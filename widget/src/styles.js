/**
 * All widget styles are injected into the Shadow DOM as a <style> tag.
 * This guarantees complete isolation from the host site's CSS.
 */
export function injectStyles(shadow) {
  const style = document.createElement('style');
  style.textContent = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    .cb-bubble {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(0,0,0,0.18);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      z-index: 999999;
    }
    .cb-bubble:hover { transform: scale(1.08); box-shadow: 0 6px 24px rgba(0,0,0,0.22); }
    .cb-bubble svg { width: 26px; height: 26px; fill: #fff; }

    .cb-window {
      position: fixed;
      bottom: 92px;
      right: 24px;
      width: min(420px, 100vw);
      max-height: min(600px, 80vh);
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.16);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      overscroll-behavior: contain;
      z-index: 999998;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      animation: cb-slide-up 0.2s ease;
    }
    @keyframes cb-slide-up {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .cb-header {
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #fff;
      flex-shrink: 0;
    }
    .cb-header-info { display: flex; align-items: center; gap: 10px; }
    .cb-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: rgba(255,255,255,0.25);
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; font-weight: 700;
    }
    .cb-company { font-weight: 600; font-size: 15px; }
    .cb-status { font-size: 12px; opacity: 0.85; }
    .cb-close {
      background: none; border: none; cursor: pointer;
      color: #fff; opacity: 0.8; line-height: 1;
      font-size: 22px; padding: 2px 4px; border-radius: 4px;
      transition: opacity 0.15s;
    }
    .cb-close:hover { opacity: 1; }

    .cb-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scroll-behavior: smooth;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
    }
    .cb-messages::-webkit-scrollbar { width: 4px; }
    .cb-messages::-webkit-scrollbar-thumb { background: #ddd; border-radius: 4px; }

    .cb-chips {
      padding: 10px 12px 0;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      border-top: 1px solid #f0f0f0;
      background: #fff;
      flex-shrink: 0;
    }
    .cb-chip {
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      color: #0f172a;
      border-radius: 999px;
      padding: 7px 10px;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
      max-width: 100%;
      text-align: left;
    }
    .cb-chip:hover { background: #eef2ff; border-color: #c7d2fe; }
    .cb-chip:disabled { opacity: 0.6; cursor: not-allowed; }

    .cb-cta-row {
      padding: 10px 12px 0;
      display: flex;
      justify-content: flex-start;
      background: #fff;
      flex-shrink: 0;
    }
    .cb-cta {
      width: 100%;
      border: none;
      background: var(--cb-primary);
      color: #fff;
      border-radius: 10px;
      padding: 10px 12px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .cb-cta:hover { opacity: 0.92; }

    /* Booking modal (inline scheduling) */
    .cb-modal-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.55);
      display: flex;
      flex-direction: column;
      z-index: 999999;
    }
    .cb-modal {
      margin: 12px;
      background: #fff;
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    .cb-modal-header {
      padding: 10px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #f0f0f0;
      flex-shrink: 0;
      background: #fff;
    }
    .cb-modal-title {
      font-weight: 600;
      color: #0f172a;
      font-size: 13px;
    }
    .cb-modal-close {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 22px;
      line-height: 1;
      padding: 2px 6px;
      border-radius: 6px;
      color: #0f172a;
      opacity: 0.8;
    }
    .cb-modal-close:hover { opacity: 1; }
    .cb-modal-frame {
      flex: 1;
      width: 100%;
      border: 0;
    }

    .cb-msg { display: flex; flex-direction: column; max-width: 82%; gap: 2px; }
    .cb-msg.bot { align-self: flex-start; }
    .cb-msg.user { align-self: flex-end; }

    .cb-bubble-text {
      padding: 10px 13px;
      border-radius: 14px;
      line-height: 1.45;
      word-break: break-word;
    }
    .cb-msg.bot .cb-bubble-text {
      background: #f1f5f9;
      color: #1e293b;
      border-bottom-left-radius: 4px;
    }
    .cb-msg.user .cb-bubble-text {
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    .cb-msg-time { font-size: 10px; color: #94a3b8; padding: 0 4px; }
    .cb-msg.user .cb-msg-time { text-align: right; }

    .cb-typing {
      display: flex; align-items: center; gap: 5px;
      padding: 10px 13px;
      background: #f1f5f9;
      border-radius: 14px;
      border-bottom-left-radius: 4px;
      width: fit-content;
    }
    .cb-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #94a3b8;
      animation: cb-bounce 1.2s infinite;
    }
    .cb-dot:nth-child(2) { animation-delay: 0.2s; }
    .cb-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes cb-bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30%            { transform: translateY(-5px); }
    }

    .cb-input-row {
      padding: 12px;
      border-top: 1px solid #f0f0f0;
      display: flex;
      gap: 8px;
      flex-shrink: 0;
      background: #fff;
    }
    .cb-input {
      flex: 1;
      padding: 9px 13px;
      border: 1.5px solid #e2e8f0;
      border-radius: 24px;
      outline: none;
      font-size: 14px;
      font-family: inherit;
      color: #1e293b;
      transition: border-color 0.15s;
      resize: none;
      line-height: 1.4;
      max-height: 100px;
      overflow-y: auto;
    }
    .cb-input:focus { border-color: var(--cb-primary); }
    .cb-send {
      width: 42px; height: 42px; border-radius: 50%; border: none;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      color: #fff; flex-shrink: 0; transition: opacity 0.15s; align-self: flex-end;
      min-width: 42px; /* Ensure tap target is large enough on mobile */
    }
    .cb-send:disabled { opacity: 0.5; cursor: not-allowed; }
    .cb-send svg { width: 19px; height: 19px; fill: #fff; }

    /* Lead form */
    .cb-lead-form {
      background: #f8fafc;
      border-top: 1px solid #f0f0f0;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex-shrink: 0;
    }
    .cb-lead-title { font-weight: 600; color: #1e293b; font-size: 13px; }
    .cb-lead-field {
      padding: 9px 12px;
      border: 1.5px solid #e2e8f0;
      border-radius: 8px;
      font-size: 13px;
      font-family: inherit;
      color: #1e293b;
      outline: none;
      transition: border-color 0.15s;
    }
    .cb-lead-field:focus { border-color: var(--cb-primary); }
    .cb-lead-submit {
      padding: 9px; border: none; border-radius: 8px;
      font-weight: 600; font-size: 13px; cursor: pointer;
      color: #fff; transition: opacity 0.15s;
    }
    .cb-lead-submit:hover { opacity: 0.9; }
    .cb-lead-dismiss {
      background: none; border: none; cursor: pointer;
      font-size: 12px; color: #94a3b8; text-align: center;
      font-family: inherit;
    }
    .cb-lead-dismiss:hover { color: #64748b; }

    .cb-powered {
      text-align: center; font-size: 11px; color: #cbd5e1;
      padding: 6px 0 4px;
    }

    @media (max-width: 480px) {
      .cb-window { 
        width: 100vw;
        max-width: 100vw;
        right: 0;
        bottom: 0;
        height: calc(var(--cb-vh, 1vh) * 100);
        max-height: calc(var(--cb-vh, 1vh) * 100);
        border-radius: 0;
      }
      .cb-bubble {
        bottom: 16px;
        right: 16px;
        width: 60px;
        height: 60px;
      }
      .cb-chip {
        font-size: 13px;
        padding: 8px 12px;
      }
      .cb-input-row {
        padding: 14px;
        /* Prevent keyboard from covering input on iOS */
        padding-bottom: calc(14px + env(safe-area-inset-bottom));
      }
      .cb-send {
        width: 44px;
        height: 44px;
        min-width: 44px;
      }

      .cb-cta-row {
        padding-bottom: env(safe-area-inset-bottom);
      }

      .cb-modal {
        margin: 0;
        border-radius: 0;
      }

      .cb-powered {
        padding-bottom: env(safe-area-inset-bottom);
      }
    }
  `;
  shadow.appendChild(style);
}
