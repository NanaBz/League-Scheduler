// Generates mock Overall Acity League data with 32 teams
// Each team has: pos, team, user, gw, total, delta, players[], lineup (with captain/chip logic)

import api from './api';

const TEAM_NAMES = [
  'Eden F.C', 'Obeng United', 'Yanited', 'Orion FC', 'Firestorm', 'Falcons', 'Vikings',
  'Leopards', 'Thunder FC', 'Kingsguard', 'Raptors', 'Titans', 'Phoenix', 'Spartans',
  'Dragons', 'Wolves', 'Stallions', 'Lions', 'Sharks', 'Bulls', 'Rangers', 'Warriors',
  'Pirates', 'Comets', 'Stormbreak', 'Avalanche', 'Blaze FC', 'Galaxy', 'Nebula',
  'Eclipse', 'Meteorites', 'Dynamos'
];

const USER_NAMES = [
  'Akerejola Ayomide', 'Daniel Larsen-Reindorf', 'Benedict Abrahams', 'Nathan Adam',
  'King Kob--', 'Ehizoba Humphrey', 'Charles Amoatey', 'Adaeze Nwoko', 'Yusuf Balogun',
  'Kofi Mensah', 'Ama Serwaa', 'John Doe', 'Jane Smith', 'Kwame Boateng', 'Funmi Adebayo',
  'Nana Owusu', 'Ayo Ibrahim', 'Blessing Okoro', 'Tunde Adekunle', 'Ify Umeh', 'Seyi Ogun',
  'Tolu Adebisi', 'Chinedu Okeke', 'Naa Lamptey', 'Segun Ajayi', 'Ngozi Ibe', 'Peter Obi',
  'Halima Ali', 'Femi Ajayi', 'Nike Balogun', 'Zainab Musa', 'Joseph Kwesi'
];

const SAMPLE_PLAYERS = [
  { id: 'P001', name: 'Player One', position: 'FWD' },
  { id: 'P002', name: 'Player Two', position: 'MID' },
  { id: 'P003', name: 'Player Three', position: 'DEF' },
  { id: 'P004', name: 'Player Four', position: 'GK' },
  { id: 'P005', name: 'Player Five', position: 'MID' },
  { id: 'P006', name: 'Player Six', position: 'DEF' },
  { id: 'P007', name: 'Player Seven', position: 'FWD' },
  { id: 'P008', name: 'Player Eight', position: 'MID' },
  { id: 'P009', name: 'Player Nine', position: 'DEF' },
  { id: 'P010', name: 'Player Ten', position: 'FWD' },
  { id: 'P011', name: 'Player Eleven', position: 'MID' },
  { id: 'P012', name: 'Player Twelve', position: 'DEF' },
  { id: 'P013', name: 'Player Thirteen', position: 'GK' },
  { id: 'P014', name: 'Player Fourteen', position: 'MID' },
  { id: 'P015', name: 'Player Fifteen', position: 'DEF' },
  { id: 'P016', name: 'Player Sixteen', position: 'FWD' },
  { id: 'P017', name: 'Player Seventeen', position: 'MID' },
  { id: 'P018', name: 'Player Eighteen', position: 'DEF' },
  { id: 'P019', name: 'Player Nineteen', position: 'FWD' },
  { id: 'P020', name: 'Player Twenty', position: 'MID' }
];

const CHIPS = ['WC', 'FH', 'BB', 'TC', 'DGW'];

function randPoints() { return Math.floor(Math.random() * 13); }
function randChip() { return CHIPS[Math.floor(Math.random() * 5)]; }

// Normalize position codes from API (DF/MF/ATT -> DEF/MID/FWD)
const POS_MAP = {
  GK: 'GK',
  DEF: 'DEF',
  MID: 'MID',
  FWD: 'FWD',
  DF: 'DEF',
  MF: 'MID',
  ATT: 'FWD'
};

function normalizePos(pos) {
  if (!pos) return 'MID';
  const key = String(pos).toUpperCase();
  return POS_MAP[key] || key;
}

// Enforce max 3 players per team in a 15-player roster
// Also ensure a reliable positional distribution to fill formations
function assignPlayersRespectingTeamLimits(allPlayers, numNeeded = 15) {
  const roster = [];
  const teamCount = {};
  const shuffled = [...allPlayers].sort(() => Math.random() - 0.5);
  const targetCounts = { GK: 2, DEF: 5, MID: 5, FWD: 3 };
  const posCounts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };

  for (const player of shuffled) {
    if (roster.length >= numNeeded) break;
    const team = player.team?.name || player.teamName || 'Unknown';
    const normalizedPos = normalizePos(player.position);
    const currentTeamCount = teamCount[team] || 0;

    // Respect team limit
    if (currentTeamCount >= 3) continue;

    // Prefer players that help meet positional targets first
    const needThisPos = posCounts[normalizedPos] < targetCounts[normalizedPos];
    const alreadyMetTargets = Object.keys(targetCounts).every(k => posCounts[k] >= targetCounts[k]);
    if (needThisPos || (alreadyMetTargets && roster.length < numNeeded)) {
      roster.push({
        ...player,
        position: normalizedPos,
        gwPoints: randPoints(),
        isCaptain: false,
        isViceCaptain: false,
        chipUsed: null
      });
      teamCount[team] = currentTeamCount + 1;
      posCounts[normalizedPos] += 1;
    }
  }

  // Pad if needed (still respecting team limit)
  const pool = [...allPlayers].sort(() => Math.random() - 0.5);
  for (const p of pool) {
    if (roster.length >= numNeeded) break;
    const team = p.team?.name || p.teamName || 'Unknown';
    const normalizedPos = normalizePos(p.position);
    const currentTeamCount = teamCount[team] || 0;
    if (currentTeamCount >= 3) continue;
    if (roster.find(r => (r._id || r.id) === (p._id || p.id))) continue;

    roster.push({
      ...p,
      position: normalizedPos,
      gwPoints: randPoints(),
      isCaptain: false,
      isViceCaptain: false,
      chipUsed: null
    });
    teamCount[team] = currentTeamCount + 1;
    posCounts[normalizedPos] += 1;
  }

  return roster;
}

