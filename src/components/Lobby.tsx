import { useCallback, useEffect, useState } from 'react';

import { GameCard } from './GameCard';
import { api, shareUrl } from '@/helpers/telegram';
import { toPersianDigits } from '@/lib/hokm';
import type { GameSummary } from '@/lib/types';

export function Lobby({ onOpenGame }: { onOpenGame: (gameId: string) => void }) {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [miniAppUrl, setMiniAppUrl] = useState<string | null>(null);
  const [room, setRoom] = useState<{ code: string; link: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const lobby = await api.lobby();
      setGames(lobby.games ?? []);
      setBotUsername(lobby.botUsername ?? null);
      setMiniAppUrl(lobby.miniAppUrl ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ارتباط با سرور برقرار نشد');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'خطایی رخ داد');
    } finally {
      setBusy(false);
    }
  };

  const createSolo = () =>
    run(async () => {
      const response = await api.createGame('solo');
      onOpenGame(response.game.id);
    });

  const createRoom = () =>
    run(async () => {
      const response = await api.createGame('room');
      const base = miniAppUrl ?? (botUsername ? `https://t.me/${botUsername}` : '');
      const link = base ? `${base}?startapp=join_${response.game.id}` : '';
      setRoom({ code: response.game.id, link });
      await refresh();
    });

  const join = (value: string) =>
    run(async () => {
      const response = await api.joinGame(value.trim().toUpperCase());
      onOpenGame(response.game.id);
    });

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col gap-4 px-4 pb-8 pt-6">
      <header className="flex flex-col items-center gap-3">
        <div className="flex items-end gap-1">
          {['KS', 'QH', 'AD'].map((card, index) => (
            <span key={card} style={{ transform: `rotate(${(index - 1) * 12}deg) translateY(${Math.abs(index - 1) * 6}px)` }}>
              <GameCard card={card} width={54} />
            </span>
          ))}
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-black tracking-tight text-gold-200">خوکم</h1>
          <p className="mt-1 text-[13px] text-white/65">بازی ایرانی چهار نفره — سوت بزن، ترک ببر</p>
        </div>
      </header>

      {error ? (
        <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-center text-xs text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <button type="button" className="btn btn-primary w-full !py-3.5 text-base" disabled={busy} onClick={createSolo}>
          🎮 بازی سریع با سه ربات
        </button>

        <button type="button" className="btn btn-ghost w-full !py-3" disabled={busy} onClick={createRoom}>
          🪑 ساخت میز خصوصی و دعوت از دوستان
        </button>
      </div>

      {room ? (
        <div className="panel animate-fade-up p-4 text-center">
          <p className="text-xs text-white/70">کد میز شما</p>
          <p className="my-1 text-3xl font-black tracking-[0.2em] text-gold-200">{room.code}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="btn btn-primary flex-1 !py-2.5 text-sm"
              onClick={() => shareUrl(room.link, 'بیا خوکم بازی کنیم! 🎴')}
              disabled={!room.link}
            >
              📤 دعوت از دوستان
            </button>
            <button
              type="button"
              className="btn btn-ghost !py-2.5 text-sm"
              onClick={() => void navigator.clipboard?.writeText(room.code)}
            >
              کپی کد
            </button>
          </div>
        </div>
      ) : null}

      <div className="panel p-3">
        <p className="mb-2 text-center text-xs text-white/70">با کد میز دوستانتان وارد شوید</p>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && code.trim().length >= 4) void join(code);
            }}
            placeholder="کد میز"
            inputMode="text"
            maxLength={8}
            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/25 px-3 py-2.5 text-center text-base font-bold tracking-widest text-white outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-white/35 focus:border-amber-300/60"
          />
          <button
            type="button"
            className="btn btn-ghost !px-4"
            disabled={busy || code.trim().length < 4}
            onClick={() => void join(code)}
          >
            ورود
          </button>
        </div>
      </div>

      {games.length ? (
        <div className="panel p-3">
          <p className="mb-2 px-1 text-xs text-white/70">بازی‌های فعال شما</p>
          <div className="flex flex-col gap-1.5">
            {games.map((game) => (
              <button
                key={game.id}
                type="button"
                className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2.5 text-right transition hover:bg-black/35"
                onClick={() => onOpenGame(game.id)}
              >
                <span className="text-sm">میز {game.id}</span>
                <span className="text-[11px] text-white/55">
                  {game.status === 'waiting'
                    ? 'در انتظار بازیکن'
                    : game.status === 'trump'
                      ? 'انتخاب خوکم'
                      : game.status === 'finished'
                        ? 'پایان‌یافته'
                        : 'در حال بازی'}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <footer className="mt-auto pt-2 text-center text-[11px] leading-5 text-white/40">
        ۴ بازیکن • ۱۳ ترک • خوکم = آس سوت
        {botUsername ? (
          <>
            {' • '}
            <span dir="ltr">@{botUsername}</span>
          </>
        ) : null}
        <br />
        {toPersianDigits('13')} ترک، برنده‌ی هر ترک، شروع‌کننده‌ی ترک بعدی
      </footer>
    </div>
  );
}
