import { Injectable, Logger } from '@nestjs/common';
import { BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const SESSION_FILE = path.join(process.cwd(), 'storage', 'fb_session.json');

@Injectable()
export class FbSessionService {
  private readonly logger = new Logger(FbSessionService.name);

  /**
   * Load session into context using this priority:
   * 1. Saved session file (refreshed cookies from previous runs)
   * 2. FB_COOKIE env var (manually pasted by user)
   *
   * NO auto-login. We never type credentials programmatically to avoid checkpoint.
   * Returns true if the loaded session is valid (not redirected to /login).
   */
  async ensureSession(context: BrowserContext, page: Page, testGroupId: string): Promise<boolean> {
    // 1. Try saved session file first (has freshest cookies)
    if (fs.existsSync(SESSION_FILE)) {
      try {
        const saved = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
        await context.addCookies(saved);
        this.logger.log(`📂 Loaded saved session (${saved.length} cookies)`);
        if (await this.checkSession(page, testGroupId)) {
          this.logger.log('✅ Saved session valid');
          return true;
        }
        this.logger.warn('⚠️ Saved session expired, falling back to FB_COOKIE env');
      } catch {
        this.logger.warn('Could not load session file, falling back to FB_COOKIE env');
      }
    }

    // 2. Inject from FB_COOKIE env var
    const rawCookie = process.env.FB_COOKIE;
    if (!rawCookie) {
      this.logger.error('❌ No FB_COOKIE env var set. Cannot proceed.');
      return false;
    }

    await this.injectCookies(context, rawCookie);
    this.logger.log('🍪 Injected cookies from FB_COOKIE env');

    // Accept cookie consent banner if shown
    await this.acceptCookieConsent(page);

    const valid = await this.checkSession(page, testGroupId);
    if (valid) {
      this.logger.log('✅ FB_COOKIE session valid');
    } else {
      this.logger.error('❌ FB_COOKIE is invalid or expired. Please refresh FB_COOKIE.');
    }
    return valid;
  }

  /**
   * Heartbeat: visit FB home to keep session alive without doing anything suspicious.
   * Call this every 6-12h. FB renews session tokens on every request,
   * so the refreshed cookies extend the session by another 90 days.
   */
  async heartbeat(context: BrowserContext, page: Page): Promise<void> {
    try {
      this.logger.log('💓 Session heartbeat: visiting FB home...');
      await page.goto('https://www.facebook.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });
      await this.acceptCookieConsent(page);
      // Gentle scroll to simulate human activity
      await page.evaluate(() => window.scrollBy(0, 300));
      await page.waitForTimeout(2000);
      await page.evaluate(() => window.scrollBy(0, 300));
      this.logger.log('💓 Heartbeat done');
    } catch (err) {
      this.logger.warn(`Heartbeat failed: ${err}`);
    }
  }

  async checkSession(page: Page, _groupId: string): Promise<boolean> {
    try {
      // Use FB homepage for a lightweight, fast session check
      await page.goto('https://www.facebook.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });
      await this.acceptCookieConsent(page);
      const url = page.url();
      // If we're still on facebook.com (not redirected to /login), session is valid
      return url.includes('facebook.com') && !url.includes('/login') && !url.includes('/checkpoint');
    } catch {
      return false;
    }
  }

  async saveSession(context: BrowserContext): Promise<void> {
    try {
      const cookies = await context.cookies();
      const fbCookies = cookies.filter((c) => c.domain.includes('facebook.com'));
      fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
      fs.writeFileSync(SESSION_FILE, JSON.stringify(fbCookies, null, 2));
      this.logger.log(`💾 Session saved (${fbCookies.length} cookies)`);
    } catch (err) {
      this.logger.warn('Could not save session:', err);
    }
  }

  private async injectCookies(context: BrowserContext, rawCookie: string): Promise<void> {
    if (!rawCookie) return;

    // Auto-detect: JSON array or Cookie-Editor export ({"cookies":[...]} or [{...}])
    const trimmed = rawCookie.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        // Cookie-Editor exports as {"url":"...","cookies":[...]} or plain array
        const cookieArr: any[] = Array.isArray(parsed) ? parsed : (parsed.cookies || []);
        const fbCookies = cookieArr
          .filter((c: any) => (c.domain || '').includes('facebook.com'))
          .map((c: any) => ({
            name: c.name,
            value: c.value,
            domain: c.domain.startsWith('.') ? c.domain : `.facebook.com`,
            path: c.path || '/',
            httpOnly: c.httpOnly ?? true,
            secure: c.secure ?? true,
            sameSite: this.mapSameSite(c.sameSite),
            expires: c.expirationDate ? Math.floor(c.expirationDate) : undefined,
          }));
        if (fbCookies.length > 0) {
          await context.addCookies(fbCookies);
          this.logger.log(`🍪 Injected ${fbCookies.length} FB cookies from JSON format`);
          return;
        }
      } catch (e) {
        this.logger.warn(`JSON cookie parse failed, falling back to string format: ${e}`);
      }
    }

    // Fallback: plain string format "name=value; name2=value2"
    const cookies = rawCookie
      .split(';')
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const [name, ...rest] = c.split('=');
        return {
          name: name.trim(),
          value: rest.join('=').trim(),
          domain: '.facebook.com',
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'None' as const,
        };
      });
    await context.addCookies(cookies);
  }

  private mapSameSite(val: string): 'Strict' | 'Lax' | 'None' {
    if (val === 'strict') return 'Strict';
    if (val === 'lax') return 'Lax';
    return 'None'; // 'no_restriction', 'unspecified', undefined → None
  }

  private async acceptCookieConsent(page: Page): Promise<void> {
    try {
      // FB shows cookie consent on fresh sessions from new IPs
      const selectors = [
        'button[data-cookiebanner="accept_button"]',
        'button[title="Allow all cookies"]',
        'button[title="Cho phép tất cả cookie"]',
        '[aria-label="Allow all cookies"]',
      ];
      for (const sel of selectors) {
        const btn = page.locator(sel);
        if ((await btn.count()) > 0) {
          this.logger.log('🍪 Cookie consent banner found, accepting...');
          await btn.first().click();
          await page.waitForTimeout(2000);
          return;
        }
      }
    } catch {
      // Ignore — consent may not appear
    }
  }
}
