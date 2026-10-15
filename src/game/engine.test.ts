import { describe, expect, it } from "vitest";
import { canPlayCard, chooseAiCard, createDeck, createGame, gameReducer, legalCards, resolveTrick, type Card, type PlayedCard } from "./engine";

const card = (suit: Card["suit"], rank: Card["rank"]): Card => ({ id: `${suit}-${rank}`, suit, rank });
const play = (player: PlayedCard["player"], suit: Card["suit"], rank: Card["rank"]): PlayedCard => ({ player, card: card(suit, rank) });

describe("Hokm rules engine", () => {
  it("builds a standard 52-card deck and deals five cards before trump selection", () => {
    const game = createGame(() => 0.42);
    expect(createDeck()).toHaveLength(52);
    expect(game.hands.map((hand) => hand.length)).toEqual([5, 5, 5, 5]);
    expect(game.phase).toBe("chooseTrump");
    expect(game.chooser).toBe(0);
  });

  it("deals the remaining cards after trump is chosen", () => {
    const game = createGame(() => 0.42);
    const dealt = gameReducer(game, { type: "CHOOSE_TRUMP", player: 0, suit: "hearts" });
    expect(dealt.phase).toBe("playing");
    expect(dealt.trump).toBe("hearts");
    expect(dealt.hands.map((hand) => hand.length)).toEqual([13, 13, 13, 13]);
    expect(new Set(dealt.hands.flat().map((item) => item.id)).size).toBe(52);
  });

  it("requires players to follow the lead suit when possible", () => {
    const hand = [card("hearts", "2"), card("spades", "A"), card("clubs", "K")];
    const trick = [play(0, "hearts", "9")];
    expect(legalCards(hand, trick).map((item) => item.id)).toEqual(["hearts-2"]);
    expect(canPlayCard(hand, trick, card("spades", "A"))).toBe(false);
    expect(canPlayCard(hand, trick, card("hearts", "2"))).toBe(true);
  });

  it("allows any suit when the player is void in the lead suit", () => {
    const hand = [card("spades", "2"), card("clubs", "A")];
    expect(legalCards(hand, [play(0, "hearts", "9")])).toEqual(hand);
  });

  it("lets a trump card beat a higher card of the lead suit", () => {
    const trick = [
      play(0, "hearts", "A"),
      play(1, "hearts", "2"),
      play(2, "spades", "3"),
      play(3, "hearts", "K"),
    ];
    expect(resolveTrick(trick, "spades")).toBe(2);
  });

  it("does not let an off-suit non-trump card win", () => {
    const trick = [
      play(0, "hearts", "10"),
      play(1, "clubs", "A"),
      play(2, "hearts", "Q"),
      play(3, "diamonds", "A"),
    ];
    expect(resolveTrick(trick, "spades")).toBe(2);
  });

  it("runs a complete hand, follows suit, and awards the match point only once", () => {
    let game = createGame(() => 0.37);
    game = gameReducer(game, { type: "CHOOSE_TRUMP", player: 0, suit: "clubs" });
    let safety = 0;

    while (game.phase === "playing" && safety < 80) {
      const player = game.turn;
      const card = chooseAiCard(game.hands[player], game.trick, game.trump!, player);
      game = gameReducer(game, { type: "PLAY_CARD", player, cardId: card.id });
      if (game.settling) game = gameReducer(game, { type: "COLLECT_TRICK" });
      safety += 1;
    }

    expect(safety).toBeLessThan(80);
    expect(game.phase).toBe("handSummary");
    expect(game.roundResult).not.toBeNull();
    expect(game.matchScore[game.roundResult!.winner]).toBe(game.roundResult!.points);
    expect(game.matchScore[game.roundResult!.winner]).toBeGreaterThanOrEqual(1);
  });
});
