import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { GoogleGenAI } from '@google/genai';
import { PrismaService } from './prisma.service';
import { Meilisearch } from 'meilisearch';
import { FbRawContent } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const AI_MODEL = process.env.AI_MODEL || 'gemma-4-31b-it';
const BATCH_SIZE = 5; // Process N raw posts per cron tick

/** AI response schema returned by Gemma 4 */
interface AiClassification {
  post_type: 'vang_lai' | 'tuyen_co_dinh' | 'cho_thue_san' | 'khac';
  court_name: string | null;
  address: string | null;
  start_time: string | null; // ISO 8601 +07:00
  end_time: string | null;   // ISO 8601 +07:00
  level_required: string | null; // "yeu" | "tb-" | "tb" | "tb+" | "kha" | "gioi"
  slots_available: number;
  price_per_slot: string | null;
  contact_info: string | null;
  confidence: number; // 0-1
}

@Injectable()
export class AiClassifierService {
  private readonly logger = new Logger(AiClassifierService.name);
  private readonly ai: GoogleGenAI;
  private readonly meili: Meilisearch;

  constructor(private readonly prisma: PrismaService) {
    this.ai = new GoogleGenAI({});
    this.meili = new Meilisearch({
      host: process.env.MEILI_HOST || 'http://localhost:7700',
      apiKey: process.env.MEILI_MASTER_KEY || 'supersecretmeilisearchkey',
    });
  }

  /** Run every 2 minutes to process newly scraped raw content */
  @Cron('*/2 * * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handleClassifyCron() {
    await this.processUnclassified();
  }

  async processUnclassified(): Promise<void> {
    const unprocessed = await this.prisma.fbRawContent.findMany({
      where: { processed: false },
      orderBy: { scraped_at: 'asc' },
      take: BATCH_SIZE,
    });

    if (unprocessed.length === 0) return;

    this.logger.log(`🧠 AI Classifier: processing ${unprocessed.length} raw posts`);
    for (const raw of unprocessed) {
      await this.classifyOne(raw);
    }
  }

