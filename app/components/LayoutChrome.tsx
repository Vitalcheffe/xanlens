"use client";

import { usePathname } from "next/navigation";
import AuthButton from "./AuthButton";

export default function LayoutChrome() {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");

  if (isDashboard) return null;

  return (
    <>
      {/* Promo Banner */}
      <div id="promo-banner" className="fixed top-0 w-full z-[60] bg-[#2596be] text-black text-center py-2.5 px-4">
        <div className="max-w-[1400px] mx-auto">
          <a href="/pricing" className="flex md:hidden items-center justify-center gap-2 text-[12px] font-semibold">
            <span className="bg-black text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Limited Offer</span>
            <span><span className="line-through opacity-60">$4.95</span> → <span className="font-extrabold">$0.99</span></span>
            <span className="bg-black text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Get it →</span>
          </a>
          <div className="hidden md:flex items-center justify-center gap-4 text-[14px] font-semibold">
            <span className="bg-black text-white text-[11px] font-bold px-2.5 py-1 rounded uppercase tracking-wider">Limited Offer</span>
            <span>Pro Audit + Content Fixes — <span className="line-through opacity-60">$4.95</span> <span className="font-extrabold text-[15px]">$0.99 USDC</span></span>
            <span className="opacity-60">·</span>
            <span>80% off launch discount</span>
            <a href="/pricing" className="ml-2 bg-black text-white text-[12px] font-bold px-4 py-1.5 rounded-full hover:bg-white hover:text-black transition">Get it →</a>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="global-nav fixed top-[40px] w-full z-50 border-b border-[#1a1a1a] bg-black/80 backdrop-blur-xl">
        <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="" width={28} height={28} />
            <span className="text-[15px] font-semibold tracking-tight">XanLens</span>
          </a>
          <div className="hidden md:flex items-center gap-7 text-[13px] text-[#999]">
            <a href="/api-docs" className="hover:text-white transition-colors">API Docs</a>
            <a href="/methodology" className="hover:text-white transition-colors">Methodology</a>
            <a href="/pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="/whitepaper" className="hover:text-white transition-colors">Whitepaper</a>
            <a href="/geo-index" className="hover:text-white transition-colors flex items-center gap-1.5">GEO Index <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#2596be]/15 text-[#2596be] font-medium">Soon</span></a>
            <a href="/dashboard" className="btn-primary !py-2 !px-4 !text-[13px]">Dashboard →</a>
            <AuthButton />
          </div>
          <div className="flex md:hidden items-center gap-3">
            <a href="/dashboard" className="text-[13px] text-[#999] hover:text-white transition-colors">Dashboard</a>
            <AuthButton />
          </div>
        </div>
      </nav>
    </>
  );
}
