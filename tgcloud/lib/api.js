import { EndpointError } from 'sdk';

import { loadGame, seatOfUser } from './game.js';
import { ensureUser } from './user.js';

/** The verified Telegram user of the Mini App. */
export async function requireUser(ctx) {
  const user = await ensureUser(ctx.initData);
  if (!user) {
    throw new EndpointError('کاربر نامعتبر است', { code: 'NO_USER' });
  }
  return user;
}

export async function requireGame(gameId) {
  const id = String(gameId ?? '').trim();
  if (!id) {
    throw new EndpointError('شناسه‌ی بازی ارسال نشده', { code: 'NO_GAME_ID' });
  }

  const game = await loadGame(id);
  if (!game) {
    throw new EndpointError('این بازی پیدا نشد', { code: 'NOT_FOUND' });
  }
  return game;
}

/** The seat of a player — throws when the caller does not take part. */
export function requireSeat(game, tgId) {
  const seat = seatOfUser(game, tgId);
  if (seat < 0) {
    throw new EndpointError('شما در این بازی نیستید', { code: 'NOT_A_PLAYER' });
  }
  return seat;
}
