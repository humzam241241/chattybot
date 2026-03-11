import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

/**
 * Widget entry point.
 * 
 * Reads configuration from the script tag's data attributes:
 *   <script src="/widget.js" data-site-id="abc123" data-api-url="https://api.chattybot.com"></script>
 * 
 * Creates an isolated shadow DOM container so our styles never
 * conflict with the host site's CSS.
 */
(function () {
  function mount() {
    const script =
      document.currentScript ||
      document.querySelector('script[data-site-id]');

    if (!script) {
      console.error('[ChattyBot] Could not find script tag with data-site-id.');
      return;
    }

    const siteId = script.getAttribute('data-site-id');
    const apiUrl = script.getAttribute('data-api-url') || 'https://chattybot-backend.onrender.com';
    const pricingUrl = script.getAttribute('data-pricing-url') || '';

    if (!siteId) {
      console.error('[ChattyBot] data-site-id attribute is required.');
      return;
    }

    // Avoid double-mounting if the script loads twice.
    if (document.getElementById('chattybot-root')) return;

    // Create a host element appended to body
    const host = document.createElement('div');
    host.id = 'chattybot-root';
    document.body.appendChild(host);

    // Keep JS-driven viewport variables for mobile keyboards (iOS Safari especially).
    // visualViewport gives us the *actual* visible area when the on-screen keyboard is open.
    let rafId = null;
    const updateViewportVars = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const vv = window.visualViewport;
        const layoutH = window.innerHeight || 0;
        const layoutW = window.innerWidth || 0;

        const vvHeight = Math.round(vv?.height ?? layoutH);
        const vvWidth = Math.round(vv?.width ?? layoutW);
        const vvTop = Math.round(vv?.offsetTop ?? 0);
        const vvLeft = Math.round(vv?.offsetLeft ?? 0);

        if (vvHeight) {
          host.style.setProperty('--cb-vh', `${vvHeight * 0.01}px`);
          host.style.setProperty('--cb-vv-height', `${vvHeight}px`);
        }
        if (vvWidth) host.style.setProperty('--cb-vv-width', `${vvWidth}px`);
        host.style.setProperty('--cb-vv-top', `${vvTop}px`);
        host.style.setProperty('--cb-vv-left', `${vvLeft}px`);
      });
    };
    updateViewportVars();
    window.addEventListener('resize', updateViewportVars, { passive: true });
    window.visualViewport?.addEventListener?.('resize', updateViewportVars, { passive: true });
    window.visualViewport?.addEventListener?.('scroll', updateViewportVars, { passive: true });

    // Use Shadow DOM to isolate styles from the host page
    const shadow = host.attachShadow({ mode: 'open' });

    const mountPoint = document.createElement('div');
    shadow.appendChild(mountPoint);

    const root = createRoot(mountPoint);
    root.render(<App siteId={siteId} apiUrl={apiUrl} shadow={shadow} pricingUrl={pricingUrl} />);
  }

  if (document.body) {
    mount();
  } else {
    window.addEventListener('DOMContentLoaded', mount, { once: true });
  }
})();
