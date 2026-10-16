import { toPersianDigits } from '@/lib/hokm';
import type { GameResult, ViewerInfo } from '@/lib/types';

export function ResultOverlay({
  onAgain,
  onExit,
  result,
  you,
}: {
  onAgain: () => void;
  onExit: () => void;
  result: GameResult;
  you: ViewerInfo;
}) {
  const won = you.team >= 0 && result.winner === you.team;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm">
      <div className="panel animate-pop w-full max-w-sm overflow-hidden text-center">
        <div
          className={`px-5 py-6 ${
            won
              ? 'bg-gradient-to-b from-amber-400/25 to-transparent'
              : 'bg-gradient-to-b from-rose-500/20 to-transparent'
          }`}
        >
          <div className="text-5xl">{won ? '🏆' : '😔'}</div>
          <h2 className="mt-2 text-xl font-extrabold text-gold-100">
            {won ? 'دست شما بود!' : 'این دست را باختید'}
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/80">{result.reason}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 px-5 pb-4 text-sm">
          <div className="rounded-xl bg-black/25 p-3">
            <div className="text-xs text-white/60">ترک‌ها</div>
            <div className="mt-1 font-extrabold text-gold-200">
              {toPersianDigits(String(result.teamTricks[0]))} - {toPersianDigits(String(result.teamTricks[1]))}
            </div>
          </div>
          <div className="rounded-xl bg-black/25 p-3">
            <div className="text-xs text-white/60">امتیاز کارت‌ها</div>
            <div className="mt-1 font-extrabold text-gold-200">
              {toPersianDigits(String(result.teamPoints[0]))} - {toPersianDigits(String(result.teamPoints[1]))}
            </div>
          </div>
        </div>

        {result.hokmBonus ? (
          <p className="px-5 pb-3 text-xs text-amber-200/90">
            کارت خوکم (آس سوت) دست تیم مقابل افتاد و دست به آن‌ها رسید.
          </p>
        ) : null}

        {result.sweep ? (
          <p className="px-5 pb-3 text-xs text-amber-200/90">
            یک تیم هر ۱۳ ترک را گرفت؛ طبق قانون، بازی به تیم دیگر رسید.
          </p>
        ) : null}

        <div className="flex gap-2 px-5 pb-5">
          <button type="button" className="btn btn-primary flex-1" onClick={onAgain}>
            بازی دوباره
          </button>
          <button type="button" className="btn btn-ghost flex-1" onClick={onExit}>
            خروج
          </button>
        </div>
      </div>
    </div>
  );
}
