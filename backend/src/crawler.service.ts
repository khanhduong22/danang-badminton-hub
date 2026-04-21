import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PuppeteerCrawler, ProxyConfiguration } from 'crawlee';
import { PrismaService } from './prisma.service';
import { Meilisearch } from 'meilisearch';

const FB_GROUP_URL = process.env.FB_GROUP_URL || "https://mbasic.facebook.com/groups/594956003862912";

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

  constructor(private readonly prisma: PrismaService) {}

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

  async runCrawlee() {
    this.logger.log("🕷️ Bắt đầu Crawlee cào nhóm Facebook...");

    // Thiết lập Proxy nếu có trong .env
    let proxyConfiguration: ProxyConfiguration | undefined;
    if (process.env.PROXY_URL) {
      this.logger.log("Gắn chạy qua Proxy Webshare: " + process.env.PROXY_URL);
      proxyConfiguration = new ProxyConfiguration({
        proxyUrls: [process.env.PROXY_URL],
      });
    }

    const crawler = new PuppeteerCrawler({
      proxyConfiguration,
      // Tính năng chạy ngầm (true) hoặc hiện UI nếu test local
      headless: process.env.NODE_ENV === 'production' || process.env.NODE_ENV === undefined,
      maxRequestRetries: 2,
      launchContext: {
        launchOptions: {
          executablePath: process.env.CHROME_BIN || undefined,
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
        }
      },
      // Middleware trước khi request bơi đi
      preNavigationHooks: [
        async (crawlingContext) => {
          const { page } = crawlingContext;
          // Set Fingerprint tĩnh nhẹ
          await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36");
          
          // Nạp Session Cookie nếu có  (Định dạng: c_user=123; xs=456)
          if (process.env.FB_COOKIE) {
            const rawCookies = process.env.FB_COOKIE.split(';').map(c => c.trim()).filter(Boolean);
            const cookies = rawCookies.map(c => {
              const [name, ...rest] = c.split('=');
              return { name, value: rest.join('='), domain: '.facebook.com' };
            });
            await page.setCookie(...cookies);
          }
        }
      ],
      // Xử lý chính mạch Request
      requestHandler: async ({ page, request, log }) => {
        log.info(`Đang truy cập ${request.url}...`);
        
        // Mbasic đôi khi dính Checkpoint chuyển qua URL /login
        const currentUrl = page.url();
        if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint')) {
          log.error("💥 Session/Cookie bị văng hoặc chặn! Yêu cầu thay Cookie mới.");
          return;
        }

        // AutoScroll 3 lần
        const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
        for (let i = 0; i < 3; i++) {
          await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
          await sleep(1500);
        }

        // Trích xuất văn bản từ thẻ
        const posts = await page.evaluate(() => {
          const items = Array.from(document.querySelectorAll('div, p, span'));
          const strings = items.map(item => (item as HTMLElement).innerText || "").filter(t => t.length > 20);
          return Array.from(new Set(strings));
        });

        const vangLaiPosts = posts.filter(t => t.toLowerCase().includes("vãng lai") || t.toLowerCase().includes("tuyển"));

        log.info(`✅ Bóc tách được ${vangLaiPosts.length} bài đăng tiềm năng`);

        for (const text of vangLaiPosts) {
          const courtNameMatch = text.match(/sân\s+([a-zA-Z0-9\s]+)/i);
          const courtNameRaw = courtNameMatch ? courtNameMatch[1].trim().slice(0, 50) : "Chưa xác định";
          
          try {
              // UpSert dựa theo độ dài nội dung để không lưu trùng bài cũ
              const existing = await this.prisma.wanderingPost.findFirst({
                where: { content_raw: text }
              });

              if (!existing) {
                const newPost = await this.prisma.wanderingPost.create({
                  data: {
                    court_name_raw: courtNameRaw,
                    content_raw: text,
                    start_time: new Date(), 
                    end_time: new Date(Date.now() + 7200000), 
                    slot_needed: text.match(/\d+/) ? parseInt(text.match(/\d+/)![0], 10) : 1,
                    price_per_slot: "Liên hệ trực tiếp",
                    source_url: FB_GROUP_URL
                  }
                });
                
                try {
                  const ms = new Meilisearch({
                    host: process.env.MEILI_HOST || 'http://localhost:7700',
                    apiKey: process.env.MEILI_MASTER_KEY || 'supersecretmeilisearchkey'
                  });

                  await ms.index('posts').addDocuments([{
                    id: newPost.id,
                    court_name: courtNameRaw,
                    content: text,
                    timestamp: Date.now()
                  }]);
                  log.info(`🟢 Đã ném vào Database và MeiliSearch một bài vãng lai cho sân: ${courtNameRaw}`);
                } catch (msErr) {
                  log.error("MeiliSearch Lỗi nhúng data:", msErr);
                }
              }
          } catch (dbErr) {
              log.error("Database Lỗi:", dbErr);
          }
        }
      },
      failedRequestHandler: ({ request, log }) => {
        log.error(`Request ${request.url} failed qua nhieu lan thử: \n${request.errorMessages}`);
      },
    });

    // Chạy Engine với uniqueKey ngẫu nhiên để ép Crawlee không bỏ qua Request cũ
    await crawler.run([
      { url: FB_GROUP_URL, uniqueKey: Date.now().toString() }
    ]);
  }
}
