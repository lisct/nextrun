"use client";

import type { Game, Player, QueueEntry, Session } from "@/types";

const KEYS = {
  session: "nextrun:session",
  queue: "nextrun:queue",
  game: "nextrun:game",
  players: "nextrun:players",
  syncQueue: "nextrun:sync_queue",
} as const;

export type SyncActionType =
  | "JOIN_QUEUE"
  | "LEAVE_QUEUE"
  | "GENERATE_TEAMS"
  | "MARK_WINNER"
  | "SWAP_PLAYERS"
  | "SWAP_TEAM_PLAYERS"
  | "OPEN_SESSION"
  | "CLOSE_SESSION"
  | "REGISTER_PLAYER";

interface JoinQueuePayload {
  entryId: string;
  sessionId: string;
  playerId: string;
  position: number;
}

interface LeaveQueuePayload {
  queueEntryId: string;
}

interface GenerateTeamsPayload {
  gameId: string;
  sessionId: string;
  teamAIds: string[];
  teamBIds: string[];
}

interface MarkWinnerPayload {
  gameId: string;
  sessionId: string;
  winner: "team_a" | "team_b";
}

interface SwapPlayersPayload {
  sessionId: string;
  playingPlayerId: string;
  waitingPlayerId: string;
}

interface SwapTeamPlayersPayload {
  gameId: string;
  teamAPlayerId: string;
  teamBPlayerId: string;
}

interface OpenSessionPayload {
  sessionId: string;
  date: string;
  gameFormat: number;
}

interface CloseSessionPayload {
  sessionId: string;
}

interface RegisterPlayerPayload {
  player: Player;
}

export type SyncAction =
  | { id: string; type: "JOIN_QUEUE"; createdAt: string; retryCount: number; payload: JoinQueuePayload }
  | { id: string; type: "LEAVE_QUEUE"; createdAt: string; retryCount: number; payload: LeaveQueuePayload }
  | { id: string; type: "GENERATE_TEAMS"; createdAt: string; retryCount: number; payload: GenerateTeamsPayload }
  | { id: string; type: "MARK_WINNER"; createdAt: string; retryCount: number; payload: MarkWinnerPayload }
  | { id: string; type: "SWAP_PLAYERS"; createdAt: string; retryCount: number; payload: SwapPlayersPayload }
  | { id: string; type: "SWAP_TEAM_PLAYERS"; createdAt: string; retryCount: number; payload: SwapTeamPlayersPayload }
  | { id: string; type: "OPEN_SESSION"; createdAt: string; retryCount: number; payload: OpenSessionPayload }
  | { id: string; type: "CLOSE_SESSION"; createdAt: string; retryCount: number; payload: CloseSessionPayload }
  | { id: string; type: "REGISTER_PLAYER"; createdAt: string; retryCount: number; payload: RegisterPlayerPayload };

export interface LocalStore {
  session: Session | null;
  queue: QueueEntry[];
  game: Game | null;
  players: Player[];
  syncQueue: SyncAction[];
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readKey<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeKey<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage may be unavailable (private mode, quota exceeded) — fail silently
  }
}

function removeKey(key: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export const localSession = {
  get(): Session | null {
    return readKey<Session | null>(KEYS.session, null);
  },
  set(session: Session | null): void {
    writeKey(KEYS.session, session);
  },
  clear(): void {
    removeKey(KEYS.session);
  },
};

export const localQueue = {
  get(): QueueEntry[] {
    return readKey<QueueEntry[]>(KEYS.queue, []);
  },
  set(queue: QueueEntry[]): void {
    writeKey(KEYS.queue, queue);
  },
  clear(): void {
    removeKey(KEYS.queue);
  },
};

export const localGame = {
  get(): Game | null {
    return readKey<Game | null>(KEYS.game, null);
  },
  set(game: Game | null): void {
    writeKey(KEYS.game, game);
  },
  clear(): void {
    removeKey(KEYS.game);
  },
};

export const localPlayers = {
  get(): Player[] {
    return readKey<Player[]>(KEYS.players, []);
  },
  set(players: Player[]): void {
    writeKey(KEYS.players, players);
  },
  clear(): void {
    removeKey(KEYS.players);
  },
};

export const localSyncQueue = {
  get(): SyncAction[] {
    return readKey<SyncAction[]>(KEYS.syncQueue, []);
  },
  set(actions: SyncAction[]): void {
    writeKey(KEYS.syncQueue, actions);
  },
  push(action: SyncAction): void {
    const current = localSyncQueue.get();
    writeKey(KEYS.syncQueue, [...current, action]);
  },
  clear(): void {
    removeKey(KEYS.syncQueue);
  },
};

export function clearLocalStore(): void {
  localSession.clear();
  localQueue.clear();
  localGame.clear();
  localPlayers.clear();
  localSyncQueue.clear();
}

const STUCK_ACTION_MAX_AGE_MS = 60 * 60 * 1000;

export function clearStuckActions(): void {
  const cutoff = Date.now() - STUCK_ACTION_MAX_AGE_MS;
  const current = localSyncQueue.get();
  const fresh = current.filter(
    (action) => new Date(action.createdAt).getTime() >= cutoff,
  );

  if (fresh.length !== current.length) {
    localSyncQueue.set(fresh);
  }
}
