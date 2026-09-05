import { NextResponse } from "next/server";

const SOURCES = [
  "https://everyayah.com/data/warsh/warsh_ibrahim_aldosary_128kbps",
  "https://everyayah.com/data/warsh/warsh_yassin_al_jazaery_64kbps",
] as const;

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "invalid_audio_code" }, { status: 400 });
  const requestedFallback = new URL(request.url).searchParams.get("source") === "fallback";
  const sources = requestedFallback ? [SOURCES[1]] : SOURCES;
  const range = request.headers.get("range");

  for (const base of sources) {
    try {
      const upstream = await fetch(`${base}/${code}.mp3`, {
        ...(range ? { headers: { Range: range } } : {}),
        cache: "force-cache",
        next: { revalidate: 60 * 60 * 24 * 30 },
      });
      if (!upstream.ok || !upstream.body) continue;
      const headers = new Headers();
      headers.set("Content-Type", upstream.headers.get("content-type") || "audio/mpeg");
      headers.set("Cache-Control", "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800");
      headers.set("Accept-Ranges", "bytes");
      for (const name of ["content-length", "content-range", "etag", "last-modified"]) {
        const value = upstream.headers.get(name);
        if (value) headers.set(name, value);
      }
      return new Response(upstream.body, { status: upstream.status, headers });
    } catch {
      // Try the reviewed secondary Warsh reciter.
    }
  }
  return NextResponse.json({ error: "audio_unavailable" }, { status: 502 });
}
