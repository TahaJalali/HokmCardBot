import { requireUser } from '../lib/api.js';
import { getBotInfo, miniAppLink } from '../lib/config.js';
import { createGame, publicState, viewerInfo } from '../lib/game.js';

/** Start a new game: `solo` against three bots, or `room` to invite friends. */
export default async function (input, ctx) {
  const user = await requireUser(ctx);
  const mode = input?.mode === 'room' ? 'room' : 'solo';

  const game = await createGame({
    mode,
    owner: user.tgId,
    ownerName: user.name,
    ownerTgId: user.tgId,
    ownerChatId: user.chatId,
  });

  const bot = await getBotInfo();

  return {
    game: publicState(game, 0),
    you: viewerInfo(game, 0),
    moves: [],
    shareLink: miniAppLink(`join_${game.id}`, bot?.username),
  };
}
