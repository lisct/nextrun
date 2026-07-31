export type PaymentPlan = "monthly" | "per_session";
export type SessionStatus = "open" | "in_progress" | "closed";
export type QueueStatus = "waiting" | "playing" | "done";
export type GameWinner = "team_a" | "team_b" | null;

export interface Player {
  id: string;
  name: string;
  phone: string | null;
  payment_plan: PaymentPlan;
  is_active: boolean;
  created_at: string;
  // computed
  wins?: number;
  losses?: number;
  win_rate?: number;
  current_streak?: number;
}

export interface Session {
  id: string;
  date: string;
  status: SessionStatus;
  ai_summary: string | null;
  created_by: string | null;
  created_at: string;
  game_format: number; // players per team: 2, 3, 4, 5
}

export interface QueueEntry {
  id: string;
  session_id: string;
  player_id: string;
  position: number;
  status: QueueStatus;
  joined_at: string;
  player?: Player;
}

export interface Game {
  id: string;
  session_id: string;
  team_a_ids: string[];
  team_b_ids: string[];
  winner: GameWinner;
  played_at: string;
  team_a_players?: Player[];
  team_b_players?: Player[];
}

export interface Payment {
  id: string;
  player_id: string;
  session_id: string | null;
  type: PaymentPlan;
  month: string | null;
  amount: number;
  paid: boolean;
  paid_at: string | null;
  player?: Player;
}

export interface PlayerStats {
  player_id: string;
  player_name: string;
  games_played: number;
  wins: number;
  losses: number;
  win_rate: number;
  current_streak: number;
  longest_streak: number;
  sessions_attended: number;
}
