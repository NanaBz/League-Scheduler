# Fantasy System: Gameweek → Matchweek Migration

## Summary
Changed fantasy system from using separate "gameweek" terminology to use the existing "matchweek" field from the Match model for consistency.

## Changes Made

### Backend Models

1. **FantasySquad.js**
   - Changed `gameweek` field → `matchweek`
   - Updated index from `{ fantasyUser: 1, gameweek: 1 }` → `{ fantasyUser: 1, matchweek: 1 }`
   - Updated comments from "gameweek" → "matchweek"

2. **FantasyMatchPerformance.js**
   - Changed `gameweek` field → `matchweek`
   - Updated index from `{ gameweek: 1, player: 1 }` → `{ matchweek: 1, player: 1 }`

3. **PlayerAvailability.js**
   - Changed `gameweek` field → `matchweek`
   - Updated index from `{ player: 1, gameweek: 1 }` → `{ player: 1, matchweek: 1 }`

4. **FantasyGameweek.js** ❌ DELETED
   - Removed entire model (no longer needed)
   - Fantasy now uses Match.matchweek directly

### Backend Routes (fantasyAdmin.js)

1. **Imports**
   - Removed: `const FantasyGameweek = require('../models/FantasyGameweek');`

2. **GET /api/fantasy/admin/matchweeks** (renamed from /gameweeks)
   - Now aggregates distinct matchweeks from Match collection
   - Returns: `[{ number: 1, matchCount: 6 }, { number: 2, matchCount: 6 }, ...]`

3. **GET /api/fantasy/admin/matchweeks/:mwNumber/matches** (renamed from /gameweeks/:gwNumber/matches)
   - Queries matches directly: `Match.find({ matchweek: parseInt(mwNumber) })`

4. **POST /api/fantasy/admin/matchweeks** ❌ DELETED
   - No longer needed (matchweeks created automatically when fixtures are generated)

5. **POST /api/fantasy/admin/matches/:matchId/minutes**
   - Changed request body param: `gameweek` → `matchweek`
   - Now uses `match.matchweek` as fallback if not provided

6. **POST /api/fantasy/admin/players/:playerId/availability**
   - Changed request body param: `gameweek` → `matchweek`

### Frontend (FantasyManagement.js)

1. **State Variables**
   - `gameweeks` → `matchweeks`
   - `selectedGameweek` → `selectedMatchweek`

2. **Functions**
   - `fetchGameweeks()` → `fetchMatchweeks()`
   - `handleSelectGameweek()` → `handleSelectMatchweek()`

3. **API Calls**
   - `/fantasy/admin/gameweeks` → `/fantasy/admin/matchweeks`
   - `/fantasy/admin/gameweeks/${gw.number}/matches` → `/fantasy/admin/matchweeks/${mw.number}/matches`

4. **UI Text**
   - "Fantasy Gameweek Editor" → "Fantasy Matchweek Editor"
   - "Select Gameweek" → "Select Matchweek"
   - "Edit Gameweek Data" → "Edit Matchweek Data"
   - "Gameweek {number}" → "Matchweek {number}"

5. **Matchweek Display**
   - Now shows: "Matchweek {number} ({matchCount} matches)"
   - Removed deadline display (not applicable)

## Benefits

1. **Consistency**: Fantasy system now aligns with fixture management terminology
2. **Simplicity**: No separate FantasyGameweek collection to maintain
3. **Automatic**: Matchweeks are automatically available when fixtures are generated
4. **Single Source of Truth**: Match.matchweek is the only source for week numbers

## Migration Notes

- No database migration required (existing fantasy data uses matchweek field name)
- Frontend automatically picks up matchweeks from existing matches
- If no matches exist, admin won't see any matchweeks to edit (expected behavior)

## Testing

To test the updated fantasy admin flow:
1. Navigate to Admin Panel → Fantasy Management
2. Click "Edit Matchweek Data"
3. Select a matchweek (automatically populated from existing matches)
4. Select a match that has been played
5. Assign minutes to players
6. Assign bonus points (3, 2, 1)
7. Optionally assign special points
8. Submit

All data is now tied to Match.matchweek for consistency.
