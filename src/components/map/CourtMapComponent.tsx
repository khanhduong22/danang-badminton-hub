"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Clock, Users, Ticket, MapPin } from "lucide-react";

// Fix Leaflet's default icon path issues in Next.js
const iconUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
const iconRetinaUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
const shadowUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface Post {
  id: number;
  post_type: string;
  start_time: string | null;
  end_time: string | null;
  level_required: string | null;
  slots_available: number;
  price_per_slot: string | null;
  contact_info: string | null;
  post_url: string | null;
  court: {
    id: number;
    name: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
}

interface CourtMapProps {
  posts: Post[];
}

const FALLBACK_COORDS: Record<string, [number, number]> = {
  "tiên sơn": [16.0355, 108.2238],
  "tuyên sơn": [16.0355, 108.2238],
  "win win": [16.0381, 108.2162],
  "kỳ đồng": [16.0682, 108.1751],
  "đa phước": [16.0827, 108.2045],
  "kiến trúc": [16.0336, 108.2227],
  "bách khoa": [16.0738, 108.1499],
  "cẩm lệ": [16.0125, 108.2104],
  "hòa xuân": [15.9926, 108.2230],
  "quân khu 5": [16.0461, 108.2154],
  "sơn trà": [16.0759, 108.2384],
  "kỳ hòa": [16.0685, 108.1760],
  "04 lê duẩn": [16.0754, 108.2223],
  "dương gia": [15.9961, 108.2215]
};

function getCoords(court: Post["court"]): [number, number] | null {
  if (court?.latitude && court?.longitude) return [court.latitude, court.longitude];
  if (!court?.name) return null;
  const name = court.name.toLowerCase();
  for (const [key, coords] of Object.entries(FALLBACK_COORDS)) {
    if (name.includes(key)) return coords;
  }
  return null;
}

export default function CourtMapComponent({ posts }: CourtMapProps) {
  // Group posts by court
  const courtsMap = new Map<number, { court: Post["court"]; posts: Post[] }>();

  posts.forEach((post) => {
    const coords = getCoords(post.court);
    if (post.court && coords) {
      if (!courtsMap.has(post.court.id)) {
        courtsMap.set(post.court.id, { 
          court: { ...post.court, latitude: coords[0], longitude: coords[1] }, 
          posts: [] 
        });
      }
      courtsMap.get(post.court.id)!.posts.push(post);
    }
  });

  const courts = Array.from(courtsMap.values());

  // Default to Da Nang center
  const center: [number, number] = [16.0544, 108.2022];

  return (
    <div className="h-[600px] w-full rounded-2xl overflow-hidden border border-gray-200 shadow-sm z-0 relative">
      <MapContainer center={center} zoom={13} className="h-full w-full" scrollWheelZoom={true}>
        <TileLayer
          attribution='&copy; Google Maps'
          url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
        />

        {courts.map(({ court, posts }) => {
          if (!court || !court.latitude || !court.longitude) return null;

          return (
            <Marker key={court.id} position={[court.latitude, court.longitude]}>
              <Popup className="custom-popup" minWidth={280}>
                <div className="p-1">
                  <h3 className="font-bold text-gray-900 text-base mb-1">{court.name}</h3>
                  <p className="text-gray-500 text-xs mb-3 flex items-start gap-1">
                    <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{court.address}</span>
                  </p>
                  
                  <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                    {posts.map((post) => (
                      <div key={post.id} className="bg-gray-50 border border-gray-100 rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-emerald-700 bg-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                            {post.level_required || "Mọi trình độ"}
                          </span>
                          <span className="text-xs font-medium text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded-md shadow-sm">
                            Thiếu {post.slots_available}
                          </span>
                        </div>
                        
                        <div className="space-y-1 mt-2">
                          <div className="flex items-center text-xs text-gray-600">
                            <Clock className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                            {post.start_time
                              ? new Date(post.start_time).toLocaleTimeString("vi-VN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Đang cập nhật"}
                            {post.end_time && ` - ${new Date(post.end_time).toLocaleTimeString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}`}
                          </div>
                          
                          {(post.price_per_slot || post.contact_info) && (
                            <div className="flex items-center text-[11px] text-gray-500 mt-1 pt-1 border-t border-gray-100">
                              {post.price_per_slot && (
                                <span className="flex items-center mr-3">
                                  <Ticket className="w-3 h-3 mr-1" />
                                  {post.price_per_slot}
                                </span>
                              )}
                              {post.contact_info && (
                                <span className="flex items-center truncate">
                                  {post.contact_info}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {post.post_url && (
                          <a
                            href={post.post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 block text-center text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md py-1.5 transition-colors"
                          >
                            Xem bài viết FB
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      
      {/* CSS to override leaflet z-index so it doesn't overlap with Next.js navbars */}
      <style dangerouslySetInnerHTML={{ __html: `
        .leaflet-container {
          z-index: 10;
        }
        .leaflet-pane {
          z-index: 10;
        }
        .leaflet-top, .leaflet-bottom {
          z-index: 20;
        }
        .custom-popup .leaflet-popup-content-wrapper {
          border-radius: 12px;
          padding: 0;
          overflow: hidden;
        }
        .custom-popup .leaflet-popup-content {
          margin: 12px;
        }
      `}} />
    </div>
  );
}
