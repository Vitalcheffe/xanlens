"use client";

import { useState } from "react";

export default function Waitlist({ source = "homepage" }: { source?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/v1/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source }),
      });
      if (res.ok) {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="text-center py-8">
        <p className="text-[18px] font-semibold text-white mb-2">You're on the list.</p>
        <p className="text-[14px] text-[#666]">Check your inbox — we sent you a confirmation.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        required
        className="flex-1 px-4 py-3 rounded-xl bg-[#0c0c0c] border border-[#222] text-white placeholder-[#555] focus:border-[#2596be] focus:outline-none text-[14px]"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="px-6 py-3 bg-white text-black font-semibold rounded-xl text-[14px] hover:bg-white/90 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
      >
        {status === "loading" ? "Joining..." : "Join Waitlist"}
      </button>
      {status === "error" && (
        <p className="text-[#EF4444] text-[12px] mt-1">Something went wrong. Try again.</p>
      )}
    </form>
  );
}
