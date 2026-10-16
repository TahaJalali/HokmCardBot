/**
 * A tiny in-browser stand-in for the bot's endpoints.
 *
 * It is only used when the Mini App runs outside Telegram (the local dev
 * server), so the game can be played and tested without the bot. Inside
 * Telegram every call goes to the real endpoints of the platform.
 */
import {
  cardPoints,
  deal,
  legalCards,
  RANK_VALUE,
  rankOf,
  suitOf,
  teamOf,
  trickWinner,
  type Card,
  type Suit,
} from './hokm';
import type {
  CompletedTrick,
  GameResponse,
  GameResult,
  LobbyResponse,
  PublicGame,
  Seat,
  TrickEntry,
} from './types';

const BOT_NAMES = ['ربات آرش', 'ربات بهرام', 'ربات پریسا', 'ربات دارا'];
const DEV_USER = { id: 1, name: 'بازیکن' };

interface MockGame {
  id: string;
  mode: 'solo' | 'room';
  status: 'waiting' | 'trump' | 'playing' | 'finished';
  trump: Suit | null;
  declarer: number;
  turn: number;
  lead: number;
  seats: Seat[];
  hands: Card[][];
  trick: TrickEntry[];
  tricks: CompletedTrick[];
  teamTricks: [number, number];
  teamPoints: [number, number];
  hokmTeam: number | null;
  winner: number | null;
  result: GameResult | null;
  version: number;
}

const store = new Map<string, MockGame>();

function newId(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i += 1) id += alphabet[Math.floor(Math.random() * alphabet.length)];
  return id;
}

function seatOfUser(game: MockGame, tgId: number): number {
  return game.seats.findIndex((seat) => seat.type === 'human' && seat.tgId === tgId);
}

function startGame(game: MockGame): void {
  game.hands = deal();
  game.trick = [];
  game.tricks = [];
  game.teamTricks = [0, 0];
  game.teamPoints = [0, 0];
  game.hokmTeam = null;
  game.winner = null;
  game.result = null;
  game.turn = game.declarer;
  game.lead = game.declarer;
  game.status = 'trump';
}

function chooseTrump(game: MockGame, trump: Suit): void {
  game.trump = trump;
  game.status = 'playing';
  game.turn = game.declarer;
  game.lead = game.declarer;
  game.trick = [];
}

function applyMove(game: MockGame, seat: number, card: Card): void {
  const hand = game.hands[seat];
  const index = hand.indexOf(card);
  if (index < 0) return;
  hand.splice(index, 1);
  game.trick.push({ seat, card });

  if (game.trick.length < 4) {
    game.turn = (seat + 1) % 4;
    return;
  }

  const winner = trickWinner(game.trick, game.trump) ?? 0;
  let points = game.trick.reduce((sum, entry) => sum + cardPoints(entry.card), 0);
  if (game.tricks.length + 1 === 13) points += 10;

  const team = teamOf(winner);
  game.teamTricks[team] += 1;
  game.teamPoints[team] += points;

  const hokmCard = `A${game.trump}`;
  if (game.trick.some((entry) => entry.card === hokmCard)) game.hokmTeam = team;

  game.tricks.push({ cards: [...game.trick], winner, points });
  game.trick = [];
  game.lead = winner;

  if (game.tricks.length === 13) {
    finishGame(game);
  } else {
    game.turn = winner;
  }
}

function finishGame(game: MockGame): void {
  const [first, second] = game.teamTricks;
  let winner = 0;
  let sweep = false;
  let hokmBonus = false;

  if (first === 13) {
    winner = 1;
    sweep = true;
  } else if (second === 13) {
    winner = 0;
    sweep = true;
  } else if (first > second) {
    winner = 0;
  } else if (second > first) {
    winner = 1;
  } else {
    winner = game.teamPoints[0] > game.teamPoints[1] ? 0 : 1;
  }

  if (!sweep && game.hokmTeam !== null && game.hokmTeam !== winner) {
    hokmBonus = true;
    winner = 1 - winner;
  }

  game.winner = winner;
  game.status = 'finished';
  game.result = {
    winner,
    sweep,
    hokmBonus,
    teamTricks: [...game.teamTricks],
    teamPoints: [...game.teamPoints],
    reason: sweep
      ? 'یک تیم همه‌ی ۱۳ ترک را گرفت؛ بازی به تیم دیگر رسید.'
      : hokmBonus
        ? 'تیم برنده کارت خوکم را نگرفته بود؛ دست به تیم مقابل رسید.'
        : `تیم ${winner === 0 ? 'شما' : 'مقابل'} با ${game.teamTricks[winner]} ترک برنده شد.`,
  };
}

