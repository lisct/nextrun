"use client";

import { createClient } from "@/lib/supabase/client";
import type { Game, Player, QueueEntry, Session } from "@/types";
import {
  localGame,
  localPlayers,
  localQueue,
  localSession,
  localSyncQueue,
  type SyncAction,
} from "@/lib/offline/store";

export interface SyncResult {
  synced: number;
  failed: number;
  remaining: number;
}

const MAX_RETRIES = 3;

async function applyAction(action: SyncAction): Promise<void> {
  const supabase = createClient();

  switch (action.type) {
    case "JOIN_QUEUE": {
      console.log("applyAction: JOIN_QUEUE", action.payload);
      const { sessionId, playerId, entryId, position } = action.payload;

      const { data: existing, error: lookupError } = await supabase
        .from("queue_entries")
        .select("id")
        .eq("session_id", sessionId)
        .eq("player_id", playerId)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) break; // already synced — skip the duplicate insert

      const { error } = await supabase.from("queue_entries").insert({
        id: entryId,
        session_id: sessionId,
        player_id: playerId,
        position,
        status: "waiting",
        joined_at: new Date().toISOString(),
      });
      if (error) throw error;
      break;
    }

    case "LEAVE_QUEUE": {
      console.log("applyAction: LEAVE_QUEUE", action.payload);
      const { queueEntryId } = action.payload;
      const { error } = await supabase
        .from("queue_entries")
        .delete()
        .eq("id", queueEntryId);
      if (error) throw error;
      break;
    }

    case "GENERATE_TEAMS": {
      console.log("applyAction: GENERATE_TEAMS", action.payload);
      const { gameId, sessionId, teamAIds, teamBIds } = action.payload;

      const { data: existingGame, error: lookupError } = await supabase
        .from("games")
        .select("id")
        .eq("id", gameId)
        .maybeSingle();
      if (lookupError) throw lookupError;

      if (!existingGame) {
        const { error: insertError } = await supabase.from("games").insert({
          id: gameId,
          session_id: sessionId,
          team_a_ids: teamAIds,
          team_b_ids: teamBIds,
          winner: null,
          played_at: new Date().toISOString(),
        });
        if (insertError) throw insertError;
      }

      // Already synced (e.g. via the online path) or freshly inserted —
      // either way make sure queue statuses reflect it.
      const { error: updateError } = await supabase
        .from("queue_entries")
        .update({ status: "playing" })
        .eq("session_id", sessionId)
        .in("player_id", [...teamAIds, ...teamBIds]);
      if (updateError) throw updateError;
      break;
    }

    case "MARK_WINNER": {
      console.log("applyAction: MARK_WINNER", action.payload);
      const { gameId, sessionId, winner } = action.payload;

      const { data: gameRow, error: fetchError } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single();
      if (fetchError) throw fetchError;
      const game = gameRow as Game;

      const winnerIds = winner === "team_a" ? game.team_a_ids : game.team_b_ids;
      const loserIds = winner === "team_a" ? game.team_b_ids : game.team_a_ids;

      const { error: gameError } = await supabase
        .from("games")
        .update({ winner })
        .eq("id", gameId);
      if (gameError) throw gameError;

      const { data: waitingEntries } = await supabase
        .from("queue_entries")
        .select("position")
        .eq("session_id", sessionId)
        .eq("status", "waiting")
        .order("position", { ascending: false })
        .limit(1);
      const basePosition = (waitingEntries?.[0]?.position ?? 0) + 1;

      for (let i = 0; i < loserIds.length; i++) {
        const { error: loserError } = await supabase
          .from("queue_entries")
          .update({ status: "waiting", position: basePosition + i })
          .eq("session_id", sessionId)
          .eq("player_id", loserIds[i]);
        if (loserError) throw loserError;
      }

      const { error: winnerError } = await supabase
        .from("queue_entries")
        .update({ status: "playing" })
        .eq("session_id", sessionId)
        .in("player_id", winnerIds);
      if (winnerError) throw winnerError;
      break;
    }

    case "SWAP_PLAYERS": {
      console.log("applyAction: SWAP_PLAYERS", action.payload);
      const { sessionId, playingPlayerId, waitingPlayerId } = action.payload;

      const { data: gameRow } = await supabase
        .from("games")
        .select("*")
        .eq("session_id", sessionId)
        .is("winner", null)
        .maybeSingle();
      const game = gameRow as Game | null;

      const { error: waitingError } = await supabase
        .from("queue_entries")
        .update({ status: "waiting" })
        .eq("session_id", sessionId)
        .eq("player_id", playingPlayerId);
      if (waitingError) throw waitingError;

      const { error: playingError } = await supabase
        .from("queue_entries")
        .update({ status: "playing" })
        .eq("session_id", sessionId)
        .eq("player_id", waitingPlayerId);
      if (playingError) throw playingError;

      if (game) {
        const onTeamA = game.team_a_ids.includes(playingPlayerId);
        const onTeamB = game.team_b_ids.includes(playingPlayerId);
        const column = onTeamA ? "team_a_ids" : onTeamB ? "team_b_ids" : null;

        if (column) {
          const currentIds = onTeamA ? game.team_a_ids : game.team_b_ids;
          const updatedIds = currentIds
            .filter((id) => id !== playingPlayerId)
            .concat(waitingPlayerId);

          const { error: gameError } = await supabase
            .from("games")
            .update({ [column]: updatedIds })
            .eq("id", game.id);
          if (gameError) throw gameError;
        }
      }
      break;
    }

    case "SWAP_TEAM_PLAYERS": {
      console.log("applyAction: SWAP_TEAM_PLAYERS", action.payload);
      const { gameId, teamAPlayerId, teamBPlayerId } = action.payload;

      const { data: gameRow, error: fetchError } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single();
      if (fetchError) throw fetchError;
      const game = gameRow as Game;

      const newTeamA = game.team_a_ids
        .filter((id) => id !== teamAPlayerId)
        .concat(teamBPlayerId);
      const newTeamB = game.team_b_ids
        .filter((id) => id !== teamBPlayerId)
        .concat(teamAPlayerId);

      const { error: updateError } = await supabase
        .from("games")
        .update({ team_a_ids: newTeamA, team_b_ids: newTeamB })
        .eq("id", gameId);
      if (updateError) throw updateError;
      break;
    }

    case "OPEN_SESSION": {
      console.log("applyAction: OPEN_SESSION", action.payload);
      const { sessionId, date, gameFormat } = action.payload;

      const { data: existing, error: lookupError } = await supabase
        .from("sessions")
        .select("id")
        .eq("id", sessionId)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) break; // already synced — skip the duplicate insert

      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase.from("sessions").insert({
        id: sessionId,
        date,
        status: "open",
        game_format: gameFormat,
        ai_summary: null,
        created_by: userData?.user?.id ?? null,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      break;
    }

    case "CLOSE_SESSION": {
      console.log("applyAction: CLOSE_SESSION", action.payload);
      const { sessionId } = action.payload;
      const { error } = await supabase
        .from("sessions")
        .update({ status: "closed" })
        .eq("id", sessionId);
      if (error) throw error;
      break;
    }

    case "REGISTER_PLAYER": {
      console.log("applyAction: REGISTER_PLAYER", action.payload);
      const { player } = action.payload;

      const { data: existing, error: lookupError } = await supabase
        .from("players")
        .select("id")
        .eq("id", player.id)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) break; // already synced — skip the duplicate insert

      const { error } = await supabase.from("players").insert({
        id: player.id,
        name: player.name,
        phone: player.phone,
        payment_plan: player.payment_plan,
        is_active: player.is_active,
        created_at: player.created_at,
      });
      if (error) throw error;
      break;
    }
  }
}

