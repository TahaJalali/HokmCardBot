import { api, db } from 'sdk';
import { eq } from 'sdk/db';

import { meta } from '../schema.js';

/**
 * The Mini App is served at `https://app<app_id>.tgcloud.ai/` — `tgcloud push`
 * prints the exact URL. Paste it here to link the game from the chat; without
 * it the bot falls back to the `t.me` direct link of the bot's main Mini App.
 */
export const MINI_APP_URL = '';

/** The bot's own information (cached in the database). */
export async function getBotInfo() {
  const row = await db.select().from(meta).where(eq(meta.key, 'bot')).get();
  if (row?.value?.username) return row.value;

  try {
    const me = await api.getMe();
    const info = { id: me.id, username: me.username, firstName: me.first_name };
    await db
      .insert(meta)
      .values({ key: 'bot', value: info, updated: new Date() })
      .onConflictDoUpdate({ target: meta.key, set: { value: info, updated: new Date() } })
      .run();
    return info;
  } catch (error) {
    console.warn('could not read the bot info', error?.message ?? error);
    return row?.value ?? null;
  }
}

/**
 * A link that opens the Mini App with a start parameter.
 * `param` is what the front-end reads from `Telegram.WebApp.initDataUnsafe`.
 */
export function miniAppLink(param, botUsername) {
  const base = MINI_APP_URL || (botUsername ? `https://t.me/${botUsername}` : '');
  if (!base) return '';
  return `${base}?startapp=${encodeURIComponent(param)}`;
}
