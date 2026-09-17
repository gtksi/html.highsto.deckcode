const DEFAULT_WORKER_BASE_URL = "https://highsto-deck-api.YOUR_SUBDOMAIN.workers.dev";

function getWorkerBaseUrl() {
  const configured = window.HIGHSTO_WORKER_BASE_URL;
  return (configured || DEFAULT_WORKER_BASE_URL).replace(/\/+$/, "");
}

export function parseCodes(text) {
  return [...new Set(String(text || "").split(/[\s,，、]+/).map(s => s.trim()).filter(Boolean))];
}

export async function fetchDeckPage(code) {
  const normalized = String(code).trim();
  if (!normalized) throw new Error("デッキコードが空です。");
  const url = `${getWorkerBaseUrl()}/api/deck/${encodeURIComponent(normalized)}`;
  const response = await fetch(url, { method: "GET", headers: { Accept: "text/html" } });
  if (!response.ok) throw new Error(`デッキ取得に失敗しました (${response.status})`);
  return response.text();
}

function normalizeText(text) {
  return String(text || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function getLines(element) {
  return [...(element?.innerText || "").split(/\n+/)]
    .map(normalizeText)
    .filter(Boolean);
}

function getCount(text) {
  const value = normalizeText(text);
  const match = value.match(/(?:×|x|X)\s*(\d{1,2})(?:\s*枚)?(?:\s|$)/);
  if (!match) return null;
  const count = Number(match[1]);
  return Number.isInteger(count) && count >= 1 && count <= 4 ? count : null;
}

function isCardImage(img) {
  if (!img) return false;
  const src = img.getAttribute("src") || "";
  const alt = normalizeText(img.getAttribute("alt") || "");
  return Boolean(alt) || /\.(webp|png|jpg|jpeg)(\?|$)/i.test(src) || /card\d+|CRF_|PRM_/i.test(src);
}

function findCardContainer(anchor) {
  // The Hi!story page has changed its wrapper structure before. Do not assume
  // anchor.parentElement is the card row: on the first/last card it can span
  // a much larger part of the deck page and accidentally include UI text.
  // Instead, choose the smallest ancestor that contains exactly one card image
  // and a valid x1..x4 count.
  let node = anchor.parentElement;
  for (let depth = 0; node && depth < 8; depth++, node = node.parentElement) {
    const images = [...node.querySelectorAll("img")].filter(isCardImage);
    if (images.length !== 1) continue;
    const count = getCount(node.innerText || "");
    if (count != null) return { node, count, image: images[0] };
  }
  return null;
}

function extractCard(container, anchor) {
  const img = container.image || anchor.querySelector("img");
  const src = img?.getAttribute("src") || "";
  const alt = normalizeText(img?.getAttribute("alt") || "");
  const lines = getLines(container.node);
  const count = container.count;

  const cleaned = lines.filter(line => {
    if (/(?:×|x|X)\s*\d{1,2}(?:\s*枚)?(?:\s|$)/.test(line)) return false;
    if (/^\d{1,2}\s*枚?$/.test(line)) return false;
    if (["デッキ表示", "デッキレシピ", "合計枚数"].includes(line)) return false;
    return true;
  });

  // The image alt is the card name. The text immediately associated with the
  // image is normally the alias; cards without an alias have no remaining line.
  let name = alt;
  let alias = "";

  if (name) {
    const remaining = cleaned.filter(line => line !== name);
    alias = remaining.at(-1) || "";
  } else {
    name = cleaned.at(-1) || "";
    alias = cleaned.length >= 2 ? cleaned.at(-2) : "";
  }

  // Guard against page controls accidentally being treated as an alias/name.
  if (/^(デッキ画像を生成|A4印刷用出力|PNG出力|PDF出力|コピー|QRコード)$/.test(name)) {
    return null;
  }
  if (!name) return null;

  return {
    name,
    alias,
    count,
    image: src,
    text: normalizeText(container.node.innerText || anchor.innerText || "")
  };
}

export function parseDeckHtml(html, code = "") {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const rows = [];
  const seen = new Set();

  const candidates = [...doc.querySelectorAll("a")].filter(a => {
    const href = a.getAttribute("href") || "";
    const img = a.querySelector("img");
    const src = img?.getAttribute("src") || "";
    return isCardImage(img) || /card\d+|CRF_|PRM_/i.test(src) || /card/i.test(href);
  });

  for (const a of candidates) {
    const container = findCardContainer(a);
    if (!container) continue;

    const card = extractCard(container, a);
    if (!card) continue;

    // One anchor can sometimes be encountered more than once through nested
    // markup. Use image URL + name + alias as the parser-level identity.
    const key = `${card.image}|${card.name}|${card.alias}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(card);
  }

  // Fallback for a future markup variant without image links. Keep it strict:
  // only accept lines that look like an actual card count and never parse the
  // page header/footer as a card name.
  if (!rows.length) {
    const lines = [...(doc.body?.innerText || "").split(/\n+/)].map(normalizeText).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const count = getCount(lines[i]);
      if (count == null) continue;
      const name = normalizeText(lines[i].replace(/(?:×|x|X)\s*\d{1,2}(?:\s*枚)?/, ""));
      if (!name || /^(合計枚数|デッキレシピ|デッキ表示)$/.test(name)) continue;
      rows.push({ name, alias: "", count, image: "", text: lines[i] });
    }
  }

  return { code, total: rows.reduce((sum, row) => sum + row.count, 0), cards: rows };
}
