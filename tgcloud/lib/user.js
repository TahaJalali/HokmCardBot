import { db } from 'sdk';
import { eq } from 'sdk/db';

import { users } from '../schema.js';

/**
 * Create or refresh the row of the Telegram user behind the Mini App.
 * `initData` is verified by the platform, so `initData.user` can be trusted.
 */
export async function ensureUser(initData) {
  const tgUser = initData?.user;
  if (!tgUser?.id) return null;

  const tgId = Number(tgUser.id);
  const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || 'بازیکن';
  const username = tgUser.username ? String(tgUser.username) : null;
  const chatId = initData?.chat?.id ? Number(initData.chat.id) : null;

  const existing = await db.select().from(users).where(eq(users.tgId, tgId)).get();

  if (existing) {
    await db
      .update(users)
      .set({
        name,
        username: username ?? existing.username ?? null,
        chatId: chatId ?? existing.chatId ?? null,
        lastSeen: new Date(),
      })
      .where(eq(users.id, existing.id))
      .run();
    return { ...existing, name, username, chatId: chatId ?? existing.chatId ?? null };
  }

  const inserted = await db
    .insert(users)
    .values({ tgId, name, username, chatId, lastSeen: new Date() })
    .returning({ id: users.id })
    .run();

  return { id: inserted[0]?.id, tgId, name, username, chatId };
}

/** Remember the chat a user can be reached at (from a bot update). */
export async function rememberChat(tgId, chatId, name, username) {
  if (!tgId) return;
  const existing = await db.select().from(users).where(eq(users.tgId, Number(tgId))).get();

  if (existing) {
    await db
      .update(users)
      .set({
        chatId: chatId ?? existing.chatId ?? null,
        name: name ?? existing.name,
        username: username ?? existing.username ?? null,
        lastSeen: new Date(),
      })
      .where(eq(users.id, existing.id))
      .run();
    return;
  }

  await db
    .insert(users)
    .values({ tgId: Number(tgId), name: name || 'بازیکن', username: username ?? null, chatId: chatId ?? null, lastSeen: new Date() })
    .run();
}
