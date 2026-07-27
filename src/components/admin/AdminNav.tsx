"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface AdminNavProps {
  userEmail: string;
}

const links = [
  { href: "/admin/session", label: "Session", icon: "🏀" },
  { href: "/admin/players", label: "Players", icon: "👥" },
  { href: "/admin/payments", label: "Payments", icon: "💰" },
];

export default function AdminNav({ userEmail }: AdminNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col min-h-screen">
      {/* Logo */}
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏀</span>
          <div>
            <div className="text-white font-bold text-lg leading-none">
              NextRun
            </div>
            <div className="text-gray-500 text-xs mt-0.5">Admin</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              pathname === link.href
                ? "bg-orange-500 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-800",
            )}
          >
            <span className="text-lg">{link.icon}</span>
            {link.label}
          </Link>
        ))}
      </nav>

      {/* View public screens */}
      <div className="p-3 border-t border-gray-800 space-y-1">
        <Link
          href="/queue"
          target="_blank"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <span className="text-lg">📺</span>
          Queue screen
        </Link>
        <Link
          href="/leaderboard"
          target="_blank"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <span className="text-lg">🏆</span>
          Leaderboard
        </Link>
      </div>

      {/* User + logout */}
      <div className="p-4 border-t border-gray-800">
        <div className="text-gray-500 text-xs truncate mb-3">{userEmail}</div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <span>🚪</span>
          Sign out
        </button>
      </div>
    </aside>
  );
}
