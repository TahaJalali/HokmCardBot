/**
 * The pure game logic of Hokm — no database, no SDK.
 *
 * Keeping it free of platform imports means the rules can be simulated and
 * tested locally (`node scripts/simulate.mjs`).
 */
import {
  SEAT_COUNT,
  deal,
  buildDeck,
  shuffle,
  teamOf,
  trickWinner,
} from './hokm-rules.js';
import { chooseBotCard } from './hokm-ai.js';

export { SEAT_COUNT };

/** Deal the cards and wait for the declarer to pick the trump suit. */
export function startGame(game) {
  game.declarer = shuffle(buildDeck()).findIndex((card) => card[0] === 'A') % 4;
  game.hands = deal(game.declarer);
  game.trick = [];
  game.tricks = [];
  game.teamTricks = [0, 0];
  game.teamPoints = [0, 0];
  game.hokmTeam = null;
  game.winner = null;
  game.result = null;
  game.turn = game.declarer;
  game.lead = game.declarer;
  game.status = 'trump';
  if (game.seats[game.declarer]?.type === 'bot') {
    chooseTrump(game, game.hands[game.declarer][0][1]);
    runBots(game);
  }
}

/** The declarer names the trump suit ("حکم"). */
export function chooseTrump(game, trump) {
  game.trump = trump;
  game.status = 'playing';
  game.turn = game.declarer;
  game.lead = game.declarer;
  game.trick = [];
}

/** A random trump for a bot declarer. */
export function randomTrump() {
  return ['S', 'H', 'D', 'C'][Math.floor(Math.random() * 4)];
}

/** Play one card. Assumes the card is legal. */
export function applyMove(game, seat, card) {
  const hand = game.hands[seat];
  const index = hand.indexOf(card);
  if (index < 0) throw new Error('the card is not in that hand');

  hand.splice(index, 1);
  game.trick.push({ seat, card });

  if (game.trick.length < SEAT_COUNT) {
    game.turn = (seat + 1) % SEAT_COUNT;
    return;
  }

  const winner = trickWinner(game.trick, game.trump);
  const points = 1;

  const team = teamOf(winner);
  game.teamTricks[team] += 1;


  game.tricks.push({ cards: [...game.trick], winner, points });
  game.trick = [];
  game.lead = winner;

  if (game.teamTricks[team] === 7) {
    finishGame(game);
  } else {
    game.turn = winner;
  }
}

/** Let every bot that is due to play do so. */
export function runBots(game) {
  const played = [];
  let guard = 0;

  while (game.status === 'playing' && game.seats[game.turn]?.type === 'bot' && guard < 52) {
    guard += 1;
    const seat = game.turn;
    const card = chooseBotCard({
      hand: game.hands[seat],
      trick: game.trick,
      trump: game.trump,
      seat,
    });
    if (!card) break;
    const trickNo = game.tricks.length + 1;
    applyMove(game, seat, card);
    played.push({ seat, card, trickNo });
  }

  return played;
}

export function finishGame(game) {
  const winner = game.teamTricks[0] >= 7 ? 0 : 1;
  const kot = game.teamTricks[1 - winner] === 0;
  const score = kot ? (teamOf(game.declarer) === winner ? 2 : 3) : 1;
  game.teamPoints = [0, 0];
  game.teamPoints[winner] = score;
  game.winner = winner;
  game.status = 'finished';
  game.result = {
    winner,
    sweep: false,
    hokmBonus: false,
    teamTricks: [...game.teamTricks],
    teamPoints: [...game.teamPoints],
    reason: kot
      ? `برد هفت بر صفر؛ ${score === 3 ? 'حاکم‌کتی و سه امتیاز' : 'کت و دو امتیاز'} برای تیم برنده.`
      : 'تیم برنده با گرفتن هفت دست، یک امتیاز گرفت.',
  };
}
