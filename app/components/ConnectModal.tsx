'use client';

import { useConnect } from 'wagmi';

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
}

export default function ConnectModal({ isOpen, onClose, message }: ConnectModalProps) {
  const { connect, connectors, isPending } = useConnect();

  if (!isOpen) return null;

  const handleConnect = () => {
    const connector = connectors[0];
    if (connector) connect({ connector });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-gray-950 border border-gray-800 rounded-xl p-8 max-w-sm w-full mx-4 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-600 hover:text-white transition cursor-pointer"
        >
          ✕
        </button>

        {/* Icon */}
        <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-5 mx-auto">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-400">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>

        <h3 className="text-lg font-bold text-white text-center mb-2">
          Sign In
        </h3>

        <p className="text-sm text-gray-500 text-center mb-6">
          {message || 'Sign in to run audits, track history, and unlock all features.'}
        </p>

        <button
          onClick={handleConnect}
          disabled={isPending}
          className="w-full py-3 rounded-lg bg-cyan-500 text-black font-bold text-sm hover:bg-cyan-400 transition cursor-pointer disabled:opacity-50"
        >
          {isPending ? 'Signing in...' : 'Continue with Coinbase'}
        </button>

        <p className="text-xs text-gray-600 text-center mt-4">
          Secure sign-in powered by Coinbase. No extension needed.
        </p>
      </div>
    </div>
  );
}
