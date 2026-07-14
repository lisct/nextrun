# NextRun 🏀

Friday night pickup basketball — queue management, stats, and payment tracking.

## Stack
- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- Supabase (Auth + PostgreSQL + Realtime)
- Claude API (post-game AI summary)
- Vercel (deployment)

## Getting started

### 1. Clone and install
git clone https://github.com/you/nextrun
cd nextrun
npm install

### 2. Environment variables
cp .env.example .env.local

Fill in your own values:
- Create a Supabase project at supabase.com
- Get your API key at console.anthropic.com

### 3. Database setup
- Go to your Supabase project → SQL Editor
- Run the contents of supabase/schema.sql

### 4. Create admin users
- Go to Supabase → Authentication → Users
- Create accounts for each admin (max 4)
- Run the seed SQL at the bottom of schema.sql for each admin UUID

### 5. Run locally
npm run dev

## Project structure
src/
├── app/
│   ├── (auth)/login    → admin login
│   ├── (public)/       → queue + leaderboard (iPad public screens)
│   └── admin/          → protected admin screens
├── components/         → reusable UI components
├── lib/supabase/       → database client
└── types/              → TypeScript types

context/
└── specs/              → feature specs (read before building anything)