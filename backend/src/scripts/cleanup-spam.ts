import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { PrismaService } from "../prisma.service";
import { Meilisearch } from "meilisearch";

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  
  const meili = new Meilisearch({
    host: process.env.MEILI_HOST || "http://localhost:7700",
    apiKey: process.env.MEILI_MASTER_KEY || "supersecretmeilisearchkey",
  });

  console.log("🧹 Bắt đầu dọn dẹp bài rác (không liên quan cầu lông)...");

  // Xóa các bài WanderingPost không thuộc hệ cầu lông
  const deletedPosts = await prisma.wanderingPost.deleteMany({
    where: {
      post_type: { notIn: ["vang_lai", "tuyen_co_dinh", "cho_thue_san"] }
    }
  });

  console.log(`✅ Đã xóa ${deletedPosts.count} bài viết phân loại rác khỏi Postgres (WanderingPost).`);

  // Xóa các bài Raw Content đã quét nhưng AI báo không phải cầu lông (bị skip nên ko có WanderingPost)
  const rawPosts = await prisma.fbRawContent.findMany({
    where: { processed: true },
    include: { parsedPost: true }
  });

  const spamRawIds = rawPosts.filter(r => !r.parsedPost).map(r => r.id);
  
  if (spamRawIds.length > 0) {
    await prisma.fbRawContent.deleteMany({
      where: { id: { in: spamRawIds } }
    });
    console.log(`✅ Đã dọn dẹp ${spamRawIds.length} bài Raw Content rác.`);
  } else {
    console.log(`✅ Không có bài Raw Content rác nào cần dọn.`);
  }

  // Đồng bộ lại MeiliSearch cho chắc ăn
  console.log("🔄 Đang xóa toàn bộ Index MeiliSearch để đồng bộ lại...");
  try {
    await meili.deleteIndex("posts");
  } catch (e) {
    // Ignore if index doesn't exist
  }
  
  const validPosts = await prisma.wanderingPost.findMany({
    where: { is_active: true },
    include: { court: true }
  });

  if (validPosts.length > 0) {
    await meili.index("posts").addDocuments(
      validPosts.map(p => ({
        id: p.id,
        court_name: p.court?.name || p.court_name,
        content: p.content_raw || p.contact_info,
        start_time: p.start_time?.getTime(),
        level_required: p.level_required,
        post_type: p.post_type,
        is_active: p.is_active
      }))
    );
    console.log(`✅ Đã đồng bộ lại ${validPosts.length} bài viết chuẩn vào MeiliSearch.`);
  }

  console.log("🎉 Hoàn tất dọn dẹp!");
  process.exit(0);
}

run();
