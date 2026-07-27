# Feature Spec — Stats & Leaderboard

## Overview
Stats are computed automatically from the games table via a
database view. No manual stat entry needed.

## Leaderboard page (/leaderboard)
Public — no login. Shows on iPad between games.

### Layout
- Header with NextRun logo + tonight's date
- Filter bar: This month / All time / Last 4 Fridays
- Ranked player list
- Bottom: tonight's session summary (games played, players attended)

### Player row
- Rank number (1st, 2nd, 3rd with medal colors)
- Player initials avatar
- Player name
- W-L record
- Win rate percentage (highlighted in orange)
- Current streak badge (🔥 if 3+ wins in a row)

### Minimum games filter
Players need at least 3 games to appear on leaderboard.
Avoids someone winning their first game ranking #1.

## Player profile
Tapping a player on leaderboard → shows their full stats:
- Total games played
- Wins / losses
- Win rate
- Current streak
- Longest streak ever
- Sessions attended
- Payment status (if admin is viewing)

## Stats computed from player_stats view
The view already handles:
- games_played
- wins
- losses
- win_rate
- sessions_attended

## Streak calculation
Needs to be computed separately from