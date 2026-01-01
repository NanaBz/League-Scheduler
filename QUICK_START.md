# Team Selection Feature - Quick Start Guide

## 🚀 Get Started in 60 Seconds

### Step 1: Access Admin Panel
Open the admin view and navigate to "Edit Matches" section

### Step 2: Find a Match
- Select a competition (League, Cup, etc.)
- Click on any match row
- Look for the **"Team Selection"** button

### Step 3: Set Lineups
Click **"Team Selection"** → Modal opens

**Home Team Section:**
1. Add 1 Goalkeeper (dropdown "Add GK")
2. Add 2-4 Defenders (dropdown "Add DF")
3. Add 2-4 Midfielders (dropdown "Add MF")
4. Add 1-3 Attackers (dropdown "Add ATT")

**Away Team Section:**
Repeat the same for away team

**Total: 9 players (1 GK + 2-4 DF + 2-4 MF + 1-3 ATT)**

### Step 4: Save
Click **"Save Lineups"** button (only enabled when all positions filled)

### Step 5: View as User
Go to "Fixtures & Results" → Find a match with lineup → Click to expand → See "⚽ Starting Lineup"

---

## 📍 Where to Find Things

### Admin
- **Feature Location**: Edit Matches section, "Team Selection" button on each match
- **Access**: Admin only
- **Action**: Select 9 players across 4 positions

### Users  
- **Feature Location**: Fixtures & Results section
- **Access**: Public view
- **Action**: Click match to expand and view lineups

---

## ✨ Features at a Glance

| Feature | Location | How to Use |
|---------|----------|-----------|
| Select Players | Team Selection Modal | Dropdown per position |
| Remove Players | Team Selection Modal | Click X button |
| View Constraints | Modal header | Shows position counts |
| Save Lineups | Modal footer | Click Save button |
| View Lineups | User match details | Expand match & see players |
| Expandable Hint | Under match row | "Click to expand" text |

---

## 🎯 Position Breakdown

### GK (Goalkeeper)
- **Min**: 1  
- **Max**: 1  
- **Total**: 1

### DF (Defenders)
- **Min**: 2  
- **Max**: 4  
- **Typical**: 3-4

### MF (Midfielders)
- **Min**: 2  
- **Max**: 4  
- **Typical**: 3-4

### ATT (Attackers)
- **Min**: 1  
- **Max**: 3  
- **Typical**: 2-3

**Total Players Required: 9**

---

## 💡 Tips & Tricks

1. **Player appears in dropdown?**
   - No = Already selected for another position

2. **Can't click Save?**
   - Check that all positions have minimum players
   - GK must have exactly 1
   - DF, MF need minimum 2 each
   - ATT needs minimum 1

3. **Want to change lineup?**
   - Click Team Selection again
   - Remove unwanted players
   - Add new ones
   - Save changes

4. **Players can play any position?**
   - Yes! No position restrictions on selection
   - System allows flexibility for tactical changes
   - (But fantasy points will be based on assigned position)

---

## 🔍 Troubleshooting

### "Team Selection button not showing"
- Feature is in Edit Matches section only
- Need to be logged in as admin
- Matches must exist (generate fixtures first)

### "Save button is grayed out"
- Check all positions have correct number of players
- GK: must be exactly 1
- DF: must be 2-4
- MF: must be 2-4
- ATT: must be 1-3

### "Can't see lineup in user view"
- Admin must have saved lineup first
- Click on match to expand details
- You should see "👆 Click to expand match details" hint

### "Player won't add to position"
- Position is full (reached max count)
- Player already selected elsewhere
- Try removing from other position first

---

## 📞 Need Help?

- **Documentation**: See `IMPLEMENTATION_COMPLETE.md`
- **Technical Details**: See `TEAM_SELECTION_FEATURE.md`
- **Files Modified**: Check git diff for exact changes

---

Ready to set lineups! ⚽ Good luck!
