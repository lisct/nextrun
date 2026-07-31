# NextRun — Claude Context

## What this app is
NextRun is a pickup basketball court manager for Friday night runs.
It runs on an iPad at the court. Admins manage everything. Players
tap their name on the iPad to join the queue — no login needed.

## Users
- **Admin (4 people)** — log in with email/password, manage sessions,
  generate teams, mark winners, track payments
- **Players** — no login, tap name on iPad to join queue, can register
  on the spot if not in the list

## Core game flow
1. Admin opens session for the night
2. Players walk up to iPad and tap their name to join queue
3. Admin takes top 8 from queue → generates 2 teams of 4
4. Game is played
5. Admin marks winner
6. Losers go to bottom of queue automatically
7. Next 4 from queue challenge winners
8. Repeat all night
9. Admin marks payments at end of night
10. Admin closes session → AI summary generated

## Tech stack
- Next.js 16 App Router (src/ directory)
- TypeScript — strict mode
- Tailwind CSS v4
- Supabase (PostgreSQL + Auth + Realtime)
- Claude API (post-game AI summary only)
- Vercel deployment
- PWA — installable on iPad home screen

## Folder structure
src/
├── app/
│   ├── (auth)/login/         → admin login page
│   ├── (public)/             → public iPad screens (no auth)
│   │   ├── queue/            → main screen, players tap to join
│   │   └── leaderboard/      → standings anyone can view
│   └── admin/                → protected, admin only
│       ├── session/          → manage Tonight&apos;s game
│       ├── payments/         → payment tracking
│       └── players/          → manage player roster
├── components/
│   ├── ui/                   → reusable base components
│   ├── queue/                → queue-specific components
│   ├── admin/                → admin-specific components
│   ├── payments/             → payment components
│   └── stats/                → stats and leaderboard components
├── lib/
│   └── supabase/
│       ├── client.ts         → browser client
│       └── server.ts         → server client
└── types/
    └── index.ts              → all TypeScript types

context/
└── specs/                    → feature specs, read before building

## Database tables
- players — registered players, payment plan
- sessions — each Friday night session
- queue_entries — who's in Tonight&apos;s queue and their position
- games — each game played, team arrays, winner
- payments — payment records per player per session or month
- player_stats — VIEW computed from games table

## Design system
- Background: #030712 (gray-950)
- Cards: #111827 (gray-900)
- Brand color: #f97316 (orange-500)
- Success: #22c55e (green-500)
- Danger: #ef4444 (red-500)
- Warning: #f59e0b (amber-500)
- Font: Geist Sans
- Border radius: 12px for cards, 8px for inputs
- All screens mobile-first, optimized for iPad touch

## Coding conventions
- Always use TypeScript — no `any` types
- Use server components by default, client only when needed
- All Supabase queries in server components or API routes
- Use `createClient` from lib/supabase/client.ts for client components
- Use `createClient` from lib/supabase/server.ts for server components
- Component files: PascalCase (QueueList.tsx)
- Utility files: camelCase (utils.ts)
- Always handle loading and error states
- Mobile-first Tailwind classes

## What's already built
- [x] Project scaffold
- [x] Supabase connection (client + server)
- [x] Database schema + RLS policies
- [x] Proxy (auth protection)
- [x] TypeScript types
- [x] Login page
- [x] Root layout + global CSS
- [x] PWA manifest

## What's NOT built yet
- [ ] Queue page (public)
- [ ] Leaderboard page (public)
- [ ] Admin session management
- [ ] Admin payments
- [ ] Admin player roster
- [ ] Team generation logic
- [ ] Realtime queue updates
- [ ] AI post-game summary

## Important rules for Claude
- Read the relevant spec file before writing any feature code
- Never use `any` in TypeScript
- Always use the design system colors above
- iPad-optimized means large tap targets (min 44px)
- Keep components small and focused
- Always add loading states to async operations
- RLS is enabled — always use authenticated client for admin actions