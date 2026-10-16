import { useEffect, useState } from 'react';

import { GameCard } from './GameCard';
import { cn } from '@/helpers/classname-helper';
import type { Card } from '@/lib/hokm';

const ANGLE = 2.6;

/** The player's own hand, fanned out at the bottom of the screen. */
export function HandBar({
  cards,
  legal,
  onSelect,
  selected,
  disabled,
}: {
  cards: Card[];
  legal: Set<string>;
  onSelect: (card: Card) => void;
  selected: string | null;
  disabled: boolean;
}) {
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 390 : window.innerWidth));

  useEffect(() => {
    const updateWidth = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  if (!cards.length) return null;

  // Keep a larger, readable card size while adapting the overlap to the
  // available width (especially on narrow phones and when holding many cards).
  const cardWidth = Math.min(76, Math.max(58, viewportWidth * 0.17));
  const spacing = cards.length > 1
    ? Math.min(25, Math.max(12, (viewportWidth - 24 - cardWidth) / (cards.length - 1)))
    : 0;
  const middle = (cards.length - 1) / 2;

  return (
    <div className="relative h-[142px] w-full select-none">
      {cards.map((card, index) => {
        const offset = middle - index;
        const angle = offset * ANGLE;
        const isLegal = legal.has(card);

        return (
          <button
            key={card}
            type="button"
            aria-label={card}
            aria-pressed={selected === card}
            className="absolute bottom-0 left-1/2 transition-transform duration-200"
            style={{
              transform: `translateX(calc(-50% + ${offset * spacing}px)) rotate(${angle}deg)`,
              transformOrigin: '50% 130%',
              // The right-most card lies on top, so the corner index of every
              // card stays visible.
              zIndex: cards.length - index,
            }}
            onClick={() => onSelect(card)}
          >
            <GameCard card={card} width="clamp(58px, 17vw, 76px)" disabled={disabled || !isLegal} selected={selected === card} />
          </button>
        );
      })}
    </div>
  );
}

/** A small stack of card backs — the opponents' hands. */
export function CardBacks({ count, className }: { count: number; className?: string }) {
  return (
    <div className={cn('flex items-end', className)}>
      {Array.from({ length: Math.min(count, 4) }).map((_, index) => (
        <span
          key={index}
          className="-me-1 h-7 w-4 rounded-[3px] border border-black/40 shadow-sm"
          style={{
            backgroundColor: '#9d2c35',
            backgroundImage:
              'repeating-linear-gradient(45deg, rgba(255,255,255,0.18) 0, rgba(255,255,255,0.18) 1px, transparent 1px, transparent 4px)',
          }}
        />
      ))}
    </div>
  );
}
