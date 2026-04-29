import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'playwright';

export interface ScrapedPost {
  postText: string;
  authorName: string | null;
  authorUrl: string | null;
  fbPostedAt: string | null;
  comments: { author: string; authorUrl: string | null; text: string }[];
}

// Rotate user-agents to reduce fingerprinting detection
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
];

@Injectable()
export class FbScraperCoreService {
  private readonly logger = new Logger(FbScraperCoreService.name);

  /** Pick a random user-agent for each session */
  getRandomUserAgent(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  /**
   * Inject stealth scripts to mask automation signals.
   * Must be called BEFORE page.goto() — use addInitScript so it runs on every navigation.
   */
  async injectStealthScripts(page: Page): Promise<void> {
    await page.addInitScript(() => {
      // Remove webdriver flag
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      // Spoof plugins length (real browsers have plugins)
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      // Spoof language list
      Object.defineProperty(navigator, 'languages', { get: () => ['vi-VN', 'vi', 'en-US', 'en'] });
      // Mask chrome automation runtime
      (window as any).chrome = { runtime: {} };
    });
  }

  /**
   * Dismiss the "Continue as [Name]" / "Tiếp tục" interstitial page.
   * Facebook shows this wall on headless browsers even with valid cookies.
   * It requires clicking the continue button before granting access to groups.
   */
  async dismissContinueAsWall(page: Page): Promise<boolean> {
    try {
      // Check if we're on the interstitial page by looking for known patterns
      const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
      const isInterstitial =
        bodyText.includes('Tiếp tục') ||
        bodyText.includes('Continue as') ||
        bodyText.includes('Dùng trang cá nhân khác') ||
        bodyText.includes('Use another account');

      if (!isInterstitial) return false;

      this.logger.log('🚧 Detected "Continue as" interstitial wall, attempting to bypass...');

      // Strategy 1: Click the main "Tiếp tục" / "Continue" button
      const continueSelectors = [
        // Vietnamese
        'a:has-text("Tiếp tục")',
        'button:has-text("Tiếp tục")',
        'div[role="button"]:has-text("Tiếp tục")',
        'span:has-text("Tiếp tục")',
        // English
        'a:has-text("Continue")',
        'button:has-text("Continue")',
        'div[role="button"]:has-text("Continue")',
      ];

      for (const selector of continueSelectors) {
        try {
          const el = page.locator(selector).first();
          if (await el.isVisible({ timeout: 1000 })) {
            await el.click({ timeout: 3000 });
            this.logger.log(`✅ Clicked continue button via: ${selector}`);
            // Wait for navigation after clicking
            await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
            await this.sleep(2000);
            return true;
          }
        } catch {
          // Try next selector
        }
      }

      // Strategy 2: Find the first prominent link/button that looks like a continue action
      const clicked = await page.evaluate(() => {
        const elements = document.querySelectorAll('a, button, div[role="button"], span[role="button"]');
        for (const el of elements) {
          const text = (el as HTMLElement).innerText?.trim() || '';
          if (
            /^(Tiếp tục|Continue|Continue as)/i.test(text) &&
            text.length < 50
          ) {
            (el as HTMLElement).click();
            return text;
          }
        }
        return null;
      });

      if (clicked) {
        this.logger.log(`✅ JS-clicked continue element: "${clicked}"`);
        await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
        await this.sleep(2000);
        return true;
      }

      this.logger.warn('⚠️ Could not find continue button on interstitial page');
      return false;
    } catch (err) {
      this.logger.warn(`dismissContinueAsWall error: ${err}`);
      return false;
    }
  }

  async scrapePhase1Urls(
    page: Page,
    groupId: string,
    retries = 2,
  ): Promise<{ groupId: string; postId: string; postUrl: string }[]> {
    // Try plain URL first — FB sometimes blocks feed render with ?sorting_setting param in headless
    const feedUrl = `https://www.facebook.com/groups/${groupId}`;
    this.logger.log(`📄 Phase 1: cào feed group ${groupId}`);

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        await page.goto(feedUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await this.removeLoginOverlay(page);

        // Handle Facebook's "Continue as" interstitial wall
        const wasDismissed = await this.dismissContinueAsWall(page);
        if (wasDismissed) {
          // After dismissing, we may need to navigate to the group again
          const currentUrl = page.url();
          if (!currentUrl.includes(`/groups/${groupId}`)) {
            this.logger.log('🔄 Re-navigating to group after dismissing interstitial...');
            await page.goto(feedUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await this.removeLoginOverlay(page);
          }
        }

        // Wait for group feed to hydrate (FB renders lazily after React mount)
        await this.sleep(2000);
        await page.evaluate(() => window.scrollBy(0, 400));
        await this.sleep(1000);
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await this.sleep(1500);
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await this.sleep(1500);

        // Wait for post links — FB uses /permalink/ or /posts/ in hrefs
        await page
          .waitForSelector('a[href*="/permalink/"], a[href*="/posts/"]', { timeout: 25000 })
          .catch(() => this.logger.warn(`Phase 1 attempt ${attempt}: feed selector timeout`));

        // Continue scrolling to load more posts
        const SCROLL_ROUNDS = 8;
        for (let i = 0; i < SCROLL_ROUNDS; i++) {
          await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
          await this.sleep(700 + Math.random() * 400);
          if (i % 3 === 0) await this.removeLoginOverlay(page);
        }

        const postLinks = await page.evaluate((): { postId: string; postUrl: string }[] => {
          const results: { postId: string; postUrl: string }[] = [];
          const seen = new Set<string>();
          document.querySelectorAll('a[href]').forEach((a) => {
            const href = (a as HTMLAnchorElement).href || '';
            const match =
              href.match(/\/groups\/[\w-]+\/permalink\/(\d+)/) ||
              href.match(/\/groups\/[\w-]+\/posts\/(\d+)/);
            if (match && !seen.has(match[1])) {
              seen.add(match[1]);
              results.push({ postId: match[1], postUrl: href.split('?')[0] });
            }
          });
          return results;
        });

        if (postLinks.length > 0) {
          this.logger.log(`✅ Phase 1 attempt ${attempt}: found ${postLinks.length} URLs`);
          return postLinks.map((p) => ({ groupId, ...p }));
        }

        // Diagnostic: log what FB actually showed us
        const pageSnap = await page.evaluate(() => ({
          url: document.location.href,
          title: document.title,
          bodySnippet: document.body?.innerText?.substring(0, 200).replace(/\n/g, ' ') || '',
          hasFeed: !!document.querySelector('div[role="feed"]'),
          hasMain: !!document.querySelector('div[role="main"]'),
          hasLoginForm: !!document.querySelector('form#login_popup_cta_form, input[name="email"]'),
        }));
        this.logger.warn(
          `⚠️ Phase 1 attempt ${attempt}: 0 URLs — url=${pageSnap.url} | hasFeed=${pageSnap.hasFeed} | hasMain=${pageSnap.hasMain} | hasLogin=${pageSnap.hasLoginForm} | body="${pageSnap.bodySnippet}"`,
        );
        if (attempt <= retries) await this.sleep(3000);
      } catch (err) {
        this.logger.warn(`Phase 1 attempt ${attempt} error for group ${groupId}: ${err}`);
        if (attempt > retries) break;
        await this.sleep(3000);
      }
    }
    return [];
  }

  async scrapePostDetail(page: Page, postUrl: string, postId: string): Promise<ScrapedPost | null> {
    this.logger.log(`🔍 Phase 2: scraping post ${postId}`);

    try {
      await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.removeLoginOverlay(page);
      await page
        .waitForSelector('div[role="article"], div[role="main"]', { timeout: 10000 })
        .catch(() => {});
      await this.sleep(1000); // Give React a moment to finish hydrating
    } catch {
      this.logger.warn(`Timeout loading post ${postId}`);
      return null;
    }

    // Click "Xem thêm" / "See more" to expand truncated post text
    try {
      const mainContent = page
        .locator('div[role="article"]')
        .or(page.locator('div[role="main"]'))
        .first();
      const seeMoreBtns = mainContent
        .getByText('Xem thêm', { exact: true })
        .or(mainContent.getByText('See more', { exact: true }));
      const count = await seeMoreBtns.count();
      for (let i = 0; i < count; i++) {
        try {
          if (await seeMoreBtns.nth(i).isVisible()) {
            await seeMoreBtns.nth(i).click({ timeout: 1000 });
            await this.sleep(500);
          }
        } catch (_) {}
      }
      await this.sleep(800);
    } catch (e) {
      this.logger.warn(`Error expanding post text: ${e}`);
    }

    const scraped = await page.evaluate((): ScrapedPost & { _debug?: string } => {
      const result: ScrapedPost & { _debug?: string } = {
        postText: '',
        authorName: null,
        authorUrl: null,
        fbPostedAt: null,
        comments: [],
      };

      // Anonymous: content is in role="article" or role="main" (no role="dialog" without login)
      const container =
        document.querySelector('div[role="article"]') ||
        document.querySelector('div[role="main"]') ||
        document;

      // Strategy 1: data-testid
      const postBody = container.querySelector('div[data-testid="post_message"]');
      if (postBody) {
        result.postText = (postBody as HTMLElement).textContent?.trim() || '';
      }

      // Strategy 2: Colored background posts
      if (!result.postText) {
        const bgTextEl = container.querySelector('div.x1yx25j4');
        if (bgTextEl) result.postText = (bgTextEl as HTMLElement).textContent?.trim() || '';
      }

      // Strategy 3: Longest div[dir="auto"] — main content heuristic
      if (!result.postText) {
        const candidates = Array.from(container.querySelectorAll('div[dir="auto"]'))
          .map((el) => (el as HTMLElement).textContent?.trim() || '')
          .filter((t) => t.length > 10 && t.length < 4000 && !t.includes('Facebook'));
        candidates.sort((a, b) => b.length - a.length);
        result.postText = candidates[0] || '';
      }

      // Clean up "Xem thêm" / "See more" artifacts
      if (result.postText) {
        result.postText = result.postText
          .replace(/\.\.\.\s*Xem thêm/g, '')
          .replace(/Xem thêm/g, '')
          .replace(/See more/g, '')
          .trim();
      }

      // Author
      const authorLink = container.querySelector(
        'h2 a, strong a, span a[role="link"]',
      ) as HTMLAnchorElement | null;
      if (authorLink) {
        result.authorName = authorLink.innerText.trim();
        result.authorUrl = authorLink.href;
      }

      // Timestamp
      const timeEl = document.querySelector(
        'abbr[data-utime], time[datetime]',
      ) as HTMLElement | null;
      if (timeEl) {
        result.fbPostedAt =
          timeEl.getAttribute('data-utime') || timeEl.getAttribute('datetime') || null;
      }

      // Debug info if still empty
      if (!result.postText) {
        result._debug = `URL=${document.location.href} | bodyStart=${(document.body?.innerText || '').substring(0, 80).replace(/\n/g, ' ')}`;
      }

      // Comments
      document.querySelectorAll('div[aria-label][role="article"]').forEach((commentEl) => {
        const authorEl = commentEl.querySelector('a[role="link"]') as HTMLAnchorElement | null;
        const bodyEl = commentEl.querySelector('div[dir="auto"]') as HTMLElement | null;
        const text = bodyEl?.innerText?.trim() || '';
        if (text.length > 0 && text !== result.postText) {
          result.comments.push({
            author: authorEl?.innerText.trim() || 'Unknown',
            authorUrl: authorEl?.href || null,
            text,
          });
        }
      });

      return result;
    });

    if (!scraped || !scraped.postText) {
      this.logger.warn(
        `Post ${postId} scraped empty. Debug: ${scraped?._debug || 'no debug info'}`,
      );
      return null;
    }

    this.logger.log(
      `📝 Post ${postId}: "${scraped.postText.substring(0, 80)}..." (${scraped.comments.length} comments)`,
    );
    return scraped;
  }

  public sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Remove Facebook login overlay/popup from the DOM and restore scroll.
   * Covers multiple overlay variants Facebook uses.
   */
  private async removeLoginOverlay(page: Page): Promise<void> {
    try {
      await this.sleep(600);
      await page.evaluate(() => {
        // Target the specific overlay structure bro identified
        [
          '.__fb-light-mode.x1n2onr6.xzkaem6',
          'form#login_popup_cta_form',
        ].forEach((selector) => {
          document.querySelectorAll(selector).forEach((el) => {
            const root = (el.closest('.__fb-light-mode') as HTMLElement) || (el as HTMLElement);
            root.remove();
          });
        });

        // Remove role="dialog" that wraps login forms
        document.querySelectorAll('div[role="dialog"]').forEach((dialog) => {
          const html = dialog.innerHTML;
          if (
            html.includes('login_popup_cta_form') ||
            html.includes('Log in to Facebook') ||
            html.includes('Đăng nhập vào Facebook') ||
            html.includes('See more on Facebook')
          ) {
            dialog.remove();
          }
        });

        // Restore scroll that FB locks when showing popups
        document.body.style.overflow = 'auto';
        document.body.style.position = '';
        document.documentElement.style.overflow = 'auto';
        document.documentElement.style.position = '';

        // Remove fixed backdrops that obscure content
        document.querySelectorAll<HTMLElement>('*').forEach((el) => {
          const style = window.getComputedStyle(el);
          if (
            (style.position === 'fixed' || style.position === 'sticky') &&
            (el.querySelector('form') || el.innerHTML.includes('Log in'))
          ) {
            el.remove();
          }
        });
      });
    } catch (e) {
      this.logger.warn(`removeLoginOverlay error: ${e}`);
    }
  }
}
