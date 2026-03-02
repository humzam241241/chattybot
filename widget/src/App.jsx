import React, { useState, useEffect } from 'react';
import ChatBubble from './components/ChatBubble';
import ChatWindow from './components/ChatWindow';
import { injectStyles } from './styles';

export default function App({ siteId, apiUrl, shadow }) {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState(null);

  // Inject styles into shadow DOM on mount
  useEffect(() => {
    injectStyles(shadow);
  }, [shadow]);

  // Fetch site branding config once on load
  useEffect(() => {
    fetch(`${apiUrl}/site-config/${siteId}`)
      .then((r) => r.json())
      .then((data) => setConfig(data.config))
      .catch(() => {
        // Fallback config so widget still renders if API is unreachable
        setConfig({ company_name: 'Support', primary_color: '#6366f1' });
      });
  }, [siteId, apiUrl]);

  if (!config) return null;

  const primaryColor = config.primary_color || '#6366f1';

  return (
    <>
      {isOpen && (
        <ChatWindow
          siteId={siteId}
          apiUrl={apiUrl}
          config={config}
          primaryColor={primaryColor}
          onClose={() => setIsOpen(false)}
        />
      )}
      <ChatBubble
        primaryColor={primaryColor}
        isOpen={isOpen}
        onClick={() => setIsOpen((o) => !o)}
      />
    </>
  );
}
