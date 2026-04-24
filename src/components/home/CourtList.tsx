import Image from "next/image";
import Link from "next/link";
import { Phone, Navigation, Activity } from "lucide-react";

async function getCourts() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/courts`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function CourtList() {
  const courts = await getCourts();
  // Sort or pick top courts (for now just take first 9)
  const displayCourts = courts.slice(0, 9);
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Sân Nổi Bật
          </h2>
          <p className="text-muted-foreground mt-2">
            Danh sách các sân cầu lông hot nhất hiện nay
          </p>
        </div>
        <Link href="#all" className="text-sm font-medium text-primary hover:underline">
          Xem tất cả &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        { }
        {displayCourts.map((court: any) => (
          <div key={court.id} className="group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:shadow-md hover:border-emerald-200">
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
              {court.image_urls && court.image_urls.length > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={court.image_urls[0]}
                  alt={court.name}
                  className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-emerald-50 text-emerald-200">
                  <Activity className="h-12 w-12" />
                </div>
              )}
              <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-emerald-700 shadow-sm border border-emerald-100">
                {court.price_range || "Liên hệ"}
              </div>
            </div>
            
            <div className="flex flex-col flex-1 p-5">
              <div className="flex items-center justify-between mb-2">
                <Link href={`/courts/${court.id}`} className="font-bold text-lg leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                  {court.name}
                </Link>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                {court.address}
              </p>
              
              <div className="flex flex-wrap gap-2 mb-4">
                {court.tags && court.tags.map((tag: string, idx: number) => (
                  <span key={idx} className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                    {tag}
                  </span>
                ))}
              </div>
              
              <div className="mt-auto grid grid-cols-2 gap-3 pt-4 border-t">
                <a 
                  href={`https://www.google.com/maps?q=${court.lat},${court.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background py-2 text-sm font-medium transition-colors hover:bg-muted"
                >
                  <Navigation className="h-4 w-4 text-muted-foreground" />
                  Chỉ đường
                </a>
                <a 
                  href={court.zalo_url || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
                >
                  <Phone className="h-4 w-4" />
                  Đặt sân
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
