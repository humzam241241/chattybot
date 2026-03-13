'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user, isAdmin, signOut } = useAuth();

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

  const isActive = (href) => pathname === href || pathname.startsWith(href + '/');

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
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'inherit' }}>
            <span className="logo-icon">🤖</span>
            <span className="logo-text">ChattyBot</span>
          </Link>
        </div>
        <nav className="sidebar-nav">
          <Link 
            href="/dashboard" 
            className={`nav-item ${isActive('/dashboard') && !pathname.includes('/admin') ? 'active' : ''}`}
            onClick={() => setOpen(false)}
          >
            📊 Dashboard
          </Link>
          <Link
            href="/dashboard/leads"
            className={`nav-item ${isActive('/dashboard/leads') ? 'active' : ''}`}
            onClick={() => setOpen(false)}
          >
            👥 All Leads
          </Link>
          <Link
            href="/dashboard/chats"
            className={`nav-item ${isActive('/dashboard/chats') ? 'active' : ''}`}
            onClick={() => setOpen(false)}
          >
            💬 All Chats
          </Link>
          {isAdmin && (
            <Link 
              href="/dashboard/admin" 
              className={`nav-item ${isActive('/dashboard/admin') ? 'active' : ''}`}
              onClick={() => setOpen(false)}
            >
              👑 Admin Overview
            </Link>
          )}
          <Link 
            href="/dashboard/sites/new" 
            className="nav-item nav-cta" 
            onClick={() => setOpen(false)}
          >
            + Add Client
          </Link>
        </nav>
        
        <div className="sidebar-footer">
          {user && (
            <div className="user-info">
              <div className="user-email">{user.email}</div>
              {isAdmin && <div className="admin-badge">Admin</div>}
              <button onClick={signOut} className="sign-out-btn">Sign Out</button>
            </div>
          )}
        </div>
      </aside>
      
      <style jsx global>{`
        .sidebar-footer {
          margin-top: auto;
          padding: 16px 20px;
          border-top: 1px solid var(--border);
        }
        
        .user-info {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .user-email {
          font-size: 13px;
          color: var(--text);
          word-break: break-all;
        }
        
        .admin-badge {
          display: inline-block;
          background: var(--primary);
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          width: fit-content;
        }
        
        .sign-out-btn {
          background: none;
          border: 1px solid var(--border);
          padding: 6px 12px;
          border-radius: 6px;
          color: var(--muted);
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        }
        
        .sign-out-btn:hover {
          border-color: var(--danger);
          color: var(--danger);
        }
        
        .nav-item.active {
          background: rgba(99, 102, 241, 0.1);
          color: var(--primary);
        }
      `}</style>
    </>
  );
}
