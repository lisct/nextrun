"use client";

import { useEffect, useRef, useState } from "react";
import { useOnlineStatus, usePendingSync } from "@/lib/offline/hooks";

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const pendingCount = usePendingSync();
  const [showSynced, setShowSynced] = useState(false);
  const prevPendingRef = useRef(pendingCount);

  useEffect(() => {
    const prevPending = prevPendingRef.current;
    prevPendingRef.current = pendingCount;

    if (isOnline && prevPending > 0 && pendingCount === 0) {
      setShowSynced(true);
      const timeout = setTimeout(() => setShowSynced(false), 3000);
      return () => clearTimeout(timeout);
    }
  }, [isOnline, pendingCount]);

  if (!isOnline) {
    return (
      <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-red-600 px-4 py-2 text-center text-sm font-medium text-white">
        You&apos;re offline — changes are saved and will sync automatically
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-white">
        <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        Syncing changes...
      </div>
    );
  }

  if (showSynced) {
    return (
      <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-green-600 px-4 py-2 text-center text-sm font-medium text-white">
        All changes synced ✓
      </div>
    );
  }

  return null;
}
