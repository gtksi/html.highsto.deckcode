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

export function parseDeckHtml(html, code = "") {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const rows = [];
  const candidates = [...doc.querySelectorAll("a")].filter(a => {
    const href = a.getAttribute("href") || "";
    const img = a.querySelector("img");
    const src = img?.getAttribute("src") || "";
    return /\.(webp|png|jpg|jpeg)(\?|$)/i.test(src) || /card\d+|CRF_|PRM_/i.test(src) || /card/i.test(href);
  });

  for (const a of candidates) {
    const img = a.querySelector("img");
    const src = img?.getAttribute("src") || "";
    const parent = a.parentElement;
    const text = normalizeText(parent?.innerText || a.innerText || "");
    const alt = normalizeText(img?.getAttribute("alt") || "");
    const countMatch = text.match(/(?:×|x|X)\s*(\d{1,2})\s*$/) || text.match(/(\d{1,2})\s*枚?\s*$/);
    if (!countMatch) continue;
    const count = Number(countMatch[1]);
    if (!Number.isFinite(count) || count < 1 || count > 4) continue;
    const lines = [...(parent?.innerText || "").split(/\n+/)].map(normalizeText).filter(Boolean);
    const nameCandidates = lines.filter(line => !/(?:×|x|X)\s*\d+$/.test(line) && !/^\d+\s*枚?$/.test(line) && line !== "デッキ表示");
    const name = nameCandidates.at(-1) || alt || "";
    const alias = nameCandidates.length >= 2 ? nameCandidates.at(-2) : "";
    rows.push({ name, alias, count, image: src, text });
  }

  if (!rows.length) {
    const bodyText = normalizeText(doc.body?.innerText || "");
    for (const m of bodyText.matchAll(/([^\n]{1,80}?)\s*(?:×|x|X)\s*(\d{1,2})/g)) {
      const name = normalizeText(m[1]);
      const count = Number(m[2]);
      if (name && count >= 1 && count <= 4) rows.push({ name, alias: "", count, image: "", text: m[0] });
    }
  }
  return { code, total: rows.reduce((sum, row) => sum + row.count, 0), cards: rows };
}
