const ALLOWED_ORIGIN = "https://gtksi.github.io";

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
  if (origin === ALLOWED_ORIGIN) headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGIN;
  return headers;
}

function jsonResponse(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) },
  });
}

function isValidDeckCode(code) {
  return /^[A-Za-z0-9_-]{6,32}$/.test(code);
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    if (url.pathname === "/api/health") return jsonResponse({ ok: true, service: "highsto-deck-api" }, 200, origin);

    const match = url.pathname.match(/^\/api\/deck\/([^/]+)$/);
    if (!match) return jsonResponse({ error: "Not found" }, 404, origin);
    if (request.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405, origin);
    if (origin && origin !== ALLOWED_ORIGIN) return jsonResponse({ error: "Origin not allowed" }, 403, origin);

    const code = decodeURIComponent(match[1]);
    if (!isValidDeckCode(code)) return jsonResponse({ error: "Invalid deck code" }, 400, origin);

    const targetUrl = `https://highsto.net/deck-code/${encodeURIComponent(code)}`;
    try {
      const upstream = await fetch(targetUrl, {
        headers: { "User-Agent": "highsto-deck-analyzer/1.0", "Accept": "text/html,application/xhtml+xml" },
      });
      if (!upstream.ok) return jsonResponse({ error: "Upstream request failed", status: upstream.status, deckCode: code }, 502, origin);
      const html = await upstream.text();
      return new Response(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300", ...corsHeaders(origin) },
      });
    } catch (error) {
      return jsonResponse({ error: "Failed to fetch highsto.net", message: String(error), deckCode: code }, 502, origin);
    }
  },
};
