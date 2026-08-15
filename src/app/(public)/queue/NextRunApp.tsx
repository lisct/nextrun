"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Game, Player, QueueEntry, Session } from "@/types";
import { cn } from "@/lib/utils";
import QueueTab from "@/components/queue/QueueTab";
import SessionTab from "@/components/admin/SessionTab";
import PlayersTab from "@/components/admin/PlayersTab";
import LeaderboardTab from "@/components/stats/LeaderboardTab";
import { useOnlineStatus, useLocalStore, usePendingSync } from "@/lib/offline/hooks";
import {
  localSession,
  localQueue,
  localGame,
  localPlayers,
} from "@/lib/offline/store";
import { syncToSupabase, refreshFromSupabase } from "@/lib/offline/sync";

type TabId = "queue" | "session" | "players" | "leaderboard";

const ADMIN_ONLY_TABS: TabId[] = ["session", "players"];

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "queue", label: "Queue", icon: "🏀" },
  { id: "session", label: "Session", icon: "🔐" },
  { id: "players", label: "Players", icon: "👥" },
  { id: "leaderboard", label: "Leaderboard", icon: "🏆" },
];

interface NextRunAppProps {
  initialSession: Session | null;
  initialPlayers: Player[];
  initialQueue: QueueEntry[];
  initialGame: Game | null;
  initialIsAdmin: boolean;
}

