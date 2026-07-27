# NextRun — App Overview

## What it is
A court-side iPad app for managing Friday night pickup basketball.
Handles queue rotation, team generation, stats, and payment tracking.

## The problem it solves
Friday night pickup basketball is chaotic — no one knows who's next,
payments are tracked in someone's head or a notes app, and there's
no record of who's winning or losing over time. NextRun fixes all of that.

## How a Friday night works

### Before the game
1. Admin opens the app on the iPad at the court
2. Admin logs in and opens tonight's session
3. iPad stays on the queue screen all night

### During the game
1. Players arrive and tap their name on the iPad to join the queue
2. New players tap "New Player" and register on the spot
3. Admin takes top 8 from queue and generates 2 teams of 4
4. Game is played
5. Admin taps winning team
6. Losers auto-move to bottom of queue
7. Next 4 from queue form the challenger team
8. Repeat until everyone goes home

### End of night
1. Admin marks payments for the session
2. Admin closes the session
3. AI generates a fun summary of the night
4. Stats and leaderboard update automatically

## Who uses it

### Admin (4 people, email + password login)
- Opens and closes sessions
- Generates teams
- Marks game winners
- Manages payment tracking
- Manages player roster

### Players (no login, iPad only)
- Tap name to join queue
- Register if new
- See their queue position
- View leaderboard

## Key constraints
- Runs on one iPad at the court
- Must work on gym WiFi (may be slow)
- Touch targets must be large (fingers, not mouse)
- Simple enough for anyone to use without training
- No player login — friction kills adoption

## Success metrics
- Every Friday runs without confusion
- Admin can manage a full night in under 30 seconds per action
- Players know their queue position at all times
- Payment tracking takes less than 2 minutes at end of night