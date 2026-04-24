import { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

export const metadata: Metadata = {
  title: "Raw Scraped Posts",
  description: "Raw data from Facebook crawler",
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function getRawPosts() {
  try {
    const res = await fetch(`${API_BASE}/api/raw-posts`, {
      next: { revalidate: 0 }, // Always fetch fresh data for debugging
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export default async function RawPostsPage() {
  const posts = await getRawPosts();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Raw Scraped Posts</h1>
        <p className="text-muted-foreground">
          Toàn bộ dữ liệu thô (chưa qua màng lọc AI) vừa cào được từ Facebook.
        </p>
      </div>

      <div className="rounded-md border bg-white overflow-x-auto shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 whitespace-nowrap font-semibold">Tác giả</th>
              <th className="px-4 py-3 whitespace-nowrap font-semibold">Thời gian cào</th>
              <th className="px-4 py-3 whitespace-nowrap font-semibold">Trạng thái AI</th>
              <th className="px-4 py-3 font-semibold min-w-[500px]">Nội dung gốc</th>
              <th className="px-4 py-3 whitespace-nowrap font-semibold">Link FB</th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Chưa có dữ liệu cào được.
                </td>
              </tr>
            ) : (
               
              posts.map((post: any) => (
                <tr key={post.id} className="border-b hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium whitespace-nowrap">
                    {post.author_name || "Unknown"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {formatDistanceToNow(new Date(post.scraped_at), { addSuffix: true, locale: vi })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {post.processed ? (
                      <span className="px-2 py-1 text-xs rounded-full bg-emerald-100 text-emerald-700 font-medium">
                        Đã xử lý
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-700 font-medium">
                        Chờ xử lý
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="max-w-2xl whitespace-pre-wrap leading-relaxed">
                      {post.post_text}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <a
                      href={post.post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium"
                    >
                      Xem bài đăng
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
