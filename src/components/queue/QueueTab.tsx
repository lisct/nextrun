"use client";

import { useState } from "react";
import { Session, Player, QueueEntry, PaymentPlan } from "@/types";
import { cn, getInitials } from "@/lib/utils";
import {
  joinQueue,
  registerAndJoin,
  removePlayerFromQueue,
} from "@/app/(public)/queue/actions";
import {
  localQueue,
  localPlayers,
  localSyncQueue,
  type SyncAction,
} from "@/lib/offline/store";

interface QueueTabProps {
  session: Session | null;
  queue: QueueEntry[];
  setQueue: (queue: QueueEntry[]) => void;
  players: Player[];
  setPlayers: (players: Player[]) => void;
  isOnline: boolean;
  pendingSync: number;
  syncing: boolean;
  refreshLocalStore: () => void;
  reconcileFromServer: (sessionId: string) => Promise<void>;
}

export default function QueueTab({
  session,
  queue,
  setQueue,
  players,
  setPlayers,
  isOnline,
  pendingSync,
  syncing,
  refreshLocalStore,
  reconcileFromServer,
}: QueueTabProps) {
  const [search, setSearch] = useState("");
  const [showNewPlayer, setShowNewPlayer] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [playerToRemove, setPlayerToRemove] = useState<QueueEntry | null>(null);

  // New player form
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPlan, setNewPlan] = useState<PaymentPlan>("per_session");

  const queuePlayerIds = new Set(queue.map((e) => e.player_id));

  const filtered = players.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

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

  async function handleJoin(player: Player) {
    if (!session) return;
    if (queuePlayerIds.has(player.id)) return;

    setLoading(player.id);
    setError(null);

    // Online actions never touch the sync queue — they either land directly
    // (using the server's response as the source of truth) or, if the
    // direct call fails, fall through to the offline path below. That path
    // is the ONLY thing that ever writes to localSyncQueue, so a
    // successfully-synced-online action can never also be replayed by a
    // later sync pass.
    if (isOnline) {
      try {
        const entry = await joinQueue(session.id, player.id);
        const updatedQueue = [...queue, { ...entry, player }];
        setQueue(updatedQueue);
        localQueue.set(updatedQueue);
        refreshLocalStore();
        setLoading(null);
        return;
      } catch {
        // Direct call failed even though we thought we were online — fall
        // through to the offline path so the join isn't lost.
      }
    }

    const entryId = crypto.randomUUID();
    const nextPosition =
      queue.length > 0
        ? Math.max(...queue.map((e) => e.position)) + 1
        : 1;
    const optimisticEntry: QueueEntry = {
      id: entryId,
      session_id: session.id,
      player_id: player.id,
      position: nextPosition,
      status: "waiting",
      joined_at: new Date().toISOString(),
      player,
    };

    const updatedQueue = [...queue, optimisticEntry];
    setQueue(updatedQueue);
    localQueue.set(updatedQueue);

    const action: SyncAction = {
      id: crypto.randomUUID(),
      type: "JOIN_QUEUE",
      createdAt: new Date().toISOString(),
      retryCount: 0,
      payload: {
        entryId,
        sessionId: session.id,
        playerId: player.id,
        position: optimisticEntry.position,
      },
    };
    localSyncQueue.push(action);
    refreshLocalStore();

    setLoading(null);
  }

  async function handleRegisterAndJoin() {
    if (!session || !newName.trim()) return;

    setLoading("new");
    setError(null);

    const trimmedName = newName.trim();
    const trimmedPhone = newPhone.trim();
    const plan = newPlan;

    if (isOnline) {
      try {
        const { player, entry } = await registerAndJoin(
          session.id,
          trimmedName,
          trimmedPhone || null,
          plan,
        );
        const updatedPlayers = [...players, player].sort((a, b) =>
          a.name.localeCompare(b.name),
        );
        const updatedQueue = [...queue, { ...entry, player }];
        setPlayers(updatedPlayers);
        setQueue(updatedQueue);
        localPlayers.set(updatedPlayers);
        localQueue.set(updatedQueue);
        refreshLocalStore();

        setShowNewPlayer(false);
        setNewName("");
        setNewPhone("");
        setNewPlan("per_session");
        setLoading(null);
        return;
      } catch {
        // Direct call failed even though we thought we were online — fall
        // through to the offline path so registration isn't lost.
      }
    }

    const playerId = crypto.randomUUID();
    const entryId = crypto.randomUUID();

    const newPlayer: Player = {
      id: playerId,
      name: trimmedName,
      phone: trimmedPhone || null,
      payment_plan: plan,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    const nextPosition =
      queue.length > 0
        ? Math.max(...queue.map((e) => e.position)) + 1
        : 1;
    const optimisticEntry: QueueEntry = {
      id: entryId,
      session_id: session.id,
      player_id: playerId,
      position: nextPosition,
      status: "waiting",
      joined_at: new Date().toISOString(),
      player: newPlayer,
    };

    const updatedPlayers = [...players, newPlayer].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const updatedQueue = [...queue, optimisticEntry];
    setPlayers(updatedPlayers);
    setQueue(updatedQueue);
    localPlayers.set(updatedPlayers);
    localQueue.set(updatedQueue);

    localSyncQueue.push({
      id: crypto.randomUUID(),
      type: "REGISTER_PLAYER",
      createdAt: new Date().toISOString(),
      retryCount: 0,
      payload: { player: newPlayer },
    });
    localSyncQueue.push({
      id: crypto.randomUUID(),
      type: "JOIN_QUEUE",
      createdAt: new Date().toISOString(),
      retryCount: 0,
      payload: {
        entryId,
        sessionId: session.id,
        playerId,
        position: optimisticEntry.position,
      },
    });
    refreshLocalStore();

    setShowNewPlayer(false);
    setNewName("");
    setNewPhone("");
    setNewPlan("per_session");

    setLoading(null);
  }

  function initiateRemove(entry: QueueEntry) {
    setPlayerToRemove(entry);
    setPin("");
    setPinError(null);
    setShowPinModal(true);
  }

  async function handleRemove() {
    if (!session || !playerToRemove) return;

    const correctPin = process.env.NEXT_PUBLIC_ADMIN_PIN ?? "1234";

    if (pin !== correctPin) {
      setPinError("Incorrect PIN");
      setPin("");
      return;
    }

    setShowPinModal(false);

    const entryToRemove = playerToRemove;
    setPlayerToRemove(null);

    if (isOnline) {
      try {
        await removePlayerFromQueue(session.id, entryToRemove.player_id);
        // removePlayerFromQueue can promote/swap players server-side —
        // pull the reconciled state rather than guessing at it locally.
        // This also keeps the Session tab's game view in sync.
        await reconcileFromServer(session.id);
        return;
      } catch {
        // Direct call failed even though we thought we were online — fall
        // through to the offline path so the removal isn't lost.
      }
    }

    const updatedQueue = queue.filter((e) => e.id !== entryToRemove.id);
    setQueue(updatedQueue);
    localQueue.set(updatedQueue);

    localSyncQueue.push({
      id: crypto.randomUUID(),
      type: "LEAVE_QUEUE",
      createdAt: new Date().toISOString(),
      retryCount: 0,
      payload: { queueEntryId: entryToRemove.id },
    });
    refreshLocalStore();
  }

  // Session closed
  if (session?.status === "closed") {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">🏀</div>
          <h1 className="text-3xl font-bold text-white mb-2">That&apos;s a wrap!</h1>
          <p className="text-gray-400">
            Tonight&apos;s session has ended. See you next Friday!
          </p>
        </div>
      </div>
    );
  }

  // No session open
  if (!session || session.status !== "open") {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">🏀</div>
          <h1 className="text-3xl font-bold text-white mb-2">NextRun</h1>
          <p className="text-gray-400">
            Waiting for Tonight&apos;s session to open...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🏀</span>
          <div>
            <h1 className="text-xl font-bold text-white">NextRun</h1>
            <p className="text-gray-400 text-xs">
              Tap your name to join the queue
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
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
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left — Player grid */}
        <div className="w-1/2 border-r border-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-800">
            <input
              type="text"
              placeholder="Search players..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 text-lg"
            />
          </div>

          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((player) => {
                const inQueue = queuePlayerIds.has(player.id);
                const queueEntry = queue.find((e) => e.player_id === player.id);
                const position =
                  queue
                    .filter((e) => e.status === "waiting")
                    .findIndex((e) => e.player_id === player.id) + 1;

                return (
                  <button
                    key={player.id}
                    onClick={() => handleJoin(player)}
                    disabled={inQueue || loading === player.id}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-2xl border transition text-left",
                      inQueue
                        ? "bg-green-950 border-green-800 cursor-default"
                        : loading === player.id
                          ? "bg-gray-800 border-gray-700 opacity-50"
                          : "bg-gray-900 border-gray-800 hover:border-orange-500 hover:bg-gray-800 active:scale-95",
                    )}
                  >
                    <div
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                        inQueue
                          ? "bg-green-900 text-green-400"
                          : getAvatarColor(player.name),
                      )}
                    >
                      {getInitials(player.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={cn(
                          "font-semibold text-base truncate",
                          inQueue ? "text-green-400" : "text-white",
                        )}
                      >
                        {player.name}
                      </div>
                      <div className="text-xs mt-0.5">
                        {inQueue ? (
                          <span className="text-green-500">
                            {queueEntry?.status === "playing"
                              ? "▶ Playing now"
                              : `#${position} in queue`}
                          </span>
                        ) : (
                          <span className="text-gray-500">Tap to join</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* New player button */}
              <button
                onClick={() => setShowNewPlayer(true)}
                className="flex items-center gap-3 p-4 rounded-2xl border border-dashed border-gray-700 hover:border-orange-500 text-gray-500 hover:text-orange-400 transition active:scale-95"
              >
                <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-2xl shrink-0">
                  +
                </div>
                <div>
                  <div className="font-semibold text-base">New Player</div>
                  <div className="text-xs mt-0.5">Register here</div>
                </div>
              </button>
            </div>

            {error && (
              <div className="mt-4 bg-red-950 border border-red-800 rounded-xl px-4 py-3 text-red-300 text-sm">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Right — Queue */}
        <div className="w-1/2 flex flex-col">
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold text-lg">
                Tonight&apos;s Queue
              </h2>
              <span className="text-gray-400 text-sm">
                {queue.filter((e) => e.status === "waiting").length} waiting
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {queue.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <p className="text-lg">No one in queue yet</p>
                <p className="text-sm mt-1">Tap your name to be first!</p>
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
                  .map((entry) => {
                    const player = entry.player as Player;
                    if (!player) return null;
                    const waitingIndex = [...queue]
                      .filter((e) => e.status === "waiting")
                      .sort((a, b) => a.position - b.position)
                      .findIndex((e) => e.player_id === entry.player_id);

                    return (
                      <div
                        key={entry.id}
                        className={cn(
                          "flex items-center gap-4 px-4 py-4 rounded-2xl border",
                          entry.status === "playing"
                            ? "bg-orange-950 border-orange-800"
                            : "bg-gray-900 border-gray-800",
                        )}
                      >
                        {/* Position */}
                        <div
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                            entry.status === "playing"
                              ? "bg-orange-500 text-white"
                              : "bg-gray-800 text-gray-400",
                          )}
                        >
                          {entry.status === "playing" ? "▶" : waitingIndex + 1}
                        </div>

                        {/* Avatar */}
                        <div
                          className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                            entry.status === "playing"
                              ? "bg-orange-900 text-orange-300"
                              : getAvatarColor(player.name),
                          )}
                        >
                          {getInitials(player.name)}
                        </div>

                        {/* Name */}
                        <div className="flex-1">
                          <div
                            className={cn(
                              "font-semibold text-base",
                              entry.status === "playing"
                                ? "text-orange-300"
                                : "text-white",
                            )}
                          >
                            {player.name}
                          </div>
                        </div>

                        {/* Status */}
                        <span
                          className={cn(
                            "text-xs px-3 py-1 rounded-full font-medium",
                            entry.status === "playing"
                              ? "bg-orange-500 text-white"
                              : "bg-gray-800 text-gray-400",
                          )}
                        >
                          {entry.status === "playing" ? "Playing" : "Waiting"}
                        </span>

                        {/* Remove button */}
                        <button
                          onClick={() => initiateRemove(entry)}
                          className="text-gray-600 hover:text-red-400 transition p-1 rounded-lg hover:bg-gray-800"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Player Modal */}
      {showNewPlayer && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-5">New Player</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Name *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 text-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Phone (optional)
                </label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Your phone number"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 text-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Payment plan
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setNewPlan("per_session")}
                    className={cn(
                      "py-4 rounded-xl text-sm font-medium border transition",
                      newPlan === "per_session"
                        ? "bg-orange-500 border-orange-500 text-white"
                        : "bg-gray-800 border-gray-700 text-gray-400",
                    )}
                  >
                    Per session
                  </button>
                  <button
                    onClick={() => setNewPlan("monthly")}
                    className={cn(
                      "py-4 rounded-xl text-sm font-medium border transition",
                      newPlan === "monthly"
                        ? "bg-orange-500 border-orange-500 text-white"
                        : "bg-gray-800 border-gray-700 text-gray-400",
                    )}
                  >
                    Monthly
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-950 border border-red-800 rounded-xl px-4 py-3 text-red-300 text-sm">
                  {error}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowNewPlayer(false);
                  setError(null);
                }}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium py-4 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRegisterAndJoin}
                disabled={loading === "new" || !newName.trim()}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-4 rounded-xl transition"
              >
                {loading === "new" ? "Joining..." : "Join Queue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Modal */}
      {showPinModal && playerToRemove && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold text-white mb-2">Admin PIN</h2>
            <p className="text-gray-400 text-sm mb-5">
              Enter PIN to remove{" "}
              <span className="text-white font-medium">
                {(playerToRemove.player as Player)?.name}
              </span>{" "}
              from queue
            </p>

            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setPinError(null);
              }}
              placeholder="••••"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-4 text-white text-center text-2xl tracking-widest placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500 mb-3"
              autoFocus
            />

            {pinError && (
              <div className="text-red-400 text-sm text-center mb-3">
                {pinError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setShowPinModal(false);
                  setPlayerToRemove(null);
                }}
                className="bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRemove}
                disabled={pin.length !== 4}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
