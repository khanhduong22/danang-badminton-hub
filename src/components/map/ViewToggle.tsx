"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { List, Map } from "lucide-react";

export default function ViewToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view") || "list";

  const handleToggle = (view: "list" | "map") => {
    const params = new URLSearchParams(searchParams);
    if (view === "map") {
      params.set("view", "map");
    } else {
      params.delete("view");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex bg-gray-100 p-1 rounded-xl mb-6 self-end sm:self-auto shrink-0 border border-gray-200">
      <button
        onClick={() => handleToggle("list")}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          currentView !== "map"
            ? "bg-white text-emerald-700 shadow-sm"
            : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
        }`}
      >
        <List className="w-4 h-4" />
        <span className="hidden sm:inline">Danh sách</span>
      </button>
      <button
        onClick={() => handleToggle("map")}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          currentView === "map"
            ? "bg-white text-emerald-700 shadow-sm"
            : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
        }`}
      >
        <Map className="w-4 h-4" />
        <span className="hidden sm:inline">Bản đồ</span>
      </button>
    </div>
  );
}
