import { EndpointError } from 'sdk';

import { requireGame, requireSeat, requireUser } from '../lib/api.js';
import {
  applyMove,
  logMove,
  publicState,
  runBots,
  saveGame,
  viewerInfo,
} from '../lib/game.js';
import { legalCards } from '../lib/hokm-rules.js';
import { notify, notifyOne } from '../lib/notify.js';

/** Play a card — the bots answer right away. */
export default async function (input, ctx) {
  const user = await requireUser(ctx);
  const game = await requireGame(input?.gameId);
  const seat = requireSeat(game, user.tgId);

  if (game.status !== 'playing') {
    throw new EndpointError('بازی در جریان نیست', { code: 'NOT_PLAYING' });
  }

  if (game.turn !== seat) {
    throw new EndpointError('هنوز نوبت شما نیست', { code: 'NOT_YOUR_TURN' });
  }

  const card = String(input?.card ?? '');
  const legal = legalCards(game.hands[seat], game.trick, game.trump);
  if (!legal.includes(card)) {
    throw new EndpointError('این کارت در این وضعیت قابل بازی نیست', { code: 'ILLEGAL_CARD' });
  }

  const trickNo = game.tricks.length + 1;
  applyMove(game, seat, card);

  const moves = runBots(game);

  const saved = await saveGame(game);
  if (!saved) {
    // Somebody else moved in parallel — send the fresh state instead.
    const fresh = await requireGame(game.id);
    return {
      game: publicState(fresh, seat),
      you: viewerInfo(fresh, seat),
      moves: [],
      notice: 'هم‌زمان بازی شد؛ آخرین وضعیت را نشان می‌دهیم.',
    };
  }

  // The move log is only written when the position could be stored.
  await logMove(game, seat, card, trickNo);
  for (const move of moves) {
    await logMove(game, move.seat, move.card, move.trickNo ?? trickNo);
  }

  if (game.status === 'finished') {
    const result = game.result;
    await notify(
      game,
      `بازی خوکم تمام شد.\n${result?.reason ?? ''}\nترک‌ها: ${game.teamTricks[0]} - ${game.teamTricks[1]}\nامتیاز: ${game.teamPoints[0]} - ${game.teamPoints[1]}`,
    );
  } else if (game.seats[game.turn]?.type === 'human') {
    // A human plays next — let them know in the chat.
    const next = game.seats[game.turn];
    if (next.chatId) {
      await notifyOne(
        next.chatId,
        `نوبت شماست! ترک ${game.tricks.length + 1} از ۱۳ — میز ${game.id}`,
      );
    }
  }

  return {
    game: publicState(game, seat),
    you: viewerInfo(game, seat),
    moves,
  };
}
