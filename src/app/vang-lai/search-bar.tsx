"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export default function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(() => {
      if (query.trim()) {
        router.push(`/vang-lai?q=${encodeURIComponent(query.trim())}`);
      } else {
        router.push(`/vang-lai`);
      }
    });
  }

  return (
    <form 
      onSubmit={handleSubmit}
      className="relative max-w-2xl mx-auto mb-10 w-full"
    >
      <div className="relative flex items-center w-full group">
        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
          <Search className="w-5 h-5 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" />
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="block w-full p-4 pl-12 text-sm text-gray-900 border border-gray-200 rounded-2xl bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm transition-all outline-none"
          placeholder="Tìm sân, lịch đánh, trình độ (ví dụ: trung bình yếu, tối nay)..."
        />
        <button
          type="submit"
          disabled={isPending}
          className="text-white absolute right-2.5 bottom-2.5 bg-emerald-600 hover:bg-emerald-700 focus:ring-4 focus:outline-none focus:ring-emerald-300 font-medium rounded-xl text-sm px-5 py-2 transition-colors disabled:opacity-75"
        >
          {isPending ? "Đang tìm..." : "Tìm Kèo"}
        </button>
      </div>
    </form>
  );
}
