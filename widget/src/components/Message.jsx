import React from 'react';

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function Message({ role, content, timestamp, primaryColor, imageUrl }) {
  return (
    <div className={`cb-msg ${role}`}>
      <div
        className="cb-bubble-text"
        style={role === 'user' ? { background: primaryColor } : undefined}
      >
        {imageUrl ? (
          <div className="cb-msg-image-wrap">
            <img className="cb-msg-image" src={imageUrl} alt="Uploaded" />
          </div>
        ) : null}
        {content && (!imageUrl || (content !== 'Photo' && content !== 'Image shared')) ? content : null}
      </div>
      <span className="cb-msg-time">{formatTime(timestamp)}</span>
    </div>
  );
}
