import { MapPin, Navigation } from "lucide-react";
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

async function getCourt(id: string) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/courts`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const courts = await res.json();
     
    return courts.find((c: any) => c.id.toString() === id);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const court = await getCourt(resolvedParams.id);
  if (!court) return { title: "Không tìm thấy sân | Đà Nẵng Badminton Hub" };
  return {
    title: `${court.name} | Đà Nẵng Badminton Hub`,
    description: `Thông tin chi tiết, địa chỉ và bản đồ của ${court.name}.`,
  };
}

export default async function CourtDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const court = await getCourt(resolvedParams.id);

  if (!court) {
    notFound();
  }

  const mapUrl = `https://www.google.com/maps?q=${court.lat},${court.lng}`;

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl min-h-[70vh]">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header Section */}
        <div className="p-8 md:p-12 border-b border-gray-100 bg-emerald-50/30">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div>
              <div className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800 mb-4">
                Thông tin sân
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
                {court.name}
              </h1>
              <div className="flex items-start gap-2 text-gray-600">
                <MapPin className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-lg leading-relaxed">{court.address}</span>
              </div>
            </div>
            
            <div className="flex flex-col gap-3 min-w-[200px]">
              <a 
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium shadow-sm"
              >
                <Navigation className="w-4 h-4" />
                Chỉ đường (Google Maps)
              </a>
              <Link 
                href={`/vang-lai?court=${encodeURIComponent(court.name)}`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-50 transition-colors font-medium"
              >
                Tìm vãng lai tại đây
              </Link>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-8 md:p-12">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Bản đồ</h2>
            <div className="aspect-video w-full rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 relative">
              {court.lat && court.lng ? (
                <iframe
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  allowFullScreen
                  src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}&q=${court.lat},${court.lng}&zoom=15`}
                ></iframe>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                  Chưa có tọa độ bản đồ
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
