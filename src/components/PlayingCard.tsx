import type { CSSProperties } from "react";
import type { Rank, Suit } from "../game/engine";

type Pip = { x: number; y: number; flip?: boolean };

type PlayingCardProps = {
  rank: Rank;
  suit: Suit;
  className?: string;
  faceDown?: boolean;
  /** Card width in CSS pixels. Height follows the classic 5:7 ratio. */
  width?: number;
  selected?: boolean;
  muted?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  label?: string;
};

const suitPaths: Record<Suit, string> = {
  clubs: "M12 2a4.1 4.1 0 0 0-4.1 4.1c0 .93.31 1.79.83 2.48a4.1 4.1 0 1 0 2.9 7.33c-.28 2.2-1.02 3.72-2.43 5.09h5.6c-1.41-1.37-2.15-2.89-2.43-5.09a4.1 4.1 0 1 0 2.9-7.33c.52-.69.83-1.55.83-2.48A4.1 4.1 0 0 0 12 2Z",
  diamonds: "M12 1.5 19.3 12 12 22.5 4.7 12Z",
  hearts: "M12 21.4C6.1 15.9 2.6 12.4 2.6 8.6a4.85 4.85 0 0 1 4.85-4.85c1.8 0 3.5.87 4.55 2.33a5.63 5.63 0 0 1 4.55-2.33A4.85 4.85 0 0 1 21.4 8.6c0 3.8-3.5 7.3-9.4 12.8Z",
  spades: "M12 1.8C6.9 7.2 3.6 10.3 3.6 13.6a4.35 4.35 0 0 0 7.1 3.36c-.3 1.9-1 3.26-2.35 4.54h7.3c-1.35-1.28-2.05-2.64-2.35-4.54a4.35 4.35 0 0 0 7.1-3.36c0-3.3-3.3-6.4-8.4-11.8Z",
};

const redSuits: ReadonlySet<Suit> = new Set(["diamonds", "hearts"]);
const left = 0;
const center = 50;
const right = 100;

const pipLayouts: Partial<Record<Rank, readonly Pip[]>> = {
  "2": [{ x: center, y: 0 }, { x: center, y: 100, flip: true }],
  "3": [{ x: center, y: 0 }, { x: center, y: 50 }, { x: center, y: 100, flip: true }],
  "4": [{ x: left, y: 0 }, { x: right, y: 0 }, { x: left, y: 100, flip: true }, { x: right, y: 100, flip: true }],
  "5": [{ x: left, y: 0 }, { x: right, y: 0 }, { x: center, y: 50 }, { x: left, y: 100, flip: true }, { x: right, y: 100, flip: true }],
  "6": [{ x: left, y: 0 }, { x: right, y: 0 }, { x: left, y: 50 }, { x: right, y: 50 }, { x: left, y: 100, flip: true }, { x: right, y: 100, flip: true }],
  "7": [{ x: left, y: 0 }, { x: right, y: 0 }, { x: center, y: 25 }, { x: left, y: 50 }, { x: right, y: 50 }, { x: left, y: 100, flip: true }, { x: right, y: 100, flip: true }],
  "8": [{ x: left, y: 0 }, { x: right, y: 0 }, { x: center, y: 25 }, { x: left, y: 50 }, { x: right, y: 50 }, { x: center, y: 75, flip: true }, { x: left, y: 100, flip: true }, { x: right, y: 100, flip: true }],
  "9": [{ x: left, y: 0 }, { x: right, y: 0 }, { x: left, y: 33.3 }, { x: right, y: 33.3 }, { x: center, y: 50 }, { x: left, y: 66.7, flip: true }, { x: right, y: 66.7, flip: true }, { x: left, y: 100, flip: true }, { x: right, y: 100, flip: true }],
  "10": [{ x: left, y: 0 }, { x: right, y: 0 }, { x: center, y: 16.7 }, { x: left, y: 33.3 }, { x: right, y: 33.3 }, { x: left, y: 66.7, flip: true }, { x: right, y: 66.7, flip: true }, { x: center, y: 83.3, flip: true }, { x: left, y: 100, flip: true }, { x: right, y: 100, flip: true }],
};

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function SuitIcon({ suit, className }: { suit: Suit; className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d={suitPaths[suit]} />
    </svg>
  );
}

function CornerIndex({ rank, suit, flipped = false }: { rank: Rank; suit: Suit; flipped?: boolean }) {
  return (
    <span className={cn("card-corner", flipped && "card-corner-bottom")}>
      <span className="card-corner-rank">{rank}</span>
      <SuitIcon className="card-corner-suit" suit={suit} />
    </span>
  );
}

