# خوکم — Hokm Card Bot

A Persian **Hokm** (خوکم) game as a **Telegram Mini App**, running on the
tgcloud serverless platform. Four players, two teams, 13 tricks, a trump suit
(«خوکم») and the ace of trumps as the Hokm card.

* **Mini App front-end** — Vite + React + TypeScript + Tailwind (v4), in the
  project root, built into `dist/`.
* **Bot back-end** — serverless modules in `tgcloud/` (database schema, shared
  libraries, update handlers, endpoints).
* **No server** — every request is a stateless function; the position of a
  game lives in the database.

---

## Quick start

```bash
npm install          # install the front-end and the tgcloud CLI
npm run dev          # the Mini App on http://localhost:5173 (with a bot-less mock)
npm run build        # type check + build into dist/
npm run deploy       # build + tgcloud push
npx tgcloud migrate  # apply the database schema
```

Outside Telegram the Mini App falls back to an in-browser mock
(`src/lib/mock-server.ts`), so the whole game can be played locally.

### The first deploy

```bash
npx tgcloud login      # link this project to a bot
npm run deploy         # pushes the modules and the Mini App
npx tgcloud migrate    # creates the tables
```

`tgcloud push` prints the URL of the Mini App
(`https://app<app_id>.tgcloud.ai/`). Put it into `tgcloud/lib/config.js`:

```js
export const MINI_APP_URL = 'https://app123456.tgcloud.ai';
```

Without it the bot falls back to the `t.me` direct link of the bot's main
Mini App.

---

## The project

```
├── index.html               the Mini App shell (RTL, Persian)
├── vite.config.ts           Vite + Tailwind + the `@/` alias
├── src/                     the Mini App (front-end)
│   ├── components/
│   │   ├── PlayingCard.tsx  the card component (ported from the project helper)
│   │   ├── GameCard.tsx     the same component for the game's card codes
│   │   ├── GameView.tsx     the table: seats, trick, hand
│   │   ├── HandBar.tsx      the fanned hand of the player
│   │   ├── TrickArea.tsx    the cards of the running trick
│   │   ├── SeatPanel.tsx    a player at the table
│   │   ├── Lobby.tsx        the menu: quick game, private table, join
│   │   ├── TrumpPicker.tsx  the choice of the trump suit
│   │   ├── ResultOverlay.tsx the result of a finished game
│   │   └── RulesSheet.tsx   the rules
│   ├── helpers/
│   │   ├── classname-helper.ts   the `cn()` helper
│   │   └── telegram.ts           the Telegram Web App bridge
│   └── lib/
│       ├── hokm.ts          the rules (mirror of the server)
│       ├── types.ts         the contract of the endpoints
│       └── mock-server.ts   the endpoints without Telegram
├── tgcloud/                 the bot (server side)
│   ├── schema.js            the tables
│   ├── lib/
│   │   ├── hokm-rules.js    the rules — the source of truth
│   │   ├── hokm-play.js     the pure game logic (no platform imports)
│   │   ├── hokm-ai.js       the bots
│   │   ├── game.js          the life cycle + the database
│   │   ├── user.js          the Telegram users
│   │   ├── config.js        the Mini App URL and the bot info
│   │   ├── api.js           the helpers of the endpoints
│   │   └── notify.js        the messages to the players
│   ├── handlers/            message.js, callback_query.js
│   └── endpoints/           getLobby, createGame, getGame, joinGame,
│                            chooseTrump, playCard, fillBots, leaveGame
├── scripts/
│   ├── simulate.mjs         plays thousands of bot games and checks the rules
│   └── check-mirror.ts      proves the client and the server agree
└── docs/hokm-rules.md       the rules as they are implemented
```

## The endpoints

The Mini App talks to the bot through the platform's endpoints — never with a
hand written `fetch`:

```js
Telegram.WebApp.Serverless.call('playCard', { gameId, card }, (err, result) => …)
```

| endpoint      | what it does                                              |
|---------------|-----------------------------------------------------------|
| `getLobby`    | the games of the caller, the bot name, the Mini App URL    |
| `createGame`  | a new game (`solo` against bots, or `room` for friends)    |
| `getGame`     | the state of a game (the other hands stay hidden)          |
| `joinGame`    | take a seat at a table                                     |
| `chooseTrump` | the declarer names the trump suit                          |
| `playCard`    | play a card — the bots answer in the same call             |
| `fillBots`    | fill the empty seats with bots and start                   |
| `leaveGame`   | leave a table                                             |

Every endpoint answers with `{ game, you, moves }`. `you` is the seat of the
caller, `moves` are the cards the bots played while serving the call (the
Mini App animates them).

## The bot

```
/start          welcome + the button of the Mini App
/new            a new game against the bots
/games          the games you take part in
/rules          the rules
/link           the address of the Mini App
```

`/start join_<CODE>` — the deep link of an invitation — opens the table
directly. The same parameter is used by the Mini App: `?startapp=join_CODE`
joins a table, `?startapp=g_ID` opens a game.

## The database

| table          | what it holds                                            |
|----------------|----------------------------------------------------------|
| `hokm_users`   | the Telegram users and their chat ids                    |
| `hokm_games`   | the games — the whole position in JSON columns            |
| `hokm_moves`   | every card that was played                                |
| `hokm_meta`    | small cache (the bot info)                                |

The tables are created with `npx tgcloud migrate`.

## Tests

```bash
node scripts/simulate.mjs 3000     # 3000 complete bot games, every rule checked
npx esbuild scripts/check-mirror.ts --bundle --platform=node --format=esm --outfile=/tmp/m.mjs && node /tmp/m.mjs
```

The first script plays thousands of games and proves that the rules hold; the
second proves that the Mini App and the bot always agree about which cards
may be played.

## The rules

See [docs/hokm-rules.md](docs/hokm-rules.md) — in short:

* the declarer chooses the trump (خوکم); the ace of the trump is the Hokm card
* follow the suit, otherwise play a trump, and beat a trump whenever you can
* the winner of a trick leads the next one
* seven tricks win the round; taking all thirteen loses it
* if the winners did not capture the Hokm card, the round goes to the other team
