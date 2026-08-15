"use server";

import { createClient } from "@/lib/supabase/server";
import { PaymentPlan } from "@/types";
import { revalidatePath } from "next/cache";

export async function joinQueue(sessionId: string, playerId: string) {
  const supabase = await createClient();

  // Get current max position
  const { data: maxPos } = await supabase
    .from("queue_entries")
    .select("position")
    .eq("session_id", sessionId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (maxPos?.position ?? 0) + 1;

  const { data, error } = await supabase
    .from("queue_entries")
    .insert({
      session_id: sessionId,
      player_id: playerId,
      position,
      status: "waiting",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/queue");
  return data;
}

export async function registerAndJoin(
  sessionId: string,
  name: string,
  phone: string | null,
  paymentPlan: PaymentPlan,
) {
  const supabase = await createClient();

  // Create player
  const { data: player, error: playerError } = await supabase
    .from("players")
    .insert({
      name: name.trim(),
      phone: phone?.trim() || null,
      payment_plan: paymentPlan,
      is_active: true,
    })
    .select()
    .single();

  if (playerError) throw new Error(playerError.message);

  // Join queue
  const { data: maxPos } = await supabase
    .from("queue_entries")
    .select("position")
    .eq("session_id", sessionId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (maxPos?.position ?? 0) + 1;

  const { data: entry, error: queueError } = await supabase
    .from("queue_entries")
    .insert({
      session_id: sessionId,
      player_id: player.id,
      position,
      status: "waiting",
    })
    .select()
    .single();

  if (queueError) throw new Error(queueError.message);

  revalidatePath("/queue");
  return { player, entry };
}

export async function removePlayerFromQueue(
  sessionId: string,
  playerId: string,
) {
  const supabase = await createClient();

  // Check if player is currently playing
  const { data: entry } = await supabase
    .from("queue_entries")
    .select("*")
    .eq("session_id", sessionId)
    .eq("player_id", playerId)
    .single();

  if (!entry) throw new Error("Player not found in queue");

  const wasPlaying = entry.status === "playing";

  // Remove the player from queue
  const { error: deleteError } = await supabase
    .from("queue_entries")
    .delete()
    .eq("session_id", sessionId)
    .eq("player_id", playerId);

  if (deleteError) throw new Error(deleteError.message);

  // If they were playing, promote next waiting player
  if (wasPlaying) {
    // Get next waiting player (#1 in queue)
    const { data: nextPlayer } = await supabase
      .from("queue_entries")
      .select("*")
      .eq("session_id", sessionId)
      .eq("status", "waiting")
      .order("position", { ascending: true })
      .limit(1)
      .single();

    if (nextPlayer) {
      // Promote them to playing
      await supabase
        .from("queue_entries")
        .update({ status: "playing" })
        .eq("id", nextPlayer.id);

      // Update the current active game — replace removed player with next player
      const { data: currentGame } = await supabase
        .from("games")
        .select("*")
        .eq("session_id", sessionId)
        .is("winner", null)
        .single();

      if (currentGame) {
        // Find which team the removed player was on
        const onTeamA = currentGame.team_a_ids.includes(playerId);
        const onTeamB = currentGame.team_b_ids.includes(playerId);

        if (onTeamA) {
          const newTeamA = currentGame.team_a_ids
            .filter((id: string) => id !== playerId)
            .concat(nextPlayer.player_id);

          await supabase
            .from("games")
            .update({ team_a_ids: newTeamA })
            .eq("id", currentGame.id);
        } else if (onTeamB) {
          const newTeamB = currentGame.team_b_ids
            .filter((id: string) => id !== playerId)
            .concat(nextPlayer.player_id);

          await supabase
            .from("games")
            .update({ team_b_ids: newTeamB })
            .eq("id", currentGame.id);
        }
      }
    }
  }

  revalidatePath("/queue");
}
