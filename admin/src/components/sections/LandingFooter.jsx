'use client';

import Link from 'next/link';
import { MessageCircle } from 'lucide-react';

export default function LandingFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
              style={{ background: 'var(--ink)' }}
            >
              <MessageCircle className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="font-semibold text-[var(--ink)]">ChattyBot</span>
          </div>
          <p className="text-sm text-[var(--ink-secondary)] md:max-w-xs">
            AI chatbots that convert.
          </p>
          <div className="flex gap-12">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-tertiary)]">
                Product
              </h4>
              <div className="mt-3 flex flex-col gap-2">
                <Link
                  href="/pricing"
                  className="text-sm font-medium text-[var(--ink-secondary)] hover:text-[var(--ink)]"
                >
                  Pricing
                </Link>
                <Link
                  href="/about"
                  className="text-sm font-medium text-[var(--ink-secondary)] hover:text-[var(--ink)]"
                >
                  About
                </Link>
                <Link
                  href="/contact"
                  className="text-sm font-medium text-[var(--ink-secondary)] hover:text-[var(--ink)]"
                >
                  Contact
                </Link>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-tertiary)]">
                Account
              </h4>
              <div className="mt-3 flex flex-col gap-2">
                <Link
                  href="/sign-in"
                  className="text-sm font-medium text-[var(--ink-secondary)] hover:text-[var(--ink)]"
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className="text-sm font-medium text-[var(--ink-secondary)] hover:text-[var(--ink)]"
                >
                  Sign up
                </Link>
                <Link
                  href="/dashboard"
                  className="text-sm font-medium text-[var(--ink-secondary)] hover:text-[var(--ink)]"
                >
                  Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-12 border-t border-[var(--border)] pt-8 text-center text-sm text-[var(--ink-tertiary)]">
          &copy; {new Date().getFullYear()} ChattyBot. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
