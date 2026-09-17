const DEFAULT_WORKER_BASE_URL = "https://highsto-deck-api.YOUR_SUBDOMAIN.workers.dev";

function getWorkerBaseUrl() {
  const configured = window.HIGHSTO_WORKER_BASE_URL;
  return (configured || DEFAULT_WORKER_BASE_URL).replace(/\/+$/, "");
}

export function parseCodes(text) {
  // Manual input may contain commas/newlines. Keep only actual 8-character
  // Hi!story deck codes so pasted page text cannot become a request.
  const tokens = String(text || "")
    .split(/[\s,，、]+/)
    .map(s => s.trim())
    .filter(Boolean);
  return [...new Set(tokens.filter(s => /^[A-Za-z0-9]{8}$/.test(s)))];
}

export async function fetchDeckPage(code) {
  const normalized = String(code).trim();
  if (!/^[A-Za-z0-9]{8}$/.test(normalized)) {
    throw new Error("デッキコードは8文字の英数字で指定してください。");
  }
  const url = `${getWorkerBaseUrl()}/api/deck/${encodeURIComponent(normalized)}`;
  const response = await fetch(url, { method: "GET", headers: { Accept: "text/html" } });
  if (!response.ok) throw new Error(`デッキ取得に失敗しました (${response.status})`);
  return response.text();
}

function normalizeText(text) {
  return String(text || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function getCount(text) {
  const value = normalizeText(text);
  const match = value.match(/(?:×|x|X)\s*(\d{1,2})(?:\s*枚)?(?:\s|$)/);
  if (!match) return null;
  const count = Number(match[1]);
  return Number.isInteger(count) && count >= 1 && count <= 4 ? count : null;
}

function hasCardLikeImage(img) {
  if (!img) return false;
  const src = img.getAttribute("src") || "";
  const alt = normalizeText(img.getAttribute("alt") || "");
  return Boolean(
    /app\.highsto\.net\/assets\/images\/cards\//i.test(src) ||
    /(?:^|\/)cards?\//i.test(src) ||
    /(?:card\d+|CRF_|PRM_)/i.test(src) ||
    alt.length > 0
  );
}

function getLines(element) {
  return [...(element?.innerText || "").split(/\n+/)]
    .map(normalizeText)
    .filter(Boolean);
}

function isUiText(line) {
  return /^(Amazon|Twitter|X\s*\(旧Twitter\)|LINE|Highsto|Copyright|デッキ画像を生成|A4印刷用出力|PNG出力|PDF出力|コピー|QRコード|デッキ表示|デッキレシピ|合計枚数)$/i.test(line);
}

function cleanCardLines(lines) {
  return lines.filter(line => {
    if (isUiText(line)) return false;
    if (/(?:×|x|X)\s*\d{1,2}(?:\s*枚)?(?:\s|$)/.test(line)) return false;
    if (/^\d{1,2}\s*枚?$/.test(line)) return false;
    return true;
  });
}

function findCardContainer(img) {
  // First choice: smallest ancestor containing this image, exactly one
  // card-like image, and a valid x1-x4 count.
  let node = img.parentElement;
  for (let depth = 0; node && depth < 14; depth++, node = node.parentElement) {
    const images = [...node.querySelectorAll("img")].filter(hasCardLikeImage);
    if (images.length !== 1) continue;
    const count = getCount(node.innerText || "");
    if (count != null) return { node, count };
  }
  return null;
}

function extractCard(img, container) {
  const src = img.getAttribute("src") || "";
  const alt = normalizeText(img.getAttribute("alt") || "");
  const lines = cleanCardLines(getLines(container.node));
  const count = container.count;

  // Prefer image alt because the site may expose the card name there.
  let name = alt;
  let alias = "";

  if (name) {
    const remaining = lines.filter(line => line !== name);
    // Usually the alias is the text immediately associated with the card name.
    // Avoid treating arbitrary surrounding text as an alias.
    alias = remaining.find(line => line !== name && line.length <= 80) || "";
  } else {
    // If alt is absent, choose the last non-UI line as the card name.
    // A preceding short line is a possible alias.
    name = lines.at(-1) || "";
    alias = lines.length >= 2 ? lines.at(-2) : "";
  }

  if (!name || isUiText(name)) return null;

  return {
    name,
    alias: alias === name || isUiText(alias) ? "" : alias,
    count,
    image: src,
    text: normalizeText(container.node.innerText || "")
  };
}

export function parseDeckHtml(html, code = "") {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const rows = [];
  const seen = new Set();

  // Work from images rather than anchors. Some valid deck pages do not wrap
  // card images in an <a>, which made the previous parser return zero cards.
  const images = [...doc.querySelectorAll("img")].filter(hasCardLikeImage);

  for (const img of images) {
    const container = findCardContainer(img);
    if (!container) continue;

    const card = extractCard(img, container);
    if (!card) continue;

    const key = `${card.image}|${card.name}|${card.alias}|${card.count}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(card);
  }

  // Fallback: locate elements containing a count and then inspect their
  // nearest card-like image. This handles markup where the count is rendered
  // outside the immediate image wrapper.
  if (!rows.length) {
    const countElements = [...doc.querySelectorAll("body *")].filter(el => {
      const text = normalizeText(el.innerText || "");
      return text && getCount(text) != null && text.length <= 300;
    });

    for (const el of countElements) {
      const img = [...el.querySelectorAll("img")].find(hasCardLikeImage) ||
        (hasCardLikeImage(el.querySelector("img")) ? el.querySelector("img") : null);
      if (!img) continue;

      const container = { node: el, count: getCount(el.innerText || "") };
      const card = extractCard(img, container);
      if (!card) continue;
      const key = `${card.image}|${card.name}|${card.alias}|${card.count}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(card);
    }
  }

  return {
    code,
    total: rows.reduce((sum, row) => sum + row.count, 0),
    cards: rows
  };
}
