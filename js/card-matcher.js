function normalizeText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[\t\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(value) {
  return String(value ?? "")
    .trim()
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/\?.*$/, "")
    .replace(/#.*$/, "");
}

function basename(value) {
  const s = normalizeUrl(value);
  return s.split("/").pop() || "";
}

export function cardKey(name, alias) {
  return `${normalizeText(name)}｜${normalizeText(alias)}`.trim();
}

function buildNameIndex(cards) {
  const map = new Map();
  for (const card of cards) {
    const name = normalizeText(card.name);
    if (!name) continue;
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(card);
  }
  return map;
}

function buildImageIndex(cards) {
  const map = new Map();
  for (const card of cards) {
    const url = normalizeUrl(card.cardImage);
    if (!url) continue;
    if (!map.has(url)) map.set(url, []);
    map.get(url).push(card);

    const file = basename(url);
    if (file) {
      if (!map.has(`file:${file}`)) map.set(`file:${file}`, []);
      map.get(`file:${file}`).push(card);
    }
  }
  return map;
}

function splitRawCardText(raw, nameIndex) {
  const text = normalizeText(raw);
  if (!text) return { name: "", alias: "" };

  // Prefer the longest known card name that occurs at the end of the text.
  // Deck pages commonly render cards as "異名 カード名".
  let best = null;
  for (const [name, candidates] of nameIndex) {
    if (!text.endsWith(name)) continue;
    if (!best || name.length > best.name.length) {
      best = { name, candidates };
    }
  }

  if (!best) return { name: text, alias: "" };

  const prefix = normalizeText(text.slice(0, text.length - best.name.length));
  const alias = prefix || "";
  return { name: best.name, alias };
}

function aliasMatches(candidate, alias) {
  const a = normalizeText(alias);
  const ca = normalizeText(candidate.alias);
  if (!a) return !ca || ca === "ー" || ca === "-";
  return ca === a;
}

function uniqueCards(cards) {
  const seen = new Set();
  return cards.filter(card => {
    const key = card.cardId || `${card.name}|${card.alias}|${card.cardImage}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeCards(cards) {
  const map = new Map();
  for (const card of cards) {
    const key = cardKey(card.name, card.alias);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(card);
  }

  // Keep indexes as non-enumerable-ish properties on the Map object so the
  // existing app API remains compatible.
  map.nameIndex = buildNameIndex(cards);
  map.imageIndex = buildImageIndex(cards);
  return map;
}

export function matchCard(row, cardMap) {
  const rawName = normalizeText(row.name);
  const rawAlias = normalizeText(row.alias);

  // 1. The deck page image is the most reliable identifier. Different
  // printings can share the same card name, especially rank-0 cards.
  const imageUrl = normalizeUrl(row.image);
  const imageFile = basename(imageUrl);
  let candidates = [];
  if (imageUrl) candidates = cardMap.imageIndex?.get(imageUrl) ?? [];
  if (!candidates.length && imageFile) {
    candidates = cardMap.imageIndex?.get(`file:${imageFile}`) ?? [];
  }

  // 2. Parse "alias cardName" using the card master when image matching is
  // unavailable or the page does not expose the card image URL.
  const split = splitRawCardText(rawName, cardMap.nameIndex ?? new Map());
  const name = split.name || rawName;
  const alias = rawAlias || split.alias;

  if (!candidates.length) {
    const exactKey = cardKey(name, alias);
    candidates = cardMap.get(exactKey) ?? [];
  }

  // 3. If the page has no alias for an ordinary named card, fall back to name
  // matching. Prefer a candidate whose alias agrees with the parsed prefix.
  if (!candidates.length && name) {
    const byName = cardMap.nameIndex?.get(name) ?? [];
    const aliasMatched = byName.filter(c => aliasMatches(c, alias));
    candidates = aliasMatched.length ? aliasMatched : byName;
  }

  candidates = uniqueCards(candidates);
  const preferred = candidates[0] ?? null;

  return {
    ...row,
    cardKey: cardKey(name, alias),
    resolvedName: preferred?.name || name,
    resolvedAlias: preferred?.alias && preferred.alias !== "ー" ? preferred.alias : (alias || ""),
    masterMatches: candidates
  };
}

export function preferredPrinting(matches) {
  if (!matches?.length) return null;
  return matches[0];
}
