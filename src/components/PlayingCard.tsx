import { cn } from '@/helpers/classname-helper';

/*
 * Ported from the project's `PlayingCard` helper (a Next.js component) to the
 * Vite front-end of the Mini App:
 *   - `next/image` is replaced by inline SVG art for the court cards, so the
 *     app ships without binary card assets.
 *   - the card back is drawn with CSS gradients instead of a PNG.
 * The public API (props, layout, pip positions) is unchanged.
 */

export type PlayingCardRank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K';

export type PlayingCardSuit = 'clubs' | 'diamonds' | 'hearts' | 'spades';

export type PlayingCardProps = {
  rank: PlayingCardRank;
  suit: PlayingCardSuit;
  className?: string;
  faceDown?: boolean;
  /** Card width in pixels. Height follows the classic 5:7 ratio. */
  width?: number;
  /** Dim the card (not your turn / illegal move). */
  disabled?: boolean;
  /** Raise the card (selected). */
  selected?: boolean;
  /** Show a golden frame — e.g. the Hokm (trump ace) card. */
  highlighted?: boolean;
  onClick?: () => void;
};

type Pip = { x: number; y: number; flip?: boolean };

const suitPaths: Record<PlayingCardSuit, string> = {
  clubs:
    'M12 2a4.1 4.1 0 0 0-4.1 4.1c0 .93.31 1.79.83 2.48a4.1 4.1 0 1 0 2.9 7.33c-.28 2.2-1.02 3.72-2.43 5.09h5.6c-1.41-1.37-2.15-2.89-2.43-5.09a4.1 4.1 0 1 0 2.9-7.33c.52-.69.83-1.55.83-2.48A4.1 4.1 0 0 0 12 2Z',
  diamonds: 'M12 1.5 19.3 12 12 22.5 4.7 12Z',
  hearts:
    'M12 21.4C6.1 15.9 2.6 12.4 2.6 8.6a4.85 4.85 0 0 1 4.85-4.85c1.8 0 3.5.87 4.55 2.33a5.63 5.63 0 0 1 4.55-2.33A4.85 4.85 0 0 1 21.4 8.6c0 3.8-3.5 7.3-9.4 12.8Z',
  spades:
    'M12 1.8C6.9 7.2 3.6 10.3 3.6 13.6a4.35 4.35 0 0 0 7.1 3.36c-.3 1.9-1 3.26-2.35 4.54h7.3c-1.35-1.28-2.05-2.64-2.35-4.54a4.35 4.35 0 0 0 7.1-3.36c0-3.3-3.3-6.4-8.4-11.8Z',
};

const redSuits: ReadonlySet<PlayingCardSuit> = new Set(['diamonds', 'hearts']);

const left = 0;
const center = 50;
const right = 100;

const pipLayouts: Partial<Record<PlayingCardRank, readonly Pip[]>> = {
  '2': [
    { x: center, y: 0 },
    { x: center, y: 100, flip: true },
  ],
  '3': [
    { x: center, y: 0 },
    { x: center, y: 50 },
    { x: center, y: 100, flip: true },
  ],
  '4': [
    { x: left, y: 0 },
    { x: right, y: 0 },
    { x: left, y: 100, flip: true },
    { x: right, y: 100, flip: true },
  ],
  '5': [
    { x: left, y: 0 },
    { x: right, y: 0 },
    { x: center, y: 50 },
    { x: left, y: 100, flip: true },
    { x: right, y: 100, flip: true },
  ],
  '6': [
    { x: left, y: 0 },
    { x: right, y: 0 },
    { x: left, y: 50 },
    { x: right, y: 50 },
    { x: left, y: 100, flip: true },
    { x: right, y: 100, flip: true },
  ],
  '7': [
    { x: left, y: 0 },
    { x: right, y: 0 },
    { x: center, y: 25 },
    { x: left, y: 50 },
    { x: right, y: 50 },
    { x: left, y: 100, flip: true },
    { x: right, y: 100, flip: true },
  ],
  '8': [
    { x: left, y: 0 },
    { x: right, y: 0 },
    { x: center, y: 25 },
    { x: left, y: 50 },
    { x: right, y: 50 },
    { x: center, y: 75, flip: true },
    { x: left, y: 100, flip: true },
    { x: right, y: 100, flip: true },
  ],
  '9': [
    { x: left, y: 0 },
    { x: right, y: 0 },
    { x: left, y: 33.3 },
    { x: right, y: 33.3 },
    { x: center, y: 50 },
    { x: left, y: 66.7, flip: true },
    { x: right, y: 66.7, flip: true },
    { x: left, y: 100, flip: true },
    { x: right, y: 100, flip: true },
  ],
  '10': [
    { x: left, y: 0 },
    { x: right, y: 0 },
    { x: center, y: 16.7 },
    { x: left, y: 33.3 },
    { x: right, y: 33.3 },
    { x: left, y: 66.7, flip: true },
    { x: right, y: 66.7, flip: true },
    { x: center, y: 83.3, flip: true },
    { x: left, y: 100, flip: true },
    { x: right, y: 100, flip: true },
  ],
};

const courtRanks: ReadonlySet<PlayingCardRank> = new Set(['J', 'Q', 'K']);

function SuitIcon({ className, suit }: { className?: string; suit: PlayingCardSuit }) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d={suitPaths[suit]} />
    </svg>
  );
}

