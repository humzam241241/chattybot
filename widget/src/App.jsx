import React, { useState, useEffect, useRef } from 'react';
import ChatBubble from './components/ChatBubble';
import ChatWindow from './components/ChatWindow';
import { injectStyles } from './styles';

export default function App({ siteId, apiUrl, shadow }) {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState(null);
  const scrollLockRef = useRef(null);

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

  // Mobile scroll lock when the chat is open (prevents the page behind from scrolling)
  useEffect(() => {
    const isMobile = window.matchMedia?.('(max-width: 480px)')?.matches;
    if (!isMobile) return;

    if (isOpen) {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const body = document.body;
      const docEl = document.documentElement;

      scrollLockRef.current = {
        scrollY,
        bodyStyle: {
          position: body.style.position,
          top: body.style.top,
          left: body.style.left,
          right: body.style.right,
          width: body.style.width,
          overflow: body.style.overflow,
        },
        docStyle: {
          overflow: docEl.style.overflow,
          height: docEl.style.height,
        },
      };

      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';

      docEl.style.overflow = 'hidden';
      docEl.style.height = '100%';
      return;
    }

    // Unlock
    const prev = scrollLockRef.current;
    if (prev) {
      const body = document.body;
      const docEl = document.documentElement;
      body.style.position = prev.bodyStyle.position;
      body.style.top = prev.bodyStyle.top;
      body.style.left = prev.bodyStyle.left;
      body.style.right = prev.bodyStyle.right;
      body.style.width = prev.bodyStyle.width;
      body.style.overflow = prev.bodyStyle.overflow;
      docEl.style.overflow = prev.docStyle.overflow;
      docEl.style.height = prev.docStyle.height;
      window.scrollTo(0, prev.scrollY);
      scrollLockRef.current = null;
    }
  }, [isOpen]);

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
