const puppeteer = require("puppeteer-core"); // use puppeteer-core on VPS or fallback

// Cấu hình URL PostgREST của bạn trên Contabo (Đổi lại IP/Domain của bạn)
const POSTGREST_URL = process.env.POSTGREST_URL || "http://127.0.0.1:3000";

// ID Nhóm/Trang FB mà bạn muốn cào (Ví dụ: id nhóm cầu lông nào đó)
const FB_GROUP_URL = process.env.FB_GROUP_URL || "https://mbasic.facebook.com/groups/caulongdanang123";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runCrawler() {
  console.log("🚀 Bắt đầu khởi chạy Facebook Crawler...");
  
  // Bạn cần cấu hình browser path trên VPS, ví dụ '/usr/bin/google-chrome-stable'
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      executablePath: "/usr/bin/google-chrome-stable",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  } catch (err) {
    console.error("Lỗi khởi tạo Puppeteer. Hãy đảm bảo chạy 'npm install puppeteer' trên VPS.", err);
    process.exit(1);
  }

  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36");

  try {
    // Để cào FB ổn định, thường dùng mbasic.facebook.com
    await page.goto(FB_GROUP_URL, { waitUntil: "networkidle2" });
    
    // Tự động cuộn trang để lấy bài
    for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await sleep(2000);
    }

    // Logic DOM tuỳ thuộc vào mbasic cấu trúc
    const posts = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('div[data-ft]'));
        return items.map(item => item.innerText || "").filter(t => t.toLowerCase().includes("vãng lai") || t.toLowerCase().includes("tuyển"));
    });

    console.log(`✅ Lọc được ${posts.length} bài đăng tiềm năng. Tiếp tục bóc tách...`);

    // Gửi POST request đẩy data sang PostgREST VPS Contabo
    for (const text of posts) {
        // Dùng Regex hoặc gọi GenAI bóc tách text ở đây
        // Phía dưới là mock bóc tách cơ bản:
        const courtNameMatch = text.match(/sân\s+([a-zA-Z0-9\s]+)/i);
        
        const payload = {
            court_name_raw: courtNameMatch ? courtNameMatch[1].trim() : "Chưa rõ",
            content_raw: text,
            start_time: new Date().toISOString(), // demo time
            end_time: new Date(Date.now() + 7200000).toISOString(),
            slot_needed: text.match(/\d+/) ? parseInt(text.match(/\d+/)[0], 10) : 1,
            price_per_slot: "Liên hệ trực tiếp",
            source_url: FB_GROUP_URL
        };

        // Bắn vào DB (Bảng wandering_posts)
        try {
            const res = await fetch(`${POSTGREST_URL}/wandering_posts`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    // "Authorization": `Bearer ${process.env.PG_TOKEN}`
                },
                body: JSON.stringify(payload)
            });

            if(res.ok) {
                console.log(`🟢 Inserted: ${payload.court_name_raw}`);
            } else {
                console.log(`🔴 Lỗi Insert: ${res.statusText}`);
            }
        } catch (postErr) {
            console.error("Lỗi kết nối tới PostgREST:", postErr.message);
        }
    }

  } catch (e) {
    console.error("Crawler báo lỗi:", e);
  } finally {
    await browser.close();
    console.log("Đã đóng browser.");
  }
}

runCrawler();
