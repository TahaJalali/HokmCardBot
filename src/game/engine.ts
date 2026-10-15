export const SUITS = ["clubs", "diamonds", "hearts", "spades"] as const;
export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"] as const;

export type Suit = (typeof SUITS)[number];
export type Rank = (typeof RANKS)[number];
export type Card = { id: string; rank: Rank; suit: Suit };
export type PlayerId = 0 | 1 | 2 | 3;
export type TeamId = 0 | 1;
export type GamePhase = "chooseTrump" | "playing" | "handSummary";
export type PlayedCard = { player: PlayerId; card: Card };
export type TeamScore = [number, number];

export type RoundResult = {
  winner: TeamId;
  tricks: TeamScore;
  points: number;
  shutout: boolean;
  matchWon: boolean;
};

export type GameState = {
  phase: GamePhase;
  hands: [Card[], Card[], Card[], Card[]];
  dealer: PlayerId;
  chooser: PlayerId;
  trump: Suit | null;
  leader: PlayerId;
  turn: PlayerId;
  trick: PlayedCard[];
  settling: boolean;
  tricks: TeamScore;
  matchScore: TeamScore;
  round: number;
  roundResult: RoundResult | null;
};

export type GameAction =
  | { type: "CHOOSE_TRUMP"; player: PlayerId; suit: Suit }
  | { type: "PLAY_CARD"; player: PlayerId; cardId: string }
  | { type: "COLLECT_TRICK" }
  | { type: "NEXT_ROUND" }
  | { type: "NEW_MATCH" };

const rankValue: Record<Rank, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const asPlayer = (value: number): PlayerId => ((value + 4) % 4) as PlayerId;

export function teamForPlayer(player: PlayerId): TeamId {
  return player % 2 === 0 ? 0 : 1;
}

export function createDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ id: `${suit}-${rank}`, suit, rank })));
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function sortHand(hand: Card[]): Card[] {
  const suitOrder = new Map<Suit, number>(SUITS.map((suit, index) => [suit, index]));
  return [...hand].sort((left, right) => {
    const suitDifference = suitOrder.get(left.suit)! - suitOrder.get(right.suit)!;
    return suitDifference || rankValue[right.rank] - rankValue[left.rank];
  });
}

function dealRound(matchScore: TeamScore, round: number, dealer: PlayerId, random: () => number): GameState {
  const chooser = asPlayer(dealer + 1);
  const deck = shuffled(createDeck(), random);
  const hands: [Card[], Card[], Card[], Card[]] = [[], [], [], []];
  let nextCard = 0;

  // The player to the dealer's left receives the first five cards and chooses trump.
  for (let index = 0; index < 20; index += 1) {
    hands[asPlayer(chooser + (index % 4))].push(deck[nextCard++]);
  }

  return {
    phase: "chooseTrump",
    hands: [sortHand(hands[0]), sortHand(hands[1]), sortHand(hands[2]), sortHand(hands[3])],
    dealer,
    chooser,
    trump: null,
    leader: chooser,
    turn: chooser,
    trick: [],
    settling: false,
    tricks: [0, 0],
    matchScore: [...matchScore],
    round,
    roundResult: null,
  };
}

export function createGame(random: () => number = Math.random): GameState {
  // The first dealer is the player on the left of the human, so the human opens as hakim.
  return dealRound([0, 0], 1, 3, random);
}

function completeDeal(state: GameState, trump: Suit): GameState {
  const deck = shuffled(createDeck(), Math.random);
  const dealtIds = new Set(state.hands.flat().map((card) => card.id));
  const remaining = deck.filter((card) => !dealtIds.has(card.id));
  const hands: [Card[], Card[], Card[], Card[]] = [
    [...state.hands[0]],
    [...state.hands[1]],
    [...state.hands[2]],
    [...state.hands[3]],
  ];

  for (let index = 0; index < remaining.length; index += 1) {
    hands[asPlayer(state.chooser + (index % 4))].push(remaining[index]);
  }

  return {
    ...state,
    phase: "playing",
    hands: [sortHand(hands[0]), sortHand(hands[1]), sortHand(hands[2]), sortHand(hands[3])],
    trump,
    leader: state.chooser,
    turn: state.chooser,
  };
}

export function chooseTrumpForHand(hand: Card[]): Suit {
  let bestSuit: Suit = SUITS[0];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const suit of SUITS) {
    const suitedCards = hand.filter((card) => card.suit === suit);
    const highCardPoints = suitedCards.reduce((score, card) => {
      if (card.rank === "A") return score + 5;
      if (card.rank === "K") return score + 4;
      if (card.rank === "Q") return score + 3;
      if (card.rank === "J") return score + 2;
      return score;
    }, 0);
    const score = suitedCards.length * 3 + highCardPoints + (suitedCards.length >= 4 ? 2 : 0);
    if (score > bestScore) {
      bestSuit = suit;
      bestScore = score;
    }
  }

  return bestSuit;
}

export function legalCards(hand: Card[], trick: PlayedCard[]): Card[] {
  if (trick.length === 0) return hand;
  const leadSuit = trick[0].card.suit;
  const followingSuit = hand.filter((card) => card.suit === leadSuit);
  return followingSuit.length > 0 ? followingSuit : hand;
}

