/**
 * The rules of Hokm (خوکم) — the source of truth for the bot.
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

export const SUIT_NAME = { S: 'گشنیز', H: 'دل', D: 'خشت', C: 'خاج' };

export const RANK_NAME = { A: 'آس', T: 'ده', J: 'ب', Q: 'خ', K: 'شاه' };

/**
 * When the winning team does not capture the Hokm card (the ace of trumps)
 * the round goes to the other team. This is the classic "خوکم" rule; set it
 * to `false` to play the plain "most tricks wins" variant.
 */
export const HOKM_CARD_RULE = true;

/** The last trick of the game is worth this many extra points. */
export const LAST_TRICK_BONUS = 10;

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

export function cardPoints(card) {
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

/** Deal the whole deck: 13 cards per seat, seat 0 first. */
export function deal() {
  const deck = shuffle(buildDeck());
  const hands = [[], [], [], []];
  let card = 0;
  for (let round = 0; round < 13; round += 1) {
    for (let seat = 0; seat < SEAT_COUNT; seat += 1) {
      hands[seat].push(deck[card]);
      card += 1;
    }
  }
  // Sort every hand by rank so the UI and the AI see a stable order.
  for (const hand of hands) {
    hand.sort((a, b) => RANK_VALUE[rankOf(b)] - RANK_VALUE[rankOf(a)] || a.localeCompare(b));
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

/**
 * The cards a seat may legally play.
 *
 * - The suit that was led must be followed.
 * - Without that suit a trump must be played.
 * - If a trump is in the trick and the seat holds a higher one, it has to
 *   beat it (the classic "باید خوکم بزند" rule).
 */
export function legalCards(hand, trick, trump) {
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

export function isLegal(card, hand, trick, trump) {
  return legalCards(hand, trick, trump).includes(card);
}
