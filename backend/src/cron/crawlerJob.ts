import cron from 'node-cron';
import puppeteer from 'puppeteer-core';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FB_GROUP_URL = process.env.FB_GROUP_URL || "https://mbasic.facebook.com/groups/caulongdanang123";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runCrawler() {
  console.log("🕷️ Bắt đầu cào dữ liệu Facebook tìm vãng lai...");

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      // Cấu hình Chrome dành riêng cho môi trường Docker Alpine/Debian
      executablePath: process.env.CHROME_BIN || "/usr/bin/google-chrome-stable",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  } catch (err) {
    console.error("Lỗi khởi tạo Puppeteer:", err);
    return;
  }

  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36");

  try {
    await page.goto(FB_GROUP_URL, { waitUntil: "networkidle2" });
    
    // Tự động cuộn trang
    for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await sleep(2000);
    }

    const posts = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('div[data-ft]'));
        return items.map(item => (item as HTMLElement).innerText || "").filter(t => t.toLowerCase().includes("vãng lai") || t.toLowerCase().includes("tuyển"));
    });

    console.log(`✅ Lọc được ${posts.length} bài đăng tiềm năng từ group.`);

    // Xử lý song song lưu vào DB
    for (const text of posts) {
        const courtNameMatch = text.match(/sân\s+([a-zA-Z0-9\s]+)/i);
        const courtNameRaw = courtNameMatch ? courtNameMatch[1].trim() : "Chưa xác định";
        
        try {
            await prisma.wanderingPost.create({
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
            console.log(`🟢 Đã lưu bài tìm vãng lai tại: ${courtNameRaw}`);
        } catch (dbErr) {
            console.error("Lỗi insert DB:", dbErr);
        }
    }

  } catch (e) {
    console.error("Crawler báo lỗi:", e);
  } finally {
    await browser.close();
    console.log("Đã đóng browser.");
  }
}

export function startCrawlerCron() {
  // Chạy crawler mỗi 30 phút. 
  cron.schedule('*/30 * * * *', () => {
    runCrawler();
  });
  console.log("⏰ Đã đăng ký tác vụ tự động Crawler (Chạy mỗi 30 phút).");
  
  // Dùng để test khi vừa khởi động
  // runCrawler(); 
}
