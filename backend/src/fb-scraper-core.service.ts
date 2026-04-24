import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'playwright';

export interface ScrapedPost {
  postText: string;
  authorName: string | null;
  authorUrl: string | null;
  fbPostedAt: string | null;
  comments: { author: string; authorUrl: string | null; text: string }[];
}

@Injectable()
export class FbScraperCoreService {
  private readonly logger = new Logger(FbScraperCoreService.name);

  async scrapePhase1Urls(
    page: Page,
    groupId: string,
  ): Promise<{ groupId: string; postId: string; postUrl: string }[]> {
    // Append ?sorting_setting=CHRONOLOGICAL to force Facebook to sort by "Newest Posts"
    const feedUrl = `https://www.facebook.com/groups/${groupId}?sorting_setting=CHRONOLOGICAL`;
    this.logger.log(`📄 Phase 1: cào feed group ${groupId} (Sắp xếp: Mới nhất)`);

    try {
      await page.goto(feedUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch {
      this.logger.warn(`Timeout loading feed for group ${groupId}`);
      return [];
    }

    // Scroll to trigger lazy loading of posts
    for (let i = 0; i < 15; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
      await this.sleep(1200);
    }

    // Extract post links
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

    return postLinks.map((p) => ({ groupId, ...p }));
  }

  async scrapePostDetail(page: Page, postUrl: string, postId: string): Promise<ScrapedPost | null> {
    this.logger.log(`🔍 Phase 2: scraping post ${postId}`);

    try {
      await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      // Wait for either the dialog, article container, or main container to appear
      await page.waitForSelector('div[role="dialog"], div[role="article"], div[role="main"]', { timeout: 10000 }).catch(() => {});
      await this.sleep(1000); // Give React a moment to finish hydrating
    } catch {
      this.logger.warn(`Timeout loading post ${postId}`);
      return null;
    }

    // Click "See More" / "Xem thêm" to expand truncated post text
    try {
      const mainContent = page.locator('div[role="dialog"]').or(page.locator('div[role="main"]')).or(page.locator('div[role="article"]')).first();
      const seeMoreBtns = mainContent.getByText('Xem thêm', { exact: true }).or(mainContent.getByText('See more', { exact: true }));
      const count = await seeMoreBtns.count();
      for (let i = 0; i < count; i++) {
        try {
          if (await seeMoreBtns.nth(i).isVisible()) {
            await seeMoreBtns.nth(i).click({ timeout: 1000 });
            await this.sleep(500);
          }
        } catch (e) {}
      }
      await this.sleep(800); // Give it time to expand the DOM
    } catch (e) {
      this.logger.warn(`Error expanding post text: ${e}`);
    }

    const scraped = await page.evaluate((): ScrapedPost => {
      const result: ScrapedPost = {
        postText: '',
        authorName: null,
        authorUrl: null,
        fbPostedAt: null,
        comments: [],
      };

      // FB might render post in a dialog if logged in, or article/main otherwise
      const container = document.querySelector('div[role="dialog"]') || document.querySelector('div[role="article"]') || document.querySelector('div[role="main"]') || document;
      
      const postBody = container.querySelector('div[data-testid="post_message"]');
      if (postBody) {
        result.postText = (postBody as HTMLElement).textContent?.trim() || '';
      }

      // Fallback 1: Colored background posts (which use specific container classes instead of post_message)
      if (!result.postText) {
        const bgTextElement = container.querySelector('div.x1yx25j4');
        if (bgTextElement) {
          result.postText = (bgTextElement as HTMLElement).textContent?.trim() || '';
        }
      }

      // Fallback 2: Generic div[dir="auto"] extraction (sort by length to get the main content)
      if (!result.postText) {
        const candidates = Array.from(container.querySelectorAll('div[dir="auto"]'));
        const texts = candidates
          .map((el) => (el as HTMLElement).textContent?.trim() || '')
          .filter((t) => t.length > 5 && !t.includes('Facebook') && !t.includes('AWS Summit') && t.length < 3000);
        
        // Sort by length descending, assuming the longest text is the actual post content
        texts.sort((a, b) => b.length - a.length);
        result.postText = texts[0] || '';
      }

      // Detect Login Wall ("Se connecter" / "Log in")
      const fullBodyText = document.querySelector('body')?.innerText || '';
      if (!result.postText && (fullBodyText.includes('Se connecter') || fullBodyText.includes('Log In') || fullBodyText.includes('Đăng nhập'))) {
         result.postText = '[LOGIN_WALL_DETECTED]';
      }

      // Clean up text
      if (result.postText && result.postText !== '[LOGIN_WALL_DETECTED]') {
        result.postText = result.postText.replace(/\.\.\.\s*Xem thêm/g, '').replace(/Xem thêm/g, '').trim();
      }

      // Author
      const authorLink = container.querySelector('h2 a, strong a, span a[role="link"]') as HTMLAnchorElement | null;
      if (authorLink) {
        result.authorName = authorLink.innerText.trim();
        result.authorUrl = authorLink.href;
      }

      // Timestamp: abbr or time element
      const timeEl = document.querySelector('abbr[data-utime], time[datetime]') as HTMLElement | null;
      if (timeEl) {
        result.fbPostedAt = timeEl.getAttribute('data-utime') || timeEl.getAttribute('datetime') || null;
      }

      // Hack to return debug info: we'll attach the url to authorUrl just for debugging if postText is empty
      if (!result.postText || result.postText === '[LOGIN_WALL_DETECTED]') {
        result.authorUrl = document.location.href;
        result.authorName = fullBodyText.substring(0, 50).replace(/\n/g, ' ') || '';
        
        if (result.postText === '[LOGIN_WALL_DETECTED]') {
           result.postText = ''; // Clear it so it still logs as empty but we know why
        }
      }

      // Comments: div[aria-label] blocks inside comment threads
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
      this.logger.warn(`Post ${postId} scraped empty text. URL: ${scraped?.authorUrl}, BodyStart: ${scraped?.authorName}, skipping`);
      return null;
    }

    this.logger.log(`📝 Post ${postId}: "${scraped.postText.substring(0, 60)}..." (${scraped.comments.length} comments)`);
    return scraped;
  }

  public sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
