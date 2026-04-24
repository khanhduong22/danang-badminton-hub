"use client";

import Link from "next/link";
import { Activity, Map, Users, ShoppingBag, Database } from "lucide-react";
import { cn } from "@/lib/utils";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center mx-auto px-4">
        <Link href="/" className="flex items-center gap-2 mr-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Activity className="h-6 w-6" />
          </div>
          <span className="font-bold text-xl tracking-tight hidden sm:inline-block">
            Danang Badminton Hub
          </span>
        </Link>
        
        <nav className="flex items-center gap-6 text-sm font-medium flex-1">
          <Link
            href="/#radar"
            className="transition-colors hover:text-primary flex items-center gap-2"
          >
            <Map className="h-4 w-4" />
            <span className="hidden sm:inline">Bản đồ Sân</span>
          </Link>
          <Link
            href="/vang-lai"
            className="transition-colors hover:text-primary flex items-center gap-2 text-muted-foreground"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Tìm Vãng Lai</span>
          </Link>
          <Link
            href="/pass-san"
            className="transition-colors hover:text-primary flex items-center gap-2 text-muted-foreground"
          >
            <Map className="h-4 w-4" />
            <span className="hidden sm:inline">Pass Sân</span>
          </Link>
          <Link
            href="/cho-do"
            className="transition-colors hover:text-primary flex items-center gap-2 text-muted-foreground"
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">Chợ Đồ</span>
          </Link>
          <Link
            href="/raw-posts"
            className="transition-colors hover:text-primary flex items-center gap-2 text-muted-foreground"
          >
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Raw Posts</span>
          </Link>
        </nav>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => alert("Tính năng Đăng nhập đang được phát triển. Mong bạn thông cảm nhé!")}
            className="h-9 px-4 py-2 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90"
          >
            Đăng nhập
          </button>
        </div>
      </div>
    </header>
  );
}
