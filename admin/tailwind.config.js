/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Minimal Intelligence palette — strong contrast, no weak grays
        surface: {
          DEFAULT: 'var(--surface)',
          elevated: 'var(--surface-elevated)',
          overlay: 'var(--surface-overlay)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          secondary: 'var(--ink-secondary)',
          tertiary: 'var(--ink-tertiary)',
        },
        brand: {
          DEFAULT: 'var(--brand)',
          hover: 'var(--brand-hover)',
          muted: 'var(--brand-muted)',
        },
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display-lg': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.04em' }],
        'display': ['2.5rem', { lineHeight: '1.15', letterSpacing: '-0.03em' }],
        'display-sm': ['1.75rem', { lineHeight: '1.25', letterSpacing: '-0.02em' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6' }],
        'body': ['1rem', { lineHeight: '1.6' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5' }],
        'caption': ['0.8125rem', { lineHeight: '1.4' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '30': '7.5rem',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
        'card': 'var(--radius-card)',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
        'glow': '0 0 0 1px var(--border), 0 4px 24px var(--brand-glow)',
      },
      transitionDuration: {
        'smooth': '280ms',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.25, 0.4, 0.25, 1)',
      },
    },
  },
  plugins: [],
};
