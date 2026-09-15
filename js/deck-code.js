const CODE_RE = /^[A-Za-z0-9]{6,16}$/;

export function parseCodes(text) {
  return [...new Set(
    text.split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean)
      .filter(s => CODE_RE.test(s))
  )];
}

/*
 * Official public deck-code pages are the intended source:
 *   https://highsto.net/deck-code/{code}
 *
 * Browser CORS policy may prevent direct fetches from GitHub Pages.
 * The parser below is intentionally defensive and is kept separate from
 * the card-master matching logic so the source can be replaced later by
 * an API/Worker implementation without changing the UI.
 */
export async function fetchDeckPage(code) {
  const url = `https://highsto.net/deck-code/${encodeURIComponent(code)}`;
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return await response.text();
}

function cleanText(value) {
  return value.replace(/\s+/g, " ").trim();
}

export function parseDeckHtml(html, code) {
  const doc = new DOMParser().parseFromString(html, "text/html");

  // First attempt: extract text blocks containing "xN".
  const rows = [];
  const seen = new Set();

  for (const el of doc.querySelectorAll("li, tr, article, div")) {
    const text = cleanText(el.textContent || "");
    const m = text.match(/^(.*?)(?:\s+|　+)[x×](\d+)$/i);
    if (!m) continue;

    const name = cleanText(m[1]);
    const count = Number(m[2]);
    if (!name || count <= 0 || count > 4) continue;

    const key = `${name}|${count}|${rows.length}`;
    if (seen.has(key)) continue;
    seen.add(key);

    rows.push({
      name,
      alias: "",
      count
    });
  }

  return {
    code,
    sourceUrl: `https://highsto.net/deck-code/${encodeURIComponent(code)}`,
    deckName: "",
    cards: rows
  };
}
