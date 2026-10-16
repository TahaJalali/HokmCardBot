# قوانین خوکم — the rules this project implements

Hokm (خوکم) is the four player trick taking game of Iran and the Caucasus:
two teams of two partners, a full deck of 52 cards and 13 tricks.

This document describes **exactly** what the code in `tgcloud/lib/` does, so
the bot and the Mini App can be checked against one another.

## The players

* Four players sit around the table: seats `0, 1, 2, 3`.
* Seats `0` and `2` are partners, seats `1` and `3` are partners
  (`teamOf(seat) === seat % 2`).
* The order of play is `0 → 1 → 2 → 3 → 0 …`.
* The declarer (بازیکن اعلان‌کننده) is seat `0` — the player who created the
  table. In a solo game that is the human, in a private table it is the host.

## The cards

A card is a two character string: the rank, then the suit.

| rank | `2 3 4 5 6 7 8 9 T J Q K A` |
|------|------------------------------|
| suit | `S` spades (گشنیز), `H` hearts (دل), `D` diamonds (خشت), `C` clubs (خاج) |

The whole deck is dealt, 13 cards per seat.

## The trump — «خوکم»

1. The declarer names the trump suit. The ace of the trump suit is the
   **Hokm card** (کارت خوکم).
2. The declarer leads the first trick.

## Playing a card

1. **Follow the suit that was led.** If you hold a card of that suit, you must
   play one of them.
2. **Otherwise play a trump.** If you have no card of the led suit, you must
   play a trump. If you have no trump either, any card is allowed.
3. **Beat the trump.** When a trump is already in the trick and you hold a
   higher trump, you *must* play a higher one — the classic
   «باید خوکم بزند» rule. This also applies when the trump was the led suit.
4. The winner of a trick leads the next one.

The set of legal cards is computed by `legalCards()` in
`tgcloud/lib/hokm-rules.js` (mirrored in `src/lib/hokm.ts`).

## Winning a trick

* If somebody played a trump, the highest trump wins the trick.
* Otherwise the highest card of the led suit wins it.
* The team of the winner takes the trick.

## Winning the game

* A team that takes **7 of the 13 tricks** wins the round.
* **Sweep:** a team that takes all 13 tricks *loses* the round — the other
  team wins it.
* **Hokm card rule** (`HOKM_CARD_RULE` in `tgcloud/lib/hokm-rules.js`): if the
  team that won by tricks did not capture the Hokm card, the round goes to the
  other team. Set the constant to `false` to play the plain variant.
* The card points are a display value and a safety net for a 6–6 split (which
  cannot happen with 13 tricks, but the code handles it anyway).

## The points

| card | points |
|------|--------|
| آس (A) | 10 |
| ده (T) | 10 |
| شاه (K) | 4 |
| خانم (Q) | 3 |
| ب (J) | 2 |
| everything else | 0 |

The points of all 52 cards add up to **116**; the last trick of the game is
worth **10 extra** points, so a full game is worth **126**.

## The bots

`tgcloud/lib/hokm-ai.js` plays the same rules as the humans:

* **Leading:** the longest side suit, with its lowest card. With five or more
  trumps the bot pulls the opponents' trumps instead.
* **Following:** the lowest card that wins the trick, unless the partner is
  currently winning it — the bot does not beat its own partner.
* When it cannot win, it throws away its cheapest card.

`scripts/simulate.mjs` plays thousands of complete bot games and checks every
rule (all 52 cards are played exactly once, 13 tricks, the right trick
winner, the sum of the points).

## The flow of a game

```
createGame  →  status "trump"  →  chooseTrump  →  status "playing"
                                                       ↓
                                              playCard (human)
                                                       ↓
                                              runBots (up to 3 cards)
                                                       ↓
                                              13 tricks later → "finished"
```

A private table starts in the status `waiting` and only deals the cards when
the fourth player has taken a seat (or when the host fills the empty seats
with bots).
