'use client';

import {
  LandingHeader,
  Hero,
  FeaturesSection,
  PricingSection,
  CTASection,
  LandingFooter,
} from '../components/sections';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--ink)]">
      <LandingHeader />
      <main>
        <Hero />
        <FeaturesSection />
        <PricingSection />
        <CTASection />
      </main>
      <LandingFooter />
    </div>
  );
}
