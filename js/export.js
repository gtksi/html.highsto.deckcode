function csvEscape(value) {
  const s = value == null ? "" : String(value);
  return `"${s.replaceAll('"', '""')}"`;
}

function download(text, filename, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCsv(decks) {
  const header = [
    "deck_code","deck_name","card_name","alias","count",
    "card_key","rank","power","attribute","effect_name_1",
    "effect_content_1","effect_name_2","effect_content_2",
    "card_id","product_id","pack_id","card_number","rarity"
  ];
  const lines = [header.map(csvEscape).join(",")];

  for (const deck of decks) {
    for (const card of deck.cards) {
      const m = card.masterMatches?.[0] ?? {};
      lines.push([
        deck.code, deck.deckName, card.name, card.alias, card.count,
        card.cardKey, m.rank, m.power, m.attribute,
        m.effectName1, m.effectContent1, m.effectName2, m.effectContent2,
        m.cardId, m.productId, m.packId, m.cardNumber, m.rarity
      ].map(csvEscape).join(","));
    }
  }
  return lines.join("\n");
}

export function toMarkdown(decks) {
  const out = ["# Hi!story デッキリスト", ""];
  for (const deck of decks) {
    out.push(`## ${deck.deckName || "デッキ"} — ${deck.code}`);
    out.push("");
    out.push(`- デッキコード：${deck.code}`);
    if (deck.sourceUrl) out.push(`- 参照URL：${deck.sourceUrl}`);
    out.push("");
    out.push("| カード | 異名 | 枚数 | Rank | Power | 効果 |");
    out.push("|---|---|---:|---:|---:|---|");
    for (const card of deck.cards) {
      const m = card.masterMatches?.[0] ?? {};
      const effects = [
        m.effectName1 && `${m.effectName1}: ${m.effectContent1 ?? ""}`,
        m.effectName2 && `${m.effectName2}: ${m.effectContent2 ?? ""}`
      ].filter(Boolean).join("<br>");
      out.push(`| ${card.name} | ${card.alias || ""} | ${card.count} | ${m.rank ?? ""} | ${m.power ?? ""} | ${effects} |`);
    }
    out.push("");
  }
  return out.join("\n");
}

export function toJson(decks) {
  return JSON.stringify({ generatedAt: new Date().toISOString(), decks }, null, 2);
}

export function saveCsv(decks) {
  download("\ufeff" + toCsv(decks), "highsto-decks.csv", "text/csv;charset=utf-8");
}
export function saveMarkdown(decks) {
  download(toMarkdown(decks), "highsto-decks.md", "text/markdown;charset=utf-8");
}
export function saveJson(decks) {
  download(toJson(decks), "highsto-decks.json", "application/json;charset=utf-8");
}
