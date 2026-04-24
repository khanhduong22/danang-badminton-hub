import { Store } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chợ Đồ Cầu Lông | Đà Nẵng Badminton Hub",
  description: "Mua bán, trao đổi vợt, giày, phụ kiện cầu lông tại Đà Nẵng.",
};

export default function GearMarketplacePage() {
  return (
    <div className="container mx-auto px-4 py-20 flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="bg-emerald-100 p-4 rounded-full mb-6">
        <Store className="w-12 h-12 text-emerald-600" />
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-4 text-gray-900">
        Chợ Đồ Cầu Lông
      </h1>
      <p className="text-xl text-gray-500 mb-8 max-w-2xl">
        Tính năng mua bán, trao đổi vợt, giày và phụ kiện cầu lông đang được phát triển và sẽ sớm ra mắt.
      </p>
      <div className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm">
        Sắp Ra Mắt
      </div>
    </div>
  );
}
