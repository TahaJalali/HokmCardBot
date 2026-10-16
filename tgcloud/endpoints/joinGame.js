import { EndpointError } from 'sdk';

import { requireGame, requireUser } from '../lib/api.js';
import { notify } from '../lib/notify.js';
import { participantsOf, publicState, saveGame, seatOfUser, startGame, viewerInfo } from '../lib/game.js';

/** Take a seat at a table. The game starts as soon as the table is full. */
export default async function (input, ctx) {
  const user = await requireUser(ctx);
  const code = String(input?.code ?? '').trim().toUpperCase();

  const game = await requireGame(code);

  if (game.status !== 'waiting') {
    throw new EndpointError('این میز دیگر در حال انتظار نیست', { code: 'GAME_ALREADY_STARTED' });
  }

  let seat = seatOfUser(game, user.tgId);

  if (seat < 0) {
    seat = game.seats.findIndex((item) => item.type === 'empty');
    if (seat < 0) {
      throw new EndpointError('میز پر است', { code: 'ROOM_FULL' });
    }

    game.seats[seat] = {
      type: 'human',
      name: user.name,
      tgId: user.tgId,
      chatId: user.chatId ?? null,
    };
    game.participants = `,${participantsOf(game).join(',')},`;
  }

  const full = game.seats.every((item) => item.type === 'human');
  if (full) {
    startGame(game);
    await saveGame(game);
    await notify(game, 'بازی خوکم شروع شد! 🎴 خوکم (سوت) را انتخاب کنید.');
  } else {
    await saveGame(game);
  }

  return {
    game: publicState(game, seat),
    you: viewerInfo(game, seat),
    moves: [],
  };
}
