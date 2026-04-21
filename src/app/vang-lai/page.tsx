import { Clock, MapPin, Users, Ticket, ExternalLink, Star } from "lucide-react";
import SearchBar from "./search-bar";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const LEVEL_LABELS: Record<string, string> = {
  yeu: "Yếu",
  "tb-": "TB Yếu",
  tb: "Trung Bình",
  "tb+": "TB Khá",
  kha: "Khá",
  gioi: "Giỏi",
};

const LEVEL_COLORS: Record<string, string> = {
  yeu: "bg-gray-100 text-gray-700",
  "tb-": "bg-blue-100 text-blue-700",
  tb: "bg-emerald-100 text-emerald-700",
  "tb+": "bg-teal-100 text-teal-700",
  kha: "bg-orange-100 text-orange-700",
  gioi: "bg-red-100 text-red-700",
};

async function getPosts(q?: string, level?: string, type?: string) {
  try {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (level) params.set("level", level);
    if (type) params.set("type", type);

    const hasSearch = q || level || type;
    const endpoint = hasSearch
      ? `/api/search?${params.toString()}`
      : `/api/wandering-posts`;

    const res = await fetch(`${API_BASE}${endpoint}`, {
      next: { revalidate: hasSearch ? 0 : 30 },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function VangLaiPage(props: Props) {
  const sp = await props.searchParams;
  const q = sp?.q as string | undefined;
  const level = sp?.level as string | undefined;
  const type = sp?.type as string | undefined;

  const posts = await getPosts(q, level, type);

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-4">
          Tìm{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-600">
            Vãng Lai
          </span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Cập nhật liên tục các kèo đánh vãng lai tại Đà Nẵng từ cộng đồng.
          Tìm sân, tìm người chơi nhanh chóng.
        </p>
        <SearchBar />
      </div>

      {/* Active filter badges */}
      {(level || type) && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {level && (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-3 py-1 text-sm font-medium text-teal-800">
              Trình độ: {LEVEL_LABELS[level] ?? level}
            </span>
          )}
          {type && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-800">
              Loại: {type === "vang_lai" ? "Vãng lai" : type}
            </span>
          )}
        </div>
      )}

      {/* Posts grid */}
      {posts.length === 0 ? (
        <div className="text-center py-20 bg-emerald-50/50 rounded-2xl border border-emerald-100">
          <p className="text-lg text-emerald-600 font-medium">
            Hiện chưa có kèo vãng lai mới nào. Bot đang cào tự động, vui lòng
            quay lại sau ít phút...
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post: any) => {
            const startTime = post.start_time
              ? new Date(post.start_time)
              : null;
            const endTime = post.end_time ? new Date(post.end_time) : null;
            const levelLabel =
              LEVEL_LABELS[post.level_required] ?? post.level_required;
            const levelColor =
              LEVEL_COLORS[post.level_required] ?? "bg-gray-100 text-gray-700";

            return (
              <div
                key={post.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:shadow-md hover:border-emerald-200"
              >
                {/* Card header */}
                <div className="p-5 border-b bg-emerald-50/30">
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <h3 className="font-bold text-lg leading-tight line-clamp-1 group-hover:text-emerald-600 transition-colors">
                      {post.court_name || "Chưa xác định sân"}
                    </h3>
                    {post.level_required && (
                      <span
                        className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${levelColor}`}
                      >
                        <Star className="h-3 w-3 mr-1" />
                        {levelLabel}
                      </span>
                    )}
                  </div>

                  {/* Address */}
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="line-clamp-1">
                      {post.address_raw || post.court?.address || "Đà Nẵng"}
                    </span>
                  </div>
                </div>

                {/* Card body */}
                <div className="flex flex-col flex-1 p-5 gap-4">
                  {/* Raw content preview */}
                  <p className="text-sm text-foreground line-clamp-3 italic bg-muted/50 p-3 rounded-lg border border-border/50">
                    &quot;
                    {post.content_raw ||
                      post.raw_content?.post_text ||
                      "Không có nội dung"}
                    &quot;
                  </p>

                  {/* Time */}
                  {startTime && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>
                        {startTime.toLocaleString("vi-VN", {
                          weekday: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                        })}
                        {endTime &&
                          ` – ${endTime.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`}
                      </span>
                    </div>
                  )}

                  {/* Slots + Price */}
                  <div className="grid grid-cols-2 gap-3 mt-auto">
                    <div className="flex items-center gap-2 text-sm bg-blue-50/50 px-3 py-2 rounded-lg border border-blue-100/50">
                      <Users className="h-4 w-4 text-blue-500 shrink-0" />
                      <span className="font-medium text-blue-900">
                        Thiếu:{" "}
                        {post.slots_available ?? post.slot_needed ?? "?"} suất
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm bg-orange-50/50 px-3 py-2 rounded-lg border border-orange-100/50">
                      <Ticket className="h-4 w-4 text-orange-500 shrink-0" />
                      <span className="font-medium text-orange-900 line-clamp-1">
                        {post.price_per_slot || "Liên hệ"}
                      </span>
                    </div>
                  </div>

                  {/* CTA */}
                  <a
                    href={post.post_url || post.source_url || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg transition-colors shadow-sm"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Xem bài gốc
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
