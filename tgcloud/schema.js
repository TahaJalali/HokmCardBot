import { table, integer, text, json, index, sql } from 'sdk/db';

// Tables are named exports; deploying this file registers the schema.
// `npx tgcloud migrate` applies the changes to the database.

/** Telegram users who have played the game. */
export const users = table('hokm_users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tgId: integer('tg_id').notNull().unique(),
  name: text('name').notNull(),
  username: text('username'),
  chatId: integer('chat_id'),
  created: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  lastSeen: integer('last_seen', { mode: 'timestamp' }),
});

/** A single game of Hokm. The whole position lives in the JSON columns. */
export const games = table('hokm_games', {
  id: text('id').primaryKey(),
  mode: text('mode').notNull().default('solo'),
  status: text('status').notNull().default('waiting'),
  trump: text('trump'),
  declarer: integer('declarer').notNull().default(0),
  turn: integer('turn').notNull().default(0),
  lead: integer('lead').notNull().default(0),
  seats: json('seats').notNull(),
  hands: json('hands').notNull(),
  trick: json('trick').notNull(),
  tricks: json('tricks').notNull(),
  teamTricks: json('team_tricks').notNull(),
  teamPoints: json('team_points').notNull(),
  hokmTeam: integer('hokm_team'),
  winner: integer('winner'),
  result: json('result'),
  owner: integer('owner'),
  /** Comma separated list of the Telegram ids taking part: ",123,456,". */
  participants: text('participants'),
  version: integer('version').notNull().default(0),
  created: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updated: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (t) => ({
  ownerIdx: index('idx_hokm_games_owner').on(t.owner),
  statusIdx: index('idx_hokm_games_status').on(t.status),
}));

/** Every card played in a game, in order. */
export const moves = table('hokm_moves', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: text('game_id').notNull(),
  seat: integer('seat').notNull(),
  card: text('card').notNull(),
  trickNo: integer('trick_no').notNull(),
  created: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (t) => ({
  gameIdx: index('idx_hokm_moves_game').on(t.gameId),
}));

/** Small key/value store for cached bot information. */
export const meta = table('hokm_meta', {
  key: text('key').primaryKey(),
  value: json('value'),
  updated: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
