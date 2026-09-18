import { parseCodes, fetchDeckPage, parseDeckHtml } from "./deck-code.js";
import { normalizeCards, matchCard } from "./card-matcher.js";
import { saveCsv, saveMarkdown, saveJson } from "./export.js";
import { fetchTournamentPage, parseTournamentHtml } from "./tournament.js";

let cards = [];
let cardMap = new Map();
let decks = [];

const $ = id => document.getElementById(id);

async function init() {
  const res = await fetch("./data/cards.json");
  const data = await res.json();
  cards = data.cards ?? [];
  cardMap = normalizeCards(cards);
  $("cardMasterStatus").textContent =
    `${cards.length.toLocaleString()}件のカードマスタを読み込みました。`;
}

function render() {
  const total = decks.reduce(
    (n, d) => n + d.cards.reduce((m, c) => m + Number(c.count || 0), 0), 0
  );
  $("summary").textContent = `${decks.length}デッキ / ${total}枚`;

  const root = $("results");
  root.innerHTML = "";

  if (!decks.length) {
    root.innerHTML = `<p class="muted">まだデータがありません。</p>`;
    return;
  }

  for (const deck of decks) {
    const section = document.createElement("section");
    section.className = "deck";
    section.innerHTML = `
      <div class="deck-header">
        <h3>${escapeHtml(deck.deckName || "デッキ")}</h3>
        <div class="deck-meta">コード：${escapeHtml(deck.code)}</div>
      </div>
    `;

    const table = document.createElement("table");
    table.innerHTML = `
      <thead><tr>
        <th>カード</th><th>異名</th><th>枚数</th>
        <th>Rank</th><th>Power</th><th>効果</th>
      </tr></thead>
    `;
    const tbody = document.createElement("tbody");

    for (const card of deck.cards) {
      const m = card.masterMatches?.[0] ?? {};
      const tr = document.createElement("tr");
      const effects = [
        m.effectName1 && `${m.effectName1}: ${m.effectContent1 ?? ""}`,
        m.effectName2 && `${m.effectName2}: ${m.effectContent2 ?? ""}`
      ].filter(Boolean).join("\n");

      tr.innerHTML = `
        <td>${escapeHtml(card.resolvedName || card.name)}</td>
        <td>${escapeHtml(card.resolvedAlias || "")}</td>
        <td>${card.count}</td>
        <td>${m.rank ?? ""}</td>
        <td>${m.power ?? ""}</td>
        <td class="effect">${escapeHtml(effects)}</td>
      `;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    section.appendChild(table);
    root.appendChild(section);
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadCodes(codes) {
  const status = $("tournamentStatus");
  status.className = "status";
  status.textContent = `${codes.length}件のコードを処理しています…`;

  for (const code of codes) {
    try {
      const html = await fetchDeckPage(code);
      let deck = parseDeckHtml(html, code);
      deck.cards = deck.cards.map(c => matchCard(c, cardMap));
      decks.push(deck);
    } catch (e) {
      status.textContent += `\n${code}: ${e.message}`;
    }
  }

  render();

  if (decks.length) {
    status.textContent += `\n取得済み：${decks.length}デッキ`;
    status.className = "status success";
  }
}

$("loadCodes").addEventListener("click", async () => {
  const codes = parseCodes($("deckCodes").value);
  if (!codes.length) {
    $("tournamentStatus").textContent = "有効なデッキコードがありません。";
    return;
  }
  await loadCodes(codes);
});

$("clearAll").addEventListener("click", () => {
  decks = [];
  $("deckCodes").value = "";
  $("tournamentStatus").textContent = "";
  render();
});

$("loadTournament").addEventListener("click", async () => {
  const url = $("tournamentUrl").value.trim();
  if (!url) return;

  const status = $("tournamentStatus");
  try {
    status.textContent = "大会ページを取得しています…";
    const html = await fetchTournamentPage(url);
    const result = parseTournamentHtml(html);
    $("deckCodes").value = result.codes.join("\n");
    status.textContent =
      `大会名候補：${result.title || "(取得できず)"}\n` +
      `候補コード：${result.codes.length}件\n` +
      `内容を確認して「デッキを取得」を押してください。`;
  } catch (e) {
    status.textContent =
      `大会ページを取得できませんでした。\n${e.message}\n` +
      `CORS等の制約が考えられます。`;
  }
});

$("exportCsv").addEventListener("click", () => saveCsv(decks));
$("exportMd").addEventListener("click", () => saveMarkdown(decks));
$("exportJson").addEventListener("click", () => saveJson(decks));

init().catch(e => {
  $("cardMasterStatus").textContent = `カードマスタの読み込みに失敗しました: ${e.message}`;
});

render();
