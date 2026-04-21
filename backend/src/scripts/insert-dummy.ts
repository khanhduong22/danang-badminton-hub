import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { CrawlerService } from "../crawler.service";
import { GoogleGenAI } from "@google/genai";
import { MeiliSearch } from "meilisearch";

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const crawler = app.get(CrawlerService);
  
  const rawPosts = [{
    content: "Tuyển 2-3 bạn vãng lai đánh sân Kỳ Hòa tối nay lúc 18h tới 20h. Cưa tiền sân 50k, yêu cầu trình độ tb khá. Liên hệ zalo 0123.",
    url: "https://facebook.com/groups/temp/permalink/404"
  }, {
    content: "[Góc Nhặt Khách] Sân T11 chiều mai T4 từ 17h đến 19h cần tuyển 1 vãng lai trình khá cứng bao tiền sân 60 cành.",
    url: "https://facebook.com/groups/temp/permalink/405"
  }];
  
  const ai = new GoogleGenAI({});
  const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  
  for (const post of rawPosts) {
      const prompt = `Trích xuất thông tin kèo cầu lông từ bài viết sau. Hiện tại là: ${now} (Giờ VN).\nBài viết: "${post.content}"`;
      console.log("[Gemma 4 31B] Prompting AI for post:", post.content);
      
      try {
        const res = await ai.models.generateContent({
            model: "gemma-4-31b-it",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        court_name: { type: "STRING" },
                        start_time: { type: "STRING" },
                        end_time: { type: "STRING" },
                        slot_needed: { type: "INTEGER" },
                        price_per_slot: { type: "STRING" },
                        level_required: { type: "STRING" }
                    }
                }
            }
        });
        
        const parsedData = JSON.parse(res.text || res.text());
        console.log("AI PARSED:", parsedData);
        
        // Postgres
        const pgData = {
            court_name_raw: parsedData.court_name || "Sân Test",
            content_raw: post.content,
            start_time: new Date(parsedData.start_time || Date.now()),
            end_time: new Date(parsedData.end_time || Date.now()),
            slot_needed: parsedData.slot_needed || 1,
            price_per_slot: parsedData.price_per_slot || "50k",
            level_required: parsedData.level_required || "TB",
            source_url: post.url
        };
        const newPost = await (crawler as any).prisma.wanderingPost.create({ data: pgData });
        
        // Meilisearch
        const ms = new MeiliSearch({
            host: process.env.MEILI_HOST || "http://localhost:7700",
            apiKey: process.env.MEILI_MASTER_KEY || "supersecretmeilisearchkey"
        });
        await ms.index("posts").addDocuments([{
            id: newPost.id,
            court_name: newPost.court_name_raw,
            content: newPost.content_raw,
            timestamp: Date.now()
        }]);
        console.log("✅ DONE INSERT Postgres & MeiliSearch:", pgData.court_name_raw);
        
      } catch (e) {
        console.error("LỖI:", e);
      }
  }
}
run();
