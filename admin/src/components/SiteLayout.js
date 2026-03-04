'use client';

import { usePathname, useParams } from 'next/navigation';
import Link from 'next/link';

export default function SiteLayout({ children, siteName = 'Site' }) {
  const pathname = usePathname();
  const { id } = useParams();

  const navItems = [
    { href: `/sites/${id}`, label: '⚙️ Settings', icon: '⚙️' },
    { href: `/sites/${id}/conversations`, label: '💬 Conversations', icon: '💬' },
    { href: `/sites/${id}/leads`, label: '👥 Leads', icon: '👥' },
    { href: `/sites/${id}/files`, label: '📁 Files', icon: '📁' },
    { href: `/sites/${id}/rag-eval`, label: '🎯 RAG Evaluation', icon: '🎯' },
  ];

  const isActive = (href) => pathname === href;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <div
        style={{
          width: 240,
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 0',
        }}
      >
        {/* Logo */}
        <Link
          href="/sites"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 20px 24px',
            borderBottom: '1px solid var(--border)',
            marginBottom: 16,
            textDecoration: 'none',
          }}
        >
          <span style={{ fontSize: 22 }}>🤖</span>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--primary)' }}>ChattyBot</span>
        </Link>

        {/* Site Name */}
        <div
          style={{
            padding: '0 20px',
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.05em', marginBottom: 6 }}>
            CURRENT SITE
          </div>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{siteName}</div>
        </div>

        {/* Navigation */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 12px', flex: 1 }}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                color: isActive(item.href) ? 'var(--primary)' : 'var(--muted)',
                background: isActive(item.href) ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                textDecoration: 'none',
                fontWeight: isActive(item.href) ? 600 : 500,
                fontSize: 14,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span>{item.label.replace(/^[^\s]+\s/, '')}</span>
            </Link>
          ))}
        </nav>

        {/* Back to Sites */}
        <div style={{ padding: '0 12px', marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <Link
            href="/sites"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 8,
              color: 'var(--muted)',
              textDecoration: 'none',
              fontWeight: 500,
              fontSize: 14,
              transition: 'all 0.15s',
            }}
          >
            <span>←</span>
            <span>All Sites</span>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ marginLeft: 240, flex: 1, padding: 32, maxWidth: 1200 }}>{children}</div>
    </div>
  );
}
