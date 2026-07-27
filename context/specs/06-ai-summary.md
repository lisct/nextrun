# Feature Spec — AI Post-Game Summary

## Overview
When admin closes the session, one Claude API call generates
a fun, engaging summary of the night. Saved to the session record.

## When it runs
Admin taps "Close Session" →
1. Session status set to 'closed'
2. API call to /api/summary with session_id
3. Claude generates summary from game data
4. Summary saved to sessions.ai_summary
5. Summary displayed on screen

## What Claude receives
- Total games played tonight
- Each game: Team A players vs Team B players, winner
- Player with most wins tonight
- Longest win streak of the night
- Total players who attended
- Any player who went undefeated

## What Claude returns
A short, fun, human-sounding recap. 3-5 sentences max.
Written like a sports commentator, not a robot.

Example output:
"What a night at the court! 8 games went down and Marcus was
unstoppable — going 4-0 and carrying Team Roja to glory three
times. Javi put up a fight with a 3-1 record but couldn't stop
the Marcus train. 14 ballers came out tonight and the last game
went down to the wire. See you next Friday! 🏀"

## API route
POST /api/summary
Body: { session_id: string }
Auth: requires admin session (server-side check)
Returns: { summary: string }

## System prompt
"You are a fun, energetic sports commentator recapping a Friday
night pickup basketball session. Write a short 3-5 sentence
summary that feels personal and exciting. Use the players' names.
Mention standout performances. End with something that hypes up
next Friday. Keep it casual and fun — this is neighborhood ball,
not the NBA."

## Files to create
- src/app/api/summary/route.ts — API route
- src/components/admin/SessionSummary.tsx — display component

## Business rules
- Only generated once per session at close time
- If API fails → session still closes,