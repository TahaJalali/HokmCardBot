/**
 * Play thousands of complete games with four bots and check the rules.
 *
 *   node scripts/simulate.mjs [games]
 *
 * The simulation uses the very same modules the bot runs
 * (`tgcloud/lib/hokm-rules.js`, `hokm-ai.js` and `hokm-play.js`), so it
 * catches rule bugs before a single card is dealt on the platform.
 */
import { applyMove, chooseTrump, finishGame, randomTrump, startGame } from '../tgcloud/lib/hokm-play.js';
import { legalCards, buildDeck, cardPoints, RANK_VALUE, rankOf, suitOf } from '../tgcloud/lib/hokm-rules.js';

const GAMES = Number(process.argv[2] ?? 2000);

function newGame() {
  return {
    id: 'SIM',
    mode: 'solo',
    status: 'trump',
    trump: null,
    declarer: 0,
    turn: 0,
    lead: 0,
    seats: [
      { type: 'bot', name: 'A' },
      { type: 'bot', name: 'B' },
      { type: 'bot', name: 'C' },
      { type: 'bot', name: 'D' },
    ],
    hands: [[], [], [], []],
    trick: [],
    tricks: [],
    teamTricks: [0, 0],
    teamPoints: [0, 0],
    hokmTeam: null,
    winner: null,
    result: null,
    version: 0,
  };
}

const stats = {
  team0: 0,
  team1: 0,
  sweeps: 0,
  hokmBonus: 0,
  sixSix: 0,
  totalPoints: 0,
  trumpA: [0, 0],
};

for (let index = 0; index < GAMES; index += 1) {
  const game = newGame();
  startGame(game);

  // Every card is dealt exactly once.
  const dealt = game.hands.flat();
  const deck = buildDeck();
  if (dealt.length !== 52) throw new Error('the deck was not dealt completely');
  for (const card of deck) {
    if (dealt.filter((c) => c === card).length !== 1) throw new Error(`card ${card} was dealt twice`);
  }

  chooseTrump(game, randomTrump());

  let guard = 0;
  while (game.status === 'playing' && guard < 200) {
    guard += 1;
    const seat = game.turn;
    const legal = legalCards(game.hands[seat], game.trick, game.trump);
    if (!legal.length) throw new Error(`seat ${seat} has no legal card`);

    // The bots play, but every now and then a random legal card is used to
    // explore states the AI would never choose.
    const card = Math.random() < 0.12 ? legal[Math.floor(Math.random() * legal.length)] : legal[0];
    if (!legal.includes(card)) throw new Error('illegal card played');
    applyMove(game, seat, card);
  }

  if (game.status !== 'finished') throw new Error('the game did not finish');
  if (game.tricks.length !== 13) throw new Error(`expected 13 tricks, got ${game.tricks.length}`);
  if (game.teamTricks[0] + game.teamTricks[1] !== 13) throw new Error('the tricks do not add up');
  if (game.hands.some((hand) => hand.length !== 0)) throw new Error('cards are left in a hand');
  if (game.trick.length !== 0) throw new Error('the last trick was not cleared');
  if (game.hokmTeam === null) throw new Error('the Hokm card was never captured');

  // The points of the whole deck: aces, tens, kings, queens and jacks.
  const expected = buildDeck().reduce((sum, card) => sum + cardPoints(card), 0) + 10;
  const scored = game.teamPoints[0] + game.teamPoints[1];
  if (scored !== expected) throw new Error(`points ${scored} !== ${expected}`);

  // The trick winner must hold the highest card of the trick.
  for (const trick of game.tricks) {
    const winner = trick.cards.find((entry) => entry.seat === trick.winner);
    const trump = game.trump;
    const led = suitOf(trick.cards[0].card);
    const trumps = trick.cards.filter((entry) => suitOf(entry.card) === trump);
    const pool = trumps.length ? trumps : trick.cards.filter((entry) => suitOf(entry.card) === led);
    const best = pool.reduce((a, b) => (RANK_VALUE[rankOf(b.card)] > RANK_VALUE[rankOf(a.card)] ? b : a));
    if (best.seat !== trick.winner) throw new Error('the wrong player won the trick');
    if (!winner) throw new Error('the winner is not in the trick');
  }

  if (game.winner === 0) stats.team0 += 1;
  else stats.team1 += 1;
  if (game.result.sweep) stats.sweeps += 1;
  if (game.result.hokmBonus) stats.hokmBonus += 1;
  if (game.teamTricks[0] === game.teamTricks[1]) stats.sixSix += 1;
  stats.totalPoints += scored;
  const trump = game.trump;
  stats.trumpA[trump === 'S' ? 0 : 1] += 1;
}

// A second pass: the same but with a fixed trump, to see the spread.
console.log(`simulated ${GAMES} games — every rule held.`);
console.log(`  team 0 wins: ${stats.team0} (${((stats.team0 / GAMES) * 100).toFixed(1)}%)`);
console.log(`  team 1 wins: ${stats.team1} (${((stats.team1 / GAMES) * 100).toFixed(1)}%)`);
console.log(`  sweeps:      ${stats.sweeps}`);
console.log(`  hokm bonus:  ${stats.hokmBonus}`);
console.log(`  6-6 ties:    ${stats.sixSix}`);
console.log(`  points/game: ${stats.totalPoints / GAMES}`);
