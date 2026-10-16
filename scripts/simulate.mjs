import assert from 'node:assert/strict';
import { applyMove, chooseTrump, finishGame, startGame } from '../tgcloud/lib/hokm-play.js';
import { buildDeck, legalCards, teamOf, trickWinner, SUIT_NAME, RANK_NAME } from '../tgcloud/lib/hokm-rules.js';
import { chooseBotCard } from '../tgcloud/lib/hokm-ai.js';

assert.equal(SUIT_NAME.S, 'پیک');
assert.equal(RANK_NAME.J, 'سرباز');
assert.equal(RANK_NAME.Q, 'بی‌بی');
assert.deepEqual(legalCards(['2H', 'AS'], [{ seat: 0, card: 'AH' }], 'S'), ['2H']);
assert.deepEqual(legalCards(['2S', 'AS', '3D'], [{ seat: 0, card: 'AH' }, { seat: 1, card: 'KS' }], 'S'), ['2S', 'AS', '3D']);
assert.deepEqual(legalCards(['2S', 'AS'], [{ seat: 0, card: 'KS' }], 'S'), ['2S', 'AS']);
assert.equal(trickWinner([{ seat: 0, card: 'AH' }, { seat: 1, card: '2S' }], 'S'), 1);
for (const [declarer, tricks, score] of [[0, [7, 0], 2], [1, [7, 0], 3], [0, [0, 7], 3], [1, [0, 7], 2], [0, [7, 6], 1]]) {
  const game = { declarer, teamTricks: tricks, hokmTeam: tricks[0] === 7 ? 1 : 0 };
  finishGame(game);
  assert.equal(game.winner, tricks[0] === 7 ? 0 : 1);
  assert.equal(game.teamPoints[game.winner], score);
}
const count = Number(process.argv[2] ?? 2000);
for (let n = 0; n < count; n++) {
  const game = { seats: Array.from({ length: 4 }, () => ({ type: 'human' })) };
  startGame(game);
  assert.equal(game.status, 'trump');
  assert.deepEqual([...game.hands.flat()].sort(), buildDeck().sort());
  assert.ok(game.declarer >= 0 && game.declarer < 4);
  chooseTrump(game, ['S', 'H', 'D', 'C'][n % 4]);
  assert.equal(game.turn, game.declarer);
  const played = new Set();
  while (game.status === 'playing') {
    const seat = game.turn;
    const hand = game.hands[seat];
    const legal = legalCards(hand, game.trick, game.trump);
    const card = Math.random() < 0.12 ? legal[Math.floor(Math.random() * legal.length)] : chooseBotCard({ hand, trick: game.trick, trump: game.trump, seat });
    assert.ok(legal.includes(card));
    assert.ok(!played.has(card));
    played.add(card);
    const entries = [...game.trick, { seat, card }];
    const previous = [...game.teamTricks];
    applyMove(game, seat, card);
    if (entries.length === 4) {
      const winner = trickWinner(entries, game.trump);
      assert.equal(game.teamTricks[teamOf(winner)], previous[teamOf(winner)] + 1);
      assert.equal(game.lead, winner);
    }
    assert.ok(played.size <= 52);
  }
  assert.equal(game.teamTricks[game.winner], 7);
  assert.ok(game.teamTricks[1 - game.winner] < 7);
  assert.equal(game.tricks.length, game.teamTricks[0] + game.teamTricks[1]);
  assert.equal(played.size + game.hands.flat().length, 52);
  assert.equal(game.trick.length, 0);
}
console.log(`Passed rule regressions and ${count} complete games.`);
