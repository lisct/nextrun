import { createClient } from "@/lib/supabase/server";
import PlayersClient from "@/components/admin/PlayersClient";

export default async function PlayersPage() {
  const supabase = await createClient();

  const { data: players, error } = await supabase
    .from("players")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching players:", error);
  }

  return <PlayersClient initialPlayers={players ?? []} />;
}
