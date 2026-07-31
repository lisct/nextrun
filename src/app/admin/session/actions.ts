"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function openSession(gameFormat: number = 4) {
  const supabase = await createClient();

  const today = new Date().toISOString().split("T")[0];
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      date: today,
      status: "open",
      created_by: user?.id,
      game_format: gameFormat,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/admin/session");
  revalidatePath("/queue");
  return data;
}

export async function closeSession(sessionId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("sessions")
    .update({ status: "closed" })
    .eq("id", sessionId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/session");
}

export async function generateTeams(sessionId: string) {
  const supabase = await createClient();

  // Get session to know game format
  const { data: session } = await supabase
    .from("sessions")
    .select("game_format")
    .eq("id", sessionId)
    .single();

  const teamSize = session?.game_format ?? 4;
  const totalNeeded = teamSize * 2;

  // Get current winners (staying on court)
  const { data: currentlyPlaying } = await supabase
    .from("queue_entries")
    .select("*, player:players(*)")
    .eq("session_id", sessionId)
    .eq("status", "playing");

  // Get waiting players
  const { data: waiting, error } = await supabase
    .from("queue_entries")
    .select("*, player:players(*)")
    .eq("session_id", sessionId)
    .eq("status", "waiting")
    .order("position", { ascending: true });

  if (error) throw new Error(error.message);

  const winners = currentlyPlaying ?? [];
  const waitingPlayers = waiting ?? [];

  if (winners.length === 0) {
    // First game — need full teams
    if (waitingPlayers.length < totalNeeded) {
      throw new Error(
        `Need ${totalNeeded} players for ${teamSize}v${teamSize} (have ${waitingPlayers.length})`,
      );
    }
  } else {
    // Subsequent games — need enough to fill challenger team
    if (waitingPlayers.length < teamSize) {
      throw new Error(
        `Need ${teamSize} players to challenge (have ${waitingPlayers.length})`,
      );
    }
  }

  let teamAIds: string[];
  let teamBIds: string[];

  if (winners.length === 0) {
    const shuffled = [...waitingPlayers]
      .slice(0, totalNeeded)
      .sort(() => Math.random() - 0.5);
    teamAIds = shuffled.slice(0, teamSize).map((e) => e.player_id);
    teamBIds = shuffled.slice(teamSize).map((e) => e.player_id);
  } else {
    teamAIds = winners.map((e) => e.player_id);
    teamBIds = waitingPlayers.slice(0, teamSize).map((e) => e.player_id);
  }

  const { data: game, error: gameError } = await supabase
    .from("games")
    .insert({
      session_id: sessionId,
      team_a_ids: teamAIds,
      team_b_ids: teamBIds,
      winner: null,
    })
    .select()
    .single();

  if (gameError) throw new Error(gameError.message);

  const allPlayingIds = [...teamAIds, ...teamBIds];
  await supabase
    .from("queue_entries")
    .update({ status: "playing" })
    .eq("session_id", sessionId)
    .in("player_id", allPlayingIds);

  revalidatePath("/admin/session");
  revalidatePath("/queue");
  return game;
}

export async function markWinner(
  gameId: string,
  sessionId: string,
  winner: "team_a" | "team_b",
) {
  const supabase = await createClient();

  // Always fetch fresh game data from DB — never trust client state
  const { data: freshGame, error: fetchError } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single();

  if (fetchError || !freshGame) throw new Error("Game not found");

  const winnerIds =
    winner === "team_a" ? freshGame.team_a_ids : freshGame.team_b_ids;

  const loserIds =
    winner === "team_a" ? freshGame.team_b_ids : freshGame.team_a_ids;

  // Mark game winner
  const { error: gameError } = await supabase
    .from("games")
    .update({ winner })
    .eq("id", gameId);

  if (gameError) throw new Error(gameError.message);

  // Get max position of WAITING players only
  const { data: waitingEntries } = await supabase
    .from("queue_entries")
    .select("position")
    .eq("session_id", sessionId)
    .eq("status", "waiting")
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const basePosition = (waitingEntries?.position ?? 0) + 1;

  // Move losers to bottom of queue as waiting
  for (let i = 0; i < loserIds.length; i++) {
    await supabase
      .from("queue_entries")
      .update({
        status: "waiting",
        position: basePosition + i,
      })
      .eq("session_id", sessionId)
      .eq("player_id", loserIds[i]);
  }

  // Keep winners as playing
  await supabase
    .from("queue_entries")
    .update({ status: "playing" })
    .eq("session_id", sessionId)
    .in("player_id", winnerIds);

  revalidatePath("/admin/session");
  revalidatePath("/queue");
}

export async function removeFromQueue(sessionId: string, playerId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("queue_entries")
    .delete()
    .eq("session_id", sessionId)
    .eq("player_id", playerId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/session");
  revalidatePath("/queue");
}

export async function reopenSession(sessionId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("sessions")
    .update({ status: "open" })
    .eq("id", sessionId);

  if (error) return { error: error.message };

  revalidatePath("/admin/session");
  revalidatePath("/queue");
  return { error: null };
}

export async function startNewSession(gameFormat: number = 4) {
  const supabase = await createClient();

  const today = new Date().toISOString().split("T")[0];
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("sessions")
    .update({ status: "closed" })
    .eq("date", today);

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      date: today,
      status: "open",
      created_by: user?.id,
      game_format: gameFormat,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/admin/session");
  revalidatePath("/queue");
  return data;
}

export async function swapPlayers(
  sessionId: string,
  playingPlayerId: string,
  waitingPlayerId: string,
) {
  const supabase = await createClient();

  // Get current active game
  const { data: currentGame } = await supabase
    .from("games")
    .select("*")
    .eq("session_id", sessionId)
    .is("winner", null)
    .single();

  // Update queue — swap statuses
  await supabase
    .from("queue_entries")
    .update({ status: "waiting" })
    .eq("session_id", sessionId)
    .eq("player_id", playingPlayerId);

  await supabase
    .from("queue_entries")
    .update({ status: "playing" })
    .eq("session_id", sessionId)
    .eq("player_id", waitingPlayerId);

  // Update game record if game in progress
  if (currentGame) {
    const onTeamA = currentGame.team_a_ids.includes(playingPlayerId);
    const onTeamB = currentGame.team_b_ids.includes(playingPlayerId);

    if (onTeamA) {
      const newTeamA = currentGame.team_a_ids
        .filter((id: string) => id !== playingPlayerId)
        .concat(waitingPlayerId);
      await supabase
        .from("games")
        .update({ team_a_ids: newTeamA })
        .eq("id", currentGame.id);
    } else if (onTeamB) {
      const newTeamB = currentGame.team_b_ids
        .filter((id: string) => id !== playingPlayerId)
        .concat(waitingPlayerId);
      await supabase
        .from("games")
        .update({ team_b_ids: newTeamB })
        .eq("id", currentGame.id);
    }
  }

  revalidatePath("/admin/session");
  revalidatePath("/queue");
}
