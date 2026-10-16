import { db } from 'sdk';
import { desc, like } from 'sdk/db';

import { games } from '../schema.js';
import { requireUser } from '../lib/api.js';
import { MINI_APP_URL, getBotInfo } from '../lib/config.js';

/** The lobby: the games of the caller plus the information the UI needs. */
export default async function (input, ctx) {
  const user = await requireUser(ctx);

  const rows = await db
    .select()
    .from(games)
    .where(like(games.participants, `%,${user.tgId},%`))
    .orderBy(desc(games.updated))
    .limit(12)
    .all();

  const list = (rows ?? [])
    .filter((row) => row.status !== 'finished')
    .map((row) => ({
      id: row.id,
      mode: row.mode,
      status: row.status,
      trump: row.trump ?? null,
      turn: row.turn ?? 0,
      seats: (row.seats ?? []).map((seat) => ({ type: seat.type, name: seat.name })),
    }));

  const bot = await getBotInfo();

  return {
    games: list,
    botUsername: bot?.username ?? null,
    miniAppUrl: MINI_APP_URL || null,
  };
}
