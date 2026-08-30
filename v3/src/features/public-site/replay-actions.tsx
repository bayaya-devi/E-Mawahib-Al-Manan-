"use client";

import { Eye, Heart, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

export function ReplayActions({ replayId, initialLikes, views, labels }: { replayId: string; initialLikes: number; views: number; labels: { views: string; likes: string; share: string } }) {
  const [likes, setLikes] = useState(initialLikes);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void fetch(`/api/public/replays/${replayId}/view`, { method: "POST" }); }, [replayId]);
  async function toggleLike() {
    if (busy) return;
    setBusy(true);
    try { const response = await fetch(`/api/public/replays/${replayId}/like`, { method: "POST" }); const data = await response.json() as { likesCount?: number }; if (response.ok && typeof data.likesCount === "number") setLikes(data.likesCount); } finally { setBusy(false); }
  }
  async function share() { if (navigator.share) await navigator.share({ url: window.location.href }); else await navigator.clipboard.writeText(window.location.href); }
  return <div className="replay-actions"><span><Eye aria-hidden="true" size={17} />{views} {labels.views}</span><button type="button" onClick={toggleLike} disabled={busy}><Heart aria-hidden="true" size={17} />{likes} {labels.likes}</button><button type="button" onClick={() => void share()}><Share2 aria-hidden="true" size={17} />{labels.share}</button></div>;
}
