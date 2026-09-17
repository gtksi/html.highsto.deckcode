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

export function parseTournamentHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const text = doc.body?.innerText ?? "";
  const codes = [...new Set((text.match(/\b[A-Za-z0-9]{6,16}\b/g) ?? [])
    .filter(x => /^[A-Za-z0-9]{6,16}$/.test(x)))];

  return {
    title: doc.querySelector("h1")?.textContent?.trim() || "",
    codes
  };
}
