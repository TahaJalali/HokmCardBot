import { api, EndpointError } from 'sdk';

import { loadGame, saveGame, seatOfUser } from '../lib/game.js';
import { getBotInfo, miniAppLink } from '../lib/config.js';

const TRUMP_LABELS = { S: '♠️ پیک', H: '♥️ دل', D: '♦️ خشت', C: '♣️ خاج' };

/** Handle the inline buttons of the bot. */
export default async function (callbackQuery, ctx) {
  const id = callbackQuery?.id;
  const data = String(callbackQuery?.data ?? '');
  const from = callbackQuery?.from;
  const message = callbackQuery?.message;

  const answer = async (text = '', alert = false) => {
    if (!id) return;
    try {
      await api.answerCallbackQuery({ callback_query_id: id, text, show_alert: alert });
    } catch (error) {
      console.warn('could not answer the callback query', error?.message ?? error);
    }
  };

  try {
    if (data === 'rules') {
      await answer('قوانین حکم را با دستور /rules ببینید');
      return;
    }

    if (data.startsWith('open:')) {
      const gameId = data.slice(5);
      const game = await loadGame(gameId);
      if (!game) {
        await answer('این بازی پیدا نشد', true);
        return;
      }

      const bot = await getBotInfo();
      const seat = from?.id ? seatOfUser(game, from.id) : -1;

      let status = 'در حال بازی';
      if (game.status === 'waiting') status = 'در انتظار بازیکن';
      else if (game.status === 'trump') status = 'در انتظار انتخاب حکم';
      else if (game.status === 'finished') status = 'پایان یافته';

      const keyboard = [];
      if (game.status === 'trump' && seat === game.declarer) {
        keyboard.push(
          Object.keys(TRUMP_LABELS).map((suit) => [
            { text: TRUMP_LABELS[suit], callback_data: `trump:${gameId}:${suit}` },
          ]),
        );
      }
      keyboard.push([
        { text: '🎴 بازی در مینی‌اپ', web_app: { url: miniAppLink(`g_${gameId}`, bot?.username) } },
      ]);

      if (message?.chat?.id && message?.message_id) {
        await api.editMessageText({
          chat_id: message.chat.id,
          message_id: message.message_id,
          text: `میز \`${gameId}\`\nوضعیت: ${status}\nدست‌ها: ${game.teamTricks[0]} - ${game.teamTricks[1]}`,
          reply_markup: { inline_keyboard: keyboard },
        });
      }

      await answer();
      return;
    }

    if (data.startsWith('trump:')) {
      const [, gameId, suit] = data.split(':');
      const game = await loadGame(gameId);
      if (!game) {
        await answer('این بازی پیدا نشد', true);
        return;
      }

      const seat = from?.id ? seatOfUser(game, from.id) : -1;
      if (seat < 0 || seat !== game.declarer) {
        await answer('فقط حاکم می‌تواند حکم را انتخاب کند', true);
        return;
      }

      if (game.status !== 'trump') {
        await answer('الان نوبت انتخاب حکم نیست', true);
        return;
      }

      game.trump = suit;
      game.status = 'playing';
      game.turn = game.declarer;
      game.lead = game.declarer;
      await saveGame(game);

      await answer(`حکم: ${TRUMP_LABELS[suit] ?? suit}`);
      return;
    }

    await answer();
  } catch (error) {
    console.error(error);
    if (error instanceof EndpointError) {
      await answer(error.description, true);
      return;
    }
    await answer('خطایی رخ داد', true);
  }
}
