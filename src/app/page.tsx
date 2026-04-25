import { HeroSection } from "@/components/home/HeroSection";
import { MapPlaceholder } from "@/components/home/MapPlaceholder";
import { CourtList } from "@/components/home/CourtList";

async function getCourts() {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://144.91.88.242:3001";
    // Ensure we don't end up with double slashes if NEXT_PUBLIC_API_URL has trailing slash
    const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    const res = await fetch(`${baseUrl}/api/courts`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export default async function Home() {
  const courts = await getCourts();

  return (
    <>
      <HeroSection />
      
      <section id="radar" className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-5 flex flex-col justify-center">
              <CourtList courts={courts} />
            </div>
            
            <div className="lg:col-span-7 h-full">
              <div className="sticky top-24">
                <MapPlaceholder courts={courts} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Decorative divider */}
      <div className="h-1 w-full bg-gradient-to-r from-emerald-100 via-primary to-teal-100 opacity-20"></div>
    </>
  );
}
