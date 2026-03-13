'use client';

import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui';
import { MessageCircle } from 'lucide-react';

export default function LandingHeader() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--surface-overlay)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-[var(--ink)] font-semibold no-underline hover:opacity-90"
        >
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
            style={{ background: 'var(--ink)' }}
          >
            <MessageCircle className="h-4 w-4" strokeWidth={2} />
          </span>
          <span>ChattyBot</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link
            href="/about"
            className="rounded-md px-3 py-2 text-sm font-medium text-[var(--ink-secondary)] hover:bg-[var(--brand-muted)] hover:text-[var(--ink)]"
          >
            About
          </Link>
          <Link
            href="/pricing"
            className="rounded-md px-3 py-2 text-sm font-medium text-[var(--ink-secondary)] hover:bg-[var(--brand-muted)] hover:text-[var(--ink)]"
          >
            Pricing
          </Link>
          <Link
            href="/contact"
            className="rounded-md px-3 py-2 text-sm font-medium text-[var(--ink-secondary)] hover:bg-[var(--brand-muted)] hover:text-[var(--ink)]"
          >
            Contact
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <Button href="/dashboard" variant="primary" size="md">
              Dashboard
            </Button>
          ) : (
            <>
              <Button href="/sign-in" variant="ghost" size="md">
                Sign in
              </Button>
              <Button href="/sign-up" variant="primary" size="md">
                Get started
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
