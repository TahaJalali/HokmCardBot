/**
 * The pure game logic of Hokm — no database, no SDK.
 *
 * Keeping it free of platform imports means the rules can be simulated and
 * tested locally (`node scripts/simulate.mjs`).
 */
import {
  HOKM_CARD_RULE,
  LAST_TRICK_BONUS,
  SEAT_COUNT,
  cardPoints,
  deal,
  teamOf,
  trickWinner,
} from './hokm-rules.js';
import { chooseBotCard } from './hokm-ai.js';

export { SEAT_COUNT };

/** Deal the cards and wait for the declarer to pick the trump suit. */
export function startGame(game) {
  game.hands = deal();
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
}

/** The declarer names the trump suit ("خوکم"). */
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

function reasonText({ winner, sweep, hokmBonus, teamTricks }) {
  if (sweep) {
    return `تیم ${winner === 0 ? 'شما' : 'مقابل'} همه‌ی ۱۳ ترک را گرفت؛ طبق قانون خوکم، بازی به تیم دیگر رسید.`;
  }
  if (hokmBonus) {
    return `تیم ${winner === 0 ? 'شما' : 'مقابل'} برنده‌ی دست بود، اما کارت خوکم (آس خوکم) را تیم مقابل گرفته بود؛ پس دست به آن‌ها رسید.`;
  }
  const mine = teamTricks[winner];
  const theirs = teamTricks[1 - winner];
  return `تیم ${winner === 0 ? 'شما' : 'مقابل'} با ${mine} ترک در برابر ${theirs} ترک برنده شد.`;
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
  let points = game.trick.reduce((sum, entry) => sum + cardPoints(entry.card), 0);
  const trickNo = game.tricks.length + 1;
  if (trickNo === 13) points += LAST_TRICK_BONUS;

  const team = teamOf(winner);
  game.teamTricks[team] += 1;
  game.teamPoints[team] += points;

  // The Hokm card (ace of trumps) goes to the team that won its trick.
  const hokmCard = `A${game.trump}`;
  if (game.trick.some((entry) => entry.card === hokmCard)) game.hokmTeam = team;

  game.tricks.push({ cards: [...game.trick], winner, points });
  game.trick = [];
  game.lead = winner;

  if (game.tricks.length === 13) {
    finishGame(game);
  } else {
    game.turn = winner;
  }
}

/** Let every bot that is due to play do so. */
export function runBots(game) {
  const played = [];
  let guard = 0;

  while (game.status === 'playing' && game.seats[game.turn]?.type === 'bot' && guard < 16) {
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
  const [first, second] = game.teamTricks;
  let winner = null;
  let sweep = false;

  if (first === 13) {
    winner = 1;
    sweep = true;
  } else if (second === 13) {
    winner = 0;
    sweep = true;
  } else if (first > second) {
    winner = 0;
  } else if (second > first) {
    winner = 1;
  } else {
    // With 13 tricks a 6 — 6 split cannot happen; the points are the safety
    // net for it.
    winner = game.teamPoints[0] > game.teamPoints[1] ? 0 : 1;
  }

  let hokmBonus = false;
  if (!sweep && HOKM_CARD_RULE && game.hokmTeam !== null && game.hokmTeam !== winner) {
    hokmBonus = true;
    winner = 1 - winner;
  }

  game.winner = winner;
  game.status = 'finished';
  game.result = {
    winner,
    sweep,
    hokmBonus,
    teamTricks: [...game.teamTricks],
    teamPoints: [...game.teamPoints],
    reason: reasonText({ winner, sweep, hokmBonus, teamTricks: game.teamTricks }),
  };
}
