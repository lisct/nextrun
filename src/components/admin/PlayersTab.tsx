"use client";
import {
  addPlayer,
  updatePlayer,
  deactivatePlayer,
} from "@/app/admin/players/actions";
import { useState } from "react";
import { Player, PaymentPlan } from "@/types";
import { getInitials, cn } from "@/lib/utils";

interface PlayersTabProps {
  players: Player[];
  onPlayersChange: (players: Player[]) => void;
}

export default function PlayersTab({
  players,
  onPlayersChange,
}: PlayersTabProps) {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan>("per_session");

  const filtered = players.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  function openAddForm() {
    setEditingPlayer(null);
    setName("");
    setPhone("");
    setPaymentPlan("per_session");
    setError(null);
    setShowForm(true);
  }

  function openEditForm(player: Player) {
    setEditingPlayer(player);
    setName(player.name);
    setPhone(player.phone ?? "");
    setPaymentPlan(player.payment_plan);
    setError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingPlayer(null);
    setError(null);
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (editingPlayer) {
        const updated = await updatePlayer(
          editingPlayer.id,
          name,
          phone || null,
          paymentPlan,
        );
        onPlayersChange(
          players.map((p) => (p.id === editingPlayer.id ? updated : p)),
        );
      } else {
        const newPlayer = await addPlayer(name, phone || null, paymentPlan);
        onPlayersChange(
          [...players, newPlayer].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        );
      }
      closeForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeactivate(player: Player) {
    if (!confirm(`Remove ${player.name} from the roster?`)) return;

    try {
      await deactivatePlayer(player.id);
      onPlayersChange(players.filter((p) => p.id !== player.id));
    } catch {
      alert("Error removing player");
    }
  }

  const avatarColors = [
    "bg-orange-950 text-orange-400",
    "bg-blue-950 text-blue-400",
    "bg-green-950 text-green-400",
    "bg-purple-950 text-purple-400",
    "bg-red-950 text-red-400",
    "bg-yellow-950 text-yellow-400",
  ];

  function getAvatarColor(name: string) {
    const index = name.charCodeAt(0) % avatarColors.length;
    return avatarColors[index];
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Players</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {players.length} registered players
            </p>
          </div>
          <button
            onClick={openAddForm}
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-xl transition"
          >
            + Add Player
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search players..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 mb-4"
        />

        {/* Players list */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            {search
              ? "No players found"
              : "No players yet — add your first player"}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((player) => (
              <div
                key={player.id}
                className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-4"
              >
                {/* Avatar */}
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                    getAvatarColor(player.name),
                  )}
                >
                  {getInitials(player.name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium">{player.name}</div>
                  <div className="text-gray-500 text-sm">
                    {player.phone ?? "No phone"}
                  </div>
                </div>

                {/* Payment plan */}
                <span
                  className={cn(
                    "text-xs font-medium px-3 py-1 rounded-full",
                    player.payment_plan === "monthly"
                      ? "bg-yellow-950 text-yellow-400"
                      : "bg-gray-800 text-gray-400",
                  )}
                >
                  {player.payment_plan === "monthly" ? "Monthly" : "Per session"}
                </span>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditForm(player)}
                    className="text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeactivate(player)}
                    className="text-gray-400 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition text-sm"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-white mb-5">
                {editingPlayer ? "Edit Player" : "Add Player"}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Player name"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Payment plan
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setPaymentPlan("per_session")}
                      className={cn(
                        "py-3 rounded-xl text-sm font-medium border transition",
                        paymentPlan === "per_session"
                          ? "bg-orange-500 border-orange-500 text-white"
                          : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600",
                      )}
                    >
                      Per session
                    </button>
                    <button
                      onClick={() => setPaymentPlan("monthly")}
                      className={cn(
                        "py-3 rounded-xl text-sm font-medium border transition",
                        paymentPlan === "monthly"
                          ? "bg-orange-500 border-orange-500 text-white"
                          : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600",
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
                  onClick={closeForm}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition"
                >
                  {loading
                    ? "Saving..."
                    : editingPlayer
                      ? "Save changes"
                      : "Add player"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
