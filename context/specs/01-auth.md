# Feature Spec — Auth

## Overview
Only admins log in. Players have no accounts. The iPad stays logged
in permanently — admins only need to log in once when setting up.

## Admin login
- Email + password via Supabase Auth
- Max 4 admin accounts — created manually by developer in Supabase dashboard
- No self-registration — no sign up page
- After login → redirect to /admin/session
- Session persists across browser refreshes (Supabase handles this)
- Logout available in admin sidebar

## Route protection
- /admin/* → requires authenticated Supabase session
- /queue → public, no auth
- /leaderboard → public, no auth
- / → redirects to /queue

## Login page (/login)
Already built. Dark screen, NextRun logo, email + password form.
If already logged in → redirect to /admin/session automatically.

## Admin layout
All /admin/* pages share a layout with:
- NextRun logo top left
- Navigation links: Session, Players, Payments
- Current admin email shown
- Logout button
- Optimized for iPad landscape

## Logout flow
- Admin taps logout
- Supabase signs out
- Redirect to /login

## Files to create
- src/app/admin/layout.tsx — shared admin layout with nav
- src/app/admin/session/page.tsx — placeholder for now
- src/app/admin/players/page.tsx — placeholder for now
- src/app/admin/payments/page.tsx — placeholder for now

## Important
- Never expose admin routes to unauthenticated users
- The proxy.ts already handles this — don't duplicate checks
- Use server client (lib/supabase/server.ts) in server components
- Use browser client (lib/supabase/client.ts) in client components