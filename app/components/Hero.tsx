"use client";

import React from "react";
import { motion } from "framer-motion";
import { fade, AI_ENGINES } from "./shared";

function RotatingEngine() {
  const [index, setIndex] = React.useState(0);
  const [fading, setFading] = React.useState(false);

  React.useEffect(() => {
    const interval = setInterval(() => {
      // Dissolve out
      setFading(true);
      // Swap + dissolve in
      setTimeout(() => {
        setIndex((i) => (i + 1) % AI_ENGINES.length);
        setFading(false);
      }, 800);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const engine = AI_ENGINES[index];

  return (
    <div
      className="flex items-center justify-center gap-4 md:gap-5"
      style={{
        height: "clamp(3.5rem, 7vw, 5.5rem)",
        opacity: fading ? 0 : 1,
        filter: fading ? "blur(6px)" : "blur(0px)",
        transition: "opacity 0.8s ease-in-out, filter 0.8s ease-in-out",
      }}
    >
      <img src={engine.logo} alt={engine.name} className="h-10 w-10 md:h-14 md:w-14 lg:h-16 lg:w-16" />
      <span className="text-2xl md:text-4xl lg:text-5xl font-semibold tracking-tight">{engine.name}</span>
    </div>
  );
}

/* Hero tiers moved to Pricing section */

export default function Hero() {
  const [mode, setMode] = React.useState<"human" | "agent">("human");

  return (
    <section className="pt-44 sm:pt-56 pb-20 sm:pb-28 px-4 sm:px-6">
      <motion.div className="max-w-7xl mx-auto" initial="hidden" animate="visible" variants={fade}>
        <div className="text-center mb-20">
          <span className="tag mb-10 inline-block">Generative Engine Optimization</span>
          <h1 className="heading-xl heading-gradient mb-6">We get you recommended by</h1>
          <div className="flex justify-center mb-6"><RotatingEngine /></div>
          <p className="text-[12px] text-[#555] tracking-[0.15em] font-mono mb-12">Built by agents, for agents.</p>

          {/* Human / Agent toggle */}
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-14 px-4 sm:px-0">
            {(["human", "agent"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-6 sm:px-8 py-3 sm:py-4 rounded-xl border-2 transition-all duration-300 text-center w-full sm:w-auto sm:min-w-[180px] ${
                  mode === m ? "border-white text-white bg-white/5" : "border-[#222] text-[#666] hover:border-[#444] hover:text-[#999]"
                }`}
              >
                <span className="text-[15px] font-medium block">I&apos;m {m === "human" ? "a Human" : "an Agent"}</span>
              </button>
            ))}
          </div>

          {/* Human path */}
          {mode === "human" && (
            <div className="transition-all duration-500 opacity-100">
              <p className="body-lg max-w-[520px] mx-auto mb-10">
                Your brand exists. But when someone asks AI, you're not there. Your agent can fix that — starting now.
              </p>
              <a href="/dashboard" className="btn-primary text-[15px] px-10 py-4">
                Audit your brand →
              </a>
              <p className="mt-5 text-[13px]">
                <a href="https://x.com/xanlens_" target="_blank" rel="noopener noreferrer" className="text-[#888] hover:text-white transition-colors">Get a free coupon on <span className="text-white font-medium">𝕏</span></a>
              </p>
            </div>
          )}

          {/* Agent path */}
          {mode === "agent" && (
            <div className="transition-all duration-500 opacity-100">
              <p className="body-lg max-w-[560px] mx-auto mb-8">
                REST API with x402 payments. No keys, no accounts — just send a URL and pay with USDC.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <a href="/api-docs" className="inline-flex items-center gap-2 text-[13px] border border-[#333] rounded-full px-5 py-2.5 hover:border-white hover:text-white transition-all font-mono tracking-wide">
                  API DOCS <span className="text-[10px]">↗</span>
                </a>
                <a href="https://clawhub.ai/FeyDeFi/geo-audit-optimizer" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[13px] border border-[#333] rounded-full px-5 py-2.5 hover:border-white hover:text-white transition-all font-mono tracking-wide">
                  OPENCLAW SKILL <span className="text-[10px]">↗</span>
                </a>
                <a href="/api-docs#x402" className="inline-flex items-center gap-2 text-[13px] border border-[#333] rounded-full px-5 py-2.5 hover:border-white hover:text-white transition-all font-mono tracking-wide">
                  x402 PAYMENTS <span className="text-[10px]">↗</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </section>
  );
}