export function canPlayCard(hand: Card[], trick: PlayedCard[], card: Card): boolean {
  return legalCards(hand, trick).some((legalCard) => legalCard.id === card.id);
}

export function resolveTrick(trick: PlayedCard[], trump: Suit): PlayerId {
  if (trick.length === 0) throw new Error("A trick needs at least one card.");

  let winner = trick[0];
  for (const play of trick.slice(1)) {
    const candidateIsTrump = play.card.suit === trump;
    const winnerIsTrump = winner.card.suit === trump;
    const candidateIsHigher = rankValue[play.card.rank] > rankValue[winner.card.rank];

    if (
      (candidateIsTrump && !winnerIsTrump) ||
      (play.card.suit === winner.card.suit && candidateIsHigher)
    ) {
      winner = play;
    }
  }
  return winner.player;
}

function lowestCard(cards: Card[]): Card {
  return [...cards].sort((left, right) => rankValue[left.rank] - rankValue[right.rank])[0];
}

export function chooseAiCard(hand: Card[], trick: PlayedCard[], trump: Suit, player: PlayerId): Card {
  const options = legalCards(hand, trick);
  if (options.length === 0) throw new Error("The player has no legal card to play.");

  if (trick.length === 0) {
    const suitCounts = SUITS.map((suit) => ({ suit, count: hand.filter((card) => card.suit === suit).length }));
    const preferredSuit = suitCounts.reduce((best, current) => current.count > best.count ? current : best).suit;
    const leads = options.filter((card) => card.suit === preferredSuit);
    return [...leads].sort((left, right) => rankValue[right.rank] - rankValue[left.rank])[0];
  }

  const currentWinner = resolveTrick(trick, trump);
  const partnerIsWinning = teamForPlayer(currentWinner) === teamForPlayer(player);
  if (partnerIsWinning) return lowestCard(options);

  const winningOptions = options.filter((card) => {
    const winnerPlay = trick.find((play) => play.player === currentWinner)!;
    const cardIsTrump = card.suit === trump;
    const winnerIsTrump = winnerPlay.card.suit === trump;
    return (cardIsTrump && !winnerIsTrump) ||
      (card.suit === winnerPlay.card.suit && rankValue[card.rank] > rankValue[winnerPlay.card.rank]);
  });

  return lowestCard(winningOptions.length > 0 ? winningOptions : options);
}

function playCard(state: GameState, player: PlayerId, cardId: string): GameState {
  if (state.phase !== "playing" || state.settling || player !== state.turn || state.trump === null) return state;

  const hand = state.hands[player];
  const card = hand.find((item) => item.id === cardId);
  if (!card || !canPlayCard(hand, state.trick, card)) return state;

  const hands: [Card[], Card[], Card[], Card[]] = [
    [...state.hands[0]],
    [...state.hands[1]],
    [...state.hands[2]],
    [...state.hands[3]],
  ];
  hands[player] = hands[player].filter((item) => item.id !== cardId);
  const trick = [...state.trick, { player, card }];

  if (trick.length < 4) {
    return { ...state, hands, trick, turn: asPlayer(player + 1) };
  }

  const winner = resolveTrick(trick, state.trump);
  const winningTeam = teamForPlayer(winner);
  const tricks: TeamScore = [...state.tricks];
  tricks[winningTeam] += 1;
  const handIsOver = tricks[winningTeam] >= 7 || hands.every((cards) => cards.length === 0);
  let roundResult: RoundResult | null = null;

  if (handIsOver) {
    const losingTeam: TeamId = winningTeam === 0 ? 1 : 0;
    const shutout = tricks[losingTeam] === 0;
    const points = shutout ? 2 : 1;
    const matchScore: TeamScore = [...state.matchScore];
    matchScore[winningTeam] += points;
    roundResult = {
      winner: winningTeam,
      tricks,
      points,
      shutout,
      matchWon: matchScore[winningTeam] >= 7,
    };
  }

  return {
    ...state,
    hands,
    trick,
    turn: winner,
    leader: winner,
    tricks,
    settling: true,
    roundResult,
  };
}

function collectTrick(state: GameState): GameState {
  if (!state.settling || state.trick.length !== 4) return state;

  if (state.roundResult) {
    const matchScore: TeamScore = [...state.matchScore];
    matchScore[state.roundResult.winner] += state.roundResult.points;
    return {
      ...state,
      phase: "handSummary",
      matchScore,
      trick: [],
      settling: false,
    };
  }

  return {
    ...state,
    leader: state.turn,
    trick: [],
    settling: false,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "CHOOSE_TRUMP": {
      if (state.phase !== "chooseTrump" || action.player !== state.chooser) return state;
      return completeDeal(state, action.suit);
    }
    case "PLAY_CARD":
      return playCard(state, action.player, action.cardId);
    case "COLLECT_TRICK":
      return collectTrick(state);
    case "NEXT_ROUND": {
      if (state.phase !== "handSummary" || state.matchScore.some((score) => score >= 7)) return state;
      return dealRound(state.matchScore, state.round + 1, asPlayer(state.dealer + 1), Math.random);
    }
    case "NEW_MATCH":
      return createGame();
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
