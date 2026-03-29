'use client';

import { useEffect } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.body.classList.add('dashboard-mode');
    return () => document.body.classList.remove('dashboard-mode');
  }, []);

  return <>{children}</>;
}
