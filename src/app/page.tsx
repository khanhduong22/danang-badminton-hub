import { HeroSection } from "@/components/home/HeroSection";
import { MapPlaceholder } from "@/components/home/MapPlaceholder";
import { CourtList } from "@/components/home/CourtList";

export default function Home() {
  return (
    <>
      <HeroSection />
      
      <section id="radar" className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-5 flex flex-col justify-center">
              <CourtList />
            </div>
            
            <div className="lg:col-span-7 h-full">
              <div className="sticky top-24">
                <MapPlaceholder />
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
