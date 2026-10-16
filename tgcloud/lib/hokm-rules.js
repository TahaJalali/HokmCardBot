/**
 * The rules of Hokm (حکم) — the source of truth for the bot.
 *
 * The Mini App mirrors the pure helpers in `src/lib/hokm.ts`; keep the two
 * files in sync.
 *
 * A card is a two character string: rank + suit.
 *   ranks: 2 3 4 5 6 7 8 9 T J Q K A
 *   suits: S (spades) H (hearts) D (diamonds) C (clubs)
 */

export const SEAT_COUNT = 4;

export const SUITS = ['S', 'H', 'D', 'C'];

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

export const RANK_VALUE = {
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

export const SUIT_SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };

export const SUIT_NAME = { S: 'پیک', H: 'دل', D: 'خشت', C: 'خاج' };

export const RANK_NAME = { A: 'آس', T: 'ده', J: 'سرباز', Q: 'بی‌بی', K: 'شاه' };

export function rankOf(card) {
  return card[0];
}

export function suitOf(card) {
  return card[1];
}

/** Seats 0 and 2 are partners, 1 and 3 are partners. */
export function teamOf(seat) {
  return seat % 2;
}

export function cardPoints(_card) {
  return 0; // Cards have ranks, not scoring values in Hokm.

}

export function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push(rank + suit);
  }
  return deck;
}

/** Fisher-Yates shuffle. */
export function shuffle(deck) {
  const out = [...deck];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Reserve the 5–4–4 deal, starting with the ruler. */
export function deal(declarer = 0) {
  const deck = shuffle(buildDeck());
  const hands = [[], [], [], []];
  let card = 0;
  for (const count of [5, 4, 4]) {
    for (let offset = 0; offset < 4; offset += 1) {
      const seat = (declarer + offset) % 4;
      hands[seat].push(...deck.slice(card, card + count));
      card += count;
    }
  }
  return hands;
}

/**
 * Who wins a trick: the highest trump if anybody played one, otherwise the
 * highest card of the suit that was led. Returns the seat index.
 */
export function trickWinner(entries, trump) {
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

/** Does `card` beat `best`? */
export function beatsCard(card, best, trump) {
  const cardIsTrump = suitOf(card) === trump;
  const bestIsTrump = suitOf(best) === trump;
  if (cardIsTrump !== bestIsTrump) return cardIsTrump;
  if (cardIsTrump) return RANK_VALUE[rankOf(card)] > RANK_VALUE[rankOf(best)];
  if (suitOf(card) !== suitOf(best)) return false;
  return RANK_VALUE[rankOf(card)] > RANK_VALUE[rankOf(best)];
}

/** Follow the led suit when possible; otherwise any card is legal. */
export function legalCards(hand, trick, trump) {
  if (!trick.length || !trump) return [...hand];

  const led = suitOf(trick[0].card);
  const following = hand.filter((card) => suitOf(card) === led);
  if (following.length) return following;

  return [...hand];
}

export function isLegal(card, hand, trick, trump) {
  return legalCards(hand, trick, trump).includes(card);
}
