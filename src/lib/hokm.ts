/**
 * Hokm (خوکم) rules — client mirror of `tgcloud/lib/hokm-rules.js`.
 *
 * The server is the source of truth; this file only mirrors the pure
 * functions the Mini App needs (labels, legality checks, trick resolution) so
 * the UI can grey out illegal cards and animate tricks without a round-trip.
 *
 * A card is a two character string: rank + suit.
 *   ranks: 2 3 4 5 6 7 8 9 T J Q K A
 *   suits: S (spades) H (hearts) D (diamonds) C (clubs)
 */
export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';
export type Card = string;

export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

export const RANK_VALUE: Record<string, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

export const SUIT_SYMBOL: Record<Suit, string> = {
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣',
};

export const SUIT_NAME: Record<Suit, string> = {
  S: 'گشنیز',
  H: 'دل',
  D: 'خشت',
  C: 'خاج',
};

export const RANK_NAME: Record<string, string> = {
  A: 'آس',
  T: 'ده',
  J: 'ب',
  Q: 'خ',
  K: 'شاه',
};

/** Persian digits for the numbers on the cards. */
const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(value: string): string {
  return value.replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
}

export function rankOf(card: Card): Rank {
  return card[0] as Rank;
}

export function suitOf(card: Card): Suit {
  return card[1] as Suit;
}

export function cardLabel(card: Card): string {
  const rank = rankOf(card);
  return RANK_NAME[rank] ?? toPersianDigits(rank);
}

export function cardName(card: Card): string {
  return `${cardLabel(card)} ${SUIT_NAME[suitOf(card)]}`;
}

export function isRedSuit(suit: Suit): boolean {
  return suit === 'H' || suit === 'D';
}

/** Team of a seat: seats 0 and 2 are partners, 1 and 3 are partners. */
export function teamOf(seat: number): number {
  return seat % 2;
}

/** Card points: A = 10, 10 = 10, K = 4, Q = 3, J = 2, everything else 0. */
export function cardPoints(card: Card): number {
  switch (rankOf(card)) {
    case 'A':
    case 'T':
      return 10;
    case 'K':
      return 4;
    case 'Q':
      return 3;
    case 'J':
      return 2;
    default:
      return 0;
  }
}

export interface TrickEntry {
  seat: number;
  card: Card;
}

/**
 * Who wins the current trick: the highest trump if anybody played one,
 * otherwise the highest card of the led suit.
 */
export function trickWinner(entries: TrickEntry[], trump: Suit | null): number | null {
  if (!entries.length) return null;

  const led = suitOf(entries[0].card);
  const trumps = entries.filter((entry) => suitOf(entry.card) === trump);
  const pool = trumps.length ? trumps : entries.filter((entry) => suitOf(entry.card) === led);
  const candidates = pool.length ? pool : entries;

  let best = candidates[0];
  for (const entry of candidates.slice(1)) {
    if (RANK_VALUE[rankOf(entry.card)] > RANK_VALUE[rankOf(best.card)]) best = entry;
  }
  return best.seat;
}

/**
 * The cards a seat may legally play.
 *
 * - Must follow the suit that was led.
 * - If it cannot, it must play a trump.
 * - If a trump is in the trick and the seat holds a higher trump, it must
 *   beat it (the classic "باید خوکم بزند" rule).
 */
export function legalCards(hand: Card[], trick: TrickEntry[], trump: Suit | null): Card[] {
  if (!trick.length || !trump) return [...hand];

  const led = suitOf(trick[0].card);
  const following = hand.filter((card) => suitOf(card) === led);
  if (following.length) return following;

  const trumps = hand.filter((card) => suitOf(card) === trump);
  if (!trumps.length) return [...hand];

  const playedTrumps = trick.filter((entry) => suitOf(entry.card) === trump);
  if (playedTrumps.length) {
    const highest = Math.max(...playedTrumps.map((entry) => RANK_VALUE[rankOf(entry.card)]));
    const beaters = trumps.filter((card) => RANK_VALUE[rankOf(card)] > highest);
    if (beaters.length) return beaters;
  }

  return trumps;
}

/** A human readable reason why a card cannot be played right now. */
export function illegalReason(card: Card, trick: TrickEntry[], trump: Suit | null): string | null {
  if (!trick.length || !trump) return null;
  if (legalCards([card], trick, trump).length) return null;

  const led = suitOf(trick[0].card);
  if (suitOf(card) === led) return null;
  return 'باید سوت (خوکم) بزنید';
}

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push(rank + suit);
  }
  return deck;
}

export function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Deal the whole deck — 13 cards per seat, seat 0 first. */
export function deal(): Card[][] {
  const deck = shuffle(buildDeck());
  const hands: Card[][] = [[], [], [], []];
  let card = 0;
  for (let round = 0; round < 13; round += 1) {
    for (let seat = 0; seat < 4; seat += 1) {
      hands[seat].push(deck[card]);
      card += 1;
    }
  }
  for (const hand of hands) {
    hand.sort((a, b) => RANK_VALUE[rankOf(b)] - RANK_VALUE[rankOf(a)] || a.localeCompare(b));
  }
  return hands;
}