  async classifyOne(raw: FbRawContent): Promise<void> {
    const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

    // Build context: post text + first 5 comments (most relevant info)
    const comments = Array.isArray(raw.comments) ? (raw.comments as any[]) : [];
    const commentContext = comments
      .slice(0, 5)
      .map((c: any) => `  - ${c.author}: ${c.text}`)
      .join('\n');

    const prompt = `
Bạn là AI phân loại bài viết từ nhóm cầu lông Đà Nẵng (tiếng Việt, có thể viết tắt, viết lóng).
Hiện tại là: ${now} (Giờ Việt Nam, +07:00).

BÀI VIẾT:
"""
${raw.post_text}
"""

${commentContext ? `BÌNH LUẬN ĐẦU TIÊN:\n${commentContext}` : ''}

Hãy trích xuất thông tin có cấu trúc từ bài viết trên. Nếu không có thông tin, để null.
Quy tắc quan trọng:
1. "pass sân", "nhượng sân" -> post_type = "cho_thue_san".
2. "VL", "vl" = vãng lai -> post_type = "vang_lai".
3. Quy tắc level_required: "yeu"=yếu, "tb-"=trung bình yếu, "tb"=trung bình, "tb+"=trung bình khá, "kha"=khá, "gioi"=giỏi.

TỪ LÓNG / VIẾT TẮT TÊN SÂN:
- "pinpon", "pp", "pin pon" = Sân PinPon
- "ktruc", "kiến trúc" = Sân Kiến Trúc
- "tls", "tl" = Cung Tiên Sơn
- "index", "sân số 6", "số 6" + (Trịnh Công Sơn/Ngũ Hành Sơn/Cẩm Lệ) = Sân INDEXSport + khu vực đó
- "army" = Sân ARMY Badminton
- "icon" = Sân ICON Badminton
- "ace" = Sân ACE Badminton
- "arena" = Sân Arena.01
- "hunter" = Sân Hunter
- "long" = Sân LONG Badminton
- "t&t", "tnt" = Sân T&T Badminton

DANH SÁCH SÂN ĐÃ BIẾT (chuẩn hóa court_name về tên đúng):
- Cung Tiên Sơn (01A Phan Đăng Lưu, Hải Châu)
- Sân Quân khu 5 (07 Duy Tân, Hải Châu)
- Sân Phan Châu Trinh (405 Phan Châu Trinh, Hải Châu)
- TT Văn hóa Thể thao Q. Thanh Khê (21 Hồ Tương, Thanh Khê)
- Sân Tin Sport (107 Trường Chinh, Thanh Khê)
- Sân Kỳ Đồng (121 Kỳ Đồng, Thanh Khê)
- TT Văn hóa Thể thao Q. Sơn Trà (01 Trần Quang Diệu, Sơn Trà)
- Sân PinPon (KCN An Đồn, Sơn Trà)
- Sân Aurora (KCN An Đồn, Sơn Trà)
- Sân Cầu Lông Win Win (642 Tôn Đức Thắng, Liên Chiểu)
- TT Huấn luyện & Đào tạo TDTT (190 Đường Loan, Cẩm Lệ)
- Sân Đỗ Ngọc Du (34 Đỗ Ngọc Du, Thanh Khê)
- Sân trường ĐH TDTT TP. Đà Nẵng (44 Dũng Sĩ Thanh Khê, Thanh Khê)
- Sân cầu lông UK Academy (Tôn Thất Đạm, Thanh Khê)
- Sân INDEXSport Ngũ Hành Sơn (81C Lê Văn Hiến, Ngũ Hành Sơn)
- Sân INDEXSport Trịnh Công Sơn (12 Trịnh Công Sơn, Thanh Khê)
- Sân INDEXSPORT Cẩm Lệ (448 Mẹ Thứ, Cẩm Lệ)
- Sân Phúc Đăng (39 Thanh Lương 19, Cẩm Lệ)
- Sân Kingsport (85 Tôn Thất Dương Kỵ, Cẩm Lệ)
- Sân BetaEra (275 Nguyễn Tri Phương, Hải Châu)
- Sân Trọng Nghĩa 1 (458 Nguyễn Tri Phương, Hải Châu)
- TT Thể thao Hải Châu (49 Tân An 3, Hải Châu)
- Sân 04 Lê Duẩn (04 Lê Duẩn, Hải Châu)
- Sân Đa Phước (KĐT Đa Phước, Hải Châu)
- Sân Bưu Điện (50B Nguyễn Du, Hải Châu)
- Sân Trọng Nghĩa 2 (194 Bế Văn Đàn, Thanh Khê)
- Sân CĐ Thương Mại (45 Dũng Sĩ Thanh Khê, Thanh Khê)
- CLB An Khê (178 Nguyễn Đình Tựu, Thanh Khê)
- Sân ACE Badminton (257 Dũng Sĩ Thanh Khê, Thanh Khê)
- Sân Wings / CĐ Nghề Đà Nẵng (132 Tô Hiến Thành, Sơn Trà)
- Sân An Đồn 5.5 (KCN An Đồn, Sơn Trà)
- Sân Hồ Nghinh (Sơn Trà)
- Sân Arena.01 (40 Hoàng Văn Thái, Liên Chiểu)
- Sân Hunter (459 Tôn Đức Thắng, Liên Chiểu)
- Sân AlphaEra (Cạnh Mikazuki, Liên Chiểu)
- Sân Làng Hòa Mỹ (K120 Nguyễn Huy Tưởng, Liên Chiểu)
- Sân Min Tom (108 Hoàng Minh Thảo, Liên Chiểu)
- Sân Hiếu Con (172-182 Đỗ Quỳ, Cẩm Lệ)
- Nhà Thi Đấu Hòa Xuân (01A Dương Loan, Cẩm Lệ)
- Sân Hoa Cam (02 Trường Sơn, Cẩm Lệ)
- Sân Dương Gia Hòa Xuân (207 Quách Thị Trang, Cẩm Lệ)
- Sân Mỹ An (382 Ngũ Hành Sơn, Ngũ Hành Sơn)
- TT Văn hóa Thể thao Q. Ngũ Hành Sơn (01B Trần Văn Đán, Ngũ Hành Sơn)
- Sân Thiên Vũ (Hòa Quý, Ngũ Hành Sơn)
- Sân LONG Badminton (Hòa Quý, Ngũ Hành Sơn)
- Sân T&T Badminton (534 Phạm Hùng, Hòa Vang)
- Sân Lâm Gia (17 Bàu Năng, Liên Chiểu)
- Sân ARMY Badminton (Phạm Ngọc Mậu, Thanh Khê)
- Sân ICON Badminton (122 Tôn Đản, Cẩm Lệ)

QUAN TRỌNG: Khi trích xuất court_name, hãy CHUẨN HÓA về đúng tên từ danh sách trên.
Ví dụ: "sân số 6 Trịnh Công Sơn" → "Sân INDEXSport Trịnh Công Sơn", "sân index" → tùy theo địa chỉ, "army" → "Sân ARMY Badminton".
Nếu không chắc chắn về tên chính xác, hãy chọn tên gần nhất theo địa chỉ.

Hãy NỖ LỰC TỐI ĐA suy luận tên sân từ từ lóng/viết tắt, tuyệt đối đừng để court_name null nếu bài có nhắc tới địa điểm.
Trả về JSON hợp lệ theo schema đã định nghĩa.
`.trim();

    try {
      const response = await this.ai.models.generateContent({
        model: AI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              post_type: {
                type: 'STRING',
                enum: ['vang_lai', 'tuyen_co_dinh', 'cho_thue_san', 'khac'],
                description: 'Loại bài viết',
              },
              court_name: { type: 'STRING', description: 'Tên sân cầu lông', nullable: true },
              address: { type: 'STRING', description: 'Địa chỉ sân', nullable: true },
              start_time: {
                type: 'STRING',
                description: 'Thời gian bắt đầu ISO 8601 với +07:00, ví dụ 2026-04-22T09:00:00+07:00',
                nullable: true,
              },
              end_time: {
                type: 'STRING',
                description: 'Thời gian kết thúc ISO 8601 với +07:00',
                nullable: true,
              },
              level_required: {
                type: 'STRING',
                description: 'Trình độ yêu cầu: yeu|tb-|tb|tb+|kha|gioi',
                nullable: true,
              },
              slots_available: {
                type: 'INTEGER',
                description: 'Số suất còn cần tuyển',
              },
              price_per_slot: {
                type: 'STRING',
                description: 'Chi phí mỗi người, ví dụ 50k',
                nullable: true,
              },
              contact_info: {
                type: 'STRING',
                description: 'Số điện thoại hoặc Zalo để liên hệ',
                nullable: true,
              },
              confidence: {
                type: 'NUMBER',
                description: 'Độ tin cậy 0-1 rằng đây là bài tuyển vãng lai hợp lệ',
              },
            },
            required: ['post_type', 'slots_available', 'confidence'],
          },
        },
      });

      const text = response.text || '';
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const ai: AiClassification = JSON.parse(cleaned);

      // --- FILTER ADS & INVALID POSTS ---
      // The user noted that posts without a clear court_name are almost always ads/spam.
      // We also drop posts explicitly classified as 'khac' (other) or low confidence.
      const isSpamOrAd = ai.post_type === 'khac' || !ai.court_name || ai.confidence < 0.5;

      if (isSpamOrAd) {
        if (raw.post_url) {
          try {
            const logPath = path.join(process.cwd(), 'storage', 'spam_urls.log');
            fs.appendFileSync(logPath, `[${now}] ${raw.post_url}\n`);
          } catch (e) {
            this.logger.error('Failed to write to spam_urls.log', e);
          }
        }
        this.logger.warn(
          `🗑️ Bỏ qua bài rác/quảng cáo: [${ai.post_type}] court="${ai.court_name || 'N/A'}" conf=${ai.confidence} | post ${raw.fb_post_id}`
        );
        // Mark raw as processed but DO NOT create WanderingPost
        await this.prisma.fbRawContent.update({
          where: { id: raw.id },
          data: { processed: true },
        });
        return;
      }

      let courtId: number | null = null;
      if (ai.court_name) {
        const allCourts = await this.prisma.court.findMany();
        const match = allCourts.find(c => 
          ai.court_name?.toLowerCase().includes(c.name.toLowerCase()) || 
          c.name.toLowerCase().includes(ai.court_name?.toLowerCase() || '')
        );
        if (match) courtId = match.id;
      }

      // Save structured post
      const created = await this.prisma.wanderingPost.create({
        data: {
          raw_content_id: raw.id,
          post_type: ai.post_type,
          court_id: courtId,
          court_name: ai.court_name,
          address_raw: ai.address || null,
          start_time: ai.start_time ? new Date(ai.start_time) : null,
          end_time: ai.end_time ? new Date(ai.end_time) : null,
          level_required: ai.level_required || null,
          slots_available: ai.slots_available ?? 1,
          price_per_slot: ai.price_per_slot || null,
          contact_info: ai.contact_info || null,
          post_url: raw.post_url,
          author_url: raw.author_url,
          content_raw: raw.post_text,
          ai_confidence: ai.confidence ?? null,
          is_active: true,
          source_url: raw.post_url,
        },
      });

      // Mark raw as processed
      await this.prisma.fbRawContent.update({
        where: { id: raw.id },
        data: { processed: true },
      });

      // Index in Meilisearch
      await this.indexInMeili(created, raw, ai);

      this.logger.log(
        `✅ Classified: [${ai.post_type}] "${ai.court_name || 'N/A'}" | conf=${ai.confidence} | post ${raw.fb_post_id}`,
      );
    } catch (err) {
      this.logger.error(`AI/DB error for raw post ${raw.id}:`, err);
      // Don't mark as processed — will retry next cron
    }
  }

  private async indexInMeili(
    post: any,
    raw: FbRawContent,
    ai: AiClassification,
  ): Promise<void> {
    try {
      await this.meili.index('posts').addDocuments([
        {
          id: post.id,
          post_type: ai.post_type,
          court_name: ai.court_name || '',
          address: ai.address || '',
          level_required: ai.level_required || '',
          price_per_slot: ai.price_per_slot || '',
          contact_info: ai.contact_info || '',
          content: raw.post_text,
          author_name: raw.author_name || '',
          post_url: raw.post_url,
          start_time: post.start_time ? new Date(post.start_time).getTime() : null,
          is_active: post.is_active,
          confidence: ai.confidence,
          scraped_at: new Date(raw.scraped_at).getTime(),
        },
      ]);
    } catch (err) {
      this.logger.warn(`Meilisearch indexing failed for post ${post.id}:`, err);
    }
  }
}
