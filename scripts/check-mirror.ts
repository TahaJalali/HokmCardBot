/**
 * The Mini App mirrors the rules of the bot (`src/lib/hokm.ts` ⇄
 * `tgcloud/lib/hokm-rules.js`). This script makes sure both sides always
 * agree — a mismatch would let the UI grey out a card the server accepts.
 *
 *   npx esbuild scripts/check-mirror.ts --bundle --platform=node --format=esm --outfile=/tmp/check-mirror.mjs
 *   node /tmp/check-mirror.mjs
 */
import {
  legalCards as clientLegal,
  trickWinner as clientWinner,
  cardPoints as clientPoints,
  buildDeck,
  shuffle,
  type Card,
  type Suit,
  type TrickEntry,
} from '../src/lib/hokm';
import {
  legalCards as serverLegal,
  trickWinner as serverWinner,
  cardPoints as serverPoints,
  buildDeck as serverDeck,
} from '../tgcloud/lib/hokm-rules.js';

const trumps: Suit[] = ['S', 'H', 'D', 'C'];

function same(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((value, index) => value === right[index]);
}

let checks = 0;

for (let round = 0; round < 3000; round += 1) {
  const deck = shuffle(buildDeck());
  const hand = deck.slice(0, 1 + Math.floor(Math.random() * 13));
  const trickSize = Math.floor(Math.random() * 4);
  const trick: TrickEntry[] = deck.slice(13, 13 + trickSize).map((card, index) => ({
    seat: index,
    card,
  }));
  const trump = trumps[Math.floor(Math.random() * 4)];

  const client = clientLegal(hand, trick, trump);
  const server = serverLegal(hand, trick, trump);
  if (!same(client, server)) {
    throw new Error(`legal cards differ for ${JSON.stringify({ hand, trick, trump })}`);
  }
  checks += 1;

  if (trick.length) {
    const a = clientWinner(trick, trump);
    const b = serverWinner(trick, trump);
    if (a !== b) {
      throw new Error(`the trick winner differs for ${JSON.stringify({ trick, trump })}`);
    }
    checks += 1;
  }

  for (const card of deck) {
    if (clientPoints(card) !== serverPoints(card)) {
      throw new Error(`the points of ${card} differ`);
    }
    checks += 1;
  }
}

if (buildDeck().sort().join() !== serverDeck().sort().join()) {
  throw new Error('the decks differ');
}

console.log(`the client and the server agree on ${checks} checks.`);
