const DEFAULT_WORKER_BASE_URL = "https://highsto-deck-api.YOUR_SUBDOMAIN.workers.dev";

function getWorkerBaseUrl() {
  const configured = window.HIGHSTO_WORKER_BASE_URL;
  return (configured || DEFAULT_WORKER_BASE_URL).replace(/\/+$/, "");
}

function getTournamentId(input) {
  let parsed;
  try {
    parsed = new URL(String(input).trim());
  } catch {
    throw new Error("大会結果URLの形式が正しくありません。");
  }

  if (parsed.hostname !== "highsto.net" || !/^\/news\/\d+\/?$/.test(parsed.pathname)) {
    throw new Error("対応しているURLは https://highsto.net/news/<数字>/ です。");
  }

  return parsed.pathname.match(/^\/news\/(\d+)/)[1];
}

export async function fetchTournamentPage(input) {
  const tournamentId = getTournamentId(input);
  const url = `${getWorkerBaseUrl()}/api/tournament/${tournamentId}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "text/html" }
  });
  if (!response.ok) throw new Error(`大会結果取得に失敗しました (${response.status})`);
  return await response.text();
}

function normalizeLine(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/[\t\r ]+/g, " ")
    .trim();
}

function isDeckCode(value) {
  // Hi!story deck-code pages use an 8-character alphanumeric code.
  // Keep this strict so Amazon/X/footer text can never become a code.
  return /^[A-Za-z0-9]{8}$/.test(value);
}

export function parseTournamentHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const lines = [...(doc.body?.innerText || "").split(/\n+/)]
    .map(normalizeLine)
    .filter(Boolean);

  const codes = [];
  const seen = new Set();

  const add = code => {
    if (!isDeckCode(code) || seen.has(code)) return;
    seen.add(code);
    codes.push(code);
  };

  // Primary parser: the official tournament pages explicitly label each code
  // as "デッキコード：XXXXXXXX". This avoids picking up navigation/footer
  // text such as Amazon, Twitter, Highsto, or Copyright.
  for (const line of lines) {
    const match = line.match(/デッキコード\s*[：:]\s*([A-Za-z0-9]{8})(?![A-Za-z0-9])/);
    if (match) add(match[1]);
  }

  // Fallback for a markup variant where the label and code are separated into
  // adjacent text nodes/lines. Only accept a line that consists of exactly
  // one 8-character alphanumeric token.
  if (!codes.length) {
    for (const line of lines) {
      if (isDeckCode(line)) add(line);
    }
  }

  return {
    title: doc.querySelector("h1")?.textContent?.trim() || "",
    codes
  };
}
