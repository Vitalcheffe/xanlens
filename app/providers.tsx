'use client';

import CDPProvider from './components/CDPProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CDPProvider>
      {children}
    </CDPProvider>
  );
}
