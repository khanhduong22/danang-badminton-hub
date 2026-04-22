import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { PrismaService } from './prisma.service';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Config — add group IDs here or via env FB_GROUP_IDS=id1,id2
// ---------------------------------------------------------------------------
const FB_GROUP_IDS: string[] = (
  process.env.FB_GROUP_IDS || '594956003862912'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const MAX_POSTS_PER_RUN = 10; // rate-limit: max new post details per cron tick
const POST_DELAY_MS = 1500;   // pause between post detail requests
const SESSION_FILE = path.join(process.cwd(), 'storage', 'fb_session.json');

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Cron schedules
  // -------------------------------------------------------------------------
  @Cron('*/1 16-19 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handlePeakHourCron() {
    this.logger.debug('Kích hoạt Crawlee giờ CAO ĐIỂM (1 phút/lần)');
    await this.runCrawlee();
  }

  @Cron('*/5 0-15,20-23 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handleOffPeakCron() {
    this.logger.debug('Kích hoạt Crawlee giờ THẤP ĐIỂM (5 phút/lần)');
    await this.runCrawlee();
  }

  /** Hourly: auto-deactivate posts whose end_time has passed */
  @Cron('0 * * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handleAutoDeactivate() {
    const result = await this.prisma.wanderingPost.updateMany({
      where: {
        is_active: true,
        end_time: { lte: new Date() },
      },
      data: { is_active: false },
    });
    if (result.count > 0) {
      this.logger.log(`⏰ Auto-deactivated ${result.count} expired posts`);
    }
  }

  // -------------------------------------------------------------------------
  // Main entry point
  // -------------------------------------------------------------------------
  async runCrawlee() {
    this.logger.log('🕷️ Bắt đầu cào Facebook Groups...');

    let browser: Browser | null = null;
    try {
      browser = await chromium.launch({
        headless: true,
        executablePath: process.env.CHROME_BIN || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
        ],
      });

      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        locale: 'vi-VN',
      });

      const page = await context.newPage();

      // --- Session bootstrap ---
      // Priority 1: saved session file (from previous auto-login)
      // Priority 2: auto-login with FB_EMAIL + FB_PASSWORD credentials
      // Priority 3: FB_COOKIE env var (manual fallback)
      const loggedIn = await this.ensureSession(context, page);
      if (!loggedIn) {
        this.logger.error(
          '💥 Không thể đăng nhập Facebook. Kiểm tra FB_EMAIL/FB_PASSWORD hoặc FB_COOKIE.',
        );
        return;
      }

      // Phase 1: Collect post URLs across all configured groups
      const allPostUrls: { groupId: string; postId: string; postUrl: string }[] = [];
      for (const groupId of FB_GROUP_IDS) {
        const urls = await this.phase1_collectPostUrls(page, groupId);
        allPostUrls.push(...urls);
      }
      this.logger.log(`📋 Phase 1 done: Tìm thấy ${allPostUrls.length} post URLs`);

      // Filter: only posts not yet in DB
      const existingIds = await this.getExistingFbPostIds(
        allPostUrls.map((p) => p.postId),
      );
      const newPosts = allPostUrls.filter((p) => !existingIds.has(p.postId));
      this.logger.log(`🆕 ${newPosts.length} bài mới chưa cào`);

      // Phase 2: Scrape each new post (rate-limited)
      const toProcess = newPosts.slice(0, MAX_POSTS_PER_RUN);
      for (const post of toProcess) {
        await this.phase2_scrapePostDetail(page, post);
        await this.sleep(POST_DELAY_MS);
      }

      // Persist session cookies so next run skips login
      await this.saveSession(context);

      this.logger.log(`✅ Cào xong: ${toProcess.length} bài mới nhét vào DB`);
    } catch (err) {
      this.logger.error('Crawler lỗi:', err);
    } finally {
      await browser?.close();
    }
  }

  // -------------------------------------------------------------------------
  // Session management
  // -------------------------------------------------------------------------

  /**
   * Ensures a valid FB session in `context`.
   * 1. Try loading saved session from disk
   * 2. If still not logged in → auto-login with FB_EMAIL / FB_PASSWORD on mbasic
   * 3. Fallback to FB_COOKIE env var
   * Returns true if session is valid.
   */
  private async ensureSession(context: BrowserContext, page: Page): Promise<boolean> {
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
    if (await this.checkSession(page, FB_GROUP_IDS[0])) {
      this.logger.log('✅ Session valid');
      return true;
    }

    // 3. Try auto-login with credentials
    const email = process.env.FB_EMAIL;
    const password = process.env.FB_PASSWORD;
    if (email && password) {
      this.logger.log('🔑 Đang tự đăng nhập bằng FB_EMAIL/FB_PASSWORD...');
      const loginOk = await this.autoLogin(page, email, password);
      if (loginOk) {
        await this.saveSession(context);
        return true;
      }
      this.logger.error('❌ Auto-login thất bại');
    }

    // 4. Fallback: inject FB_COOKIE from env
    const rawCookie = process.env.FB_COOKIE;
    if (rawCookie) {
      this.logger.warn('⚠️ Dùng FB_COOKIE env (manual fallback)...');
      await this.injectCookies(context, rawCookie);
      return await this.checkSession(page, FB_GROUP_IDS[0]);
    }

    return false;
  }

  /**
   * Auto-login via mbasic login form (simpler, less bot-detection than desktop).
   */
  private async autoLogin(page: Page, email: string, password: string): Promise<boolean> {
    try {
      await page.goto('https://mbasic.facebook.com/login/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Handle cookie consent wall (often appears on VPS/EU IPs)
      try {
        const cookieButton = await page.$('button[name="accept_only_essential"], button[name="accept_all"], a[href*="cookie/consent"], button[value="1"], input[value="1"][type="submit"]');
        if (cookieButton) {
          this.logger.log('🍪 Tìm thấy trang Cookie Consent, đang click bỏ qua...');
          await cookieButton.click();
          await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
        }
      } catch (err) {
        // Ignore errors if no cookie wall
      }

      // mbasic login form: input[name="email"] and input[name="pass"]
      await page.waitForSelector('input[name="email"]', { timeout: 10000 });
      await page.fill('input[name="email"]', email);
      await this.sleep(500);
      await page.fill('input[name="pass"]', password);
      await this.sleep(500);

      // Submit — Facebook often hides the actual submit input (visible=false)
      // and uses a div[role="button"]. Pressing Enter is the most robust way.
      await page.keyboard.press('Enter');
      
      // Wait for URL to change away from /login/
      try {
        await page.waitForURL((url) => !url.toString().includes('/login/'), { timeout: 20000 });
      } catch {
        // Might already be on new page — check current URL
      }

      const finalUrl = page.url();
      this.logger.log(`Login redirect → ${finalUrl}`);

      // Check if we hit a checkpoint / 2FA page
      if (finalUrl.includes('/checkpoint') || finalUrl.includes('/two_step')) {
        this.logger.error('⚠️ Facebook yêu cầu xác minh 2FA hoặc checkpoint. Dùng account khác không có 2FA.');
        return false;
      }

      // Verify session
      return !(finalUrl.includes('/login'));
    } catch (err) {
      this.logger.error('autoLogin error:', err);
      return false;
    }
  }

  /** Save current session cookies to disk for reuse */
  private async saveSession(context: BrowserContext): Promise<void> {
    try {
      const cookies = await context.cookies();
      // Only keep facebook cookies
      const fbCookies = cookies.filter((c) => c.domain.includes('facebook.com'));
      fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
      fs.writeFileSync(SESSION_FILE, JSON.stringify(fbCookies, null, 2));
      this.logger.log(`💾 Session saved (${fbCookies.length} cookies)`);
    } catch (err) {
      this.logger.warn('Could not save session:', err);
    }
  }

  // -------------------------------------------------------------------------
  // Phase 1: Collect post URLs from group feed (mbasic)
  // -------------------------------------------------------------------------
  private async phase1_collectPostUrls(
    page: Page,
    groupId: string,
  ): Promise<{ groupId: string; postId: string; postUrl: string }[]> {
    // Append ?sorting_setting=CHRONOLOGICAL to force Facebook to sort by "Newest Posts"
    // rather than "Recent Activity" so we don't miss new posts without comments.
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

    // Extract post links — match both numeric IDs and vanity group names (e.g. danangbadminton)
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

  // -------------------------------------------------------------------------
  // Phase 2: Scrape full post detail + comments (mbasic)
  // -------------------------------------------------------------------------
  private async phase2_scrapePostDetail(
    page: Page,
    post: { groupId: string; postId: string; postUrl: string },
  ): Promise<void> {
    // Use the desktop post URL (same domain/session as Phase 1)
    const postUrl = post.postUrl || `https://www.facebook.com/groups/${post.groupId}/posts/${post.postId}/`;
    this.logger.log(`🔍 Phase 2: scraping post ${post.postId}`);

    try {
      await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch {
      this.logger.warn(`Timeout loading post ${post.postId}`);
      return;
    }

    // Click "See More" / "Xem thêm" to expand truncated post text
    try {
      const seeMoreBtn = page.locator('div[data-ad-preview="message"] [role="button"]:has-text("Xem thêm"), div[data-ad-preview="message"] [role="button"]:has-text("See more")');
      if (await seeMoreBtn.count() > 0) {
        await seeMoreBtn.first().click();
        await this.sleep(500);
      }
    } catch {
      // No "See More" button — post text already fully visible
    }

    const scraped = await page.evaluate(() => {
      const result: {
        postText: string;
        authorName: string | null;
        authorUrl: string | null;
        fbPostedAt: string | null;
        comments: { author: string; authorUrl: string | null; text: string }[];
      } = {
        postText: '',
        authorName: null,
        authorUrl: null,
        fbPostedAt: null,
        comments: [],
      };

      // Desktop FB: post body in div[data-ad-preview="message"] or aria-label article
      const postBody = document.querySelector('[data-ad-preview="message"], div[data-testid="post_message"]');
      if (postBody) {
        result.postText = (postBody as HTMLElement).innerText?.trim() || '';
      }

      // Fallback: grab all dir=auto divs with substantial text
      if (!result.postText) {
        const candidates = Array.from(document.querySelectorAll('div[dir="auto"]'));
        const texts = candidates
          .map((el) => (el as HTMLElement).innerText?.trim() || '')
          .filter((t) => t.length > 30 && !t.includes('Facebook') && t.length < 3000);
        result.postText = texts[0] || '';
      }

      // Author: h2 inside the first article
      const article = document.querySelector('div[role="article"]');
      if (article) {
        const authorLink = article.querySelector('h2 a, strong a') as HTMLAnchorElement | null;
        if (authorLink) {
          result.authorName = authorLink.innerText.trim();
          result.authorUrl = authorLink.href;
        }
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
      this.logger.warn(`Post ${post.postId} scraped empty text, skipping`);
      return;
    }

    this.logger.log(`📝 Post ${post.postId}: "${scraped.postText.substring(0, 60)}..." (${scraped.comments.length} comments)`);

    try {
      await this.prisma.fbRawContent.create({
        data: {
          fb_post_id: post.postId,
          group_id: post.groupId,
          author_name: scraped.authorName,
          author_url: scraped.authorUrl,
          post_text: scraped.postText,
          comments: scraped.comments as any,
          post_url: post.postUrl,
          fb_posted_at: scraped.fbPostedAt ? this.parseRelativeTime(scraped.fbPostedAt) : null,
          processed: false,
        },
      });
      this.logger.log(`💾 Saved raw: post ${post.postId}`);
    } catch (err) {
      this.logger.error(`DB error saving raw post ${post.postId}:`, err);
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  private async checkSession(page: Page, groupId: string): Promise<boolean> {
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

  private async getExistingFbPostIds(postIds: string[]): Promise<Set<string>> {
    if (postIds.length === 0) return new Set();
    const existing = await this.prisma.fbRawContent.findMany({
      where: { fb_post_id: { in: postIds } },
      select: { fb_post_id: true },
    });
    return new Set(existing.map((r) => r.fb_post_id));
  }

  private parseRelativeTime(raw: string): Date | null {
    try {
      const data = JSON.parse(raw);
      if (data.time) return new Date(data.time * 1000);
    } catch {
      // not JSON
    }
    const now = new Date();
    const hourMatch = raw.match(/(\d+)\s*giờ/i);
    const minMatch = raw.match(/(\d+)\s*phút/i);
    if (hourMatch) now.setHours(now.getHours() - parseInt(hourMatch[1]));
    if (minMatch) now.setMinutes(now.getMinutes() - parseInt(minMatch[1]));
    return now;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
