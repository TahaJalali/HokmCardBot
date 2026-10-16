import { requireGame, requireUser } from '../lib/api.js';
import { getBotInfo, miniAppLink } from '../lib/config.js';
import { publicState, seatOfUser, viewerInfo } from '../lib/game.js';

/** The state of a game. Players who are not seated may watch the game. */
export default async function (input, ctx) {
  const user = await requireUser(ctx);
  const game = await requireGame(input?.gameId);
  const seat = seatOfUser(game, user.tgId);
  const bot = await getBotInfo();

  return {
    game: publicState(game, seat),
    you:
      seat < 0
        ? { seat: -1, team: -1, name: user.name, isDeclarer: false }
        : viewerInfo(game, seat),
    moves: [],
    shareLink: miniAppLink(`join_${game.id}`, bot?.username),
  };
}
