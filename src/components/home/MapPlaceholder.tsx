import { MapPin } from "lucide-react";

export function MapPlaceholder() {
  return (
    <div className="w-full bg-emerald-50 rounded-2xl overflow-hidden shadow-sm border border-emerald-100 flex flex-col items-center justify-center min-h-[400px] lg:min-h-[600px] relative">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1524661135-423595f22d0b?auto=format&fit=crop&q=80&w=1200')] bg-cover bg-center opacity-20 filter grayscale"></div>
      
      <div className="relative z-10 flex flex-col items-center justify-center p-8 text-center bg-white/80 backdrop-blur-md rounded-xl max-w-md shadow-lg border border-emerald-100/50">
        <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <MapPin className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">Bản Đồ Radar Sân Cầu Lông</h3>
        <p className="text-muted-foreground mb-6">
          Khu vực hiển thị mapbox tương tác, đang tích hợp dữ liệu hệ thống các sân tại Đà Nẵng...
        </p>
        <div className="w-full bg-emerald-100 rounded-full h-2 mb-4 overflow-hidden">
          <div className="bg-emerald-500 h-2 rounded-full animate-[pulse_2s_ease-in-out_infinite] w-1/2"></div>
        </div>
        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest">
          Coming Soon
        </p>
      </div>
    </div>
  );
}
