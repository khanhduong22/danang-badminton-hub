# Software Requirements Specification (SRS) - Danang Badminton Hub

## 1. Tổng Quan Dự Án (Project Overview)
- **Tên dự án**: Danang Badminton Hub (badminton.khanhdp.com)
- **Mục tiêu**: Xây dựng nền tảng thông tin toàn diện cho cộng đồng người chơi cầu lông tại Đà Nẵng. Giải quyết các "nỗi đau" (pain points) như: Khó tìm sân trống, thiếu thông tin về chất lượng sân, khó tìm người chơi cùng trình độ (tìm vãng lai), và nhu cầu trao đổi thiết bị.
- **Đối tượng người dùng**: Người chơi cầu lông từ nghiệp dư đến phong trào, Chủ sân cầu lông (Phase 2).

---

## 2. Tính Năng Cốt Lõi (Core Features - Phase 1)
### 2.1. Bản Đồ Sân Cầu Lông (Court Radar)
- Hiển thị danh sách các sân cầu lông tại Đà Nẵng trên bản đồ tương tác.
- Lọc sân theo: Khu vực (Quận/Huyện), Giá thuê, Khung giờ hoạt động.
- Trang chi tiết sân: Hình ảnh, không gian 360 (nếu có), địa chỉ, định vị Google Maps, số lượng thảm, giá thuê, sđt liên hệ/đặt sân (Direct call/Zalo link).

### 2.2. Trạm Tìm Vãng Lai (Social Matchmaking)
- **Tự động hóa (Auto-crawler)**: Background Service thu thập dữ liệu tự động từ các nhóm Facebook cầu lông Đà Nẵng.
- Bóc tách nội dung bằng AI (Gemini/ChatGPT API) thành các trường dữ liệu có cấu trúc: `Thời gian`, `Tên sân`, `Trình độ yêu cầu`, `Số lượng còn thiếu`, `Chi phí/người`.
- Hiển thị danh sách các nhóm đang "Tuyển vãng lai" theo thời gian thực (Real-time update).
- Hỗ trợ User đăng form thủ công để tìm team trực tiếp trên web.

### 2.3. Chợ Đồ Cầu Lông (Gear Marketplace)
- Khu vực rao vặt ký gửi mua bán, trao đổi vợt, giày, phụ kiện cũ/mới.
- Phân loại theo thương hiệu (Yonex, Victor, Lining...), tình trạng (New, 2nd, Lỗi xước).
- Người mua liên hệ người bán thông qua Zalo/SĐT đính kèm một cách nhanh chóng mà không cần qua trung gian web.

---

## 3. Tính Năng Nâng Cao (Advanced Features - Phase 2)
- **Hệ thống Đánh giá Sân (Rating & Review)**: User đánh giá theo các tiêu chí thực dụng như: *Độ cao trần cáp, Chói đèn, Thảm trơn/bám, Khu vực bãi giữ xe, Độ nóng/thông gió*.
- **Matchmaking cá nhân**: Tính năng ghép đôi những người chơi rảnh rỗi ở gần nhau dựa trên trình độ kỹ năng tự đánh giá.
- **Cổng Chủ Sân (Owner Portal)**: Cho phép chủ sân tự cập nhật trạng thái sân rảnh, thay đổi liên hệ, up ảnh chuẩn và chạy quảng cáo sân lọt top đầu tìm kiếm.
- **Dịch vụ tiện ích xung quanh**: Map vị trí các tiệm đan lưới, cửa hàng bán trang phục lấy uy tín làm trọng tâm cắm mốc.

---

## 4. Kiến Trúc Cơ Sở & Công Nghệ Đề Xuất (Tech Stack)
- **Application Web Framework**: `Next.js 14+` (Sử dụng App Router tối ưu SEO cho từ khóa "Sân cầu lông Đà Nẵng").
- **Giao diện (Frontend Style)**: `TailwindCSS` kết hợp `shadcn/ui` hoặc `Framer Motion` nhằm mang lại cảm giác năng động, tốc độ và "xịn xò" của một hệ sinh thái thể thao.
- **Database & Backend Services**: `Supabase` (PostgreSQL) để cung cấp khả năng tích hợp Realtime, Auth, và Text Search mạnh mẽ. Có thể tích hợp với `Prisma ORM`.
- **Maps API**: `Mapbox GL JS` (vì nhẹ, UI/UX mượt và có hỗ trợ custom layer đẹp) hoặc `Google Maps API`.
- **Crawler Service**: `Node.js` (Puppeteer) hoặc Python chạy script schedule cronjob để cào bài FB -> Đẩy sang GenAI xử lý -> Gọi Webhook lưu file DB.

---

## 5. Cấu Trúc Dữ Liệu Cơ Bản (Database Schema Concept)
- **`Courts`**: id, name, address, latitude, longitude, contact_number, zalo_url, maps_url, image_urls, num_of_courts, price_range, tags, created_at.
- **`WanderingPosts` (Bài tìm vãng lai)**: id, court_id_ref, start_time, end_time, level_required, slot_needed, price_per_slot, source_url, content_raw, created_at.
- **`Gears` (Chợ đồ cầu lông)**: id, user_id, title, description, price, condition, brand_tags, images, contact_string.

---

## 6. Lệnh Prompt Để Kích Hoạt Agent Ở Workspace Tới
*(Copy lệnh prompt bên dưới thả vào Agent)*

> "Tôi vừa khởi tạo dự án Danang Badminton Hub. Hãy đọc nội dung file `badminton_srs.md` này. Bạn hãy đóng vai trò là Senior Fullstack Developer để triển khai phase 1 theo tài liệu:
> 1. Setup cấu trúc cơ bản ứng dụng Next.js (App Router, TailwindCSS).
> 2. Khởi tạo Base Layout với Navbar và Footer mang nét thể thao.
> 3. Dựng Landing Page / Homepage có Hero section và Map placeholder.
> 4. Chỉ cần code khung frontend trước, sử dụng file JSON mockup cho danh sách các Sân thay vì nối DB."
