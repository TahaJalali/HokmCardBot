import { cn } from '@/helpers/classname-helper';
import type { Seat } from '@/lib/types';

const AVATAR = ['🂡', '🂢', '🂣', '🂤', '🂧', '🂨', '🂩', '🂪', '🂫', '🂬'];

export function SeatAvatar({ name, type }: { name: string; type: Seat['type'] }) {
  const letter = AVATAR[Math.abs(hash(name)) % AVATAR.length];

  return (
    <div
      className={cn(
        'flex size-11 items-center justify-center rounded-full border text-lg shadow-inner',
        type === 'bot' && 'border-sky-300/30 bg-sky-500/20',
        type === 'human' && 'border-amber-300/40 bg-amber-400/20',
        type === 'empty' && 'border-white/15 bg-white/5 text-white/40',
      )}
    >
      {type === 'empty' ? '＋' : letter}
    </div>
  );
}

function hash(value: string): number {
  let out = 0;
  for (let i = 0; i < value.length; i += 1) {
    out = (out * 31 + value.charCodeAt(i)) | 0;
  }
  return out;
}

export function SeatPanel({
  active = false,
  cards = 0,
  className,
  name,
  seat,
  sub,
  type,
}: {
  active?: boolean;
  cards?: number;
  className?: string;
  name: string;
  seat: number;
  sub?: string;
  type: Seat['type'];
}) {
  return (
    <div className={cn('flex flex-col items-center gap-1.5', className)}>
      <div className="relative">
        <SeatAvatar name={name || `صندلی ${seat + 1}`} type={type} />
        {active ? (
          <span className="absolute -inset-1 animate-pulse rounded-full border-2 border-amber-300/70" />
        ) : null}
      </div>

      <div className="max-w-[104px] truncate text-center text-xs font-medium text-white/85">
        {name || 'بازیکن'}
      </div>

      {sub ? <div className="text-[11px] text-amber-200/80">{sub}</div> : null}

      <div className="flex h-8 items-end gap-0.5">
        {Array.from({ length: Math.min(cards, 5) }).map((_, index) => (
          <span
            key={index}
            className="h-7 w-4 rounded-[3px] border border-black/30 shadow-sm"
            style={{
              backgroundColor: '#9d2c35',
              backgroundImage:
                'repeating-linear-gradient(45deg, rgba(255,255,255,0.18) 0, rgba(255,255,255,0.18) 1px, transparent 1px, transparent 4px)',
            }}
          />
        ))}
        {cards > 5 ? <span className="ms-1 text-[10px] text-white/60">+{cards - 5}</span> : null}
      </div>
    </div>
  );
}
