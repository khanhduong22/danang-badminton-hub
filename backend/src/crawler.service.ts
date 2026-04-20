import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as puppeteer from 'puppeteer-core';
import { PrismaService } from './prisma.service';

const FB_GROUP_URL = process.env.FB_GROUP_URL || "https://mbasic.facebook.com/groups/caulongdanang123";

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Chạy mỗi 1 phút vào các giờ cao điểm: từ 17:00 đến 19:59 (GMT+7 Ho Chi Minh)
  @Cron('*/1 17-19 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handlePeakHourCron() {
    this.logger.debug('Kích hoạt Crawler giờ CAO ĐIỂM (1 phút/lần)');
    await this.runCrawler();
  }

  // Chạy mỗi 5 phút vào các giờ thấp điểm (các giờ còn lại)
  @Cron('*/5 0-16,20-23 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handleOffPeakCron() {
    this.logger.debug('Kích hoạt Crawler giờ THẤP ĐIỂM (5 phút/lần)');
    await this.runCrawler();
  }

  async runCrawler() {
    this.logger.log("🕷️ Bắt đầu cào dữ liệu Facebook tìm vãng lai...");

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.CHROME_BIN || "/usr/bin/google-chrome-stable",
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });
    } catch (err) {
      this.logger.error("Lỗi khởi tạo Puppeteer", err);
      return;
    }

    try {
      const page = await browser.newPage();
      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36");

      await page.goto(FB_GROUP_URL, { waitUntil: "networkidle2" });
      
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      for (let i = 0; i < 3; i++) {
          await page.evaluate(() => window.scrollBy(0, window.innerHeight));
          await sleep(2000);
      }

      const posts = await page.evaluate(() => {
          const items = Array.from(document.querySelectorAll('div[data-ft]'));
          return items.map(item => (item as HTMLElement).innerText || "").filter(t => t.toLowerCase().includes("vãng lai") || t.toLowerCase().includes("tuyển"));
      });

      this.logger.log(`✅ Lọc được ${posts.length} bài đăng tiềm năng từ group.`);

      for (const text of posts) {
          const courtNameMatch = text.match(/sân\s+([a-zA-Z0-9\s]+)/i);
          const courtNameRaw = courtNameMatch ? courtNameMatch[1].trim() : "Chưa xác định";
          
          try {
              await this.prisma.wanderingPost.create({
                data: {
                  court_name_raw: courtNameRaw,
                  content_raw: text,
                  start_time: new Date(), 
                  end_time: new Date(Date.now() + 7200000), // Mặc định 2 giờ
                  slot_needed: text.match(/\d+/) ? parseInt(text.match(/\d+/)![0], 10) : 1,
                  price_per_slot: "Liên hệ trực tiếp",
                  source_url: FB_GROUP_URL
                }
              });
              this.logger.log(`🟢 Đã lưu bài tìm vãng lai tại: ${courtNameRaw}`);
          } catch (dbErr) {
              this.logger.error("Lỗi insert DB:", dbErr);
          }
      }
    } catch (e) {
      this.logger.error("Crawler báo lỗi nội bộ:", e);
    } finally {
      await browser.close();
      this.logger.log("Đã đóng browser.");
    }
  }
}
