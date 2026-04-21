import Link from "next/link";
import { ArrowRight, Search, Users } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-emerald-50 dark:bg-emerald-950/20 pt-16 md:pt-24 pb-32">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&q=80&w=2000')] bg-cover bg-center opacity-10 mix-blend-multiply pointer-events-none"></div>
      
      <div className="container relative z-10 mx-auto px-4 text-center">
        <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100/50 px-3 py-1 text-sm font-medium text-emerald-800 mb-8 backdrop-blur-sm">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
          Cập nhật hơn 30+ sân tại Đà Nẵng
        </div>
        
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground max-w-4xl mx-auto mb-6 leading-tight">
          Cộng Đồng Cầu Lông <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">
            Năng Động Nhất Đà Nẵng
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          Đập tan nỗi lo không mướn được sân, thiếu tay đánh lưới. Tìm sân rảnh, bắt cặp vãng lai và mua bán đồ nghề chỉ trong một nốt nhạc!
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/#radar" className="w-full sm:w-auto inline-flex items-center justify-center whitespace-nowrap rounded-lg text-base font-medium transition-colors h-12 px-8 bg-primary text-primary-foreground shadow-lg shadow-emerald-500/20 hover:bg-primary/90 hover:-translate-y-0.5 duration-200">
            <Search className="mr-2 h-5 w-5" />
            Tìm Sân Gần Đây
          </Link>
          <Link href="/vang-lai" className="w-full sm:w-auto inline-flex items-center justify-center whitespace-nowrap rounded-lg text-base font-medium transition-colors h-12 px-8 bg-white border border-emerald-200 text-emerald-700 shadow-sm hover:bg-emerald-50 hover:-translate-y-0.5 duration-200">
            <Users className="mr-2 h-5 w-5" />
            Tuyển Vãng Lai
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
