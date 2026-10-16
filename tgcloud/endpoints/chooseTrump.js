import { EndpointError } from 'sdk';

import { requireGame, requireSeat, requireUser } from '../lib/api.js';
import { chooseTrump, publicState, runBots, saveGame, viewerInfo } from '../lib/game.js';
import { notify } from '../lib/notify.js';

const TRUMPS = ['S', 'H', 'D', 'C'];

/** The declarer names the trump suit — the "خوکم". */
export default async function (input, ctx) {
  const user = await requireUser(ctx);
  const game = await requireGame(input?.gameId);
  const seat = requireSeat(game, user.tgId);

  if (game.status !== 'trump') {
    throw new EndpointError('الان نوبت انتخاب خوکم نیست', { code: 'WRONG_PHASE' });
  }

  if (game.declarer !== seat) {
    throw new EndpointError('فقط بازیکن اعلان‌کننده خوکم را انتخاب می‌کند', { code: 'NOT_DECLARER' });
  }

  const trump = String(input?.trump ?? '').toUpperCase();
  if (!TRUMPS.includes(trump)) {
    throw new EndpointError('خوکم انتخاب‌شده معتبر نیست', { code: 'BAD_TRUMP' });
  }

  chooseTrump(game, trump);
  const moves = runBots(game);
  await saveGame(game);

  return {
    game: publicState(game, seat),
    you: viewerInfo(game, seat),
    moves,
  };
}
