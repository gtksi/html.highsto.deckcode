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

function normalizeAlias(alias) {
  const value = String(alias ?? "").trim();
  return value === "ー" ? "" : value;
}

function effectSignature(card) {
  return [
    card.effectName1 ?? "",
    card.effectName2 ?? ""
  ].map(v => String(v).trim()).join("／");
}

export function cardKey(name, alias) {
  return `${String(name ?? "").trim()}｜${normalizeAlias(alias)}`;
}

export function abilityKey(card) {
  return `${String(card.name ?? "").trim()}｜${normalizeAlias(card.alias)}｜${effectSignature(card)}`;
}

export function printingKey(card) {
  return [
    card.productId ?? "",
    card.packId ?? "",
    card.name ?? "",
    normalizeAlias(card.alias)
  ].join("｜");
}

export function buildIndexes(cards) {
  const byImage = new Map();
  const byNameAlias = new Map();
  const abilityCounts = new Map();

  for (const card of cards) {
    const imageKey = normalizeImageUrl(card.cardImage);
    if (imageKey) {
      if (!byImage.has(imageKey)) byImage.set(imageKey, []);
      byImage.get(imageKey).push(card);
    }

    const key = cardKey(card.name, card.alias);
    if (!byNameAlias.has(key)) byNameAlias.set(key, []);
    byNameAlias.get(key).push(card);

    const akey = abilityKey(card);
    abilityCounts.set(akey, (abilityCounts.get(akey) || 0) + 1);
  }

  return { byImage, byNameAlias, abilityCounts };
}

export function normalizeCards(cards) {
  return buildIndexes(cards);
}

function chooseCandidate(candidates, row) {
  if (!candidates?.length) return null;

  // productId/packId + card name/alias are useful secondary discriminators.
  const narrowed = candidates.filter(card =>
    (!row.productId || card.productId === row.productId) &&
    (!row.packId || card.packId === row.packId)
  );
  const pool = narrowed.length ? narrowed : candidates;

  return pool[0] ?? null;
}

export function matchCard(row, indexes) {
  const imageKey = normalizeImageUrl(row.image);
  let candidates = imageKey ? (indexes.byImage.get(imageKey) ?? []) : [];
  let matchSource = candidates.length ? "image" : "";

  if (!candidates.length) {
    const key = cardKey(row.name, row.alias);
    candidates = indexes.byNameAlias.get(key) ?? [];
    matchSource = candidates.length ? "name_alias" : "unmatched";
  }

  const master = chooseCandidate(candidates, row);
  const ability = master ? effectSignature(master) : "";
  const alias = master?.alias ?? row.alias ?? "";
  const name = master?.name ?? row.name ?? "";

  return {
    ...row,
    name,
    alias,
    cardKey: cardKey(name, alias),
    abilityKey: master ? abilityKey(master) : cardKey(name, alias),
    printingKey: master ? printingKey(master) : "",
    abilityLabel: master
      ? `${name}（${[master.effectName1, master.effectName2]
          .filter(v => v && v !== "ー")
          .join("／")}）`
      : name,
    matchSource,
    masterMatches: candidates,
    master: master ?? null
  };
}

export function preferredPrinting(matches) {
  if (!matches?.length) return null;
  return matches[0];
}
