import { db } from 'sdk';
import { and, eq } from 'sdk/db';

import { games, moves } from '../schema.js';
import { SEAT_COUNT, teamOf } from './hokm-rules.js';
import { botName } from './hokm-ai.js';
import { applyMove, chooseTrump, randomTrump, runBots, startGame } from './hokm-play.js';

/**
 * The life cycle of a game of Hokm.
 *
 * A game is a plain object; it is stored in the `hokm_games` table (the whole
 * position in the JSON columns) and loaded again on every request, because the
 * platform runs every module in a fresh isolate. The rules themselves live in
 * `hokm-play.js`, which has no platform imports and can be tested locally.
 */

const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newGameId() {
  let id = '';
  for (let i = 0; i < 6; i += 1) {
    id += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
  }
  return id;
}

function emptySeat() {
  return { type: 'empty', name: '', tgId: null, chatId: null };
}

function botSeat(seat) {
  return { type: 'bot', name: botName(seat), tgId: null, chatId: null };
}

export function participantsOf(game) {
  return game.seats.filter((seat) => seat.type === 'human' && seat.tgId).map((seat) => seat.tgId);
}

export function seatOfUser(game, tgId) {
  if (!tgId) return -1;
  return game.seats.findIndex((seat) => seat.type === 'human' && Number(seat.tgId) === Number(tgId));
}

/** Create a new game. `solo` fills the other three seats with bots. */
export async function createGame({ mode, owner, ownerName, ownerTgId, ownerChatId }) {
  const id = newGameId();
  const isSolo = mode === 'solo';

  const seats = [];
  for (let seat = 0; seat < SEAT_COUNT; seat += 1) {
    if (seat === 0) {
      seats.push({ type: 'human', name: ownerName, tgId: ownerTgId, chatId: ownerChatId ?? null });
    } else if (isSolo) {
      seats.push(botSeat(seat));
    } else {
      seats.push(emptySeat());
    }
  }

  const game = {
    id,
    mode: isSolo ? 'solo' : 'room',
    status: isSolo ? 'trump' : 'waiting',
    trump: null,
    declarer: 0,
    turn: 0,
    lead: 0,
    seats,
    hands: Array.from({ length: SEAT_COUNT }, () => []),
    trick: [],
    tricks: [],
    teamTricks: [0, 0],
    teamPoints: [0, 0],
    hokmTeam: null,
    winner: null,
    result: null,
    owner,
    participants: `,${ownerTgId},`,
    version: 0,
  };

  if (isSolo) startGame(game);

  await db
    .insert(games)
    .values({
      id: game.id,
      mode: game.mode,
      status: game.status,
      trump: game.trump,
      declarer: game.declarer,
      turn: game.turn,
      lead: game.lead,
      seats: game.seats,
      hands: game.hands,
      trick: game.trick,
      tricks: game.tricks,
      teamTricks: game.teamTricks,
      teamPoints: game.teamPoints,
      hokmTeam: game.hokmTeam,
      winner: game.winner,
      result: game.result,
      owner: game.owner,
      participants: game.participants,
      version: game.version,
    })
    .run();

  return game;
}

/* ------------------------------------------------------------------ */
/* Persistence                                                          */
/* ------------------------------------------------------------------ */

export async function loadGame(id) {
  const row = await db.select().from(games).where(eq(games.id, id)).get();
  if (!row) return null;

  return {
    id: row.id,
    mode: row.mode,
    status: row.status,
    trump: row.trump ?? null,
    declarer: row.declarer ?? 0,
    turn: row.turn ?? 0,
    lead: row.lead ?? 0,
    seats: row.seats ?? [],
    hands: row.hands ?? Array.from({ length: SEAT_COUNT }, () => []),
    trick: row.trick ?? [],
    tricks: row.tricks ?? [],
    teamTricks: row.teamTricks ?? [0, 0],
    teamPoints: row.teamPoints ?? [0, 0],
    hokmTeam: row.hokmTeam ?? null,
    winner: row.winner ?? null,
    result: row.result ?? null,
    owner: row.owner ?? null,
    participants: row.participants ?? '',
    version: row.version ?? 0,
  };
}

/**
 * Save the game. The version check makes sure nobody overwrites a move that
 * happened in parallel — the caller reloads and retries in that case.
 */
export async function saveGame(game) {
  const result = await db
    .update(games)
    .set({
      status: game.status,
      trump: game.trump,
      declarer: game.declarer,
      turn: game.turn,
      lead: game.lead,
      seats: game.seats,
      hands: game.hands,
      trick: game.trick,
      tricks: game.tricks,
      teamTricks: game.teamTricks,
      teamPoints: game.teamPoints,
      hokmTeam: game.hokmTeam,
      winner: game.winner,
      result: game.result,
      participants: game.participants,
      version: game.version + 1,
      updated: new Date(),
    })
    .where(and(eq(games.id, game.id), eq(games.version, game.version)))
    .run();

  if (result.rowsAffected !== 1) return false;
  game.version += 1;
  return true;
}

export async function logMove(game, seat, card, trickNo) {
  await db.insert(moves).values({ gameId: game.id, seat, card, trickNo }).run();
}

/* ------------------------------------------------------------------ */
/* The view the Mini App is allowed to see                              */
/* ------------------------------------------------------------------ */

export function publicState(game, viewerSeat) {
  return {
    id: game.id,
    mode: game.mode,
    status: game.status,
    trump: game.trump,
    declarer: game.declarer,
    turn: game.turn,
    lead: game.lead,
    trick: game.trick,
    trickNo: game.tricks.length + 1,
    tricks: game.tricks,
    handCounts: game.hands.map((hand) => game.status === 'trump' ? 5 : hand.length),
    teamTricks: [...game.teamTricks],
    teamPoints: [...game.teamPoints],
    seats: game.seats.map((seat) => ({
      type: seat.type,
      name: seat.name,
      tgId: seat.tgId ?? undefined,
    })),
    hokmTeam: game.hokmTeam,
    winner: game.winner,
    result: game.result,
    hand: viewerSeat >= 0 ? game.hands[viewerSeat].slice(0, game.status === 'trump' ? 5 : 13) : [],
    version: game.version,
  };
}

export function viewerInfo(game, seat) {
  return {
    seat,
    team: teamOf(seat),
    name: game.seats[seat]?.name ?? 'بازیکن',
    isDeclarer: game.declarer === seat,
  };
}

export { applyMove, chooseTrump, randomTrump, runBots, startGame };
