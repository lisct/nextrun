import { createClient } from "@/lib/supabase/server";
import SessionClient from "@/components/admin/SessionClient";

export default async function SessionPage() {
  const supabase = await createClient();

  const today = new Date().toISOString().split("T")[0];

  // Get today's session if exists
  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("date", today)
    .single();

  // Get current game if session exists
  const { data: currentGame } = session
    ? await supabase
        .from("games")
        .select("*")
        .eq("session_id", session.id)
        .is("winner", null)
        .single()
    : { data: null };

  // Get queue if session exists
  const { data: queue } = session
    ? await supabase
        .from("queue_entries")
        .select("*, player:players(*)")
        .eq("session_id", session.id)
        .order("position", { ascending: true })
    : { data: null };

  // Get all players for team display
  const { data: players } = await supabase
    .from("players")
    .select("*")
    .eq("is_active", true);

  return (
    <SessionClient
      initialSession={session}
      initialGame={currentGame}
      initialQueue={queue ?? []}
      players={players ?? []}
    />
  );
}
