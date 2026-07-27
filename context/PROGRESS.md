# NextRun — Progress Tracker

## Current Status
**Phase:** Scaffold complete, starting feature development
**Last updated:** July 2026
**App URL (local):** http://localhost:3000
**Repo:** [github.com/yourusername/nextrun](https://github.com/lisct/nextrun)

---

## ✅ Completed

### Scaffold & Infrastructure
- [x] Next.js 16 + TypeScript + Tailwind CSS v4
- [x] Supabase project created (East US - Virginia)
- [x] Database schema — all tables + RLS policies
- [x] Supabase Realtime enabled (queue_entries, games, sessions)
- [x] Proxy (auth protection on /admin routes)
- [x] TypeScript types (Player, Session, QueueEntry, Game, Payment)
- [x] Supabase client (browser + server)
- [x] Utility helpers (cn, formatDate, getInitials)
- [x] Root layout + global CSS + brand colors
- [x] Login page UI
- [x] PWA manifest (installable on iPad)
- [x] Folder structure (public + auth + admin routes)
- [x] GitHub repo (private)
- [x] Git initialized + first commit
- [x] Context folder + CLAUDE.md + all spec files
- [x] Admin users created (1 of 4)
- [x] Supabase grants fixed (authenticated + anon roles)

### Feature 1 — Admin Players ✅
- [x] Admin layout with sidebar navigation
- [x] Admin players page — view all players
- [x] Add new player form
- [x] Edit player (name, phone, payment plan)
- [x] Deactivate player (soft delete)
- [x] 8 real players added to roster

## 🔄 In Progress

### Feature 2 — Queue (Public iPad Screen)
- [ ] Queue page layout (iPad optimized)
- [ ] Player grid — tap name to join queue
- [ ] New player registration inline
- [ ] Live queue display with positions
- [ ] Supabase Realtime — queue updates instantly
- [ ] Session status awareness (open/closed)

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
- [ ] Tonight's payment status per player
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