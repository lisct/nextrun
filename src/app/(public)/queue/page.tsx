import { createClient } from "@/lib/supabase/server";
import QueueClient from "@/components/queue/QueueClient";

export default async function QueuePage() {
  const supabase = await createClient();

  const today = new Date().toISOString().split("T")[0];

  // Get today's most recent session (any status)
  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("date", today)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get all active players
  const { data: players } = await supabase
    .from("players")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  // Get queue for today's session
  const { data: queue } = session
    ? await supabase
        .from("queue_entries")
        .select("*, player:players(*)")
        .eq("session_id", session.id)
        .order("position", { ascending: true })
    : { data: null };

  return (
    <QueueClient
      session={session}
      players={players ?? []}
      initialQueue={queue ?? []}
    />
  );
}