function buildLineup(players, currentGw = 1) {
  const normalized = players.map(p => ({ ...p, position: normalizePos(p.position) }));
  const byPos = {
    GK: normalized.filter(p => p.position === 'GK'),
    DEF: normalized.filter(p => p.position === 'DEF'),
    MID: normalized.filter(p => p.position === 'MID'),
    FWD: normalized.filter(p => p.position === 'FWD'),
  };

  const splits = [
    { def: 3, mid: 3, fwd: 2, name: '3-3-2' },
    { def: 3, mid: 2, fwd: 3, name: '3-2-3' },
    { def: 4, mid: 3, fwd: 1, name: '4-3-1' },
    { def: 4, mid: 2, fwd: 2, name: '4-2-2' },
    { def: 2, mid: 3, fwd: 3, name: '2-3-3' },
  ];
  const pick = splits[Math.floor(Math.random() * splits.length)];

  const take = (list, n, pool) => {
    const picked = list.slice(0, n);
    if (picked.length < n) {
      const need = n - picked.length;
      const fallback = pool.filter(p => !picked.includes(p));
      picked.push(...fallback.slice(0, need));
    }
    return picked;
  };

  const outfieldPool = [...byPos.DEF, ...byPos.MID, ...byPos.FWD];
  const gk = take(byPos.GK, 1, normalized);
  const def = take(byPos.DEF, pick.def, outfieldPool);
  const mid = take(byPos.MID, pick.mid, outfieldPool);
  const fwd = take(byPos.FWD, pick.fwd, outfieldPool);

  const outfielders = [...def, ...mid, ...fwd];
  const captainIdx = Math.floor(Math.random() * outfielders.length);
  let viceIdx = Math.floor(Math.random() * outfielders.length);
  if (outfielders.length > 1) {
    while (viceIdx === captainIdx) {
      viceIdx = Math.floor(Math.random() * outfielders.length);
    }
  }

  const starterIds = new Set([...gk, ...def, ...mid, ...fwd].map(p => p._id || p.id));
  const remaining = normalized.filter(p => !starterIds.has(p._id || p.id));
  const bench = remaining.slice(0, 4);

  const chipUsed = Math.random() < 0.3 ? randChip() : null;

  const buildCard = (p, idx, isCapt = false, isVC = false) => {
    let points = p.gwPoints ?? randPoints();
    if (isCapt) points *= 2;
    if (chipUsed === 'TC' && isCapt) points *= 1.5;
    return { ...p, points, isCaptain: isCapt, isViceCaptain: isVC, chipUsed: isCapt ? chipUsed : null };
  };

  // Build position arrays with captain/VC assignments
  const gkCards = gk.map((p, idx) => buildCard(p, idx, false, false));
  const defCards = def.map((p, idx) => buildCard(p, idx, idx === captainIdx, idx === viceIdx));
  const midCards = mid.map((p, idx) => {
    const globalIdx = def.length + idx;
    return buildCard(p, globalIdx, globalIdx === captainIdx, globalIdx === viceIdx);
  });
  const fwdCards = fwd.map((p, idx) => {
    const globalIdx = def.length + mid.length + idx;
    return buildCard(p, globalIdx, globalIdx === captainIdx, globalIdx === viceIdx);
  });

  const benchCards = bench.map(p => ({ ...p, points: p.gwPoints ?? randPoints(), isCaptain: false, chipUsed: null }));

  const allStarters = [...gkCards, ...defCards, ...midCards, ...fwdCards];

  return {
    starters: allStarters,
    gk: gkCards,
    def: defCards,
    mid: midCards,
    fwd: fwdCards,
    bench: benchCards,
    formation: pick.name,
    gameweek: currentGw,
    chipUsed,
    totalPoints: allStarters.reduce((sum, p) => sum + p.points, 0)
  };
}

export async function generateMockLeague(currentGw = 1) {
  try {
    const { data: allPlayers } = await api.get('/players');
    
    const entries = TEAM_NAMES.slice(0, 32).map((team, i) => {
      const user = USER_NAMES[i % USER_NAMES.length];
      const roster = assignPlayersRespectingTeamLimits(allPlayers, 15);
      const lineup = buildLineup(roster, currentGw);
      
      return {
        pos: i + 1,
        team,
        user,
        gw: lineup.totalPoints,
        total: 800 + Math.floor(Math.random() * 400),
        delta: ['up', 'down', 'same'][Math.floor(Math.random() * 3)],
        players: roster,
        lineup,
      };
    });
    return entries;
  } catch (error) {
    console.warn('Fallback to basic mock:', error.message);
    return TEAM_NAMES.slice(0, 32).map((team, i) => {
      const players = [];
      for (let j = 0; j < 15; j++) {
        const p = SAMPLE_PLAYERS[j % SAMPLE_PLAYERS.length];
        players.push({ ...p, gwPoints: randPoints(), isCaptain: false, isViceCaptain: false, chipUsed: null });
      }
      const lineup = buildLineup(players, currentGw);
      return {
        pos: i + 1,
        team,
        user: USER_NAMES[i % USER_NAMES.length],
        gw: lineup.totalPoints,
        total: 800 + Math.floor(Math.random() * 400),
        delta: ['up', 'down', 'same'][Math.floor(Math.random() * 3)],
        players,
        lineup,
      };
    });
  }
}

export default generateMockLeague;
