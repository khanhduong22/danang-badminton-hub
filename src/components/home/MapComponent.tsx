"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix missing marker icons in leaflet with Next.js/Webpack
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

export default function MapComponent({ courts = [] }: { courts?: any[] }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-full h-full min-h-[400px] lg:min-h-[600px] bg-emerald-50 rounded-2xl animate-pulse"></div>;
  }

  // Da Nang center
  const center: [number, number] = [16.0544, 108.2022];

  return (
    <div className="w-full h-full min-h-[400px] lg:min-h-[600px] rounded-2xl overflow-hidden shadow-sm border border-emerald-200 relative z-0">
      <MapContainer 
        center={center} 
        zoom={13} 
        scrollWheelZoom={false}
        className="w-full h-full absolute inset-0"
      >
        <TileLayer
          attribution='&copy; Google Maps'
          url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
        />
        {courts.map((court) => (
          court.latitude && court.longitude ? (
            <Marker 
              key={court.id} 
              position={[court.latitude, court.longitude]}
              icon={icon}
            >
              <Popup>
                <div className="flex flex-col gap-1 min-w-[200px]">
                  <h3 className="font-bold text-sm text-foreground m-0">{court.name}</h3>
                  <p className="text-xs text-muted-foreground m-0 leading-tight">{court.address}</p>
                  <p className="text-xs font-semibold text-emerald-600 mt-1 m-0">
                    SĐT: {court.contact_number || "Liên hệ trực tiếp"}
                  </p>
                  <a 
                    href={court.maps_url || `https://www.google.com/maps?q=${court.latitude},${court.longitude}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="mt-2 block w-full text-center bg-primary text-primary-foreground text-xs py-1.5 rounded"
                  >
                    Chỉ đường
                  </a>
                </div>
              </Popup>
            </Marker>
          ) : null
        ))}
      </MapContainer>
    </div>
  );
}
