'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAccount } from 'wagmi';

interface OnrampButtonProps {
  amount?: number;
  className?: string;
  label?: string;
}

export default function OnrampButton({ amount, className, label = "Buy USDC" }: OnrampButtonProps) {
  const { address } = useAccount();
  const [showModal, setShowModal] = useState(false);
  const [showOnramper, setShowOnramper] = useState(false);
  const [copied, setCopied] = useState(false);

  const wallet = address || (typeof window !== 'undefined' ? localStorage.getItem('xanlens_wallet') : null);

  const handleCopy = () => {
    if (wallet) {
      navigator.clipboard.writeText(wallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Onramper widget URL — pre-configured for USDC on Base
  const onramperUrl = wallet
    ? `https://buy.onramper.com/?mode=buy&defaultCrypto=usdc_base&onlyCryptos=usdc_base&walletAddress=${wallet}&themeName=dark&containerColor=000000ff&primaryColor=2596beff&secondaryColor=111111ff&cardColor=0a0a0aff&primaryTextColor=ffffffff&secondaryTextColor=888888ff&borderRadius=0.75`
    : '';

  return (
    <>
      <button
        onClick={() => {
          if (!wallet) { alert('Please sign in first'); return; }
          setShowModal(true);
        }}
        className={className || "px-4 py-2 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-500 transition cursor-pointer"}
      >
        {label}
      </button>

      {/* Top-up Modal — portaled to body so it's not trapped in scrollable containers */}
      {showModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={() => { setShowModal(false); setShowOnramper(false); }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative bg-[#0a0a0a] border border-[#222] rounded-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[#191919]">
              <h3 className="text-[16px] font-semibold text-white">Add USDC</h3>
              <button onClick={() => { setShowModal(false); setShowOnramper(false); }} className="text-[#555] hover:text-white transition cursor-pointer">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {!showOnramper ? (
              <div className="p-5 space-y-3">
                {/* Option 1: Buy with card via Onramper */}
                <button
                  onClick={() => setShowOnramper(true)}
                  className="w-full p-4 bg-[#111] border border-[#222] rounded-xl hover:border-[#444] transition cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#2596be]/10 flex items-center justify-center shrink-0">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2596be" strokeWidth="1.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                    </div>
                    <div>
                      <p className="text-[14px] font-medium text-white group-hover:text-white">Buy with Card</p>
                      <p className="text-[12px] text-[#666]">Visa, Mastercard, Apple Pay, Google Pay, bank transfer</p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" className="ml-auto shrink-0 group-hover:stroke-white transition"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                </button>

                {/* Option 2: Receive USDC */}
                <div className="p-4 bg-[#111] border border-[#222] rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-[#222] flex items-center justify-center shrink-0">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </div>
                    <div>
                      <p className="text-[14px] font-medium text-white">Receive USDC</p>
                      <p className="text-[12px] text-[#666]">Send USDC on Base from any exchange or wallet</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2.5 bg-[#0a0a0a] border border-[#191919] rounded-lg text-[12px] text-[#888] font-mono truncate">
                      {wallet}
                    </div>
                    <button
                      onClick={handleCopy}
                      className="px-3 py-2.5 bg-[#222] rounded-lg text-[12px] text-white hover:bg-[#333] transition cursor-pointer shrink-0"
                    >
                      {copied ? '✓' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-[11px] text-[#555] mt-2">⚠️ Only send USDC on <span className="text-[#2596be]">Base network</span>. Other networks will result in lost funds.</p>
                </div>

                {/* Option 3: Coinbase */}
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/v1/coinbase-onramp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ address: wallet, amount: amount || 5 }),
                      });
                      const data = await res.json();
                      if (data.url) {
                        window.open(data.url, 'coinbase-onramp', `width=460,height=700,left=${(screen.width-460)/2},top=${(screen.height-700)/2}`);
                      } else {
                        alert(data.error || 'Failed to open Coinbase');
                      }
                    } catch {
                      alert('Failed to connect to Coinbase');
                    }
                  }}
                  className="w-full p-4 bg-[#111] border border-[#222] rounded-xl hover:border-[#444] transition cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#0052FF]/10 flex items-center justify-center shrink-0">
                      <svg width="20" height="20" viewBox="0 0 16 16" fill="none"><rect width="16" height="16" rx="4" fill="#0052FF"/><path d="M8 3.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9zM6.5 7h3v2h-3V7z" fill="white"/></svg>
                    </div>
                    <div>
                      <p className="text-[14px] font-medium text-white group-hover:text-white">Coinbase</p>
                      <p className="text-[12px] text-[#666]">Buy USDC via Coinbase Pay</p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" className="ml-auto shrink-0 group-hover:stroke-white transition"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                </button>
              </div>
            ) : (
              /* Onramper — open in new window (their CSP blocks iframes from external domains) */
              <div className="p-5 space-y-4">
                <p className="text-[14px] text-[#999] text-center">Onramper will open in a new window where you can buy USDC with card.</p>
                <button
                  onClick={() => { window.open(onramperUrl, 'onramper', `width=460,height=700,left=${(screen.width-460)/2},top=${(screen.height-700)/2}`); }}
                  className="w-full px-4 py-3 bg-[#2596be] text-white font-semibold rounded-xl text-[14px] hover:bg-[#1e7da3] transition cursor-pointer"
                >
                  Open Onramper
                </button>
                <button
                  onClick={() => setShowOnramper(false)}
                  className="w-full px-4 py-2 text-[#666] text-[13px] hover:text-white transition cursor-pointer"
                >
                  Back
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
