# Feature Spec — Team Generation & Game Management

## Overview
Admin takes the top 8 players from the queue and splits them into
2 teams of 4. After the game, admin marks the winner.

## Admin session page (/admin/session)

### Layout
Three sections:
1. Session controls (open/close tonight's session)
2. Current game (teams on court + mark winner)
3. Queue management (view queue, generate next teams)

### Open session
- Button: "Open Tonight's Session"
- Creates a new session record with today's date
- Sets status to 'open'
- Only one session per day allowed
- After opening → queue becomes active on iPad

### Generate teams
- Shows top 8 players from queue
- "Generate Teams" button → randomly splits into 2 teams of 4
- Admin can shuffle (re-randomize) before confirming
- Admin can manually drag players between teams
- "Confirm Teams" → creates game record, sets players to 'playing'

### Current game display
Shows Team A vs Team B with player names.
Two buttons: "Team A Wins" / "Team B Wins"
Tapping winner:
- Sets game.winner in database
- Moves losing team players to bottom of queue
- Updates player stats automatically via view
- Clears current game → ready for next game

### Queue panel
- Shows full current queue with positions
- Admin can remove a player (they left the court)
- Shows how many are waiting

### Close session
- Button: "Close Tonight's Session"
- Sets session status to 'closed'
- Triggers AI summary generation
- Queue becomes inactive

## Team generation algorithm
1. Take players 1-8 from queue (by position)
2. Shuffle array randomly
3. First 4 → Team A, Last 4 → Team B
4. Admin can re-shuffle before confirming

## Files to create
- src/app/admin/session/page.tsx
- src/components/admin/SessionControls.tsx
- src/components/admin/TeamGenerator.tsx
- src/components/admin/CurrentGame.tsx
- src/components/admin/QueuePanel.tsx
- src/lib/teams.ts — team generation logic

## Business rules
- Can't generate teams if fewer than 8 in queue
- Can't close session while a game is in progress
- Only one active game at a time per session
- Losers always go to absolute bottom of queue
- Winners stay — they don't re-enter queue until they lose