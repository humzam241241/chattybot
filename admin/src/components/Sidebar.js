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

  const isActive = (href) => pathname === href;

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
          <span className="logo-icon">🤖</span>
          <span className="logo-text">ChattyBot</span>
        </div>
        <nav className="sidebar-nav">
          <Link 
            href="/" 
            className={`nav-item ${isActive('/') ? 'active' : ''}`}
            onClick={() => setOpen(false)}
          >
            📊 Dashboard
          </Link>
          <Link 
            href="/sites/new" 
            className="nav-item nav-cta" 
            onClick={() => setOpen(false)}
          >
            + Add Client
          </Link>
        </nav>
        
        <div className="sidebar-footer">
          <div className="footer-text">Manage AI Chatbots</div>
        </div>
      </aside>
      
      <style jsx global>{`
        .sidebar-footer {
          margin-top: auto;
          padding: 16px 20px;
          border-top: 1px solid var(--border);
        }
        
        .footer-text {
          font-size: 12px;
          color: var(--muted);
        }
        
        .nav-item.active {
          background: rgba(99, 102, 241, 0.1);
          color: var(--primary);
        }
      `}</style>
    </>
  );
}
