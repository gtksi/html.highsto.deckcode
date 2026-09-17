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

function normalizeImageUrl(value) {
  if (!value) return "";
  try {
    const u = new URL(String(value), "https://highsto.net");
    u.hash = "";
    u.search = "";
    return decodeURIComponent(u.toString()).replace(/\/$/, "").toLowerCase();
  } catch {
    return decodeURIComponent(String(value)).replace(/\/$/, "").toLowerCase();
  }
}

function findCountElement(img) {
  let node = img.closest("a") || img;
  for (let i = 0; i < 6 && node; i += 1) {
    const text = normalizeText(node.innerText || node.textContent || "");
    const match = text.match(/(?:×|x|X)\s*(\d{1,2})\s*$/) || text.match(/(\d{1,2})\s*枚?\s*$/);
    if (match) {
      const count = Number(match[1]);
      if (Number.isInteger(count) && count >= 1 && count <= 4) return { node, count };
    }
    node = node.parentElement;
  }
  return null;
}

function extractRowText(node) {
  return normalizeText(node?.innerText || node?.textContent || "");
}

function imageFileName(src) {
  try {
    const u = new URL(src, "https://highsto.net");
    return decodeURIComponent(u.pathname.split("/").pop() || "").toLowerCase();
  } catch {
    return decodeURIComponent(String(src).split("/").pop() || "").toLowerCase();
  }
}

export function parseDeckHtml(html, code = "") {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const rows = [];

  // The official page exposes each deck card as an image. Using the image URL
  // is much more reliable than parsing visible text: rank-0 cards such as
  // ハマボウ/シオリン/シュン have multiple variants with the same name.
  const images = [...doc.querySelectorAll("img")].filter(img => {
    const src = img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-original") || "";
    return /\/assets\/images\/cards\//i.test(src);
  });

  for (const img of images) {
    const src = img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-original") || "";
    const countInfo = findCountElement(img);
    if (!countInfo) continue;

    const imageKey = normalizeImageUrl(src);
    const alt = normalizeText(img.getAttribute("alt") || "");
    const text = extractRowText(countInfo.node);
    const href = img.closest("a")?.getAttribute("href") || "";

    rows.push({
      name: alt,
      alias: "",
      count: countInfo.count,
      image: src,
      imageFileName: imageFileName(src),
      href,
      text
    });
  }

  return {
    code,
    total: rows.reduce((sum, row) => sum + row.count, 0),
    cards: rows
  };
}
