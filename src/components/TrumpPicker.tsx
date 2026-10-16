import { SUIT_NAME, SUIT_SYMBOL, type Suit } from '@/lib/hokm';

const SUITS: Suit[] = ['S', 'H', 'D', 'C'];

export function TrumpPicker({
  onPick,
  onClose,
}: {
  onPick: (suit: Suit) => void;
  onClose?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">
      <div className="panel animate-pop w-full max-w-sm p-5 text-center">
        <h2 className="text-lg font-extrabold text-gold-200">خوکم (سوت) را انتخاب کنید</h2>
        <p className="mt-1 text-xs leading-5 text-white/70">
          سوتی که انتخاب می‌کنید، بزرگ‌ترین کارت بازی است. آس آن سوت، «کارت خوکم» می‌شود.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {SUITS.map((suit) => (
            <button
              key={suit}
              type="button"
              className="btn btn-ghost flex-col !gap-0.5 !py-3"
              onClick={() => onPick(suit)}
            >
              <span
                className={`text-3xl leading-none ${
                  suit === 'H' || suit === 'D' ? 'text-rose-400' : 'text-slate-200'
                }`}
              >
                {SUIT_SYMBOL[suit]}
              </span>
              <span className="text-sm">{SUIT_NAME[suit]}</span>
            </button>
          ))}
        </div>

        {onClose ? (
          <button type="button" className="btn btn-ghost mt-4 w-full" onClick={onClose}>
            انصراف
          </button>
        ) : null}
      </div>
    </div>
  );
}
