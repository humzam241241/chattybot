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
  const script = document.currentScript ||
    document.querySelector('script[data-site-id]');

  if (!script) {
    console.error('[ChattyBot] Could not find script tag with data-site-id.');
    return;
  }

  const siteId = script.getAttribute('data-site-id');
  const apiUrl = script.getAttribute('data-api-url') || 'https://chattybot-backend.onrender.com';

  if (!siteId) {
    console.error('[ChattyBot] data-site-id attribute is required.');
    return;
  }

  // Create a host element appended to body
  const host = document.createElement('div');
  host.id = 'chattybot-root';
  document.body.appendChild(host);

  // Use Shadow DOM to isolate styles from the host page
  const shadow = host.attachShadow({ mode: 'open' });

  const mountPoint = document.createElement('div');
  shadow.appendChild(mountPoint);

  const root = createRoot(mountPoint);
  root.render(<App siteId={siteId} apiUrl={apiUrl} shadow={shadow} />);
})();
