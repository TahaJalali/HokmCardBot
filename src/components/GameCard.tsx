import { PlayingCard, type PlayingCardProps, type PlayingCardRank, type PlayingCardSuit } from './PlayingCard';
import type { Card } from '@/lib/hokm';

const SUIT_MAP: Record<string, PlayingCardSuit> = {
  S: 'spades',
  H: 'hearts',
  D: 'diamonds',
  C: 'clubs',
};

const RANK_MAP: Record<string, PlayingCardRank> = {
  A: 'A',
  T: '10',
  J: 'J',
  Q: 'Q',
  K: 'K',
};

export type GameCardProps = Omit<PlayingCardProps, 'rank' | 'suit'> & { card: Card };

/** A card of the game (`"AS"`, `"TD"`, …) rendered with the shared component. */
export function GameCard({ card, ...rest }: GameCardProps) {
  return (
    <PlayingCard
      rank={RANK_MAP[card[0]] ?? (card[0] as PlayingCardRank)}
      suit={SUIT_MAP[card[1]] ?? 'spades'}
      {...rest}
    />
  );
}
