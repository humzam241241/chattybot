"use client";

import { useEffect, useState } from "react";

export default function ConversationsPage({ params }) {
  const siteId = params?.id;

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!siteId) return;

    async function load() {
      try {
        const res = await fetch(`/api/conversations/site/${siteId}`);

        if (!res.ok) {
          throw new Error("Failed to load conversations");
        }

        const data = await res.json();

        setConversations(data?.conversations ?? []);
      } catch (err) {
        console.error("Conversation load error:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [siteId]);

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <h1>Conversations</h1>

      {conversations.length === 0 ? (
        <p>No conversations yet.</p>
      ) : (
        conversations.map((c) => (
          <div key={c.id}>
            {c.visitor_id}
          </div>
        ))
      )}
    </div>
  );
}
