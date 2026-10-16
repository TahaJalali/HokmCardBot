import type { Card, Suit } from './hokm';

export type SeatKind = 'human' | 'bot' | 'empty';
export type GameMode = 'solo' | 'room';
export type GameStatus = 'waiting' | 'trump' | 'playing' | 'finished';

export interface Seat {
  type: SeatKind;
  name: string;
  tgId?: number;
  chatId?: number;
}

export interface TrickEntry {
  seat: number;
  card: Card;
}

export interface CompletedTrick {
  cards: TrickEntry[];
  winner: number;
  points: number;
}

export interface GameResult {
  winner: number;
  /** Persian sentence explaining the outcome. */
  reason: string;
  /** The winners took all 13 tricks — they lose the round. */
  sweep: boolean;
  /** The winners did not capture the Hokm (trump ace) card. */
  hokmBonus: boolean;
  teamTricks: [number, number];
  teamPoints: [number, number];
}

/** Everything the Mini App is allowed to see about a game. */
export interface PublicGame {
  id: string;
  mode: GameMode;
  status: GameStatus;
  trump: Suit | null;
  declarer: number;
  /** Seat that must act next. */
  turn: number;
  /** Seat that led the current trick. */
  lead: number;
  trick: TrickEntry[];
  /** 1-based number of the trick being played. */
  trickNo: number;
  tricks: CompletedTrick[];
  /** How many cards each seat still holds. */
  handCounts: number[];
  teamTricks: [number, number];
  teamPoints: [number, number];
  seats: Seat[];
  /** Team that captured the Hokm card (trump ace), if it was played. */
  hokmTeam: number | null;
  winner: number | null;
  result: GameResult | null;
  /** The viewer's own hand. */
  hand: Card[];
  version: number;
}

export interface ViewerInfo {
  seat: number;
  team: number;
  name: string;
  isDeclarer: boolean;
}

export interface GameResponse {
  game: PublicGame;
  you: ViewerInfo;
  /** Cards played by bots while serving this call (for animation). */
  moves: { seat: number; card: Card }[];
  notice?: string;
  /** A link that opens this game in the Mini App (to share it). */
  shareLink?: string;
}

export interface GameSummary {
  id: string;
  mode: GameMode;
  status: GameStatus;
  trump: Suit | null;
  turn: number;
  seats: Seat[];
}

export interface LobbyResponse {
  games: GameSummary[];
  botUsername: string | null;
  miniAppUrl: string | null;
}
