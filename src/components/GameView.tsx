import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { HandBar } from './HandBar';
import { ResultOverlay } from './ResultOverlay';
import { RulesSheet } from './RulesSheet';
import { SeatPanel } from './SeatPanel';
import { TrickArea } from './TrickArea';
import { TrumpPicker } from './TrumpPicker';
import { api, haptic, shareUrl } from '@/helpers/telegram';
import {
  cardName,
  illegalReason,
  legalCards,
  SUIT_NAME,
  SUIT_SYMBOL,
  toPersianDigits,
  type Suit,
} from '@/lib/hokm';
import type { GameResponse } from '@/lib/types';

export function GameView({
  gameId,
  onExit,
  onOpenGame,
}: {
  gameId: string;
  onExit: () => void;
  onOpenGame: (gameId: string) => void;
}) {
  const [data, setData] = useState<GameResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setBusy(true);
      try {
        const response = await api.getGame(gameId);
        if (!mounted.current) return;
        setData(response);
        setError(null);
      } catch (cause) {
        if (!mounted.current) return;
        setError(cause instanceof Error ? cause.message : 'ارتباط با سرور برقرار نشد');
      } finally {
        if (mounted.current && !silent) setBusy(false);
      }
    },
    [gameId],
  );

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const game = data?.game ?? null;
  const you = data?.you ?? null;
  const viewerSeat = you?.seat ?? -1;
  const yourTurn = Boolean(game && you && game.status === 'playing' && game.turn === you.seat);
  const waitingForBot = Boolean(game && game.status === 'playing' && !yourTurn && game.seats[game.turn]?.type === 'bot');

  // Poll while the opponent has to move, so the table stays up to date.
  useEffect(() => {
    if (!game || game.status === 'finished' || yourTurn) return;
    const timer = window.setInterval(() => void load(true), 3000);
    return () => window.clearInterval(timer);
  }, [game, yourTurn, load]);

  // Refresh when the app comes back to the foreground.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const legal = useMemo(() => {
    if (!game) return new Set<string>();
    return new Set(legalCards(game.hand, game.trick, game.trump));
  }, [game]);

  const selectCard = (card: string) => {
    if (!game || !yourTurn || busy) return;
    if (selected === card) {
      void play(card);
      return;
    }
    if (!legal.has(card)) {
      const reason = illegalReason(card, game.trick, game.trump, game.hand);
      setNotice(reason ? `${reason} — ${cardName(card)}` : 'این کارت در این وضعیت قابل بازی نیست');
      haptic('error');
      return;
    }
    setSelected(card);
    setNotice(null);
    haptic('select');
  };

  const play = async (card: string) => {
    if (!game || busy) return;
    setBusy(true);
    try {
      const response = await api.playCard(game.id, card);
      if (!mounted.current) return;
      setData(response);
      setSelected(null);
      setNotice(null);
      haptic('success');
    } catch (cause) {
      if (!mounted.current) return;
      setError(cause instanceof Error ? cause.message : 'بازی کارت ممکن نشد');
      haptic('error');
      void load(true);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const pickTrump = async (trump: Suit) => {
    if (!game || busy) return;
    setBusy(true);
    try {
      const response = await api.chooseTrump(game.id, trump);
      if (!mounted.current) return;
      setData(response);
      haptic('success');
    } catch (cause) {
      if (!mounted.current) return;
      setError(cause instanceof Error ? cause.message : 'انتخاب حکم ممکن نشد');
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const fillBots = async () => {
    if (!game || busy) return;
    setBusy(true);
    try {
      const response = await api.fillBots(game.id);
      if (!mounted.current) return;
      setData(response);
    } catch (cause) {
      if (!mounted.current) return;
      setError(cause instanceof Error ? cause.message : 'شروع بازی ممکن نشد');
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  if (!game || !you) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        {error ? (
          <>
            <p className="text-sm text-rose-200">{error}</p>
            <button type="button" className="btn btn-primary" onClick={() => void load()}>
              تلاش دوباره
            </button>
            <button type="button" className="btn btn-ghost" onClick={onExit}>
              بازگشت
            </button>
          </>
        ) : (
          <p className="text-sm text-white/60">در حال آماده‌سازی میز…</p>
        )}
      </div>
    );
  }

  const seatAt = (relative: number) => (viewerSeat + relative + 4) % 4;
  const partnerSeat = seatAt(2);
  const leftSeat = seatAt(3);
  const rightSeat = seatAt(1);

  const lastTrick = game.tricks.length ? game.tricks[game.tricks.length - 1] : null;
  const shareLink = data?.shareLink ?? '';

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <header className="flex items-center gap-2 border-b border-white/10 bg-black/25 px-3 py-2.5">
        <button type="button" className="btn btn-ghost !px-2.5 !py-1.5 text-xs" onClick={onExit}>
          ‹
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-white/50">میز</span>
            <button
              type="button"
              className="text-sm font-black tracking-widest text-gold-200"
              onClick={() => void navigator.clipboard?.writeText(game.id)}
            >
              {game.id}
            </button>
            {game.trump ? (
              <span className="rounded-full bg-black/30 px-2 py-0.5 text-[11px] text-white/80">
                حکم: {SUIT_SYMBOL[game.trump]} {SUIT_NAME[game.trump]}
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-xs text-white/60">
            دست {toPersianDigits(String(game.trickNo))} از ۱۳ • دست‌ها {toPersianDigits(String(game.teamTricks[0]))} -{' '}
            {toPersianDigits(String(game.teamTricks[1]))} • امتیاز {toPersianDigits(String(game.teamPoints[0]))} -{' '}
            {toPersianDigits(String(game.teamPoints[1]))}
          </div>
        </div>

        <button type="button" className="btn btn-ghost !px-2.5 !py-1.5 text-xs" onClick={() => setShowRules(true)}>
          قوانین
        </button>

        {you.seat >= 0 ? (
          <button
            type="button"
            className="btn btn-ghost !px-2.5 !py-1.5 text-xs"
            onClick={() => {
              if (!window.confirm('از این میز خارج می‌شوید؟')) return;
              void api
                .leaveGame(game.id)
                .catch(() => undefined)
                .finally(() => onExit());
            }}
          >
            خروج
          </button>
        ) : null}
      </header>

      {/* the table */}
      <div className="felt relative flex-1 overflow-hidden">
        <div className="absolute inset-x-0 top-1 flex justify-center">
          <SeatPanel
            active={game.turn === partnerSeat && game.status === 'playing'}
            cards={game.handCounts[partnerSeat]}
            name={game.seats[partnerSeat]?.name ?? ''}
            seat={partnerSeat}
            sub={game.declarer === partnerSeat ? 'حاکم' : 'هم‌تیمی'}
            type={game.seats[partnerSeat]?.type ?? 'empty'}
          />
        </div>

        <div className="absolute left-1 top-1/2 -translate-y-1/2">
          <SeatPanel
            active={game.turn === leftSeat && game.status === 'playing'}
            cards={game.handCounts[leftSeat]}
            name={game.seats[leftSeat]?.name ?? ''}
            seat={leftSeat}
            type={game.seats[leftSeat]?.type ?? 'empty'}
          />
        </div>

        <div className="absolute right-1 top-1/2 -translate-y-1/2">
          <SeatPanel
            active={game.turn === rightSeat && game.status === 'playing'}
            cards={game.handCounts[rightSeat]}
            name={game.seats[rightSeat]?.name ?? ''}
            seat={rightSeat}
            type={game.seats[rightSeat]?.type ?? 'empty'}
          />
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <TrickArea trick={game.trick} viewerSeat={viewerSeat} />
          {lastTrick ? (
            <span className="rounded-full bg-black/40 px-2.5 py-1 text-[11px] text-white/70">
              دست {toPersianDigits(String(game.tricks.length))}: {game.seats[lastTrick.winner]?.name ?? ''}
            </span>
          ) : null}
        </div>

        {game.status === 'waiting' ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/55 p-6 backdrop-blur-sm">
            <div className="panel w-full max-w-xs p-5 text-center">
              <h2 className="text-base font-extrabold text-gold-200">در انتظار بازیکن</h2>
              <p className="mt-2 text-xs leading-6 text-white/70">
                کد میز <span className="font-black tracking-widest text-gold-100">{game.id}</span> را برای دوستانتان
                بفرستید تا به میز بپیوندند.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() =>
                    shareUrl(
                      shareLink || `https://t.me/share/url?url=&text=${encodeURIComponent(`میز حکم: ${game.id}`)}`,
                      `میز حکم: ${game.id}`,
                    )
                  }
                >
                  📤 دعوت از دوستان
                </button>
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void fillBots()}>
                  شروع با ربات‌ها
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {waitingForBot ? (
          <div className="absolute inset-x-0 bottom-2 flex justify-center">
            <span className="rounded-full bg-black/45 px-3 py-1 text-[11px] text-white/75">ربات در حال بازی است…</span>
          </div>
        ) : null}
      </div>

      {/* the hand */}
      <footer className="border-t border-white/10 bg-black/35 px-2 pt-2 pb-2.5">
        {error ? (
          <p className="mx-2 mb-1 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2 py-1 text-center text-[11px] text-rose-200">
            {error}
          </p>
        ) : null}

        {notice ? (
          <p className="mx-2 mb-1 rounded-lg border border-amber-300/30 bg-amber-400/10 px-2 py-1 text-center text-[11px] text-amber-100">
            {notice}
          </p>
        ) : null}

        {game.status === 'playing' ? (
          <div className="flex items-end justify-center gap-2">
            <div className="min-w-0 flex-1">
              <HandBar
                cards={game.hand}
                disabled={!yourTurn || busy}
                legal={legal}
                onSelect={selectCard}
                selected={selected}
              />
            </div>
          </div>
        ) : null}

        {game.status === 'playing' ? (
          <div className="mt-3 flex items-center justify-center gap-4">
            <span className="text-xs text-white/60">
              {selected ? (
                <span className="font-bold text-gold-200">{cardName(selected)}</span>
              ) : yourTurn ? (
                'کارت را انتخاب کنید'
              ) : (
                'نوبت شما نیست…'
              )}
            </span>
            <button
              type="button"
              className="btn btn-primary !px-7 !py-2.5 text-sm"
              disabled={!selected || !yourTurn || busy}
              onClick={() => selected && void play(selected)}
            >
              بازی کارت
            </button>
          </div>
        ) : null}
      </footer>

      {game.status === 'trump' && you.seat === game.declarer ? (
        <TrumpPicker hand={game.hand} onPick={(suit) => void pickTrump(suit)} />
      ) : null}

      {game.status === 'trump' && you.seat !== game.declarer ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="panel p-6 text-center text-sm text-white/85">
            <div className="mb-2 text-3xl">⏳</div>
            حاکم در حال انتخاب حکم است…
          </div>
        </div>
      ) : null}

      {game.status === 'finished' && game.result ? (
        <ResultOverlay
          onExit={onExit}
          onAgain={() => {
            void api
              .createGame(game.mode)
              .then((response) => onOpenGame(response.game.id))
              .catch(() => onExit());
          }}
          result={game.result}
          you={you}
        />
      ) : null}

      {showRules ? <RulesSheet onClose={() => setShowRules(false)} /> : null}
    </div>
  );
}
