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

    // Keep a JS-driven viewport unit for mobile keyboards (works inside shadow DOM via CSS var inheritance)
    const updateVh = () => {
      const h = window.visualViewport?.height || window.innerHeight || 0;
      if (h) host.style.setProperty('--cb-vh', `${h * 0.01}px`);
    };
    updateVh();
    window.addEventListener('resize', updateVh, { passive: true });
    window.visualViewport?.addEventListener?.('resize', updateVh, { passive: true });
    window.visualViewport?.addEventListener?.('scroll', updateVh, { passive: true });

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
