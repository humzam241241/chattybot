# ChattyBot Marketing — Art Direction

## Chosen direction: **Minimal Intelligence**

Ultra-clean, Apple/OpenAI-style landing with strong whitespace, clear hierarchy, and subtle motion. No decorative animation; every motion supports the product story (message reveal, typing indicator, lead captured, card hover).

**Rationale:** AI automation for contractors and local businesses needs to feel trustworthy and “it just works.” Minimal design signals reliability and reduces cognitive load. Stripe, Linear, Vercel, and OpenAI use this language successfully for premium, technical products. It avoids the “futuristic glitch” cliché while still feeling modern and premium.

---

## Visual system

| Token | Usage |
|-------|--------|
| **Ink** | Primary text `#0f0f0f` — strong contrast |
| **Ink secondary** | Body/secondary text `#404040` |
| **Ink tertiary** | Captions, hints `#525252` |
| **Brand** | CTAs, key UI `#0f172a` |
| **Brand muted** | Light sections, bot bubbles `#f1f5f9` |
| **Border** | Default borders; **Border strong** for inputs/buttons |
| **Surface elevated** | Cards, chat container |

**Typography:** Inter (display), clear scale: display-lg, display, display-sm, body-lg, body, body-sm, caption.

**Spacing:** 4/8/12/16/24/32/48 (Tailwind scale) + 18, 22, 30 for section rhythm.

**Cards:** `--radius-card` (0.875rem), subtle shadow, hover: slight elevation + border.

**Buttons:** Primary = solid ink; secondary = border + surface; ghost = text + hover bg. Focus ring for a11y.

---

## Animation variants (`src/lib/motion-variants.js`)

- **fadeIn** / **fadeInUp** / **slideUp** / **scaleIn** — entrance
- **staggerContainer** + **staggerItem** — list/card stagger
- **hoverGlow** / **hoverLift** — card/button hover
- **messageReveal** — chat bubbles
- **transitionFast / Normal / Slow** — durations
- **transitionSpring** — buttons

All animations use `easeSmooth` and respect reduced motion when handled by Framer.

---

## Folder structure

```
src/
├── app/
│   ├── layout.js
│   ├── page.js              ← New landing (sections only)
│   └── globals.css          ← Tailwind + tokens
├── components/
│   ├── ui/                  ← Button, Card (shadcn-style)
│   │   ├── Button.jsx
│   │   ├── Card.jsx
│   │   └── index.js
│   ├── motion/              ← Primitives
│   │   ├── FadeIn.jsx
│   │   ├── SlideUp.jsx
│   │   ├── ScaleIn.jsx
│   │   ├── HoverGlow.jsx
│   │   ├── StaggerChildren.jsx
│   │   └── index.js
│   ├── sections/            ← Landing sections
│   │   ├── LandingHeader.jsx
│   │   ├── Hero.jsx
│   │   ├── FeaturesSection.jsx
│   │   ├── PricingSection.jsx
│   │   ├── CTASection.jsx
│   │   ├── LandingFooter.jsx
│   │   └── index.js
│   └── chat/
│       ├── ChatDemo.jsx
│       └── index.js
├── lib/
│   └── motion-variants.js
└── design/
    └── ART-DIRECTION.md
```

---

## Hero

- **Headline:** “AI Chatbots That Convert Visitors Into Leads”
- **Subline:** Install an AI employee on your website; answers questions, captures leads, SMS/email.
- **CTAs:** Start free trial (primary), View pricing (secondary).
- **Note:** 14-day free trial. No credit card required.
- **Chat demo:** Animated conversation (user → bot → user → bot) then “Lead captured” badge.

## ChatDemo script

1. User: “Do you offer free estimates?”
2. Bot: “Yes! What type of project?”
3. User: “Roof inspection”
4. Bot: “Great — let’s schedule that.”
5. “Lead captured” pill appears.

Messages and typing indicator use `messageReveal` and dot bounce; no decorative motion.
