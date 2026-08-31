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

export function financialStorageKey(userId) {
  if (!userId) return null;
  return `fantasyFinancial:${userId}`;
}

export function saveFinancialToLocalStorage(userId, financial) {
  const key = financialStorageKey(userId);
  if (!key || !financial) return;
  try {
    localStorage.setItem(key, JSON.stringify(financial));
  } catch {
    /* ignore quota errors */
  }
}

export function loadFinancialFromLocalStorage(userId) {
  const key = financialStorageKey(userId);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function squadPlayerIds(squad) {
  return Object.values(squad || {})
    .flat()
    .filter(Boolean)
    .map((p) => String(p._id || p.id));
}

/** Prefer authoritative server player prices/purchase data over cached copies. */
export function mergeSquadPlayerFieldsFromApi(apiSquad, targetSquad) {
  const api = normalizeSquadShape(apiSquad || EMPTY_SQUAD);
  const base = normalizeSquadShape(targetSquad || EMPTY_SQUAD);
  const positions = ['GK', 'DF', 'MF', 'ATT'];
  const out = {};

  for (const pos of positions) {
    out[pos] = base[pos].map((cachedPlayer, index) => {
      const apiPlayer = api[pos]?.[index];
      if (!cachedPlayer && !apiPlayer) return null;
      if (!cachedPlayer) return apiPlayer;
      if (!apiPlayer) return cachedPlayer;

      const cachedId = String(cachedPlayer._id || cachedPlayer.id || '');
      const apiId = String(apiPlayer._id || apiPlayer.id || '');
      if (cachedId && apiId && cachedId !== apiId) {
        return cachedPlayer;
      }

      return {
        ...cachedPlayer,
        ...apiPlayer,
        fantasyPrice: apiPlayer.fantasyPrice ?? cachedPlayer.fantasyPrice,
        purchasePrice: apiPlayer.purchasePrice ?? cachedPlayer.purchasePrice,
      };
    });
  }

  return out;
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

const FPL_LOCAL_STORAGE_PREFIXES = ['fantasySquad:', 'fantasyLineup:', 'fantasyFinancial:'];

/** Remove one manager's cached squad and lineup. */
export function clearFantasyUserCache(userId) {
  if (!userId) return;
  try {
    localStorage.removeItem(squadStorageKey(userId));
    localStorage.removeItem(lineupStorageKey(userId));
    localStorage.removeItem(financialStorageKey(userId));
  } catch {
    /* ignore */
  }
}

/** Clear all client-side FPL season/session cache keys (admin reset, unified archive-and-reset). */
export function clearFantasyClientSeasonKeys() {
  try {
    localStorage.removeItem('fantasyCurrentGameweek');
    localStorage.removeItem('fantasyOverallRankingLive');
    Object.keys(localStorage)
      .filter((k) => FPL_LOCAL_STORAGE_PREFIXES.some((prefix) => k.startsWith(prefix)))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

/**
 * Prefer server squad when the API reports fewer players than cache (e.g. after season reset).
 * Keeps cache merge for legitimate offline / in-progress builds when server count is not lower.
 */
export function resolveSquadFromApiAndCache(apiSquad, userId, serverPlayerCount = 0, options = {}) {
  const { preferApi = false } = options;
  const fromApi = normalizeSquadShape(apiSquad || EMPTY_SQUAD);
  const cached = userId ? loadSquadFromLocalStorage(userId) : null;
  const apiCount = countSquadPlayers(fromApi);
  const cacheCount = countSquadPlayers(cached);

  const serverCount = typeof serverPlayerCount === 'number' ? serverPlayerCount : apiCount;

  // Full stale squad after season reset (server empty, cache still has completed squad).
  if (serverCount === 0 && cacheCount >= 13) {
    if (userId) clearFantasyUserCache(userId);
    return fromApi;
  }

  // Server has fewer saved players than cache — trust server (never resurrect extra cached players).
  if (cacheCount > 0 && serverCount > 0 && serverCount < cacheCount) {
    if (userId) clearFantasyUserCache(userId);
    return fromApi;
  }

  // GW1 in-progress local build: server empty, partial cache (< 13) — keep local picks.
  if (serverCount === 0 && cacheCount > 0 && cacheCount < 13) {
    return normalizeSquadShape(cached);
  }

  if (preferApi && apiCount >= 13) return fromApi;
  if (serverCount >= 13 && cacheCount >= 13 && apiCount >= 13) {
    const apiIds = squadPlayerIds(fromApi).sort().join(',');
    const cacheIds = squadPlayerIds(cached).sort().join(',');
    if (apiIds !== cacheIds) return fromApi;
  }
  if (serverCount >= 13 && cacheCount >= 13) {
    return mergeSquadPlayerFieldsFromApi(fromApi, cached);
  }
  if (cacheCount > apiCount) {
    return mergeSquadPlayerFieldsFromApi(fromApi, cached);
  }
  if (serverCount >= 13 && apiCount >= 13) return fromApi;
  return fromApi;
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
