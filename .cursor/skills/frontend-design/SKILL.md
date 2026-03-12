---
name: frontend-design
description: Specialist in front-end UI/UX design for web apps. Focuses on layout, typography, color, spacing, accessibility (a11y), responsive design, and component styling. Use when designing or refining interfaces, improving UX, implementing UI from mockups, choosing visual systems, or when the user mentions design, styling, CSS, components, or look-and-feel.
---

# Front-End Design Specialist

## Scope

Use this skill when working on:
- **Widget** (`widget/`) – embeddable chat UI (Vite + React)
- **Admin** (`admin/`) – dashboard and configuration UIs
- Any UI component, page layout, or visual refinement

Focus on: layout, typography, color, spacing, motion, accessibility, and responsive behavior. Do not implement backend logic or authorization; defer to backend-engineer for API and tenant security.

## MCP tools (component CLIs)

Two MCP servers are configured in `.cursor/mcp.json` to help with UI components. Use them when adding or exploring components:

- **shadcn** (`npx shadcn@latest mcp`): Add and manage [shadcn/ui](https://ui.shadcn.com) components. Use when the project uses (or should use) shadcn/ui primitives, or when the user asks for shadcn components.
- **Magic UI** (`@magicuidesign/mcp`): Browse and fetch Magic UI registry items (components, examples, styles). Use `listRegistryItems` / `searchRegistryItems` to discover components, and `getRegistryItem` (with `includeSource: true`) to get copy-paste-ready code for animated or premium UI blocks.

Prefer these tools over hand-rolling components when they fit the stack and design; otherwise follow the implementation guidelines below.

## Design principles

1. **Clarity first**: Hierarchy, contrast, and whitespace so content is scannable.
2. **Consistency**: Reuse tokens (colors, spacing, type scale) and existing components; avoid one-off styles.
3. **Accessibility**: Semantic HTML, sufficient color contrast (WCAG 2.1 AA), focus states, and keyboard navigation.
4. **Responsive**: Mobile-first where appropriate; breakpoints and touch targets (min ~44px) for interactive elements.
5. **Performance**: Prefer CSS over JS for layout and animation; avoid layout thrash and unnecessary re-renders.

## Implementation guidelines

### Styling approach

- Prefer the project’s existing system (e.g. Tailwind, CSS modules, or styled-components) before introducing new ones.
- Use a small set of design tokens (e.g. `--color-primary`, `--spacing-md`) for colors and spacing.
- Keep component styles co-located or in a clear structure; avoid global overrides unless theming.

### Layout

- Use flexbox or grid for layout; avoid fragile float/hack patterns.
- Contain width and max-width for readability on large screens; preserve padding on small screens.
- Stack vertically on narrow viewports; use breakpoints for horizontal layouts where it helps.

### Typography

- Limit font families (often 1–2); use a clear scale (e.g. 0.75rem → 1rem → 1.25rem → 1.5rem).
- Line height ~1.4–1.6 for body; headings can be tighter. Keep line length readable (~45–75 characters).

### Color and contrast

- Ensure text/background contrast meets WCAG AA (4.5:1 normal, 3:1 large).
- Use color to support hierarchy and state (default, hover, focus, disabled, error) without relying only on color for meaning.

### Accessibility (a11y)

- Use semantic elements (`button`, `nav`, `main`, `label`, etc.) and ARIA only when semantics are insufficient.
- Visible focus indicators; no `outline: none` without a replacement.
- Form inputs have associated labels; errors are announced (e.g. `aria-describedby`, `role="alert"`).

### Motion and feedback

- Prefer subtle transitions (e.g. 150–300ms) for state changes; respect `prefers-reduced-motion` where possible.
- Loading and empty states: skeletons or spinners with clear messaging.

## Widget-specific notes

- Widget is embedded on third-party sites: avoid conflicting global styles (scoped CSS or shadow DOM if used).
- Respect white-label config (e.g. primary color, logo) from site config when styling the chat UI.
- Keep bundle size in mind; avoid heavy design libraries if a small set of tokens + utilities suffices.

## Review checklist (before finishing)

- [ ] Layout works at small and large viewport widths
- [ ] Interactive elements have visible focus and adequate touch targets
- [ ] Text contrast meets WCAG AA where applicable
- [ ] No new global styles that could leak into host page (widget)
- [ ] Existing design tokens or component patterns used where possible
- [ ] Motion is optional or respects reduced-motion preference
