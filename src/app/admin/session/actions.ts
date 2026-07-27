"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function openSession() {
  const supabase = await createClient();

  const today = new Date().toISOString().split("T")[0];

  // Check if session already exists for today
  const { data: existing } = await supabase
    .from("sessions")
    .select("*")
    .eq("date", today)
    .single();

  if (existing) throw new Error("A session already exists for today");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      date: today,
      status: "open",
      created_by: user?.id,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/admin/session");
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

  // First game — need 8 waiting
  if (winners.length === 0 && waitingPlayers.length < 8) {
    throw new Error(
      `Need at least 8 players in queue (have ${waitingPlayers.length})`,
    );
  }

  // Subsequent games — winners (4) + next 4 from queue
  if (winners.length > 0 && waitingPlayers.length < 4) {
    throw new Error(
      `Need at least 4 players waiting (have ${waitingPlayers.length})`,
    );
  }

  let teamAIds: string[];
  let teamBIds: string[];

  if (winners.length === 0) {
    // First game — shuffle all 8
    const top8 = waitingPlayers.slice(0, 8);
    const shuffled8 = [...top8].sort(() => Math.random() - 0.5);
    teamAIds = shuffled8.slice(0, 4).map((e) => e.player_id);
    teamBIds = shuffled8.slice(4, 8).map((e) => e.player_id);
  } else {
    // Winners vs next 4 from queue
    teamAIds = winners.map((e) => e.player_id);
    teamBIds = waitingPlayers.slice(0, 4).map((e) => e.player_id);
  }

  // Create game record
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

  // Mark all playing players as playing
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
  winnerIds: string[],
  loserIds: string[],
) {
  const supabase = await createClient();

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

  // Move losers to bottom — after all waiting players
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

  // Keep winners as playing — they stay on court
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
