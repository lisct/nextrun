"use client";

import { useState } from "react";
import { Session, Game, QueueEntry, Player } from "@/types";
import { cn, getInitials } from "@/lib/utils";
import {
  openSession,
  closeSession,
  generateTeams,
  markWinner,
} from "@/app/admin/session/actions";

interface SessionClientProps {
  initialSession: Session | null;
  initialGame: Game | null;
  initialQueue: QueueEntry[];
  players: Player[];
}

export default function SessionClient({
  initialSession,
  initialGame,
  initialQueue,
  players,
}: SessionClientProps) {
  const [session, setSession] = useState<Session | null>(initialSession);
  const [currentGame, setCurrentGame] = useState<Game | null>(initialGame);
  const [queue, setQueue] = useState<QueueEntry[]>(initialQueue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playerMap = new Map(players.map((p) => [p.id, p]));

  const waitingQueue = queue.filter((e) => e.status === "waiting");
  const canGenerateTeams = waitingQueue.length >= 8 && !currentGame;

  const avatarColors = [
    "bg-orange-950 text-orange-400",
    "bg-blue-950 text-blue-400",
    "bg-green-950 text-green-400",
    "bg-purple-950 text-purple-400",
    "bg-red-950 text-red-400",
    "bg-yellow-950 text-yellow-400",
  ];

  function getAvatarColor(name: string) {
    return avatarColors[name.charCodeAt(0) % avatarColors.length];
  }

  async function handleOpenSession() {
    setLoading(true);
    setError(null);
    try {
      const newSession = await openSession();
      setSession(newSession);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to open session");
    } finally {
      setLoading(false);
    }
  }

  async function handleCloseSession() {
    if (!session) return;
    if (!confirm("Close tonight's session?")) return;
    setLoading(true);
    try {
      await closeSession(session.id);
      setSession((prev) => (prev ? { ...prev, status: "closed" } : null));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to close session");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateTeams() {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const game = await generateTeams(session.id);
      setCurrentGame(game);
      setQueue((prev) =>
        prev.map((e) =>
          [...game.team_a_ids, ...game.team_b_ids].includes(e.player_id)
            ? { ...e, status: "playing" }
            : e,
        ),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate teams");
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkWinner(winner: "team_a" | "team_b") {
    if (!session || !currentGame) return;
    setLoading(true);
    setError(null);

    const winnerIds =
      winner === "team_a" ? currentGame.team_a_ids : currentGame.team_b_ids;
    const loserIds =
      winner === "team_a" ? currentGame.team_b_ids : currentGame.team_a_ids;

    try {
      await markWinner(currentGame.id, session.id, winner, winnerIds, loserIds);
      setCurrentGame(null);

      // Move losers to bottom of queue visually
      const maxPos = Math.max(...queue.map((e) => e.position));
      setQueue((prev) => {
        const updated = prev.map((e) => {
          if (loserIds.includes(e.player_id)) {
            return { ...e, status: "waiting" as const };
          }
          return e;
        });
        return updated;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to mark winner");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Tonight's Session</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* Session controls */}
        {!session && (
          <button
            onClick={handleOpenSession}
            disabled={loading}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl transition"
          >
            {loading ? "Opening..." : "Open Tonight's Session"}
          </button>
        )}

        {session?.status === "open" && (
          <button
            onClick={handleCloseSession}
            disabled={loading}
            className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white font-medium px-6 py-3 rounded-xl transition"
          >
            Close Session
          </button>
        )}

        {session?.status === "closed" && (
          <span className="bg-gray-800 text-gray-400 px-4 py-2 rounded-xl text-sm">
            Session closed
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-xl px-4 py-3 text-red-300 text-sm mb-4">
          {error}
        </div>
      )}

      {/* No session yet */}
      {!session && (
        <div className="text-center py-24 text-gray-500">
          <div className="text-5xl mb-4">🏀</div>
          <p className="text-lg">Open tonight's session to get started</p>
        </div>
      )}

      {session && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left — Current game */}
          <div className="space-y-4">
            {/* Current game */}
            {currentGame ? (
              <div className="bg-gray-900 border border-orange-500 rounded-2xl p-5">
                <div className="text-xs text-orange-400 font-medium uppercase tracking-wider mb-4">
                  Game in progress
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  {/* Team A */}
                  <div className="bg-gray-800 rounded-xl p-3">
                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">
                      Team A
                    </div>
                    {currentGame.team_a_ids.map((id) => {
                      const player = playerMap.get(id);
                      if (!player) return null;
                      return (
                        <div key={id} className="flex items-center gap-2 mb-2">
                          <div
                            className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                              getAvatarColor(player.name),
                            )}
                          >
                            {getInitials(player.name)}
                          </div>
                          <span className="text-white text-sm">
                            {player.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Team B */}
                  <div className="bg-gray-800 rounded-xl p-3">
                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">
                      Team B
                    </div>
                    {currentGame.team_b_ids.map((id) => {
                      const player = playerMap.get(id);
                      if (!player) return null;
                      return (
                        <div key={id} className="flex items-center gap-2 mb-2">
                          <div
                            className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                              getAvatarColor(player.name),
                            )}
                          >
                            {getInitials(player.name)}
                          </div>
                          <span className="text-white text-sm">
                            {player.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Mark winner */}
                <div className="text-xs text-gray-400 text-center mb-3">
                  Who won?
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleMarkWinner("team_a")}
                    disabled={loading}
                    className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition"
                  >
                    Team A Wins
                  </button>
                  <button
                    onClick={() => handleMarkWinner("team_b")}
                    disabled={loading}
                    className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition"
                  >
                    Team B Wins
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-4">
                  Next game
                </div>
                {canGenerateTeams ? (
                  <button
                    onClick={handleGenerateTeams}
                    disabled={loading || session.status === "closed"}
                    className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-4 rounded-xl transition text-lg"
                  >
                    {loading ? "Generating..." : "Generate Teams"}
                  </button>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">
                      {waitingQueue.length < 8
                        ? `Need ${8 - waitingQueue.length} more players in queue`
                        : "No game in progress"}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right — Queue */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                Queue
              </div>
              <span className="text-xs text-gray-500">
                {waitingQueue.length} waiting
              </span>
            </div>

            {queue.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No players in queue yet
              </div>
            ) : (
              <div className="space-y-2">
                {queue.map((entry, index) => {
                  const player = playerMap.get(entry.player_id);
                  if (!player) return null;
                  return (
                    <div
                      key={entry.id}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl",
                        entry.status === "playing"
                          ? "bg-orange-950 border border-orange-800"
                          : "bg-gray-800",
                      )}
                    >
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                          entry.status === "playing"
                            ? "bg-orange-500 text-white"
                            : "bg-gray-700 text-gray-400",
                        )}
                      >
                        {entry.status === "playing" ? "▶" : index + 1}
                      </div>
                      <div
                        className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                          getAvatarColor(player.name),
                        )}
                      >
                        {getInitials(player.name)}
                      </div>
                      <span className="text-white text-sm flex-1">
                        {player.name}
                      </span>
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          entry.status === "playing"
                            ? "bg-orange-500 text-white"
                            : "bg-gray-700 text-gray-400",
                        )}
                      >
                        {entry.status === "playing" ? "Playing" : "Waiting"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
