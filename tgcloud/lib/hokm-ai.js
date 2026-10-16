import { beatsCard, legalCards, RANK_VALUE, rankOf, suitOf, teamOf, trickWinner } from './hokm-rules.js';

/**
 * The bot opponents.
 *
 * The AI follows the same rules as the humans: it must follow suit, it must
 * play a trump when it cannot follow, and it has to beat a trump when it can.
 * On top of that it plays a reasonable card — it wins tricks it can win, keeps
 * its high cards for later, does not beat its own partner and leads its
 * longest suit.
 */

export const BOT_NAMES = ['ربات آرش', 'ربات بهرام', 'ربات پریسا', 'ربات دارا'];

export function botName(seat) {
  return BOT_NAMES[seat % BOT_NAMES.length];
}

function lowest(cards) {
  if (!cards.length) return null;
  return [...cards].sort(
    (a, b) => RANK_VALUE[rankOf(a)] - RANK_VALUE[rankOf(b)] || a.localeCompare(b),
  )[0];
}

/** Opening move: lead the longest side suit with its lowest card. */
function leadCard(hand, trump) {
  const groups = new Map();
  for (const card of hand) {
    const suit = suitOf(card);
    groups.set(suit, [...(groups.get(suit) ?? []), card]);
  }

  const trumps = groups.get(trump) ?? [];
  const sideSuits = [...groups.entries()].filter(([suit]) => suit !== trump);

  // A big trump hand is worth pulling the opponents' trumps with.
  if (trumps.length >= 5) return lowest(trumps);
  if (!sideSuits.length) return lowest(trumps);

  sideSuits.sort((a, b) => b[1].length - a[1].length);

  // A little unpredictability between the two strongest suits.
  const pick = Math.random() < 0.25 && sideSuits.length > 1 ? sideSuits[1] : sideSuits[0];
  return lowest(pick[1]);
}

/** Following move: win the trick if it is sensible, otherwise keep it cheap. */
function followCard(legal, trick, trump, seat) {
  const winnerSeat = trickWinner(trick, trump);
  const winnerEntry = trick.find((entry) => entry.seat === winnerSeat);

  if (winnerEntry) {
    const partnerWinning = teamOf(winnerSeat) === teamOf(seat);
    const beatable = legal.filter((card) => beatsCard(card, winnerEntry.card, trump));
    if (beatable.length && !partnerWinning) return lowest(beatable);
  }

  return lowest(legal);
}

/**
 * The card a bot plays next.
 * @returns {string|null} the card, or null when the bot cannot move.
 */
export function chooseBotCard({ hand, trick, trump, seat }) {
  const legal = legalCards(hand, trick, trump);
  if (!legal.length) return null;
  if (!trick.length) return leadCard(hand, trump);
  return followCard(legal, trick, trump, seat);
}
