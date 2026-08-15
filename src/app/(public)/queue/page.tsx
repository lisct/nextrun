import { createClient } from "@/lib/supabase/server";
import NextRunApp from "./NextRunApp";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAdmin = !!user;

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

  // Get the active (unfinished) game for today's session, if any
  const { data: currentGame } = session
    ? await supabase
        .from("games")
        .select("*")
        .eq("session_id", session.id)
        .is("winner", null)
        .maybeSingle()
    : { data: null };

  return (
    <NextRunApp
      initialSession={session}
      initialPlayers={players ?? []}
      initialQueue={queue ?? []}
      initialGame={currentGame ?? null}
      initialIsAdmin={isAdmin}
    />
  );
}
