"use client";

import React, { useState, useCallback } from "react";
import { useAccount } from "wagmi";

interface ShareProps {
  brand: string;
  score: number;
  grade: string;
  industry?: string;
  jobId?: string;
  engines?: Record<string, { score: number }>;
}

function buildShareText(props: ShareProps): string {
  return `Is your brand visible to AI?\n\nJust checked ${props.brand}:\n→ ${props.score}/100 score\n→ Grade ${props.grade}\n\nXanLens audits your AI visibility and generates fixes.\n\nYour turn. Check your GEO score\n@xanlens_`;
}

export default function ShareForDiscount(props: ShareProps) {
  const { address } = useAccount();
  const [step, setStep] = useState<"prompt" | "verify" | "done">("prompt");
  const [postUrl, setPostUrl] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [discount, setDiscount] = useState<{ percentage: number; message: string } | null>(null);

  const shareText = buildShareText(props);

  const shareOnX = useCallback(() => {
    const text = encodeURIComponent(shareText);
    window.open(`https://x.com/intent/tweet?text=${text}`, "_blank", "width=600,height=400");
    setStep("verify");
  }, [shareText]);

  const verifyShare = useCallback(async () => {
    if (!postUrl.trim() || !address) return;
    setVerifying(true);
    setError("");
    try {
      const res = await fetch("/api/v1/share/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, postUrl: postUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setDiscount(data.discount);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  }, [postUrl, address]);

  return (
    <div id="share-section" className="scroll-mt-24 rounded-2xl border border-[#191919] bg-[#0a0a0a] p-7 my-6">
      {step === "prompt" && (
        <>
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-[20px] font-bold text-white mb-1">Share your score → get a free re-audit</p>
              <p className="text-[14px] text-[#888]">Post your score on X, tag @xanlens_ — get a coupon for a free re-audit</p>
            </div>
            <span className="text-[12px] bg-[#2596be]/10 text-[#2596be] px-3 py-1.5 rounded-full font-semibold shrink-0 ml-4">FREE RE-AUDIT</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={shareOnX}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#111] border border-[#222] text-[14px] text-white hover:border-[#444] transition cursor-pointer font-medium"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              Share on X
            </button>
          </div>
        </>
      )}

      {step === "verify" && (
        <>
          <div className="mb-5">
            <p className="text-[20px] font-bold text-white mb-1">Claim your free re-audit coupon</p>
            <p className="text-[14px] text-[#888]">Paste the URL of your X post below to unlock your coupon.</p>
          </div>
          <div className="flex gap-3 mb-4">
            <input
              type="url"
              value={postUrl}
              onChange={(e) => setPostUrl(e.target.value)}
              placeholder="https://x.com/yourname/status/123..."
              className="flex-1 px-4 py-3 rounded-xl bg-[#0c0c0c] border border-[#222] text-white placeholder-[#444] focus:border-[#2596be] focus:outline-none text-[14px]"
            />
            <button
              onClick={verifyShare}
              disabled={verifying || !postUrl.trim()}
              className="px-6 py-3 rounded-xl bg-[#2596be] text-white text-[14px] font-semibold hover:bg-[#2596be]/90 transition disabled:opacity-50 cursor-pointer shrink-0"
            >
              {verifying ? "Verifying..." : "Verify & Claim"}
            </button>
          </div>
          {error && <p className="text-[13px] text-[#EF4444] mb-3">{error}</p>}
          <div className="flex items-center gap-4">
            <button onClick={() => setStep("prompt")} className="text-[13px] text-[#555] hover:text-white transition cursor-pointer">← Back to share</button>
            <p className="text-[12px] text-[#444]">Post must mention @xanlens_ to qualify</p>
          </div>
        </>
      )}

      {step === "done" && discount && (
        <div className="text-center py-2">
          <p className="text-[22px] font-bold text-[#2596be] mb-2">Free re-audit coupon unlocked! 🎉</p>
          <p className="text-[14px] text-[#888]">{discount.message}</p>
          <p className="text-[12px] text-[#555] mt-3">Your coupon is ready — use it anytime for a free re-audit.</p>
        </div>
      )}
    </div>
  );
}
