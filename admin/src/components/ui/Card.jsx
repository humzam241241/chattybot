'use client';

import { forwardRef } from 'react';

const Card = forwardRef(function Card({ className = '', children, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={`rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-elevated)] shadow-card ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});

const CardHeader = forwardRef(function CardHeader({ className = '', ...props }, ref) {
  return <div ref={ref} className={`p-5 pb-2 ${className}`} {...props} />;
});

const CardTitle = forwardRef(function CardTitle({ className = '', ...props }, ref) {
  return (
    <h3
      ref={ref}
      className={`text-[var(--ink)] font-semibold text-lg tracking-tight ${className}`}
      {...props}
    />
  );
});

const CardDescription = forwardRef(function CardDescription({ className = '', ...props }, ref) {
  return (
    <p ref={ref} className={`text-[var(--ink-secondary)] text-sm mt-1 ${className}`} {...props} />
  );
});

const CardContent = forwardRef(function CardContent({ className = '', ...props }, ref) {
  return <div ref={ref} className={`p-5 pt-0 ${className}`} {...props} />;
});

const CardFooter = forwardRef(function CardFooter({ className = '', ...props }, ref) {
  return <div ref={ref} className={`flex items-center p-5 pt-0 ${className}`} {...props} />;
});

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