function CourtArt({ rank, suit }: { rank: Rank; suit: Suit }) {
  const color = redSuits.has(suit) ? "#bd4548" : "#244a3b";
  const ornament = rank === "K" ? "♛" : rank === "Q" ? "✦" : "⚔";

  return (
    <svg aria-hidden="true" className="court-art" viewBox="0 0 64 88">
      <rect x="2" y="2" width="60" height="84" rx="8" fill="#f8f3e8" stroke={color} strokeOpacity=".62" strokeWidth="1.5" />
      <path d="M7 43h50M32 7v74" stroke={color} strokeOpacity=".2" strokeWidth="1" />
      <g fill={color} opacity=".12">
        <path d="M7 10h15v15H7zM42 63h15v15H42z" />
      </g>
      <g transform="translate(0 0)">
        <path d="M15 34 20 19l12 9 12-9 5 15v28H15V34Z" fill={color} fillOpacity=".15" stroke={color} strokeWidth="1.5" />
        <circle cx="32" cy="39" r="9" fill="#fffdf7" stroke={color} strokeWidth="1.5" />
        <path d="M24 57c1-7 4-10 8-10s7 3 8 10" fill={color} fillOpacity=".22" stroke={color} strokeWidth="1.5" />
        <text x="32" y="42" fill={color} fontFamily="Georgia, serif" fontSize="11" fontWeight="700" textAnchor="middle">{rank}</text>
        <text x="32" y="74" fill={color} fontFamily="serif" fontSize="13" textAnchor="middle">{ornament}</text>
      </g>
      <g transform="rotate(180 32 44)" opacity=".72">
        <path d="M15 34 20 19l12 9 12-9 5 15v28H15V34Z" fill={color} fillOpacity=".12" stroke={color} strokeWidth="1.3" />
        <circle cx="32" cy="39" r="9" fill="#fffdf7" stroke={color} strokeWidth="1.3" />
        <path d="M24 57c1-7 4-10 8-10s7 3 8 10" fill={color} fillOpacity=".22" stroke={color} strokeWidth="1.3" />
        <text x="32" y="42" fill={color} fontFamily="Georgia, serif" fontSize="11" fontWeight="700" textAnchor="middle">{rank}</text>
      </g>
      <circle cx="8" cy="8" r="1.5" fill={color} />
      <circle cx="56" cy="80" r="1.5" fill={color} />
    </svg>
  );
}

function CardFace({ rank, suit }: { rank: Rank; suit: Suit }) {
  const pips = pipLayouts[rank];
  const isCourt = rank === "J" || rank === "Q" || rank === "K";

  return (
    <>
      <CornerIndex rank={rank} suit={suit} />
      <CornerIndex flipped rank={rank} suit={suit} />
      {rank === "A" ? (
        <span className="card-ace">
          <SuitIcon className="card-ace-suit" suit={suit} />
          <span>A</span>
        </span>
      ) : null}
      {isCourt ? <CourtArt rank={rank} suit={suit} /> : null}
      {pips ? (
        <span className="card-pips">
          {pips.map((pip, index) => (
            <span
              className="card-pip-position"
              key={`${pip.x}-${pip.y}-${index}`}
              style={{ left: `${pip.x}%`, top: `${pip.y}%` }}
            >
              <SuitIcon className={cn("card-pip", pip.flip && "card-pip-flipped")} suit={suit} />
            </span>
          ))}
        </span>
      ) : null}
    </>
  );
}

export function PlayingCard({
  rank,
  suit,
  className,
  faceDown = false,
  width = 112,
  selected = false,
  muted = false,
  disabled = false,
  onClick,
  label,
}: PlayingCardProps) {
  const isRed = redSuits.has(suit);
  const style = { width, fontSize: width / 14 } as CSSProperties;
  const classes = cn(
    "playing-card",
    !faceDown && (isRed ? "card-red" : "card-black"),
    faceDown && "card-facedown",
    selected && "card-selected",
    muted && "card-muted",
    onClick && "card-clickable",
    className,
  );
  const content = faceDown ? <span className="card-back-pattern" /> : <CardFace rank={rank} suit={suit} />;

  if (onClick) {
    return (
      <button
        aria-label={label ?? (faceDown ? "کارت پشت‌ورو" : `${rank} ${suit}`)}
        className={classes}
        disabled={disabled}
        onClick={onClick}
        style={style}
        type="button"
      >
        {content}
      </button>
    );
  }

  return (
    <div aria-hidden="true" className={classes} style={style}>
      {content}
    </div>
  );
}
