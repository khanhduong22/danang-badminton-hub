import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Cron } from '@nestjs/schedule';
import { chromium, Browser } from 'playwright';
import { Meilisearch } from 'meilisearch';
import { FbSessionService } from './fb-session.service';
import { FbScraperCoreService } from './fb-scraper-core.service';

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

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fbSession: FbSessionService,
    private readonly fbScraper: FbScraperCoreService,
  ) { }

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

  /** Every 6h: warm up FB session so cookies never expire from inactivity */
  @Cron('0 */6 * * *')
  async handleSessionHeartbeat() {
    this.logger.log('💓 Kích hoạt heartbeat giữ session FB...');
    const { browser, context, page } = await this.launchBrowser();
    try {
      const loaded = await this.fbSession.ensureSession(context, page, FB_GROUP_IDS[0]);
      if (loaded) {
        await this.fbSession.heartbeat(context, page);
        await this.fbSession.saveSession(context);
        this.logger.log('✅ Session heartbeat done, cookies refreshed');
      } else {
        this.logger.error('❌ Heartbeat failed — FB_COOKIE may be expired, please refresh it');
      }
    } catch (err) {
      this.logger.error('Heartbeat error:', err);
    } finally {
      await browser.close();
    }
  }

  // -------------------------------------------------------------------------
  // Main entry point
  // -------------------------------------------------------------------------
  @Cron('*/30 * * * *')
  async handleRecheckActivePostsCron() {
    this.logger.debug('Kích hoạt Cron Recheck Active Posts (30 phút/lần)');
    try {
      await this.recheckActivePosts();
    } catch (err) {
      this.logger.error('Lỗi khi recheck active posts:', err);
    }
  }

  async runCrawlee() {
    this.logger.log('🕷️ Bắt đầu cào Facebook Groups...');

    let browser: Browser | null = null;
    try {
      const proxyPassword = process.env.APIFY_PROXY_PASSWORD;
      const launchOptions: any = {
        headless: true,
        executablePath: process.env.CHROME_BIN || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
        ],
      };

      // Route through Apify Residential Proxy (Vietnamese IP) to bypass FB datacenter detection
      if (proxyPassword) {
        launchOptions.proxy = {
          server: 'http://proxy.apify.com:8000',
          username: 'auto',
          password: `${proxyPassword},country-VN`,
        };
        this.logger.log('🌐 Using Apify Residential Proxy (VN)');
      } else {
        this.logger.warn('⚠️ APIFY_PROXY_PASSWORD not set, using direct connection (may be blocked by FB)');
      }

      browser = await chromium.launch(launchOptions);

      const context = await browser.newContext({
        userAgent: this.fbScraper.getRandomUserAgent(),
        locale: 'vi-VN',
        viewport: { width: 1366, height: 768 },
        timezoneId: 'Asia/Ho_Chi_Minh',
      });

      const page = await context.newPage();
      await this.fbScraper.injectStealthScripts(page);

      // --- Session bootstrap via cookie (no auto-login) ---
      const loggedIn = await this.fbSession.ensureSession(context, page, FB_GROUP_IDS[0]);
      if (!loggedIn) {
        this.logger.error('💥 Session invalid. Update FB_COOKIE env and redeploy.');
        return;
      }

      // Phase 1: Collect post URLs across all configured groups
      const allPostUrls: { groupId: string; postId: string; postUrl: string }[] = [];
      for (const groupId of FB_GROUP_IDS) {
        const urls = await this.fbScraper.scrapePhase1Urls(page, groupId);
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
        const postPage = await context.newPage();
        const scraped = await this.fbScraper.scrapePostDetail(postPage, post.postUrl, post.postId);
        await postPage.close();

        if (scraped) {
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
        await this.fbScraper.sleep(POST_DELAY_MS);
      }

      // Save refreshed session cookies for next run
      await this.fbSession.saveSession(context);

      this.logger.log(`✅ Cào xong: ${toProcess.length} bài mới nhét vào DB`);
    } catch (err) {
      this.logger.error('Crawler lỗi:', err);
    } finally {
      await browser?.close();
    }
  }

  // -------------------------------------------------------------------------
  // Auto-deactivate Full Posts
  // -------------------------------------------------------------------------
  async recheckActivePosts() {
    const activePosts = await this.prisma.wanderingPost.findMany({
      where: {
        is_active: true,
        start_time: { gte: new Date() }, // Only posts that haven't started yet
        post_url: { not: null },
      },
      include: { raw_content: true },
    });

    if (activePosts.length === 0) return;

    this.logger.log(`🔄 Rechecking ${activePosts.length} active posts...`);

    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });
      const page = await context.newPage();

      // Session bootstrap bypassed
      this.logger.log('Loading session for recheck...');
      const loggedIn = await this.fbSession.ensureSession(context, page, FB_GROUP_IDS[0]);
      if (!loggedIn) {
        this.logger.error('💥 Session invalid for recheck.');
        return;
      }

      let closedCount = 0;
      // Slang dictionary for closed badminton matches
      const isClosedRegex = /(?<!chưa\s)(?<!không\s)(đã\s+)?(full|đủ|chốt|pass|xong|kín|đóng|hủy)/i;

      for (const post of activePosts) {
        try {
          const scraped = await this.fbScraper.scrapePostDetail(page, post.post_url!, post.id.toString());
          if (!scraped) continue;

          let shouldClose = false;

          // Check if post text explicitly says "đã full"
          if (scraped.postText && isClosedRegex.test(scraped.postText)) {
            shouldClose = true;
          }

          // Check comments by author
          for (const comment of scraped.comments) {
            const isAuthor =
              (post.author_url && comment.authorUrl && comment.authorUrl === post.author_url) ||
              (post.raw_content?.author_name && comment.author === post.raw_content.author_name);
            if (isAuthor && isClosedRegex.test(comment.text)) {
              shouldClose = true;
              break;
            }
          }

          if (shouldClose) {
            this.logger.log(`❌ Đã full/chốt: Post ${post.id}`);
            await this.prisma.wanderingPost.update({
              where: { id: post.id },
              data: { is_active: false },
            });

            const meili = new Meilisearch({
              host: process.env.MEILI_HOST || 'http://localhost:7700',
              apiKey: process.env.MEILI_MASTER_KEY || 'supersecretmeilisearchkey',
            });
            await meili.index('posts').updateDocuments([{ id: post.id, is_active: false }]);
            closedCount++;
          }
        } catch (err: any) {
          this.logger.warn(`Failed to recheck post ${post.id}: ${err.message}`);
        }

        await this.sleep(POST_DELAY_MS);
      }

      this.logger.log(`✅ Recheck xong. Đã đóng ${closedCount} bài viết.`);
    } catch (err) {
      this.logger.error('Lỗi khi chạy recheckActivePosts:', err);
    } finally {
      await browser?.close();
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

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

  private async launchBrowser() {
    const proxyPassword = process.env.APIFY_PROXY_PASSWORD;
    const launchOptions: any = {
      headless: true,
      executablePath: process.env.CHROME_BIN || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
    };

    if (proxyPassword) {
      launchOptions.proxy = {
        server: 'http://proxy.apify.com:8000',
        username: 'auto',
        password: `${proxyPassword},country-VN`,
      };
    }

    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      userAgent: this.fbScraper.getRandomUserAgent(),
      locale: 'vi-VN',
      viewport: { width: 1366, height: 768 },
      timezoneId: 'Asia/Ho_Chi_Minh',
    });
    const page = await context.newPage();
    await this.fbScraper.injectStealthScripts(page);
    return { browser, context, page };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
