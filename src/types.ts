export interface MapEvent {
  user_id: string;
  match_id: string;
  event: string;
  category: string;
  px: number;
  py: number;
  ts_relative: number;
  is_bot: boolean;
  date: string;
}

export interface MatchMeta {
  match_id: string;
  match_id_clean: string;
  map_id: string;
  date: string;
  human_players: number;
  bot_players: number;
  total_events: number;
  duration_ms: number;
}

export interface IndexData {
  dates: string[];
  maps: string[];
  matches: MatchMeta[];
}

export interface MapData {
  map_id: string;
  total_events: number;
  events: MapEvent[];
  heatmaps: Record<string, unknown>;
}
