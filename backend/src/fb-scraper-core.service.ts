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

  async scrapePhase1Urls(
    page: Page,
    groupId: string,
    retries = 2,
  ): Promise<{ groupId: string; postId: string; postUrl: string }[]> {
    const feedUrl = `https://www.facebook.com/groups/${groupId}?sorting_setting=CHRONOLOGICAL`;
    this.logger.log(`📄 Phase 1: cào feed group ${groupId} (Mới nhất)`);

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        await page.goto(feedUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await this.removeLoginOverlay(page);

        // Wait for actual feed content to appear
        await page
          .waitForSelector('div[role="feed"], div[role="main"]', { timeout: 15000 })
          .catch(() => {});

        // Scroll gradually to trigger lazy-loading, re-check overlay every 3 rounds
        const SCROLL_ROUNDS = 12;
        for (let i = 0; i < SCROLL_ROUNDS; i++) {
          await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
          await this.sleep(800 + Math.random() * 400); // add jitter
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

        this.logger.warn(
          `⚠️ Phase 1 attempt ${attempt}: 0 URLs found for group ${groupId}. ${attempt <= retries ? 'Retrying...' : 'Giving up.'}`,
        );
        await this.sleep(3000);
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
