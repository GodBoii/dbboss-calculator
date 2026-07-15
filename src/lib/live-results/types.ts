export type ResultPhase = "open" | "close";

export interface Market {
  id: string;
  display_name: string;
  homepage_name: string;
  session: "day" | "night";
  open_time: string;
  close_time: string;
  timezone: string;
  history_url: string;
  source_url: string;
  sort_order: number;
}

export interface MarketResult {
  id: string;
  market_id: string;
  result_date: string;
  status: "open" | "closed" | "corrected";
  open_panel: string;
  open_digit: number;
  jodi: string | null;
  close_panel: string | null;
  close_digit: number | null;
  raw_source_value: string;
  confirmed_at: string;
  corrected_at: string | null;
}

export interface ParsedSourceResult {
  marketName: string;
  rawValue: string;
  phase: ResultPhase;
  openPanel: string;
  openDigit: number;
  jodi: string | null;
  closePanel: string | null;
  closeDigit: number | null;
}

export interface LiveResultsResponse {
  date: string;
  timezone: "Asia/Kolkata";
  markets: Market[];
  results: MarketResult[];
  generatedAt: string;
}
