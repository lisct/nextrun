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

  // Get top 8 waiting players from queue
  const { data: queue, error } = await supabase
    .from("queue_entries")
    .select("*, player:players(*)")
    .eq("session_id", sessionId)
    .eq("status", "waiting")
    .order("position", { ascending: true })
    .limit(8);

  if (error) throw new Error(error.message);
  if (!queue || queue.length < 8)
    throw new Error("Need at least 8 players in queue");

  // Shuffle and split into two teams
  const shuffled = [...queue].sort(() => Math.random() - 0.5);
  const teamA = shuffled.slice(0, 4).map((e) => e.player_id);
  const teamB = shuffled.slice(4, 8).map((e) => e.player_id);

  // Create game record
  const { data: game, error: gameError } = await supabase
    .from("games")
    .insert({
      session_id: sessionId,
      team_a_ids: teamA,
      team_b_ids: teamB,
      winner: null,
    })
    .select()
    .single();

  if (gameError) throw new Error(gameError.message);

  // Update queue status to playing
  const playingIds = [...teamA, ...teamB];
  await supabase
    .from("queue_entries")
    .update({ status: "playing" })
    .eq("session_id", sessionId)
    .in("player_id", playingIds);

  revalidatePath("/admin/session");
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

  // Get current max position in queue
  const { data: maxPos } = await supabase
    .from("queue_entries")
    .select("position")
    .eq("session_id", sessionId)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const basePosition = (maxPos?.position ?? 0) + 1;

  // Move losers to bottom of queue
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

  // Mark winners as waiting (they stay but keep position)
  await supabase
    .from("queue_entries")
    .update({ status: "playing" })
    .eq("session_id", sessionId)
    .in("player_id", winnerIds);

  revalidatePath("/admin/session");
}
