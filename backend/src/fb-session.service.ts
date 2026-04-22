import { Injectable, Logger } from '@nestjs/common';
import { BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const SESSION_FILE = path.join(process.cwd(), 'storage', 'fb_session.json');

@Injectable()
export class FbSessionService {
  private readonly logger = new Logger(FbSessionService.name);

  /**
   * Ensures a valid FB session in `context`.
   * 1. Try loading saved session from disk
   * 2. If still not logged in → auto-login with FB_EMAIL / FB_PASSWORD on mbasic
   * 3. Fallback to FB_COOKIE env var
   * Returns true if session is valid.
   */
  async ensureSession(context: BrowserContext, page: Page, testGroupId: string): Promise<boolean> {
    // 1. Load saved session
    if (fs.existsSync(SESSION_FILE)) {
      try {
        const saved = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
        await context.addCookies(saved);
        this.logger.log('📂 Loaded saved session from disk');
      } catch {
        this.logger.warn('Could not load session file, will re-login');
      }
    }

    // 2. Check if session is valid
    if (await this.checkSession(page, testGroupId)) {
      this.logger.log('✅ Session valid');
      return true;
    }

    // 3. Try auto-login with credentials
    const email = process.env.FB_EMAIL;
    const password = process.env.FB_PASSWORD;
    if (email && password) {
      this.logger.log('🔑 Đang tự đăng nhập bằng FB_EMAIL/FB_PASSWORD...');
      const success = await this.autoLogin(page, email, password);
      if (success) {
        this.logger.log('✅ Auto-login thành công!');
        await this.saveSession(context);
        return true;
      } else {
        this.logger.error('❌ Auto-login thất bại');
      }
    }

    // 4. Try manual cookie fallback
    this.logger.warn('⚠️ Dùng FB_COOKIE env (manual fallback)...');
    await this.injectCookies(context, process.env.FB_COOKIE || '');
    return await this.checkSession(page, testGroupId);
  }

  async checkSession(page: Page, groupId: string): Promise<boolean> {
    try {
      await page.goto(`https://www.facebook.com/groups/${groupId}`, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });
      const url = page.url();
      return !url.includes('/login') && !url.includes('/checkpoint');
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

  private async clickCookieConsent(page: Page) {
    try {
      const consentBtn = page.locator('button[data-cookiebanner="accept_button"]');
      if ((await consentBtn.count()) > 0) {
        this.logger.log('🍪 Tìm thấy trang Cookie Consent, đang click bỏ qua...');
        await consentBtn.first().click();
        await page.waitForTimeout(3000);
      }
    } catch (e) {
      // ignore
    }
  }

  private async autoLogin(page: Page, email: string, pass: string): Promise<boolean> {
    try {
      await page.goto('https://mbasic.facebook.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      await this.clickCookieConsent(page);

      const emailInput = page.locator('input[name="email"]');
      if ((await emailInput.count()) === 0) {
        return true; // Already logged in
      }

      await emailInput.fill(email);
      await page.locator('input[name="pass"]').fill(pass);

      // Press Enter to submit form instead of clicking submit button
      // to bypass Facebook's anti-bot div wrappers
      await page.keyboard.press('Enter');
      await page.waitForLoadState('domcontentloaded', { timeout: 30000 });

      // Save device if prompted
      if (page.url().includes('save-device')) {
        const saveBtn = page.locator('input[value="OK"]');
        if ((await saveBtn.count()) > 0) {
          await saveBtn.first().click();
          await page.waitForLoadState('domcontentloaded');
        }
      }

      const currentUrl = page.url();
      return !currentUrl.includes('login') && !currentUrl.includes('checkpoint');
    } catch (err) {
      this.logger.error('autoLogin error:', err);
      return false;
    }
  }
}
