"use client";

import { useState } from "react";
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
  swapTeamPlayers,
} from "@/app/admin/session/actions";
import {
  localSession,
  localQueue,
  localGame,
  localSyncQueue,
  type SyncAction,
} from "@/lib/offline/store";

interface SessionTabProps {
  session: Session | null;
  setSession: (session: Session | null) => void;
  currentGame: Game | null;
  setCurrentGame: (game: Game | null) => void;
  queue: QueueEntry[];
  setQueue: (queue: QueueEntry[]) => void;
  players: Player[];
  isOnline: boolean;
  pendingSync: number;
  syncing: boolean;
  refreshLocalStore: () => void;
  reconcileFromServer: (sessionId: string) => Promise<void>;
}

export default function SessionTab({
  session,
  setSession,
  currentGame,
  setCurrentGame,
  queue,
  setQueue,
  players,
  isOnline,
  pendingSync,
  syncing,
  refreshLocalStore,
  reconcileFromServer,
}: SessionTabProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapPin, setSwapPin] = useState("");
  const [swapPinError, setSwapPinError] = useState<string | null>(null);
  const [playerToSwap, setPlayerToSwap] = useState<QueueEntry | null>(null);
  const [swapTarget, setSwapTarget] = useState<QueueEntry | null>(null);
  const [gameFormat, setGameFormat] = useState<number>(4);
  const [showFormatPicker, setShowFormatPicker] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);
  const [showTeamSwapModal, setShowTeamSwapModal] = useState(false);
  const [teamSwapPin, setTeamSwapPin] = useState("");
  const [teamSwapPinError, setTeamSwapPinError] = useState<string | null>(null);
  const [teamSwapSource, setTeamSwapSource] = useState<{
    playerId: string;
    team: "a" | "b";
  } | null>(null);
  const [teamSwapTarget, setTeamSwapTarget] = useState<string | null>(null);

  const playerMap = new Map(players.map((p) => [p.id, p]));

  // Guards against React duplicate-key errors if the game data ever
  // contains a duplicate id.
  const uniqueTeamAIds = currentGame ? [...new Set(currentGame.team_a_ids)] : [];
  const uniqueTeamBIds = currentGame ? [...new Set(currentGame.team_b_ids)] : [];

  const waitingQueue = queue.filter((e) => e.status === "waiting");
  const playingQueue = queue.filter((e) => e.status === "playing");
  const isFirstGame = playingQueue.length === 0;
  const teamSize = playingQueue.length;

  const sessionFormat = session?.game_format ?? 4;
  const totalNeeded = sessionFormat * 2;
  const canGenerateTeams =
    !currentGame &&
    session?.status === "open" &&
    ((isFirstGame && waitingQueue.length >= totalNeeded) ||
      (!isFirstGame && waitingQueue.length >= sessionFormat));
  const avatarColors = [
    "bg-orange-950 text-orange-400",
    "bg-blue-950 text-blue-400",
    "bg-green-950 text-green-400",
    "bg-purple-950 text-purple-400",
    "bg-red-950 text-red-400",
    "bg-yellow-950 text-yellow-400",
  ];

  function showConfirm(
    title: string,
    message: string,
    confirmLabel: string,
    onConfirm: () => void,
  ) {
    setConfirmConfig({ title, message, confirmLabel, onConfirm });
    setShowConfirmModal(true);
  }

  function getAvatarColor(name: string) {
    return avatarColors[name.charCodeAt(0) % avatarColors.length];
  }

  async function handleCloseSession() {
    if (!session) return;
    showConfirm(
      "Close Session",
      "Are you sure you want to close tonight's session?",
      "Close Session",
      async () => {
        setShowConfirmModal(false);
        setLoading(true);

        if (isOnline) {
          try {
            await closeSession(session.id);
            const closedSession: Session = { ...session, status: "closed" };
            setSession(closedSession);
            localSession.set(closedSession);
            refreshLocalStore();
            setLoading(false);
            return;
          } catch {
            // Direct call failed even though we thought we were online —
            // fall through to the offline path so the close isn't lost.
          }
        }

        const closedSession: Session = { ...session, status: "closed" };
        setSession(closedSession);
        localSession.set(closedSession);

        const action: SyncAction = {
          id: crypto.randomUUID(),
          type: "CLOSE_SESSION",
          createdAt: new Date().toISOString(),
          retryCount: 0,
          payload: { sessionId: session.id },
        };
        localSyncQueue.push(action);
        refreshLocalStore();

        setLoading(false);
      },
    );
  }

  async function handleReopenSession() {
    if (!session) return;

    if (!isOnline) {
      setError("Reopening a session requires an internet connection");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { error } = await reopenSession(session.id);
      if (error) throw new Error(error);
      await reconcileFromServer(session.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reopen session");
    } finally {
      setLoading(false);
    }
  }

  async function handleNewSession() {
    setShowFormatPicker(true);
  }

  async function confirmNewSession() {
    setShowFormatPicker(false);

    if (session) {
      showConfirm(
        "Start New Session",
        "This will close the current session and start fresh. Tonight's queue will be cleared.",
        "Start New Session",
        async () => {
          setShowConfirmModal(false);
          setLoading(true);
          setError(null);

          if (isOnline) {
            try {
              const created = await startNewSession(gameFormat);
              await reconcileFromServer(created.id);
              setLoading(false);
              return;
            } catch {
              // Direct call failed even though we thought we were online —
              // fall through to the offline path so this isn't lost.
            }
          }

          const oldSessionId = session.id;
          const today = new Date().toISOString().split("T")[0];
          const newSessionId = crypto.randomUUID();
          const newSession: Session = {
            id: newSessionId,
            date: today,
            status: "open",
            ai_summary: null,
            created_by: null,
            created_at: new Date().toISOString(),
            game_format: gameFormat,
          };

          setSession(newSession);
          setQueue([]);
          setCurrentGame(null);
          localSession.set(newSession);
          localQueue.set([]);
          localGame.set(null);

          localSyncQueue.push({
            id: crypto.randomUUID(),
            type: "CLOSE_SESSION",
            createdAt: new Date().toISOString(),
            retryCount: 0,
            payload: { sessionId: oldSessionId },
          });
          localSyncQueue.push({
            id: crypto.randomUUID(),
            type: "OPEN_SESSION",
            createdAt: new Date().toISOString(),
            retryCount: 0,
            payload: { sessionId: newSessionId, date: today, gameFormat },
          });
          refreshLocalStore();

          setLoading(false);
        },
      );
    } else {
      setLoading(true);
      setError(null);

      if (isOnline) {
        try {
          const created = await openSession(gameFormat);
          await reconcileFromServer(created.id);
          setLoading(false);
          return;
        } catch {
          // Direct call failed even though we thought we were online — fall
          // through to the offline path so this isn't lost.
        }
      }

      const today = new Date().toISOString().split("T")[0];
      const newSessionId = crypto.randomUUID();
      const newSession: Session = {
        id: newSessionId,
        date: today,
        status: "open",
        ai_summary: null,
        created_by: null,
        created_at: new Date().toISOString(),
        game_format: gameFormat,
      };

      setSession(newSession);
      localSession.set(newSession);

      localSyncQueue.push({
        id: crypto.randomUUID(),
        type: "OPEN_SESSION",
        createdAt: new Date().toISOString(),
        retryCount: 0,
        payload: { sessionId: newSessionId, date: today, gameFormat },
      });
      refreshLocalStore();

      setLoading(false);
    }
  }

  async function handleGenerateTeams() {
    if (!session) return;
    setLoading(true);
    setError(null);

    if (isOnline) {
      try {
        await generateTeams(session.id);
        await reconcileFromServer(session.id);
        setLoading(false);
        return;
      } catch {
        // Direct call failed even though we thought we were online — fall
        // through to the offline path so this isn't lost.
      }
    }

    const gameId = crypto.randomUUID();
    let teamAIds: string[];
    let teamBIds: string[];

    // waitingQueue isn't guaranteed to already be in position order (e.g.
    // losers get reassigned high position numbers in place, without the
    // array itself being re-sorted) — sort explicitly, no shuffling.
    const sortedWaitingQueue = [...waitingQueue].sort(
      (a, b) => a.position - b.position,
    );

    if (isFirstGame) {
      const topPlayers = sortedWaitingQueue.slice(0, totalNeeded);
      teamAIds = topPlayers.slice(0, sessionFormat).map((e) => e.player_id);
      teamBIds = topPlayers.slice(sessionFormat).map((e) => e.player_id);
    } else {
      teamAIds = playingQueue.map((e) => e.player_id);
      teamBIds = sortedWaitingQueue
        .slice(0, sessionFormat)
        .map((e) => e.player_id);
    }

    const optimisticGame: Game = {
      id: gameId,
      session_id: session.id,
      team_a_ids: teamAIds,
      team_b_ids: teamBIds,
      winner: null,
      played_at: new Date().toISOString(),
    };

    const allPlayingIds = new Set([...teamAIds, ...teamBIds]);
    const updatedQueue = queue.map((e) =>
      allPlayingIds.has(e.player_id) ? { ...e, status: "playing" as const } : e,
    );

    setCurrentGame(optimisticGame);
    setQueue(updatedQueue);
    localGame.set(optimisticGame);
    localQueue.set(updatedQueue);

    localSyncQueue.push({
      id: crypto.randomUUID(),
      type: "GENERATE_TEAMS",
      createdAt: new Date().toISOString(),
      retryCount: 0,
      payload: { gameId, sessionId: session.id, teamAIds, teamBIds },
    });
    refreshLocalStore();

    setLoading(false);
  }

  async function handleMarkWinner(winner: "team_a" | "team_b") {
    if (!session || !currentGame) return;
    setLoading(true);
    setError(null);

    if (isOnline) {
      try {
        await markWinner(currentGame.id, session.id, winner);
        await reconcileFromServer(session.id);
        setLoading(false);
        return;
      } catch {
        // Direct call failed even though we thought we were online — fall
        // through to the offline path so this isn't lost.
      }
    }

    const winnerIds =
      winner === "team_a" ? currentGame.team_a_ids : currentGame.team_b_ids;
    const loserIds =
      winner === "team_a" ? currentGame.team_b_ids : currentGame.team_a_ids;

    const maxWaitingPosition = queue
      .filter((e) => e.status === "waiting")
      .reduce((max, e) => Math.max(max, e.position), 0);

    const updatedQueue = queue.map((e) => {
      const loserIndex = loserIds.indexOf(e.player_id);
      if (loserIndex !== -1) {
        return {
          ...e,
          status: "waiting" as const,
          position: maxWaitingPosition + 1 + loserIndex,
        };
      }
      if (winnerIds.includes(e.player_id)) {
        return { ...e, status: "playing" as const };
      }
      return e;
    });

    setCurrentGame(null);
    setQueue(updatedQueue);
    localGame.set(null);
    localQueue.set(updatedQueue);

    localSyncQueue.push({
      id: crypto.randomUUID(),
      type: "MARK_WINNER",
      createdAt: new Date().toISOString(),
      retryCount: 0,
      payload: { gameId: currentGame.id, sessionId: session.id, winner },
    });
    refreshLocalStore();

    setLoading(false);
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
    setShowSwapModal(false);

    const playingPlayerId = playerToSwap.player_id;
    const waitingPlayerId = swapTarget.player_id;

    if (isOnline) {
      try {
        await swapPlayers(session.id, playingPlayerId, waitingPlayerId);
        await reconcileFromServer(session.id);
        setPlayerToSwap(null);
        setSwapTarget(null);
        setLoading(false);
        return;
      } catch {
        // Direct call failed even though we thought we were online — fall
        // through to the offline path so this isn't lost.
      }
    }

    const updatedQueue = queue.map((e) => {
      if (e.id === playerToSwap.id) return { ...e, status: "waiting" as const };
      if (e.id === swapTarget.id) return { ...e, status: "playing" as const };
      return e;
    });

    let updatedGame = currentGame;
    if (currentGame) {
      const onTeamA = currentGame.team_a_ids.includes(playingPlayerId);
      const onTeamB = currentGame.team_b_ids.includes(playingPlayerId);
      if (onTeamA) {
        updatedGame = {
          ...currentGame,
          team_a_ids: currentGame.team_a_ids
            .filter((id) => id !== playingPlayerId)
            .concat(waitingPlayerId),
        };
      } else if (onTeamB) {
        updatedGame = {
          ...currentGame,
          team_b_ids: currentGame.team_b_ids
            .filter((id) => id !== playingPlayerId)
            .concat(waitingPlayerId),
        };
      }
    }

    setQueue(updatedQueue);
    setCurrentGame(updatedGame);
    localQueue.set(updatedQueue);
    localGame.set(updatedGame);

    localSyncQueue.push({
      id: crypto.randomUUID(),
      type: "SWAP_PLAYERS",
      createdAt: new Date().toISOString(),
      retryCount: 0,
      payload: { sessionId: session.id, playingPlayerId, waitingPlayerId },
    });
    refreshLocalStore();

    setPlayerToSwap(null);
    setSwapTarget(null);

    setLoading(false);
  }

  function initiateTeamSwap(playerId: string, team: "a" | "b") {
    setTeamSwapSource({ playerId, team });
    setTeamSwapTarget(null);
    setTeamSwapPin("");
    setTeamSwapPinError(null);
    setShowTeamSwapModal(true);
  }

  async function handleTeamSwap() {
    if (!session || !currentGame || !teamSwapSource || !teamSwapTarget) return;

    const correctPin = process.env.NEXT_PUBLIC_ADMIN_PIN ?? "1234";

    if (teamSwapPin !== correctPin) {
      setTeamSwapPinError("Incorrect PIN");
      setTeamSwapPin("");
      return;
    }

    setLoading(true);
    setShowTeamSwapModal(false);

    const teamAPlayerId =
      teamSwapSource.team === "a" ? teamSwapSource.playerId : teamSwapTarget;

    const teamBPlayerId =
      teamSwapSource.team === "b" ? teamSwapSource.playerId : teamSwapTarget;

    if (isOnline) {
      try {
        await swapTeamPlayers(
          currentGame.id,
          session.id,
          teamAPlayerId,
          teamBPlayerId,
        );
        await reconcileFromServer(session.id);
        setTeamSwapSource(null);
        setTeamSwapTarget(null);
        setLoading(false);
        return;
      } catch {
        // Direct call failed even though we thought we were online — fall
        // through to the offline path so this isn't lost.
      }
    }

    const updatedGame: Game = {
      ...currentGame,
      team_a_ids: currentGame.team_a_ids
        .filter((id) => id !== teamAPlayerId)
        .concat(teamBPlayerId),
      team_b_ids: currentGame.team_b_ids
        .filter((id) => id !== teamBPlayerId)
        .concat(teamAPlayerId),
    };

    setCurrentGame(updatedGame);
    localGame.set(updatedGame);

    localSyncQueue.push({
      id: crypto.randomUUID(),
      type: "SWAP_TEAM_PLAYERS",
      createdAt: new Date().toISOString(),
      retryCount: 0,
      payload: { gameId: currentGame.id, teamAPlayerId, teamBPlayerId },
    });
    refreshLocalStore();

    setTeamSwapSource(null);
    setTeamSwapTarget(null);

    setLoading(false);
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Tonight&apos;s Session
            </h1>
            {session && (
              <span className="text-sm bg-orange-950 text-orange-400 px-3 py-1 rounded-full border border-orange-800 mt-1 inline-block">
                {session.game_format}v{session.game_format}
              </span>
            )}
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
              onClick={() => setShowFormatPicker(true)}
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

        {/* Connection status */}
        <div className="flex items-center gap-3 mb-4">
          {pendingSync > 0 && (
            <span className="text-xs font-medium text-amber-400 bg-amber-950 border border-amber-800 rounded-full px-3 py-1">
              {pendingSync} change{pendingSync === 1 ? "" : "s"} pending sync
            </span>
          )}
          <div className="flex items-center gap-2">
            {!isOnline ? (
              <>
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="text-red-400 text-sm font-medium">
                  Offline — changes saved locally
                </span>
              </>
            ) : syncing ? (
              <>
                <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
                <span className="text-yellow-400 text-sm font-medium">
                  Syncing...
                </span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-green-400 text-sm font-medium">Live</span>
              </>
            )}
          </div>
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
            <p className="text-lg">Open Tonight&apos;s session to get started</p>
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
                      {uniqueTeamAIds.map((id) => {
                        const player = playerMap.get(id);
                        if (!player) return null;
                        return (
                          <div key={id} className="flex items-center gap-2 mb-2">
                            <div
                              className={cn(
                                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                                getAvatarColor(player.name),
                              )}
                            >
                              {getInitials(player.name)}
                            </div>
                            <span className="text-white text-sm flex-1">
                              {player.name}
                            </span>
                            <button
                              onClick={() => initiateTeamSwap(id, "a")}
                              className="text-gray-600 hover:text-orange-400 transition text-xs p-1 rounded hover:bg-gray-700"
                              title="Swap to Team B"
                            >
                              ⇄
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Team B */}
                    <div className="bg-gray-800 rounded-xl p-3">
                      <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">
                        Team B
                      </div>
                      {uniqueTeamBIds.map((id) => {
                        const player = playerMap.get(id);
                        if (!player) return null;
                        return (
                          <div key={id} className="flex items-center gap-2 mb-2">
                            <div
                              className={cn(
                                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                                getAvatarColor(player.name),
                              )}
                            >
                              {getInitials(player.name)}
                            </div>
                            <span className="text-white text-sm flex-1">
                              {player.name}
                            </span>
                            <button
                              onClick={() => initiateTeamSwap(id, "b")}
                              className="text-gray-600 hover:text-orange-400 transition text-xs p-1 rounded hover:bg-gray-700"
                              title="Swap to Team A"
                            >
                              ⇄
                            </button>
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
                      disabled={loading}
                      className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-4 rounded-xl transition text-lg"
                    >
                      {loading ? "Generating..." : "Generate Teams"}
                    </button>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-sm">
                        {waitingQueue.length < 8
                          ? isFirstGame
                            ? waitingQueue.length < 4
                              ? `Need at least 4 players to start (have ${waitingQueue.length})`
                              : waitingQueue.length % 2 !== 0
                                ? `Need an even number of players (have ${waitingQueue.length})`
                                : `Ready to generate ${waitingQueue.length / 2}v${waitingQueue.length / 2}`
                            : `Need ${teamSize - waitingQueue.length} more players to challenge`
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
                              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                              entry.status === "playing"
                                ? "bg-orange-500 text-white"
                                : "bg-gray-700 text-gray-400",
                            )}
                          >
                            {entry.status === "playing" ? "▶" : index + 1}
                          </div>
                          <div
                            className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
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
                            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
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

        {/* Format Picker Modal */}
        {showFormatPicker && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm">
              <h2 className="text-xl font-bold text-white mb-2">New Session</h2>
              <p className="text-gray-400 text-sm mb-6">
                Select the game format for tonight
              </p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {[2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setGameFormat(n)}
                    className={cn(
                      "py-4 rounded-xl text-lg font-bold border transition",
                      gameFormat === n
                        ? "bg-orange-500 border-orange-500 text-white"
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600",
                    )}
                  >
                    {n}v{n}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowFormatPicker(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmNewSession}
                  disabled={loading}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition"
                >
                  {loading ? "Starting..." : `Start ${gameFormat}v${gameFormat}`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmModal && confirmConfig && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm">
              <h2 className="text-xl font-bold text-white mb-2">
                {confirmConfig.title}
              </h2>
              <p className="text-gray-400 text-sm mb-6">
                {confirmConfig.message}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmConfig.onConfirm}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition"
                >
                  {confirmConfig.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Team Swap Modal */}
        {showTeamSwapModal && teamSwapSource && currentGame && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-white mb-1">
                Swap Between Teams
              </h2>
              <p className="text-gray-400 text-sm mb-5">
                Swap{" "}
                <span className="text-orange-400 font-medium">
                  {playerMap.get(teamSwapSource.playerId)?.name}
                </span>{" "}
                (Team {teamSwapSource.team.toUpperCase()}) with a player from Team{" "}
                {teamSwapSource.team === "a" ? "B" : "A"}
              </p>

              {/* Opposite team players */}
              <div className="space-y-2 mb-5">
                {(teamSwapSource.team === "a"
                  ? uniqueTeamBIds
                  : uniqueTeamAIds
                ).map((id) => {
                  const player = playerMap.get(id);
                  if (!player) return null;
                  return (
                    <button
                      key={id}
                      onClick={() => setTeamSwapTarget(id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition text-left",
                        teamSwapTarget === id
                          ? "bg-orange-950 border-orange-500"
                          : "bg-gray-800 border-gray-700 hover:border-gray-600",
                      )}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                          getAvatarColor(player.name),
                        )}
                      >
                        {getInitials(player.name)}
                      </div>
                      <span className="text-white text-sm flex-1">
                        {player.name}
                      </span>
                      <span className="text-gray-500 text-xs">
                        Team {teamSwapSource.team === "a" ? "B" : "A"}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* PIN input */}
              {teamSwapTarget && (
                <div className="border-t border-gray-800 pt-4 mb-4">
                  <label className="block text-sm text-gray-400 mb-2 text-center">
                    Enter admin PIN to confirm
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={teamSwapPin}
                    onChange={(e) => {
                      setTeamSwapPin(e.target.value);
                      setTeamSwapPinError(null);
                    }}
                    placeholder="••••"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    autoFocus
                  />
                  {teamSwapPinError && (
                    <p className="text-red-400 text-sm text-center mt-2">
                      {teamSwapPinError}
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowTeamSwapModal(false);
                    setTeamSwapSource(null);
                    setTeamSwapTarget(null);
                  }}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTeamSwap}
                  disabled={
                    !teamSwapTarget || teamSwapPin.length !== 4 || loading
                  }
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition"
                >
                  {loading ? "Swapping..." : "Confirm Swap"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
