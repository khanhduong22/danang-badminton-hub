"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, useEffect } from "react";

interface Court {
  id: number;
  name: string;
}

const LEVELS = [
  { value: "", label: "Mọi trình độ" },
  { value: "yeu", label: "Yếu" },
  { value: "tb-", label: "TB Yếu" },
  { value: "tb", label: "Trung Bình" },
  { value: "tb+", label: "TB Khá" },
  { value: "kha", label: "Khá" },
  { value: "gioi", label: "Giỏi" },
];

export default function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [level, setLevel] = useState(searchParams.get("level") || "");
  const [area, setArea] = useState(searchParams.get("area") || "");
  const [court, setCourt] = useState(searchParams.get("court") || "");
  const [showFilters, setShowFilters] = useState(
    !!(searchParams.get("level") || searchParams.get("area") || searchParams.get("court"))
  );
  const [isPending, startTransition] = useTransition();
  const [courts, setCourts] = useState<Court[]>([]);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/courts`)
      .then((res) => res.json())
      .then((data) => setCourts(data))
      .catch((err) => console.error("Failed to load courts", err));
  }, []);

  function buildUrl() {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (level) params.set("level", level);
    if (area) params.set("area", area);
    if (court) params.set("court", court);
    return `/vang-lai${params.toString() ? `?${params.toString()}` : ""}`;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(() => router.push(buildUrl()));
  }

  function clearAll() {
    setQuery("");
    setLevel("");
    setArea("");
    setCourt("");
    startTransition(() => router.push("/vang-lai"));
  }

  const hasFilters = query || level || area || court;

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto mb-6 w-full space-y-3">
      {/* Search input */}
      <div className="relative flex items-center w-full group">
        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
          <Search className="w-5 h-5 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" />
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="block w-full p-4 pl-12 pr-32 text-sm text-gray-900 border border-gray-200 rounded-2xl bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm transition-all outline-none"
          placeholder="Tìm sân, giờ, trình độ (ví dụ: trung bình, tối nay)..."
        />
        <div className="absolute right-2.5 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`p-2 rounded-xl transition-colors ${showFilters ? "bg-emerald-100 text-emerald-700" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
            title="Bộ lọc"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="text-white bg-emerald-600 hover:bg-emerald-700 font-medium rounded-xl text-sm px-4 py-2 transition-colors disabled:opacity-75"
          >
            {isPending ? "..." : "Tìm"}
          </button>
        </div>
      </div>

      {/* Filter row */}
      {showFilters && (
        <div className="flex flex-col gap-3 bg-gray-50 rounded-xl p-4 border border-gray-100">
          {/* Level */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-medium text-gray-500 mr-1 min-w-[60px]">Trình độ:</span>
            {LEVELS.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setLevel(l.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  level === l.value
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                    : "bg-white text-gray-600 border-gray-200 hover:border-emerald-400 hover:text-emerald-700"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Area & Court */}
          <div className="flex flex-wrap gap-4 items-center mt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 min-w-[60px]">Khu vực:</span>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="text-sm border-gray-200 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 py-1.5 px-3 bg-white outline-none cursor-pointer"
              >
                <option value="">Mọi khu vực</option>
                <option value="Hải Châu">Quận Hải Châu</option>
                <option value="Thanh Khê">Quận Thanh Khê</option>
                <option value="Sơn Trà">Quận Sơn Trà</option>
                <option value="Ngũ Hành Sơn">Quận Ngũ Hành Sơn</option>
                <option value="Liên Chiểu">Quận Liên Chiểu</option>
                <option value="Cẩm Lệ">Quận Cẩm Lệ</option>
                <option value="Hòa Vang">Huyện Hòa Vang</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 ml-1">Sân:</span>
              <select
                value={court}
                onChange={(e) => setCourt(e.target.value)}
                className="text-sm border-gray-200 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 py-1.5 px-3 bg-white outline-none cursor-pointer"
              >
                <option value="">Mọi sân</option>
                {courts.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {hasFilters && (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-red-500 hover:text-red-700 font-medium ml-auto flex items-center gap-1 px-2 py-1 rounded-md hover:bg-red-50 transition-colors"
              >
                <X className="w-3 h-3" /> Xóa bộ lọc
              </button>
            )}
          </div>
        </div>
      )}

      {/* Clear all */}
      {hasFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors mx-auto"
        >
          <X className="h-3 w-3" /> Xóa bộ lọc
        </button>
      )}
    </form>
  );
}
