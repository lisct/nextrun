# NextRun — Progress Tracker

## Current Status
**Phase:** Scaffold complete, starting feature development
**Last updated:** July 2026
**App URL (local):** http://localhost:3000
**Repo:** [github.com/yourusername/nextrun](https://github.com/lisct/nextrun)

---

## ✅ Completed

### Bug Fixes
- [x] Duplicate sessions issue fixed
- [x] Queue page auto-updates when session opens/closes
- [x] Swap syncs correctly across both pages
- [x] Remove player syncs correctly
- [x] markWinner always fetches fresh game data from DB
- [x] Hydration warning fixed (Grammarly)

### Feature 2 — Queue (Public iPad Screen) ✅
- [x] Queue page layout (iPad optimized)
- [x] Player grid — tap name to join queue
- [x] New player registration inline
- [x] Live queue display with positions
- [x] Playing players shown at top
- [x] Losers go below waiting players correctly
- [x] PIN-protected player removal from queue
- [x] Session status awareness (open/closed/none)

### Feature 3 — Session Management ✅
- [x] Open/close Tonight&apos;s session
- [x] Generate teams (first game: 8 players, subsequent: winners + 4 waiting)
- [x] Display current teams on court
- [x] Mark game winner (Team A / Team B)
- [x] Winners stay on court as playing
- [x] Losers auto-move to bottom of queue
- [x] Queue ordering correct in database and UI


## 🔄 Up Next

### Feature 4 — Payments
### Feature 5 — Stats + Leaderboard
### Feature 6 — AI Summary
---

## 📋 Up Next — Feature Development

### Week 1 — Auth + Player Roster (Admin)
- [ ] Admin layout with sidebar navigation
- [ ] Admin players page — view all players
- [ ] Add new player form
- [ ] Edit player (name, phone, payment plan)
- [ ] Deactivate player (soft delete)
- [ ] Seed initial player roster

### Week 2 — Queue (Public iPad Screen)
- [ ] Queue page layout (iPad optimized)
- [ ] Player list — tap name to join queue
- [ ] New player registration inline
- [ ] Live queue display with positions
- [ ] Supabase Realtime — queue updates instantly
- [ ] Leave queue button
- [ ] Session status awareness (open/closed)

### Week 3 — Team Generation + Game Management
- [ ] Admin session page layout
- [ ] Open/close session for the night
- [ ] Generate teams from top 8 in queue
- [ ] Display current teams on court
- [ ] Mark game winner (Team A / Team B)
- [ ] Auto-move losers to bottom of queue
- [ ] Game history for the session

### Week 4 — Payments
- [ ] Admin payments page layout
- [ ] Tonight&apos;s payment status per player
- [ ] Mark paid / unpaid toggle
- [ ] Monthly vs per-session plan display
- [ ] Payment history per player
- [ ] Outstanding balance tracker
- [ ] Session payment summary (total collected)

### Week 5 — Stats + Leaderboard
- [ ] Leaderboard public page (iPad display)
- [ ] Player rankings by win rate
- [ ] Filter by month / all time
- [ ] Win streak display
- [ ] Individual player profile + stats
- [ ] Sessions attended tracker

### Week 6 — AI Summary + Polish
- [ ] Claude API post-game session summary
- [ ] Summary displayed after session closes
- [ ] PWA install prompt on iPad
- [ ] Mobile/iPad UI polish pass
- [ ] Lighthouse performance audit
- [ ] Deploy to Vercel
- [ ] Onboard real team — go live Friday night

---

## 🐛 Known Issues
- None yet

---

## 💡 Future Ideas (Post V1)
- Push notifications when it's your turn
- Photo upload for player profiles
- Season history and archives
- Multiple courts / locations
- WhatsApp integration for game reminders

---

## 📊 Build Stats
| Metric | Value |
|--------|-------|
| Weeks planned | 6 |
| Hours per week | 4–7 hrs |
| Features | 6 major |
| Pages | 8 |
| Database tables | 5 + 1 view |
| Admin users | 1 of 4 |