// A concurrent caller (e.g. the manual "Sync now" button firing while an
// automatic reconnect sync is already running) awaits the same in-flight
// pass instead of starting a second one over the still-unprocessed queue —
// that double-processing is what was inserting duplicate rows.
let syncInFlight: Promise<SyncResult> | null = null;

export async function syncToSupabase(): Promise<SyncResult> {
  if (syncInFlight) return syncInFlight;

  syncInFlight = performSync();
  try {
    return await syncInFlight;
  } finally {
    syncInFlight = null;
  }
}

async function performSync(): Promise<SyncResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { synced: 0, failed: 0, remaining: localSyncQueue.get().length };
  }

  const pending = localSyncQueue.get();
  let synced = 0;
  let failed = 0;
  const stillPending: SyncAction[] = [];

  // Every action gets a chance to run this pass — one bad action (e.g. a
  // GENERATE_TEAMS that keeps hitting a duplicate-key error) no longer
  // blocks everything queued after it, like JOIN_QUEUE actions.
  for (const action of pending) {
    try {
      await applyAction(action);
      synced++;
    } catch (err) {
      failed++;
      const retryCount = action.retryCount + 1;

      if (retryCount >= MAX_RETRIES) {
        console.error("Sync action exceeded retry limit, discarding:", {
          actionType: action.type,
          payload: action.payload,
          error: err,
        });
      } else {
        console.error("Sync failed, will retry:", {
          actionType: action.type,
          payload: action.payload,
          retryCount,
          error: err,
        });
        stillPending.push({ ...action, retryCount });
      }
    }
  }

  localSyncQueue.set(stillPending);
  return { synced, failed, remaining: stillPending.length };
}

export async function refreshFromSupabase(sessionId: string): Promise<void> {
  const supabase = createClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();
  localSession.set((session as Session) ?? null);

  const { data: queueEntries } = await supabase
    .from("queue_entries")
    .select("*, player:players(*)")
    .eq("session_id", sessionId)
    .order("position", { ascending: true });
  localQueue.set((queueEntries as QueueEntry[]) ?? []);

  const { data: game } = await supabase
    .from("games")
    .select("*")
    .eq("session_id", sessionId)
    .is("winner", null)
    .order("played_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  localGame.set((game as Game) ?? null);

  const { data: players } = await supabase
    .from("players")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });
  localPlayers.set((players as Player[]) ?? []);
}