export default function NextRunApp({
  initialSession,
  initialPlayers,
  initialQueue,
  initialGame,
  initialIsAdmin,
}: NextRunAppProps) {
  const [session, setSession] = useState<Session | null>(initialSession);
  const [queue, setQueue] = useState<QueueEntry[]>(initialQueue);
  const [currentGame, setCurrentGame] = useState<Game | null>(initialGame);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);

  const [activeTab, setActiveTab] = useState<TabId>("queue");
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin);

  const isOnline = useOnlineStatus();
  const pendingSync = usePendingSync();
  const { store: localStoreSnapshot, refresh: refreshLocalStore } = useLocalStore();
  const [syncing, setSyncing] = useState(false);
  const wasOnlineRef = useRef(isOnline);

  const reconcileFromServer = useCallback(
    async (sessionId: string) => {
      await refreshFromSupabase(sessionId);
      setSession(localSession.get());
      setQueue(localQueue.get());
      setCurrentGame(localGame.get());
      setPlayers(localPlayers.get());
      refreshLocalStore();
    },
    [refreshLocalStore],
  );

  // Confirm admin status client-side (the server-rendered initialIsAdmin
  // avoids a flash of the Session tab) and stay in sync with auth changes —
  // e.g. an admin logging out on this device hides the tab immediately.
  useEffect(() => {
    const supabaseClient = createClient();

    supabaseClient.auth.getUser().then(({ data: { user } }) => {
      setIsAdmin(!!user);
    });

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, authSession) => {
      setIsAdmin(!!authSession?.user);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Seed the offline cache with the server-rendered snapshot, then upgrade to
  // fresh data when online, or fall back to whatever's cached when offline.
  useEffect(() => {
    async function seed() {
      if (initialSession) localSession.set(initialSession);
      localQueue.set(initialQueue);
      localGame.set(initialGame);
      localPlayers.set(initialPlayers);
      refreshLocalStore();

      if (isOnline && initialSession) {
        try {
          await reconcileFromServer(initialSession.id);
        } catch {
          // keep the SSR-seeded snapshot if the refresh fails
        }
      } else if (!isOnline) {
        if (localStoreSnapshot.session) setSession(localStoreSnapshot.session);
        if (localStoreSnapshot.queue.length > 0) setQueue(localStoreSnapshot.queue);
        setCurrentGame(localStoreSnapshot.game);
        if (localStoreSnapshot.players.length > 0)
          setPlayers(localStoreSnapshot.players);
      }
    }

    seed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSession?.id]);

  // Flush anything queued while offline as soon as we're back, then
  // reconcile local state with the server.
  useEffect(() => {
    if (isOnline && !wasOnlineRef.current) {
      setSyncing(true);
      syncToSupabase()
        .then(async () => {
          if (session) await reconcileFromServer(session.id);
        })
        .catch(() => {
          // whatever didn't sync stays queued for the next attempt
        })
        .finally(() => setSyncing(false));
    }
    wasOnlineRef.current = isOnline;
  }, [isOnline, session, reconcileFromServer]);

  // One shared realtime subscription for the whole app — every tab reads
  // from the same state, so a change made in one shows up in the others
  // without a reload.
  useEffect(() => {
    if (!session || !isOnline) return;

    const supabaseClient = createClient();
    const channel = supabaseClient
      .channel("nextrun-all-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions" },
        () => void reconcileFromServer(session.id),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue_entries" },
        () => void reconcileFromServer(session.id),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games" },
        () => void reconcileFromServer(session.id),
      )
      .subscribe((status) => {
        console.log("Realtime status:", status);
      });

    // Fallback polling in case realtime drops.
    const interval = setInterval(async () => {
      if (!isOnline) return;
      try {
        const res = await fetch("/api/session");
        const { session: latestSession } = await res.json();
        if (
          latestSession &&
          (latestSession.id !== session.id ||
            latestSession.status !== session.status)
        ) {
          setSession(latestSession);
          await reconcileFromServer(latestSession.id);
        }
      } catch {
        // ignore
      }
    }, 3000);

    return () => {
      supabaseClient.removeChannel(channel);
      clearInterval(interval);
    };
  }, [session, isOnline, reconcileFromServer]);

  // No session yet — poll for one to appear.
  useEffect(() => {
    if (session || !isOnline) return;

    const interval = setInterval(async () => {
      if (!isOnline) return;
      try {
        const res = await fetch("/api/session");
        const { session: latestSession } = await res.json();
        if (latestSession) {
          setSession(latestSession);
          await reconcileFromServer(latestSession.id);
        }
      } catch {
        // ignore
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [session, isOnline, reconcileFromServer]);

  const visibleTabs = TABS.filter(
    (tab) => !ADMIN_ONLY_TABS.includes(tab.id) || isAdmin,
  );
  // Derived, not stored: if admin access is lost while on an admin-only tab,
  // this falls back to Queue on the very next render — no effect/setState
  // needed.
  const effectiveTab: TabId =
    ADMIN_ONLY_TABS.includes(activeTab) && !isAdmin ? "queue" : activeTab;

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <div className="flex-1 min-h-0 overflow-hidden">
        {effectiveTab === "queue" && (
          <QueueTab
            session={session}
            queue={queue}
            setQueue={setQueue}
            players={players}
            setPlayers={setPlayers}
            isOnline={isOnline}
            pendingSync={pendingSync}
            syncing={syncing}
            refreshLocalStore={refreshLocalStore}
            reconcileFromServer={reconcileFromServer}
          />
        )}
        {effectiveTab === "session" && (
          <SessionTab
            session={session}
            setSession={setSession}
            currentGame={currentGame}
            setCurrentGame={setCurrentGame}
            queue={queue}
            setQueue={setQueue}
            players={players}
            isOnline={isOnline}
            pendingSync={pendingSync}
            syncing={syncing}
            refreshLocalStore={refreshLocalStore}
            reconcileFromServer={reconcileFromServer}
          />
        )}
        {effectiveTab === "players" && (
          <PlayersTab players={players} onPlayersChange={setPlayers} />
        )}
        {effectiveTab === "leaderboard" && <LeaderboardTab />}
      </div>

      {/* Bottom tab bar */}
      <nav className="grid border-t border-gray-800 bg-gray-900 shrink-0" style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))` }}>
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 min-h-[64px] py-2 text-sm font-semibold transition-colors active:scale-95",
              effectiveTab === tab.id
                ? "text-orange-500 bg-orange-500/10"
                : "text-gray-400 hover:text-white",
            )}
          >
            <span className="text-2xl leading-none">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
