"use client";

import { motion } from "framer-motion";
import Waitlist from "../components/Waitlist";

export default function GEOIndex() {
  return (
    <div className="pt-48 pb-28 px-6">
      <div className="max-w-[800px] mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-[12px] text-[#555] tracking-[0.2em] uppercase mb-5 font-mono">[ GEO Index ]</p>
          <h1 className="heading-xl mb-6">
            AI Visibility Index
          </h1>
          <p className="text-[16px] text-[#777] leading-relaxed max-w-[600px] mb-12">
            A public database of GEO audits across industries. See how major brands score across Gemini, Grok, DeepSeek, ChatGPT, Claude, Perplexity, and more.
          </p>

          <div className="card p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#111] border border-[#222] flex items-center justify-center mx-auto mb-6">
              <svg width="24" height="24" fill="none" stroke="#555" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M3 3v18h18" strokeLinecap="round" />
                <path d="M7 16l4-8 4 4 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="text-[20px] font-medium tracking-tight mb-3">Coming soon</h2>
            <p className="text-[14px] text-[#666] max-w-[400px] mx-auto leading-relaxed">
              We&apos;re auditing brands across every industry. The GEO Index will be the first public benchmark for AI engine visibility.
            </p>
          </div>

          <div className="mt-12">
            <p className="text-[14px] text-[#666] mb-6">Get notified when the GEO Index launches.</p>
            <Waitlist source="geo-index" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
