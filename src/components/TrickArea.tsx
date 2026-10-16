import type { CSSProperties } from 'react';

import { GameCard } from './GameCard';
import { cn } from '@/helpers/classname-helper';
import type { TrickEntry } from '@/lib/types';

/** Where a seat sits around the table, relative to the viewer. */
function positionFor(relative: number): CSSProperties {
  switch (relative) {
    case 0:
      return { bottom: 0, left: '50%', transform: 'translateX(-50%)' };
    case 1:
      return { right: 0, top: '50%', transform: 'translateY(-50%)' };
    case 2:
      return { top: 0, left: '50%', transform: 'translateX(-50%)' };
    default:
      return { left: 0, top: '50%', transform: 'translateY(-50%)' };
  }
}

/**
 * The cards played in the current trick. Every card sits on the side of its
 * owner, so it is obvious who played what.
 */
export function TrickArea({
  className,
  trick,
  viewerSeat,
}: {
  className?: string;
  trick: TrickEntry[];
  viewerSeat: number;
}) {
  return (
    <div className={cn('relative h-[186px] w-full max-w-[320px]', className)}>
      {[0, 1, 2, 3].map((relative) => (
        <span
          key={relative}
          className="absolute h-[62px] w-[44px] rounded-[6px] border border-dashed border-white/10 bg-black/10"
          style={positionFor(relative)}
        />
      ))}

      {trick.map((entry, index) => {
        const relative = (entry.seat - viewerSeat + 4) % 4;
        return (
          <div
            key={`${entry.seat}-${entry.card}`}
            className="animate-deal absolute"
            style={{ ...positionFor(relative), zIndex: index + 1 }}
          >
            <GameCard card={entry.card} width={46} />
          </div>
        );
      })}
    </div>
  );
}
