'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SitesPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
      Redirecting to dashboard...
    </div>
  );
}