function beats(card: Card, best: Card, trump: Suit | null): boolean {
  const cardIsTrump = suitOf(card) === trump;
  const bestIsTrump = suitOf(best) === trump;
  if (cardIsTrump !== bestIsTrump) return cardIsTrump;
  if (cardIsTrump) return RANK_VALUE[rankOf(card)] > RANK_VALUE[rankOf(best)];
  if (suitOf(card) !== suitOf(best)) return false;
  return RANK_VALUE[rankOf(card)] > RANK_VALUE[rankOf(best)];
}

function lowest(cards: Card[]): Card | null {
  if (!cards.length) return null;
  return [...cards].sort(
    (a, b) => RANK_VALUE[rankOf(a)] - RANK_VALUE[rankOf(b)] || a.localeCompare(b),
  )[0];
}

/** A simple bot: win the trick when it is cheap, otherwise keep the lowest card. */
function botCard(hand: Card[], trick: TrickEntry[], trump: Suit | null, seat: number): Card | null {
  const legal = legalCards(hand, trick, trump);
  if (!legal.length) return null;
  if (!trick.length) {
    const groups = new Map<Suit, Card[]>();
    for (const card of hand) {
      const suit = suitOf(card);
      groups.set(suit, [...(groups.get(suit) ?? []), card]);
    }
    const side = [...groups.entries()].filter(([suit]) => suit !== trump).sort((a, b) => b[1].length - a[1].length);
    return lowest(side[0]?.[1] ?? legal);
  }

  const winnerSeat = trickWinner(trick, trump);
  const winnerEntry = trick.find((entry) => entry.seat === winnerSeat);
  if (winnerEntry && winnerSeat !== null && teamOf(winnerSeat) !== teamOf(seat)) {
    const beatable = legal.filter((card) => beats(card, winnerEntry.card, trump));
    if (beatable.length) return lowest(beatable);
  }
  return lowest(legal);
}

function runBots(game: MockGame): { seat: number; card: Card }[] {
  const played: { seat: number; card: Card }[] = [];
  let guard = 0;
  while (game.status === 'playing' && game.seats[game.turn]?.type === 'bot' && guard < 16) {
    guard += 1;
    const seat = game.turn;
    const card = botCard(game.hands[seat], game.trick, game.trump, seat);
    if (!card) break;
    applyMove(game, seat, card);
    played.push({ seat, card });
  }
  return played;
}

function publicState(game: MockGame, viewerSeat: number): PublicGame {
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
    handCounts: game.hands.map((hand) => hand.length),
    teamTricks: [...game.teamTricks],
    teamPoints: [...game.teamPoints],
    seats: game.seats.map((seat) => ({ type: seat.type, name: seat.name, tgId: seat.tgId })),
    hokmTeam: game.hokmTeam,
    winner: game.winner,
    result: game.result,
    hand: viewerSeat >= 0 ? [...game.hands[viewerSeat]] : [],
    version: game.version,
  };
}

function response(game: MockGame, seat: number, moves: { seat: number; card: Card }[] = []): GameResponse {
  return {
    game: publicState(game, seat),
    you: {
      seat,
      team: teamOf(seat),
      name: game.seats[seat]?.name ?? DEV_USER.name,
      isDeclarer: game.declarer === seat,
    },
    moves,
    shareLink: '',
  };
}

