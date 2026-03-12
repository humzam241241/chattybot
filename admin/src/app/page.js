'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import dynamic from 'next/dynamic';
import {
  AnimatedGradientHero,
  SpotlightCursor,
  FloatingParticles,
  ScrollReveal,
  CTAButton,
  FeatureCard,
  PricingCard,
  ChatDemo,
  HeroContent,
  HeroTitle,
  HeroSubtitle,
  HeroCTA,
  HeroNote,
} from '../components/landing';

const HologramBot = dynamic(
  () => import('../components/ui/hologram-bot'),
  { ssr: false }
);

class HeroHologramErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div
          className="hero-hologram"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--muted-foreground)',
            fontSize: 14,
          }}
        >
          <span>3D preview</span>
        </div>
      );
    }
    return this.props.children;
  }
}

const FEATURES = [
  { icon: '💬', title: 'Smart AI Conversations', description: 'Powered by GPT-4, your chatbot understands context and provides accurate, helpful responses.' },
  { icon: '📊', title: 'Lead Capture & Scoring', description: 'Automatically capture leads and score them as Hot, Warm, or Cold based on conversation intent.' },
  { icon: '📱', title: 'SMS & WhatsApp', description: 'Extend your reach with text message support. Same AI, different channels.' },
  { icon: '📈', title: 'Analytics Dashboard', description: 'Track conversations, leads, conversion rates, and more with detailed analytics.' },
  { icon: '🎨', title: 'Fully Customizable', description: 'Match your brand with custom colors, personality settings, and guardrails.' },
  { icon: '⚡', title: 'Easy Integration', description: 'Add to any website with a single script tag. Works with WordPress, Shopify, and more.' },
];

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="header-container">
          <Link href="/" className="logo">
            <span className="logo-icon" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="logo-text">ChattyBot</span>
          </Link>
          <nav className="header-nav">
            <Link href="/about" className="header-nav-btn">About</Link>
            <Link href="/pricing" className="header-nav-btn">Pricing</Link>
            <Link href="/contact" className="header-nav-btn">Contact</Link>
          </nav>
          <div className="header-actions">
            {user ? (
              <Link href="/dashboard" className="btn btn-primary">Dashboard</Link>
            ) : (
              <>
                <Link href="/sign-in" className="btn btn-secondary">Sign In</Link>
                <Link href="/sign-up" className="btn btn-primary">Get Started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <AnimatedGradientHero className="hero-gradient-wrap">
            <FloatingParticles style={{ zIndex: 0 }} />
            <SpotlightCursor className="hero-spotlight-wrap">
              <div className="hero-inner">
                <div className="hero-hologram-bg">
                  <HeroHologramErrorBoundary>
                    <HologramBot />
                  </HeroHologramErrorBoundary>
                </div>
                <div className="hero-content">
                  <HeroContent>
                    <HeroTitle className="hero-title">
                      AI-Powered Chatbots{' '}
                      <span className="gradient-text">That Convert Visitors to Leads</span>
                    </HeroTitle>
                    <HeroSubtitle className="hero-subtitle">
                      Deploy intelligent chatbots on your website in minutes.
                      Capture leads 24/7, answer questions instantly, and never miss an opportunity.
                    </HeroSubtitle>
                    <HeroCTA className="hero-cta">
                      <CTAButton href="/sign-up" primary size="lg">
                        Start Free Trial
                      </CTAButton>
                      <CTAButton href="/pricing" primary={false} size="lg">
                        View Pricing
                      </CTAButton>
                    </HeroCTA>
                    <HeroNote className="hero-note">14-day free trial. No credit card required.</HeroNote>
                  </HeroContent>
                </div>
                <div className="hero-demo">
                  <ChatDemo />
                </div>
              </div>
            </SpotlightCursor>
          </AnimatedGradientHero>
        </section>

        <section className="features">
          <ScrollReveal>
            <h2 className="section-title">Everything You Need</h2>
          </ScrollReveal>
          <div className="features-grid">
            {FEATURES.map((f, i) => (
              <FeatureCard key={i} icon={f.icon} title={f.title} description={f.description} />
            ))}
          </div>
        </section>

        <section className="pricing-preview">
          <ScrollReveal>
            <h2 className="section-title">Simple, Transparent Pricing</h2>
            <p className="section-subtitle">Choose a plan that fits your business. All plans include a 14-day free trial.</p>
          </ScrollReveal>
          <div className="pricing-preview-grid">
            <PricingCard
              title="Pro"
              price="$50"
              period="/month"
              description="5,000 messages / month"
              features={['Unlimited chatbots', 'Lead capture & scoring', 'Analytics dashboard']}
              ctaText="View plans"
              ctaHref="/pricing"
              delay={0}
            />
            <PricingCard
              title="Plus"
              price="$150"
              period="/month"
              description="10,000 messages / month"
              features={['Everything in Pro', 'Priority support', 'Early access to features']}
              ctaText="View plans"
              ctaHref="/pricing"
              popular
              delay={0.1}
            />
            <PricingCard
              title="Ultra"
              price="$400"
              period="/month"
              description="20,000 messages / month"
              features={['Everything in Plus', 'White-label option', 'Dedicated support']}
              ctaText="View plans"
              ctaHref="/pricing"
              delay={0.2}
            />
          </div>
        </section>

        <section className="cta-section">
          <ScrollReveal>
            <div className="cta-section-content">
              <h2>Ready to Get Started?</h2>
              <p>Join hundreds of businesses using ChattyBot to capture more leads.</p>
              <div className="cta-section-buttons">
                <CTAButton href="/sign-up" primary size="lg">
                  Start Your Free Trial
                </CTAButton>
              </div>
            </div>
          </ScrollReveal>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-brand">
            <span className="logo-icon" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="logo-text">ChattyBot</span>
            <p className="footer-tagline">AI chatbots that convert.</p>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <h4>Product</h4>
              <div className="footer-col-buttons">
                <Link href="/pricing" className="footer-btn">Pricing</Link>
                <Link href="/about" className="footer-btn">About</Link>
                <Link href="/contact" className="footer-btn">Contact</Link>
              </div>
            </div>
            <div className="footer-col">
              <h4>Account</h4>
              <div className="footer-col-buttons">
                <Link href="/sign-in" className="footer-btn">Sign In</Link>
                <Link href="/sign-up" className="footer-btn">Sign Up</Link>
                <Link href="/dashboard" className="footer-btn">Dashboard</Link>
              </div>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} ChattyBot. All rights reserved.</p>
        </div>
      </footer>

      <style jsx>{`
        .landing-header {
          position: sticky;
          top: 0;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
          z-index: 100;
        }

        .header-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 16px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }

        .header-nav {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-nav-btn {
          display: inline-block;
          padding: 8px 16px;
          border-radius: var(--radius);
          color: var(--muted-foreground);
          text-decoration: none;
          font-weight: 500;
          font-size: 14px;
          background: transparent;
          border: 1px solid var(--border);
          transition: color var(--transition), background var(--transition), border-color var(--transition);
        }

        .header-nav-btn:hover {
          color: var(--foreground);
          background: var(--muted);
          border-color: var(--ring);
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .hero {
          padding: 80px 24px 100px;
          position: relative;
          min-height: 520px;
        }

        .hero-gradient-wrap {
          position: absolute;
          inset: 0;
        }

        .hero-spotlight-wrap {
          position: relative;
          height: 100%;
        }

        .hero-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 48px;
          align-items: center;
          position: relative;
        }

        .hero-hologram-bg {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 600px;
          height: 600px;
          z-index: 0;
          pointer-events: none;
          opacity: 0.5;
        }

        .hero-content {
          text-align: left;
          max-width: 560px;
          position: relative;
          z-index: 2;
        }

        .hero-title {
          font-size: clamp(32px, 4.5vw, 44px);
          font-weight: 700;
          line-height: 1.15;
          margin-bottom: 20px;
          color: var(--foreground);
          letter-spacing: -0.03em;
        }

        .gradient-text {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-subtitle {
          font-size: 18px;
          color: var(--muted-foreground);
          line-height: 1.6;
          margin-bottom: 28px;
        }

        .hero-cta {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        .hero-note {
          font-size: 13px;
          color: var(--muted-foreground);
        }

        .hero-demo {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          position: relative;
          z-index: 2;
        }

        .features {
          padding: 88px 24px;
          max-width: 1200px;
          margin: 0 auto;
          background: var(--muted);
        }

        .section-title {
          text-align: center;
          font-size: 28px;
          font-weight: 600;
          margin-bottom: 12px;
          color: var(--foreground);
          letter-spacing: -0.02em;
        }

        .section-subtitle {
          text-align: center;
          font-size: 16px;
          color: var(--muted-foreground);
          margin-bottom: 48px;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
        }

        .feature-card-wrapper {
          min-height: 1px;
        }

        .pricing-preview {
          padding: 88px 24px;
          max-width: 1100px;
          margin: 0 auto;
          background: var(--background);
        }

        .pricing-preview-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
          margin-top: 24px;
        }

        .cta-section {
          padding: 80px 24px;
          text-align: center;
          background: var(--background);
          border-top: 1px solid var(--border);
        }

        .cta-section h2 {
          font-size: 26px;
          font-weight: 600;
          margin-bottom: 12px;
          color: var(--foreground);
        }

        .cta-section-content {
          max-width: 560px;
          margin: 0 auto;
        }

        .cta-section p {
          font-size: 16px;
          color: var(--muted-foreground);
          margin-bottom: 28px;
        }

        .cta-section-buttons {
          display: flex;
          justify-content: center;
          gap: 12px;
        }

        .landing-footer {
          background: var(--card);
          border-top: 1px solid var(--border);
          padding: 48px 24px 24px;
        }

        .footer-container {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          gap: 48px;
          flex-wrap: wrap;
        }

        .footer-brand {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
        }

        .footer-brand .logo-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: linear-gradient(135deg, var(--primary-accent) 0%, #8b5cf6 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }

        .footer-brand .logo-text {
          font-weight: 700;
          font-size: 18px;
          color: var(--foreground);
        }

        .footer-tagline {
          width: 100%;
          color: var(--muted-foreground);
          font-size: 14px;
          margin: 0;
        }

        .footer-links {
          display: flex;
          gap: 64px;
        }

        .footer-col h4 {
          font-weight: 600;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--muted-foreground);
          margin-bottom: 14px;
        }

        .footer-col-buttons {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .footer-btn {
          display: inline-block;
          padding: 8px 14px;
          border-radius: var(--radius);
          color: var(--muted-foreground);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          background: var(--muted);
          border: 1px solid var(--border);
          width: fit-content;
          transition: color var(--transition), background var(--transition), border-color var(--transition);
        }

        .footer-btn:hover {
          color: var(--foreground);
          background: var(--accent);
          border-color: var(--ring);
        }

        .footer-bottom {
          max-width: 1200px;
          margin: 48px auto 0;
          padding-top: 24px;
          border-top: 1px solid var(--border);
          text-align: center;
          color: var(--muted-foreground);
          font-size: 13px;
        }

        @media (max-width: 768px) {
          .header-nav {
            display: none;
          }

          .hero-inner {
            grid-template-columns: 1fr;
            text-align: center;
          }

          .hero-hologram-bg {
            width: min(100vw, 480px);
            height: min(100vw, 480px);
            opacity: 0.62;
          }

          .hero-content {
            text-align: center;
          }

          .hero-cta {
            justify-content: center;
          }

          .hero-demo {
            max-width: 360px;
            margin: 0 auto;
          }

          .features-grid {
            grid-template-columns: 1fr;
          }

          .pricing-preview-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
