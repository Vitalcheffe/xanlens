'use client';

import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function AuthButton() {
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [showMenu, setShowMenu] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setMounted(true); }, []);

  // Save wallet to localStorage when connected
  useEffect(() => {
    if (address) {
      localStorage.setItem('xanlens_wallet', address);
      fetch('/api/v1/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address }),
      }).catch(() => {});
    }
  }, [address]);

  if (!mounted) return null;

  if (!isConnected) {
    return (
      <div className="flex flex-col items-end gap-1">
        <a
          href="/dashboard"
          className="px-4 py-1.5 rounded-full border border-[#333] text-[13px] font-medium text-white hover:border-white transition cursor-pointer"
        >
          Sign In
        </a>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#333] hover:border-white transition cursor-pointer"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M20 21a8 8 0 0 0-16 0" />
        </svg>
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-2 w-52 bg-[#0c0c0c] border border-[#1a1a1a] rounded-xl shadow-2xl z-50 overflow-hidden py-1">
            <a
              href="/dashboard"
              className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-[#999] hover:text-white hover:bg-[#111] transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-60">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              Audit
            </a>
            <a
              href="/dashboard"
              className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-[#999] hover:text-white hover:bg-[#111] transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-60">
                <circle cx="11" cy="11" r="8" strokeDasharray="4 2" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              Pro Audit
            </a>
            <a
              href="/geoskill"
              className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-[#999] hover:text-white hover:bg-[#111] transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-60">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              GEO Agentic Skill
            </a>
            <div className="border-t border-[#1a1a1a] my-1" />
            <button
              onClick={() => {
                disconnect();
                setShowMenu(false);
                localStorage.removeItem('xanlens_wallet');
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-[#555] hover:text-red-400 hover:bg-[#111] transition cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-60">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
