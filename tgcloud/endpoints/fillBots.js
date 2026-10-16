import { EndpointError } from 'sdk';

import { requireGame, requireUser } from '../lib/api.js';
import {
  chooseTrump,
  publicState,
  randomTrump,
  runBots,
  saveGame,
  seatOfUser,
  startGame,
  viewerInfo,
} from '../lib/game.js';
import { notify } from '../lib/notify.js';

const BOT_NAMES = ['ربات آرش', 'ربات بهرام', 'ربات پریسا', 'ربات دارا'];

/** Fill the empty seats of a table with bots and start the game. */
export default async function (input, ctx) {
  const user = await requireUser(ctx);
  const game = await requireGame(input?.gameId);
  const seat = seatOfUser(game, user.tgId);

  if (seat < 0) {
    throw new EndpointError('شما در این بازی نیستید', { code: 'NOT_A_PLAYER' });
  }

  if (game.status !== 'waiting') {
    throw new EndpointError('این بازی دیگر شروع نشده است', { code: 'WRONG_PHASE' });
  }

  game.seats = game.seats.map((item, index) =>
    item.type === 'empty'
      ? { type: 'bot', name: BOT_NAMES[index % BOT_NAMES.length], tgId: null, chatId: null }
      : item,
  );

  startGame(game);

  if (game.status === 'trump' && game.seats[game.declarer]?.type === 'bot') {
    chooseTrump(game, randomTrump());
  }

  const moves = runBots(game);
  await saveGame(game);
  await notify(game, 'بازی حکم با ربات‌ها شروع شد! 🎴');

  return {
    game: publicState(game, seat),
    you: viewerInfo(game, seat),
    moves,
  };
}
