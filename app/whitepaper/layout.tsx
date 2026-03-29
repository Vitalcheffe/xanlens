"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { title: "Home", href: "/whitepaper" },
  { title: "Why XanLens Exists", href: "/whitepaper/why" },
  { title: "What XanLens Does", href: "/whitepaper/what" },
  { title: "How It Works", href: "/whitepaper/how" },
  { title: "Audit Engine", href: "/whitepaper/audit-engine" },
  { title: "Content Generation", href: "/whitepaper/content-generation" },
  { title: "Scoring Methodology", href: "/whitepaper/scoring" },
  { title: "Service Tiers", href: "/whitepaper/tiers" },
  { title: "Payments via x402", href: "/whitepaper/payments" },
  { title: "Built for Humans & Agents", href: "/whitepaper/humans-and-agents" },
  { title: "Architecture", href: "/whitepaper/architecture" },
  { title: "Roadmap", href: "/whitepaper/roadmap" },
  { title: "Get Started", href: "/whitepaper/get-started" },
];

export default function WhitepaperLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const currentIndex = sections.findIndex((s) => s.href === pathname);
  const prev = currentIndex > 0 ? sections[currentIndex - 1] : null;
  const next = currentIndex < sections.length - 1 ? sections[currentIndex + 1] : null;

  return (
    <div className="min-h-screen pt-14">
      {/* Mobile toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed top-16 left-4 z-40 p-2 rounded-lg bg-[#111] border border-[#1a1a1a] text-[#999]"
      >
        ☰
      </button>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`fixed md:sticky top-14 left-0 h-[calc(100vh-3.5rem)] w-64 border-r border-[#1a1a1a] bg-black overflow-y-auto z-30 transition-transform md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="p-6">
            <Link href="/whitepaper" className="text-[14px] font-semibold tracking-tight block mb-6">
              XanLens Whitepaper
            </Link>
            <nav className="space-y-1">
              {sections.map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`block px-3 py-2 rounded-lg text-[13px] transition-colors ${
                    pathname === s.href
                      ? "bg-white/5 text-white font-medium"
                      : "text-[#999] hover:text-white hover:bg-white/5"
                  }`}
                >
                  {s.title}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 max-w-[740px] mx-auto px-6 py-12">
          {children}

          {/* Prev / Next navigation */}
          <div className="flex justify-between mt-16 pt-8 border-t border-[#1a1a1a]">
            {prev ? (
              <Link href={prev.href} className="text-[13px] text-[#999] hover:text-white transition-colors">
                ← {prev.title}
              </Link>
            ) : <span />}
            {next ? (
              <Link href={next.href} className="text-[13px] text-[#999] hover:text-white transition-colors">
                {next.title} →
              </Link>
            ) : <span />}
          </div>
        </main>
      </div>

      {/* Backdrop for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}
