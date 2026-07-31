# Feature Spec — Queue

## Overview
The queue is the heart of the app. It lives on the main iPad screen
all night. Players walk up and tap their name to join.

## Queue page (/queue)
Public — no login required.
This is what the iPad shows all night.

### Layout (iPad landscape optimized)
Split into two columns:
- Left (40%) — player list to tap and join
- Right (60%) — current queue + teams on court

### Left column — Player roster
- Search bar at top (filter by name)
- Grid of player name buttons — large tap targets
- Each button shows player name + initials avatar
- Tapping adds them to queue instantly
- If already in queue → button is disabled + shows position
- "New Player" button at bottom → opens registration modal

### Right column — Queue + court
Top half: current teams on court (Team A vs Team B)
Bottom half: waiting queue list with positions

### New player registration modal
- Name input (required)
- Phone input (optional)
- Payment plan selector (monthly / per session)
- "Join Queue" button → creates player + adds to queue

### Queue item display
Each queue entry shows:
- Position number
- Player initials avatar
- Player name
- Time joined
- Status badge (waiting / playing)

### Session states
- No session open → show "Waiting for admin to open Tonight&apos;s session"
- Session open → show queue and player list
- Session closed → show "Tonight&apos;s session has ended. See you next Friday!"

## Queue logic
- Position is assigned by joined_at timestamp
- New player always goes to end of queue
- Losers after a game → moved to end of queue (admin action)
- Player can be removed from queue by admin only

## Realtime
Use Supabase Realtime to subscribe to queue_entries table.
Queue updates instantly when:
- Player joins
- Player is removed
- Game ends and losers move to bottom
No page refresh needed.

## Files to create
- src/app/(public)/queue/page.tsx — main queue page
- src/components/queue/PlayerGrid.tsx — tappable player buttons
- src/components/queue/QueueList.tsx — waiting list display
- src/components/queue/CurrentGame.tsx — teams on court
- src/components/queue/NewPlayerModal.tsx — registration form

## Key UX rules
- Minimum tap target: 56px height
- Player name buttons: full width on mobile, grid on iPad
- Queue updates must feel instant (optimistic UI)
- No confirmation dialogs — tap = join immediately
- Large readable text — players read from standing distance