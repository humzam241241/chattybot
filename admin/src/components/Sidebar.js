'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) setOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      <button 
        className="hamburger" 
        onClick={() => setOpen(!open)}
        aria-label="Toggle menu"
      >
        {open ? '×' : '☰'}
      </button>
      
      <div 
        className={`sidebar-overlay ${open ? 'open' : ''}`}
        onClick={() => setOpen(false)}
      />
      
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <span className="logo-icon">💬</span>
          <span className="logo-text">ChattyBot</span>
        </div>
        <nav className="sidebar-nav">
          <Link href="/" className="nav-item" onClick={() => setOpen(false)}>
            Dashboard
          </Link>
          <Link href="/sites" className="nav-item" onClick={() => setOpen(false)}>
            Clients
          </Link>
          <Link href="/sites/new" className="nav-item nav-cta" onClick={() => setOpen(false)}>
            + New Client
          </Link>
        </nav>
      </aside>
    </>
  );
}
