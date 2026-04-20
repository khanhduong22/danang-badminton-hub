"use client";

import dynamic from "next/dynamic";

const MapComponent = dynamic(() => import("./MapComponent"), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[400px] lg:min-h-[600px] bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100 shadow-sm animate-pulse">
      <div className="text-emerald-500 font-medium">Đang tải bản đồ khu vực Đà Nẵng...</div>
    </div>
  )
});

export function MapPlaceholder() {
  return <MapComponent />;
}
