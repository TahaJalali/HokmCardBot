import { requireGame, requireSeat, requireUser } from '../lib/api.js';
import { publicState, saveGame, viewerInfo } from '../lib/game.js';

/** Leave a table. During a game the seat is taken over by a bot. */
export default async function (input, ctx) {
  const user = await requireUser(ctx);
  const game = await requireGame(input?.gameId);
  const seat = requireSeat(game, user.tgId);

  if (game.status === 'waiting') {
    game.seats[seat] = { type: 'empty', name: '', tgId: null, chatId: null };
  } else {
    game.seats[seat] = { type: 'bot', name: 'ربات جانشین', tgId: null, chatId: null };
  }

  await saveGame(game);

  return {
    game: publicState(game, -1),
    you: { seat: -1, team: -1, name: user.name, isDeclarer: false },
    moves: [],
  };
}