function CornerIndex({
  flipped = false,
  rank,
  suit,
}: {
  flipped?: boolean;
  rank: PlayingCardRank;
  suit: PlayingCardSuit;
}) {
  return (
    <div
      className={cn(
        'absolute flex flex-col items-center gap-[0.2em]',
        flipped ? 'right-[0.65em] bottom-[0.6em] rotate-180' : 'top-[0.6em] left-[0.65em]',
      )}
    >
      <span className="font-semibold text-[1.55em] leading-none tracking-tight">{rank}</span>
      <SuitIcon className="size-[1.05em]" suit={suit} />
    </div>
  );
}

/**
 * Court card art. The original helper loaded a PNG per court card; here the
 * picture is drawn with SVG so the Mini App stays a single, asset-free bundle.
 */
function CourtArt({ rank, suit }: { rank: PlayingCardRank; suit: PlayingCardSuit }) {
  const color = redSuits.has(suit) ? '#c22f2f' : '#23262d';
  const tint = redSuits.has(suit) ? '#fdeceb' : '#eef0f4';

  const headwear =
    rank === 'K'
      ? // crown
        'M26 30 L37 47 L50 24 L63 47 L74 30 L69 55 H31 Z'
      : rank === 'Q'
        ? // tiara
          'M30 34 L40 48 L50 28 L60 48 L70 34 L65 56 H35 Z'
        : // cap
          'M30 52 Q50 18 70 52 L64 56 H36 Z';

  return (
    <svg aria-hidden="true" className="size-full" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid meet">
      <rect x="2" y="2" width="96" height="136" rx="9" fill="#fffdf6" stroke={color} strokeWidth="1.6" />
      <rect x="8" y="8" width="84" height="124" rx="6" fill={tint} opacity="0.55" />
      <rect
        x="8"
        y="8"
        width="84"
        height="124"
        rx="6"
        fill="none"
        stroke={color}
        strokeOpacity="0.35"
        strokeWidth="1"
      />

      <g fill={color} transform="translate(0 2)">
        <path d={headwear} />
        {rank === 'K' ? (
          <>
            <circle cx="50" cy="60" r="3" />
            <circle cx="37" cy="62" r="2.4" />
            <circle cx="63" cy="62" r="2.4" />
          </>
        ) : null}
      </g>

      <g transform="translate(26 66) scale(2)" fill={color} fillOpacity="0.92">
        <path d={suitPaths[suit]} />
      </g>

      <text
        x="50"
        y="122"
        textAnchor="middle"
        fill={color}
        fontSize="13"
        fontWeight="700"
        fontFamily="Vazirmatn, Tahoma, sans-serif"
      >
        {rank === 'K' ? 'شاه' : rank === 'Q' ? 'خانم' : 'ب'}
      </text>
    </svg>
  );
}

export function PlayingCard({
  className,
  disabled = false,
  faceDown = false,
  highlighted = false,
  onClick,
  rank,
  selected = false,
  suit,
  width = 112,
}: PlayingCardProps) {
  const isRed = redSuits.has(suit);
  const pips = pipLayouts[rank];
  const isCourt = courtRanks.has(rank);

  return (
    <div
      aria-disabled={disabled || undefined}
      className={cn(
        'relative aspect-[5/7] select-none overflow-hidden rounded-[0.9em] border border-black/10 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05),0_4px_10px_rgba(0,0,0,0.07)]',
        !faceDown && (isRed ? 'text-[#c22f2f]' : 'text-[#23262d]'),
        highlighted && 'ring-2 ring-amber-400/90 ring-offset-1 ring-offset-emerald-950/60',
        selected && '-translate-y-2 shadow-[0_10px_22px_rgba(0,0,0,0.45)]',
        disabled && 'opacity-40 saturate-50',
        onClick && 'cursor-pointer transition-transform active:scale-95',
        className,
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{ fontSize: width / 14, width }}
    >
      {faceDown ? (
        <div
          className="absolute inset-[0.55em] rounded-[0.5em] border border-black/10"
          style={{
            backgroundColor: '#9d2c35',
            // Crosshatch gradients stand in for the original PNG pattern.
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(255,255,255,0.16) 0, rgba(255,255,255,0.16) 1.5px, transparent 1.5px, transparent 7px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.16) 0, rgba(255,255,255,0.16) 1.5px, transparent 1.5px, transparent 7px)",
            backgroundPosition: 'center',
            backgroundSize: 'auto, auto',
          }}
        >
          <div className="absolute inset-[0.35em] rounded-[0.35em] border border-white/25" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex size-[38%] rotate-45 items-center justify-center rounded-[0.25em] border border-white/35 bg-black/10">
              <span className="-rotate-45 text-[0.9em] font-bold text-amber-100/85">خ</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          <CornerIndex rank={rank} suit={suit} />
          <CornerIndex flipped rank={rank} suit={suit} />

          {rank === 'A' ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <SuitIcon className="size-[4.6em]" suit={suit} />
            </div>
          ) : null}

          {isCourt ? (
            <div className="absolute inset-x-[24%] inset-y-[16%] overflow-hidden rounded-[0.4em] border border-current/35">
              <CourtArt rank={rank} suit={suit} />
            </div>
          ) : null}

          {pips ? (
            <div className="absolute inset-x-[24%] inset-y-[15%]">
              {pips.map((pip) => (
                <span
                  className="-translate-x-1/2 -translate-y-1/2 absolute"
                  key={`${pip.x}-${pip.y}`}
                  style={{ left: `${pip.x}%`, top: `${pip.y}%` }}
                >
                  <SuitIcon className={cn('size-[2.1em]', pip.flip && 'rotate-180')} suit={suit} />
                </span>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
