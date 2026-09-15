export async function fetchTournamentPage(url) {
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
