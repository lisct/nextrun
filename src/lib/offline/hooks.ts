"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearStuckActions,
  localGame,
  localPlayers,
  localQueue,
  localSession,
  localSyncQueue,
  type LocalStore,
} from "@/lib/offline/store";

function readStore(): LocalStore {
  return {
    session: localSession.get(),
    queue: localQueue.get(),
    game: localGame.get(),
    players: localPlayers.get(),
    syncQueue: localSyncQueue.get(),
  };
}

async function verifyConnection(): Promise<boolean> {
  try {
    const res = await fetch("/api/session", {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | undefined;

    // Only flips isOnline once the connection is verified for real —
    // navigator.onLine can report true while the connection is still dead.
    // This hook only reports connectivity; it does NOT trigger a sync
    // itself, so consumers stay the single source of truth for when a
    // reconnect sync runs (avoids two independent triggers double-syncing
    // the same queued actions).
    async function verifyAndMarkOnline() {
      const connected = await verifyConnection();
      if (cancelled) return;

      if (connected) {
        setIsOnline(true);
      } else {
        retryTimeout = setTimeout(verifyAndMarkOnline, 3000);
      }
    }

    function handleOnline() {
      void verifyAndMarkOnline();
    }
    function handleOffline() {
      setIsOnline(false);
      if (retryTimeout) clearTimeout(retryTimeout);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      cancelled = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

export function useLocalStore(): { store: LocalStore; refresh: () => void } {
  const [store, setStore] = useState<LocalStore>(() => readStore());

  const refresh = useCallback(() => {
    setStore(readStore());
  }, []);

  useEffect(() => {
    clearStuckActions();
    refresh();
  }, [refresh]);

  return { store, refresh };
}

export function usePendingSync(): number {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    function update() {
      setCount(localSyncQueue.get().length);
    }

    update();
    const interval = setInterval(update, 2000);
    return () => clearInterval(interval);
  }, []);

  return count;
}
