export function cardKey(name, alias) {
  return `${name ?? ""}｜${alias ?? ""}`.trim();
}

export function normalizeCards(cards) {
  const map = new Map();
  for (const card of cards) {
    const key = cardKey(card.name, card.alias);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(card);
  }
  return map;
}

export function matchCard(row, cardMap) {
  const key = cardKey(row.name, row.alias);
  const candidates = cardMap.get(key) ?? [];
  return {
    ...row,
    cardKey: key,
    masterMatches: candidates
  };
}

export function preferredPrinting(matches) {
  if (!matches?.length) return null;
  // The effect-bearing card identity is the name + alias. When multiple
  // printings exist, retain all printings and use the first as display data.
  return matches[0];
}
