import Link from "next/link";
import { Activity } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t py-12 bg-muted/40 mt-auto">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="flex flex-col gap-4 col-span-1 md:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary">
                <Activity className="h-5 w-5" />
              </div>
              <span className="font-bold text-lg tracking-tight">
                Danang Badminton Hub
              </span>
            </Link>
            <p className="text-sm text-muted-foreground w-full md:w-2/3 leading-relaxed">
              Nền tảng thông tin toàn diện cho cộng đồng người chơi cầu lông tại Đà Nẵng. Tìm sân, tuyển vãng lai và trao đổi dụng cụ một cách dễ dàng và nhanh chóng nhất.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="font-semibold text-foreground">Tính năng</h3>
            <Link href="#radar" className="text-sm text-muted-foreground hover:text-primary transition-colors">Bản đồ sân cầu lông</Link>
            <Link href="#matchmaking" className="text-sm text-muted-foreground hover:text-primary transition-colors">Trạm tìm vãng lai</Link>
            <Link href="#gear" className="text-sm text-muted-foreground hover:text-primary transition-colors">Chợ đồ cầu lông</Link>
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="font-semibold text-foreground">Liên hệ</h3>
            <Link href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Về chúng tôi</Link>
            <Link href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Góp ý hệ thống</Link>
            <Link href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Hợp tác chủ sân</Link>
          </div>
        </div>
        <div className="border-t mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Danang Badminton Hub. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link href="#" className="hover:text-foreground">Privacy Policy</Link>
            <Link href="#" className="hover:text-foreground">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
