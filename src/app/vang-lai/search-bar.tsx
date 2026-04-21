"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

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
  const [showFilters, setShowFilters] = useState(
    !!(searchParams.get("level") || searchParams.get("type"))
  );
  const [isPending, startTransition] = useTransition();

  function buildUrl() {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (level) params.set("level", level);
    return `/vang-lai${params.toString() ? `?${params.toString()}` : ""}`;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(() => router.push(buildUrl()));
  }

  function clearAll() {
    setQuery("");
    setLevel("");
    startTransition(() => router.push("/vang-lai"));
  }

  const hasFilters = query || level;

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
        <div className="flex flex-wrap gap-2 items-center bg-gray-50 rounded-xl p-3 border border-gray-100">
          <span className="text-xs font-medium text-gray-500 mr-1">Trình độ:</span>
          {LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => setLevel(l.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                level === l.value
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-emerald-400 hover:text-emerald-700"
              }`}
            >
              {l.label}
            </button>
          ))}
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
