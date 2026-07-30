"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Session, Game, QueueEntry, Player } from "@/types";
import { cn, getInitials } from "@/lib/utils";
import {
  openSession,
  closeSession,
  generateTeams,
  markWinner,
  reopenSession,
  startNewSession,
  swapPlayers,
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
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapPin, setSwapPin] = useState("");
  const [swapPinError, setSwapPinError] = useState<string | null>(null);
  const [playerToSwap, setPlayerToSwap] = useState<QueueEntry | null>(null);
  const [swapTarget, setSwapTarget] = useState<QueueEntry | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (!initialSession) return;

    const channel = supabase
      .channel("session-queue-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "queue_entries",
          filter: `session_id=eq.${initialSession.id}`,
        },
        () => {
          window.location.reload();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "queue_entries",
          filter: `session_id=eq.${initialSession.id}`,
        },
        () => {
          window.location.reload();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "queue_entries",
        },
        () => {
          window.location.reload();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialSession]);

  const playerMap = new Map(players.map((p) => [p.id, p]));

  const waitingQueue = queue.filter((e) => e.status === "waiting");
  const playingQueue = queue.filter((e) => e.status === "playing");
  const isFirstGame = playingQueue.length === 0;
  const canGenerateTeams =
    !currentGame &&
    session?.status === "open" &&
    ((isFirstGame && waitingQueue.length >= 8) ||
      (!isFirstGame && waitingQueue.length >= 4));

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

  async function handleReopenSession() {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const { error } = await reopenSession(session.id);
      if (error) throw new Error(error);
      setSession((prev) => (prev ? { ...prev, status: "open" } : null));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reopen session");
    } finally {
      setLoading(false);
    }
  }

  async function handleNewSession() {
    if (!confirm("Start a brand new session? This will clear tonight's queue."))
      return;
    setLoading(true);
    setError(null);
    try {
      const newSession = await startNewSession();
      setSession(newSession);
      setQueue([]);
      setCurrentGame(null);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to start new session",
      );
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
      // Reload fresh data from server instead of updating stale local state
      window.location.reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to mark winner");
    } finally {
      setLoading(false);
    }
  }

  function initiateSwap(entry: QueueEntry) {
    setPlayerToSwap(entry);
    setSwapTarget(null);
    setSwapPin("");
    setSwapPinError(null);
    setShowSwapModal(true);
  }

  async function handleSwap() {
    if (!session || !playerToSwap || !swapTarget) return;

    const correctPin = process.env.NEXT_PUBLIC_ADMIN_PIN ?? "1234";

    if (swapPin !== correctPin) {
      setSwapPinError("Incorrect PIN");
      setSwapPin("");
      return;
    }

    setLoading(true);
    try {
      await swapPlayers(
        session.id,
        playerToSwap.player_id,
        swapTarget.player_id,
      );
      setShowSwapModal(false);
      setPlayerToSwap(null);
      setSwapTarget(null);
      window.location.reload();
    } catch (err: unknown) {
      setSwapPinError(
        err instanceof Error ? err.message : "Failed to swap players",
      );
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

      {/* Session closed */}
      {session?.status === "closed" && (
        <div className="text-center py-24 text-gray-500">
          <div className="text-5xl mb-4">✅</div>
          <p className="text-lg text-white font-semibold">Session closed</p>
          <p className="text-sm mt-2">
            Great run tonight! See you next Friday.
          </p>
          <div className="flex gap-3 justify-center mt-6">
            <button
              onClick={handleReopenSession}
              disabled={loading}
              className="bg-gray-800 hover:bg-gray-700 text-white font-medium px-6 py-3 rounded-xl transition"
            >
              Reopen Session
            </button>
            <button
              onClick={handleNewSession}
              disabled={loading}
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3 rounded-xl transition"
            >
              Start New Session
            </button>
          </div>
        </div>
      )}

      {session && session.status === "open" && (
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
                        ? isFirstGame
                          ? `Need ${8 - waitingQueue.length} more players in queue`
                          : `Need ${4 - waitingQueue.length} more players in queue`
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
                {[...queue]
                  .sort((a, b) => {
                    if (a.status === "playing" && b.status !== "playing")
                      return -1;
                    if (a.status !== "playing" && b.status === "playing")
                      return 1;
                    return a.position - b.position;
                  })
                  .map((entry, index) => {
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

                        {/* Swap button — only for playing players */}
                        {entry.status === "playing" && currentGame && (
                          <button
                            onClick={() => initiateSwap(entry)}
                            className="text-gray-500 hover:text-orange-400 transition p-1 rounded text-xs"
                            title="Swap player"
                          >
                            ⇄
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Swap Modal */}
      {showSwapModal && playerToSwap && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-1">Swap Player</h2>
            <p className="text-gray-400 text-sm mb-5">
              Replace{" "}
              <span className="text-orange-400 font-medium">
                {playerMap.get(playerToSwap.player_id)?.name}
              </span>{" "}
              with a waiting player
            </p>

            {/* Waiting players to pick from */}
            <div className="space-y-2 mb-5 max-h-48 overflow-auto">
              {waitingQueue.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  No waiting players
                </p>
              ) : (
                waitingQueue.map((entry, i) => {
                  const player = playerMap.get(entry.player_id);
                  if (!player) return null;
                  return (
                    <button
                      key={entry.id}
                      onClick={() => setSwapTarget(entry)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition text-left",
                        swapTarget?.id === entry.id
                          ? "bg-orange-950 border-orange-500"
                          : "bg-gray-800 border-gray-700 hover:border-gray-600",
                      )}
                    >
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
                      <span className="text-gray-500 text-xs">
                        #{i + 1} in queue
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* PIN input */}
            {swapTarget && (
              <>
                <div className="border-t border-gray-800 pt-4 mb-4">
                  <label className="block text-sm text-gray-400 mb-2 text-center">
                    Enter admin PIN to confirm
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={swapPin}
                    onChange={(e) => {
                      setSwapPin(e.target.value);
                      setSwapPinError(null);
                    }}
                    placeholder="••••"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    autoFocus
                  />
                  {swapPinError && (
                    <p className="text-red-400 text-sm text-center mt-2">
                      {swapPinError}
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSwapModal(false);
                  setPlayerToSwap(null);
                  setSwapTarget(null);
                }}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSwap}
                disabled={!swapTarget || swapPin.length !== 4 || loading}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition"
              >
                {loading ? "Swapping..." : "Confirm Swap"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
