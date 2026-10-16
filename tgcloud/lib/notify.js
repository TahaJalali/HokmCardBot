import { api } from 'sdk';

/**
 * Send a short message to every human player of a game (when we know their
 * chat). Failures are never fatal — a player may have never talked to the bot.
 */
export async function notify(game, text) {
  for (const seat of game.seats) {
    if (seat.type !== 'human' || !seat.chatId) continue;
    try {
      await api.sendMessage({ chat_id: seat.chatId, text, disable_web_page_preview: true });
    } catch (error) {
      console.warn('could not notify a player', error?.message ?? error);
    }
  }
}
