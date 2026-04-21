import { Clock, MapPin, Users, Ticket } from "lucide-react";
import SearchBar from "./search-bar";

async function getWanderingPosts(q?: string) {
  try {
    const endpoint = q 
      ? `/api/search?q=${encodeURIComponent(q)}` 
      : `/api/wandering-posts`;
      
    // Call external server if NEXT_PUBLIC_API_URL is configured (in Vercel)
    // Otherwise fallback to localhost
    const url = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + endpoint;
    const res = await fetch(url, { 
      next: { revalidate: q ? 0 : 60 } // No cache for search, cache 60s for list
    });
    
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error("Lỗi fetch wandering posts:", error);
    return [];
  }
}

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function VangLaiPage(props: Props) {
  const searchParams = await props.searchParams;
  const q = searchParams?.q as string | undefined;
  
  const posts = await getWanderingPosts(q);

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-4">
          Tìm <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-600">Vãng Lai</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Cập nhật liên tục các kèo đánh vãng lai tại Đà Nẵng từ Cộng Đồng. Tìm sân, tìm người chơi nhanh chóng.
        </p>
        <SearchBar />
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-20 bg-emerald-50/50 rounded-2xl border border-emerald-100">
          <p className="text-lg text-emerald-600 font-medium">Hiện chưa có kèo vãng lai mới nào. Vui lòng quay lại sau ít phút hoặc để bot tự động cập nhật...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post: any) => (
            <div key={post.id} className="group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:shadow-md hover:border-emerald-200">
              <div className="p-5 border-b bg-emerald-50/30">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                    {post.court_name_raw}
                  </h3>
                  <span className="inline-flex items-center rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                    {new Date(post.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-2">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  <span className="line-clamp-1">{post.court?.address || "Đà Nẵng"}</span>
                </div>
              </div>

              <div className="flex flex-col flex-1 p-5 gap-4">
                <p className="text-sm text-foreground line-clamp-3 italic bg-muted/50 p-3 rounded-lg border border-border/50">
                  &quot;{post.content_raw}&quot;
                </p>

                <div className="grid grid-cols-2 gap-3 mt-auto">
                  <div className="flex items-center gap-2 text-sm bg-blue-50/50 px-3 py-2 rounded-lg border border-blue-100/50">
                    <Users className="h-4 w-4 text-blue-500" />
                    <span className="font-medium text-blue-900">Thiếu: {post.slot_needed} slot</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm bg-orange-50/50 px-3 py-2 rounded-lg border border-orange-100/50">
                    <Ticket className="h-4 w-4 text-orange-500" />
                    <span className="font-medium text-orange-900 line-clamp-1">{post.price_per_slot || "Liên hệ"}</span>
                  </div>
                </div>

                <a 
                  href={post.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 text-center w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg transition-colors shadow-sm"
                >
                  Tham gia ngay &rarr;
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
