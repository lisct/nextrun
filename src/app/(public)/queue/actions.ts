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
    .single();

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
    .single();

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

  const { error } = await supabase
    .from("queue_entries")
    .delete()
    .eq("session_id", sessionId)
    .eq("player_id", playerId);

  if (error) throw new Error(error.message);

  revalidatePath("/queue");
}
