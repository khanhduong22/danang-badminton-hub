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
    for (let i = 0; i < 4; i++) {
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
    } catch {
      this.logger.warn(`Timeout loading post ${postId}`);
      return null;
    }

    // Click "See More" / "Xem thêm" to expand truncated post text
    try {
      const seeMoreBtns = page.getByText('Xem thêm', { exact: true }).or(page.getByText('See more', { exact: true }));
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

      // Restrict extraction to the main post container to avoid sidebars and ads
      const container = document.querySelector('div[role="article"]') || document.querySelector('div[role="main"]') || document;
      
      const postBody = container.querySelector('div[data-testid="post_message"]');
      if (postBody) {
        result.postText = (postBody as HTMLElement).innerText?.trim() || '';
      }

      if (!result.postText) {
        const candidates = Array.from(container.querySelectorAll('div[dir="auto"]'));
        const texts = candidates
          .map((el) => (el as HTMLElement).innerText?.trim() || '')
          .filter((t) => t.length > 20 && !t.includes('Facebook') && !t.includes('AWS Summit') && t.length < 3000);
        result.postText = texts[0] || '';
      }

      // Clean up text
      if (result.postText) {
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

    if (!scraped.postText) {
      this.logger.warn(`Post ${postId} scraped empty text, skipping`);
      return null;
    }

    this.logger.log(`📝 Post ${postId}: "${scraped.postText.substring(0, 60)}..." (${scraped.comments.length} comments)`);
    return scraped;
  }

  public sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