function createGame(mode: 'solo' | 'room'): MockGame {
  const id = newId();
  const seats: Seat[] = [];
  for (let seat = 0; seat < 4; seat += 1) {
    if (seat === 0) seats.push({ type: 'human', name: DEV_USER.name, tgId: DEV_USER.id });
    else if (mode === 'solo') seats.push({ type: 'bot', name: BOT_NAMES[seat] });
    else seats.push({ type: 'empty', name: '' });
  }

  const game: MockGame = {
    id,
    mode,
    status: mode === 'solo' ? 'trump' : 'waiting',
    trump: null,
    declarer: 0,
    turn: 0,
    lead: 0,
    seats,
    hands: [[], [], [], []],
    trick: [],
    tricks: [],
    teamTricks: [0, 0],
    teamPoints: [0, 0],
    hokmTeam: null,
    winner: null,
    result: null,
    version: 0,
  };

  if (mode === 'solo') startGame(game);
  store.set(id, game);
  return game;
}

/** The mock of `Telegram.WebApp.Serverless.call`. */
export async function mockCall<T>(name: string, input: unknown): Promise<T> {
  const body = (input ?? {}) as Record<string, unknown>;
  await new Promise((resolve) => setTimeout(resolve, 120));

  switch (name) {
    case 'getLobby': {
      const games = [...store.values()]
        .filter((game) => game.status !== 'finished')
        .map((game) => ({
          id: game.id,
          mode: game.mode,
          status: game.status,
          trump: game.trump,
          turn: game.turn,
          seats: game.seats,
        }));
      return { games, botUsername: null, miniAppUrl: null } as T;
    }

    case 'createGame': {
      const mode = body.mode === 'room' ? 'room' : 'solo';
      const game = createGame(mode);
      return response(game, 0) as T;
    }

    case 'getGame': {
      const game = store.get(String(body.gameId ?? ''));
      if (!game) throw new Error('این بازی پیدا نشد');
      const seat = seatOfUser(game, DEV_USER.id);
      return response(game, seat) as T;
    }

    case 'joinGame': {
      const game = store.get(String(body.code ?? '').toUpperCase());
      if (!game) throw new Error('این میز پیدا نشد');
      if (game.status !== 'waiting') throw new Error('این میز دیگر در حال انتظار نیست');
      let seat = seatOfUser(game, DEV_USER.id);
      if (seat < 0) {
        seat = game.seats.findIndex((item) => item.type === 'empty');
        if (seat < 0) throw new Error('میز پر است');
        game.seats[seat] = { type: 'human', name: DEV_USER.name, tgId: DEV_USER.id };
      }
      if (game.seats.every((item) => item.type === 'human')) startGame(game);
      return response(game, seat) as T;
    }

    case 'chooseTrump': {
      const game = store.get(String(body.gameId ?? ''));
      if (!game) throw new Error('این بازی پیدا نشد');
      const seat = seatOfUser(game, DEV_USER.id);
      if (game.status !== 'trump' || seat !== game.declarer) throw new Error('الان نوبت انتخاب خوکم نیست');
      chooseTrump(game, String(body.trump ?? 'S') as Suit);
      return response(game, seat) as T;
    }

    case 'playCard': {
      const game = store.get(String(body.gameId ?? ''));
      if (!game) throw new Error('این بازی پیدا نشد');
      const seat = seatOfUser(game, DEV_USER.id);
      if (game.status !== 'playing') throw new Error('بازی در جریان نیست');
      if (game.turn !== seat) throw new Error('هنوز نوبت شما نیست');
      const card = String(body.card ?? '');
      if (!legalCards(game.hands[seat], game.trick, game.trump).includes(card)) {
        throw new Error('این کارت قابل بازی نیست');
      }
      applyMove(game, seat, card);
      const moves = runBots(game);
      return response(game, seat, moves) as T;
    }

    case 'fillBots': {
      const game = store.get(String(body.gameId ?? ''));
      if (!game) throw new Error('این بازی پیدا نشد');
      const seat = seatOfUser(game, DEV_USER.id);
      game.seats = game.seats.map((item, index) =>
        item.type === 'empty' ? { type: 'bot', name: BOT_NAMES[index] } : item,
      );
      startGame(game);
      if (game.seats[game.declarer]?.type === 'bot') {
        chooseTrump(game, (['S', 'H', 'D', 'C'] as Suit[])[Math.floor(Math.random() * 4)]);
      }
      const moves = runBots(game);
      return response(game, seat, moves) as T;
    }

    default:
      throw new Error(`endpoint ناشناخته: ${name}`);
  }
}

export type { LobbyResponse };
