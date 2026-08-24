export const EMPTY_SQUAD = {
  GK: [null, null],
  DF: [null, null, null, null],
  MF: [null, null, null, null],
  ATT: [null, null, null],
};

export function squadStorageKey(userId) {
  if (!userId) return null;
  return `fantasySquad:${userId}`;
}

export function loadSquadFromLocalStorage(userId) {
  const key = squadStorageKey(userId);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return normalizeSquadShape(parsed);
  } catch {
    return null;
  }
}

export function saveSquadToLocalStorage(userId, squad) {
  const key = squadStorageKey(userId);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(squad));
  } catch {
    /* ignore quota errors */
  }
}

export function countSquadPlayers(squad) {
  if (!squad) return 0;
  return Object.values(squad).flat().filter(Boolean).length;
}

export function fantasyUserId(user) {
  if (!user) return null;
  const id = user.id || user._id;
  return id ? String(id) : null;
}

/** Prefer whichever source has more players (API vs local cache). */
export function resolveSquadFromApiAndCache(apiSquad, userId, serverPlayerCount = 0, options = {}) {
  const { preferApi = false } = options;
  const fromApi = normalizeSquadShape(apiSquad || EMPTY_SQUAD);
  const cached = userId ? loadSquadFromLocalStorage(userId) : null;
  const apiCount = countSquadPlayers(fromApi);
  const cacheCount = countSquadPlayers(cached);

  if (preferApi && apiCount >= 13) return fromApi;
  if (serverPlayerCount >= 13 && cacheCount >= 13 && apiCount >= 13) {
    const apiIds = squadPlayerIds(fromApi).sort().join(',');
    const cacheIds = squadPlayerIds(cached).sort().join(',');
    if (apiIds !== cacheIds) return fromApi;
  }
  if (serverPlayerCount >= 13 && cacheCount >= 13) return normalizeSquadShape(cached);
  if (cacheCount > apiCount) return normalizeSquadShape(cached);
  if (serverPlayerCount >= 13 && apiCount >= 13) return fromApi;
  return fromApi;
}

function squadPlayerIds(squad) {
  return Object.values(squad || {})
    .flat()
    .filter(Boolean)
    .map((p) => String(p._id || p.id));
}

export function lineupStorageKey(userId) {
  if (!userId) return null;
  return `fantasyLineup:${userId}`;
}

export function loadLineupFromLocalStorage(userId) {
  const key = lineupStorageKey(userId);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveLineupToLocalStorage(userId, lineupPayload) {
  const key = lineupStorageKey(userId);
  if (!key || !lineupPayload) return;
  try {
    localStorage.setItem(key, JSON.stringify(lineupPayload));
  } catch {
    /* ignore quota errors */
  }
}

/** Ensure all position arrays exist with the expected slot counts. */
export function normalizeSquadShape(input) {
  const positions = ['GK', 'DF', 'MF', 'ATT'];
  const lengths = { GK: 2, DF: 4, MF: 4, ATT: 3 };
  const out = {};
  for (const pos of positions) {
    const src = Array.isArray(input?.[pos]) ? input[pos] : [];
    out[pos] = Array.from({ length: lengths[pos] }, (_, i) => src[i] ?? null);
  }
  return out;
}
