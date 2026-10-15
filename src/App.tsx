import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Check,
  CircleHelp,
  Crown,
  Hand,
  RotateCcw,
  Send,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { PlayingCard, SuitIcon } from "./components/PlayingCard";
import {
  canPlayCard,
  chooseAiCard,
  chooseTrumpForHand,
  createGame,
  gameReducer,
  legalCards,
  SUITS,
  teamForPlayer,
  type Card,
  type GameState,
  type PlayerId,
  type Suit,
  type TeamId,
} from "./game/engine";

type ModalName = "rules" | "stats" | "restart" | null;
type TelegramUser = { first_name?: string; last_name?: string; username?: string };

const SUIT_LABELS: Record<Suit, string> = {
  hearts: "دل",
  diamonds: "خشت",
  clubs: "خاج",
  spades: "پیک",
};
const PLAYER_NAMES = ["شما", "آرمان", "سارا", "مانی"] as const;
const TRICK_POSITIONS: Record<PlayerId, string> = {
  0: "bottom",
  1: "right",
  2: "top",
  3: "left",
};
const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(value);

function restoreGame(): GameState {
  try {
    const saved = localStorage.getItem("hokm-mini-app:game-v1");
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (isGameState(parsed)) return parsed;
    }
  } catch {
    // A private browsing session can disable localStorage; a fresh deal still works.
  }
  return createGame();
}

function isGameState(value: unknown): value is GameState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<GameState>;
  return (
    (state.phase === "chooseTrump" || state.phase === "playing" || state.phase === "handSummary") &&
    Array.isArray(state.hands) && state.hands.length === 4 && state.hands.every(Array.isArray) &&
    Array.isArray(state.tricks) && state.tricks.length === 2 &&
    Array.isArray(state.matchScore) && state.matchScore.length === 2 &&
    typeof state.turn === "number" && typeof state.dealer === "number" &&
    Array.isArray(state.trick) && typeof state.round === "number"
  );
}

function getPlayerName(player: PlayerId, userName: string): string {
  if (player === 0) return userName;
  if (player === 2) return "سارا · هم‌تیمی";
  return PLAYER_NAMES[player];
}

function getTeamName(team: TeamId): string {
  return team === 0 ? "تیم شما" : "حریف";
}

function App({ telegramUser }: { telegramUser?: TelegramUser }) {
  const [game, dispatch] = useReducer(gameReducer, undefined, restoreGame);
  const [modal, setModal] = useState<ModalName>(null);
  const [notice, setNotice] = useState("");
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem("hokm-mini-app:muted") === "true";
    } catch {
      return false;
    }
  });
  const toastTimer = useRef<number | undefined>(undefined);
  const audioContext = useRef<AudioContext | null>(null);

  const userName = telegramUser?.first_name?.trim() || "شما";
  const displayName = userName.length > 12 ? `${userName.slice(0, 11)}…` : userName;
  const userInitial = userName.slice(0, 1) || "ش";
  const userTeamLeading = game.matchScore[0] > game.matchScore[1];
  const opponentTeamLeading = game.matchScore[1] > game.matchScore[0];
  const legalCardIds = useMemo(() => new Set(legalCards(game.hands[0], game.trick).map((card) => card.id)), [game.hands, game.trick]);
  const isUserChoosing = game.phase === "chooseTrump" && game.chooser === 0;
  const isUserTurn = game.phase === "playing" && !game.settling && game.turn === 0;
  const playedTricks = game.tricks[0] + game.tricks[1];
  const currentTrickNumber = Math.min(13, playedTricks + (game.trick.length === 4 ? 0 : 1));
  const handCardCount = game.hands[0].length;
  const handOverlap = handCardCount >= 9 ? 0.52 : handCardCount >= 6 ? 0.24 : 0.08;
  const handCardWidth = Math.min(
    70,
    (Math.min(viewportWidth - 32, 860)) / Math.max(1, 1 + (handCardCount - 1) * (1 - handOverlap)),
  );

  useEffect(() => {
    try {
      localStorage.setItem("hokm-mini-app:game-v1", JSON.stringify(game));
    } catch {
      // Gameplay is still available if storage is full or disabled.
    }
  }, [game]);

  useEffect(() => {
    try {
      localStorage.setItem("hokm-mini-app:muted", String(muted));
    } catch {
      // Sound preference is optional.
    }
  }, [muted]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (game.phase === "chooseTrump" && game.chooser !== 0) {
      const player = game.chooser;
      const timer = window.setTimeout(() => {
        dispatch({ type: "CHOOSE_TRUMP", player, suit: chooseTrumpForHand(game.hands[player]) });
      }, 950);
      return () => window.clearTimeout(timer);
    }

    if (game.phase === "playing" && game.settling) {
      const timer = window.setTimeout(() => dispatch({ type: "COLLECT_TRICK" }), 1120);
      return () => window.clearTimeout(timer);
    }

    if (game.phase === "playing" && game.turn !== 0 && game.trump) {
      const player = game.turn;
      const card = chooseAiCard(game.hands[player], game.trick, game.trump, player);
      const timer = window.setTimeout(() => dispatch({ type: "PLAY_CARD", player, cardId: card.id }), 720);
      return () => window.clearTimeout(timer);
    }
  }, [game]);

  useEffect(() => () => {
    if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current);
  }, []);

  function playTapSound(frequency = 490) {
    if (muted) return;
    try {
      const AudioContextConstructor = window.AudioContext;
      if (!AudioContextConstructor) return;
      if (!audioContext.current) audioContext.current = new AudioContextConstructor();
      const context = audioContext.current;
      if (context.state === "suspended") void context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.035, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.095);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.1);
    } catch {
      // Audio is a small enhancement and must never block a move.
    }
  }

  function tell(message: string) {
    setNotice(message);
    if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setNotice(""), 2600);
  }

  function handleCardClick(card: Card) {
    if (!isUserTurn) return;
    if (!canPlayCard(game.hands[0], game.trick, card)) {
      const leadSuit = game.trick[0]?.card.suit;
      tell(leadSuit ? `باید از خال ${SUIT_LABELS[leadSuit]} بازی کنید.` : "این کارت در حال حاضر قابل بازی نیست.");
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("error");
      return;
    }
    playTapSound(410);
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
    dispatch({ type: "PLAY_CARD", player: 0, cardId: card.id });
  }

  function handleTrumpChoice(suit: Suit) {
    playTapSound(630);
    window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
    dispatch({ type: "CHOOSE_TRUMP", player: 0, suit });
  }

  function handleShare() {
    const title = "یک دست حکم؟";
    const text = "بیا یک دور حکم بزنیم؛ مینی‌اپ حکم را امتحان کن!";
    const url = `${window.location.origin}${window.location.pathname}`;
    if (navigator.share) {
      void navigator.share({ title, text, url }).catch(() => undefined);
      return;
    }
    const telegramShare = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    if (window.Telegram?.WebApp?.openTelegramLink) window.Telegram.WebApp.openTelegramLink(telegramShare);
    else window.open(telegramShare, "_blank", "noopener,noreferrer");
  }

  function statusText(): string {
    if (game.phase === "chooseTrump") {
      return game.chooser === 0 ? "شما حاکم هستید؛ خال حکم را انتخاب کنید" : `${getPlayerName(game.chooser, displayName)} در حال انتخاب حکم است…`;
    }
    if (game.phase === "handSummary" && game.roundResult) {
      return `${getTeamName(game.roundResult.winner)} برنده‌ی این دست شد`;
    }
    if (game.settling && game.trick.length === 4) return `${getTeamName(teamForPlayer(game.turn))} این دور را برد`;
    if (game.turn === 0) return "نوبت شماست؛ یک کارت بازی کنید";
    return `نوبت ${getPlayerName(game.turn, displayName)} است`;
  }

  return (
    <div className="app-shell">
      <div className="ambient-glow ambient-glow-one" />
      <div className="ambient-glow ambient-glow-two" />
      <header className="topbar">
        <div className="brand-lockup" aria-label="حکم">
          <div className="brand-mark"><span>♠</span><span>♦</span></div>
          <div className="brand-copy">
            <strong>حُکم</strong>
            <span>بازیِ دورهمی</span>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="icon-button" onClick={() => setMuted((value) => !value)} aria-label={muted ? "روشن کردن صدا" : "بی‌صدا کردن"} title={muted ? "روشن کردن صدا" : "بی‌صدا کردن"}>
            {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </button>
          <button className="icon-button" onClick={handleShare} aria-label="دعوت از دوستان" title="دعوت از دوستان">
            <Send size={18} />
          </button>
          <div className="topbar-divider" />
          <div className="profile-chip" title={telegramUser?.username ? `@${telegramUser.username}` : displayName}>
            <span className="profile-initial">{userInitial}</span>
            <span className="profile-name">{displayName}</span>
          </div>
        </div>
      </header>

      <main className="main-content">
        <section className="game-heading">
          <div className="heading-copy">
            <span className="eyebrow"><Sparkles size={13} /> میزِ بازی</span>
            <h1>یک دست <em>حُکم</em></h1>
          </div>
          <div className="online-pill"><span className="online-dot" /> بازیِ آفلاین با هوش مصنوعی</div>
        </section>

        <section className="scoreboard" aria-label="امتیاز مسابقه">
          <div className={`score-team score-team-user ${userTeamLeading ? "is-leading" : ""}`}>
            <div className="team-label-block">
              <span className="team-title">تیم شما</span>
              <span className="team-members">{displayName} <b>·</b> سارا</span>
            </div>
            <strong className="team-score">{fa(game.matchScore[0])}</strong>
          </div>
          <div className="score-divider">
            <span className="score-vs">:</span>
            <span className="score-caption">تا {fa(7)}</span>
          </div>
          <div className={`score-team score-team-opponent ${opponentTeamLeading ? "is-leading" : ""}`}>
            <strong className="team-score">{fa(game.matchScore[1])}</strong>
            <div className="team-label-block">
              <span className="team-title">حریف</span>
              <span className="team-members">آرمان <b>·</b> مانی</span>
            </div>
          </div>
          <div className="score-goal"><span>مسابقه تا</span><b>{fa(7)}</b></div>
        </section>

        <div className="round-strip">
          <span className="round-label"><Crown size={14} /> دستِ {fa(game.round)}</span>
          <span className="round-separator" />
          <span className="round-tricks"><Hand size={14} /> {fa(playedTricks)} دور از ۱۳</span>
          <div className="round-progress" aria-label={`${playedTricks} دور بازی شده`}>
            <span style={{ width: `${Math.min(100, (playedTricks / 13) * 100)}%` }} />
          </div>
          {game.trump ? (
            <span className={`trump-summary suit-${game.trump}`}>
              <SuitIcon suit={game.trump} /> حکمِ {SUIT_LABELS[game.trump]}
            </span>
          ) : <span className="trump-summary trump-unset"><Sparkles size={12} /> انتخاب حکم</span>}
        </div>

        <section className="table-section" aria-label="میز بازی حکم">
          <div className="felt-table">
            <div className="table-rim" />
            <div className="table-felt" />
            <div className="table-line table-line-one" />
            <div className="table-line table-line-two" />
            <div className="table-medallion" aria-hidden="true"><span>ح</span></div>

            <PlayerSeat
              player={1}
              position="right"
              name={getPlayerName(1, displayName)}
              count={game.hands[1].length}
              active={game.phase === "chooseTrump" ? game.chooser === 1 : game.phase === "playing" && game.turn === 1 && !game.settling}
              partner={false}
            />
            <PlayerSeat
              player={2}
              position="top"
              name={getPlayerName(2, displayName)}
              count={game.hands[2].length}
              active={game.phase === "chooseTrump" ? game.chooser === 2 : game.phase === "playing" && game.turn === 2 && !game.settling}
              partner
            />
            <PlayerSeat
              player={3}
              position="left"
              name={getPlayerName(3, displayName)}
              count={game.hands[3].length}
              active={game.phase === "chooseTrump" ? game.chooser === 3 : game.phase === "playing" && game.turn === 3 && !game.settling}
              partner={false}
            />

            <div className="table-center-copy">
              {game.trump ? (
                <span className={`table-trump suit-${game.trump}`}><SuitIcon suit={game.trump} /> {SUIT_LABELS[game.trump]}</span>
              ) : <span className="table-trump table-trump-wait"><Crown size={13} /> حکم</span>}
              <span className="table-trick-count">دور {fa(currentTrickNumber)} <i>/</i> ۱۳</span>
            </div>

            {game.trick.map((play) => (
              <div className={`played-card played-${TRICK_POSITIONS[play.player]}`} key={`${play.player}-${play.card.id}`}>
                <PlayingCard rank={play.card.rank} suit={play.card.suit} width={58} />
                <span className="played-player-name">{play.player === 0 ? "شما" : play.player === 2 ? "سارا" : ""}</span>
              </div>
            ))}

            {game.trick.length === 0 && (
              <div className={`center-prompt ${game.phase === "playing" && game.turn === 0 ? "prompt-human-turn" : ""}`}>
                <span className="prompt-icon">{game.phase === "chooseTrump" ? <Crown size={20} /> : game.phase === "handSummary" ? <Trophy size={20} /> : <Hand size={20} />}</span>
                <span className="prompt-title">{game.phase === "chooseTrump" ? "خالِ حکم را انتخاب کنید" : game.phase === "handSummary" ? "دست به پایان رسید" : game.turn === 0 ? "کارت شما" : "منتظر نوبت…"}</span>
                <span className="prompt-subtitle">{game.phase === "chooseTrump" && game.chooser === 0 ? "از پنج کارت اول کمک بگیرید" : game.phase === "playing" && game.turn === 0 ? "یک کارت از دست‌تان روی میز بگذارید" : ""}</span>
              </div>
            )}

            {game.settling && game.trick.length === 4 && (
              <div className="trick-winner-note"><Check size={13} /> {getTeamName(teamForPlayer(game.turn))} این دور را برد</div>
            )}
          </div>
        </section>

        <section className="player-panel" aria-label="کارت‌های شما">
          <div className="player-panel-heading">
            <div className="player-identity">
              <span className="player-avatar">{userInitial}</span>
              <span className="player-heading-copy"><b>{displayName}</b><small>تیمِ سارا</small></span>
              <span className="hand-count-pill">{fa(handCardCount)} کارت</span>
            </div>
            <div className={`turn-message ${isUserTurn || isUserChoosing ? "is-your-turn" : ""}`}>
              <span className="turn-pulse" />
              <span>{statusText()}</span>
            </div>
          </div>

          {isUserChoosing && (
            <div className="trump-picker">
              <div className="picker-copy">
                <strong>حکم را انتخاب کنید</strong>
                <span>خالِ حکم از بقیه‌ی خال‌ها قوی‌تر است.</span>
              </div>
              <div className="suit-options">
                {SUITS.map((suit) => {
                  const count = game.hands[0].filter((card) => card.suit === suit).length;
                  return (
                    <button className={`suit-choice suit-${suit}`} key={suit} onClick={() => handleTrumpChoice(suit)} type="button">
                      <SuitIcon suit={suit} />
                      <span>{SUIT_LABELS[suit]}</span>
                      <small>{fa(count)} کارت</small>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {game.phase === "chooseTrump" && game.chooser !== 0 && (
            <div className="ai-thinking"><span className="thinking-dots"><i /><i /><i /></span> حاکمِ دست در حال انتخاب خال حکم است</div>
          )}

          <div className="hand-caption">
            <span>{game.phase === "chooseTrump" ? "پنج کارت نخست" : "دستِ شما"}</span>
            {game.phase === "playing" && game.trick[0] && (
              <span className="follow-suit-hint">خالِ زمینه: <b className={`suit-text-${game.trick[0].card.suit}`}>{SUIT_LABELS[game.trick[0].card.suit]}</b></span>
            )}
            {isUserTurn && game.trick.length === 0 && <span className="play-hint">یک کارت را لمس کنید</span>}
          </div>
          <div className={`hand-row ${isUserTurn ? "hand-row-active" : ""}`} style={{ "--hand-overlap": `${handOverlap * 100}%` } as React.CSSProperties}>
            {game.hands[0].map((card, index) => {
              const canFollow = legalCardIds.has(card.id);
              const mutedCard = game.phase === "playing" && isUserTurn && !canFollow;
              return (
                <div className="hand-card-wrap" key={card.id} style={{ marginLeft: index === 0 ? 0 : `${-handCardWidth * handOverlap}px`, zIndex: index + 1 }}>
                  <PlayingCard
                    rank={card.rank}
                    suit={card.suit}
                    width={handCardWidth}
                    muted={mutedCard || (game.phase === "playing" && !isUserTurn)}
                    onClick={isUserTurn ? () => handleCardClick(card) : undefined}
                    label={`${card.rank} ${SUIT_LABELS[card.suit]}${canFollow ? "، قابل بازی" : ""}`}
                  />
                </div>
              );
            })}
            {game.hands[0].length === 0 && <span className="empty-hand">همه‌ی کارت‌ها بازی شده‌اند</span>}
          </div>
        </section>

        {notice && <div className="toast-notice" role="status"><span className="toast-dot" />{notice}</div>}

        <footer className="bottom-bar">
          <button className="bottom-action" onClick={() => setModal("rules")} type="button"><CircleHelp size={17} /><span>قوانین</span></button>
          <button className="bottom-action" onClick={() => setModal("stats")} type="button"><BarChart3 size={17} /><span>آمار دست</span></button>
          <button className="bottom-action bottom-action-restart" onClick={() => setModal("restart")} type="button"><RotateCcw size={16} /><span>شروع دوباره</span></button>
          <span className="bottom-credit">ساخته‌شده برای تلگرام <span>·</span> بدون نیاز به نصب</span>
        </footer>
      </main>

      {game.phase === "handSummary" && game.roundResult ? (
        <HandSummary game={game} onContinue={() => dispatch({ type: game.roundResult?.matchWon ? "NEW_MATCH" : "NEXT_ROUND" })} />
      ) : modal ? (
        <Dialog onClose={() => setModal(null)}>
          {modal === "rules" ? <RulesContent onClose={() => setModal(null)} /> : null}
          {modal === "stats" ? <StatsContent game={game} onClose={() => setModal(null)} /> : null}
          {modal === "restart" ? <RestartContent onCancel={() => setModal(null)} onRestart={() => { dispatch({ type: "NEW_MATCH" }); setModal(null); }} /> : null}
        </Dialog>
      ) : null}
    </div>
  );
}

function PlayerSeat({
  player,
  position,
  name,
  count,
  active,
  partner,
}: {
  player: PlayerId;
  position: "top" | "left" | "right";
  name: string;
  count: number;
  active: boolean;
  partner: boolean;
}) {
  return (
    <div className={`player-seat seat-${position} ${active ? "seat-active" : ""} ${partner ? "seat-partner" : ""}`}>
      <span className="seat-avatar">{player === 2 ? "س" : player === 1 ? "آ" : "م"}</span>
      <span className="seat-player-copy"><b>{name}</b><small>{partner ? "هم‌تیمی" : "حریف"}</small></span>
      <span className="seat-card-stack" aria-label={`${fa(count)} کارت پشت‌ورو`}>
        {count > 0 ? <><span className="mini-back mini-back-one" /><span className="mini-back mini-back-two" /><span className="mini-back mini-back-three" /></> : <Check size={13} />}
        <b>{fa(count)}</b>
      </span>
    </div>
  );
}

function Dialog({ children, onClose, showClose = true }: { children: React.ReactNode; onClose: () => void; showClose?: boolean }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section aria-modal="true" className="dialog-card" role="dialog">
        {showClose ? <button aria-label="بستن" className="dialog-close" onClick={onClose} type="button"><X size={18} /></button> : null}
        {children}
      </section>
    </div>
  );
}

function RulesContent({ onClose }: { onClose: () => void }) {
  const rules = [
    { num: "۱", title: "دو تیمِ دونفره", text: "شما و هم‌تیمی روبه‌رویتان هستید؛ دو بازیکن دیگر تیم حریف‌اند." },
    { num: "۲", title: "انتخاب حکم", text: "حاکم پس از دیدن پنج کارت، یک خال را حکم می‌کند. کارت‌های آن خال از خال‌های دیگر قوی‌ترند." },
    { num: "۳", title: "پیروی از خال", text: "اگر از خالِ زمینه کارت دارید، باید همان خال را بازی کنید. اگر ندارید، هر کارتی از جمله حکم مجاز است." },
    { num: "۴", title: "بردنِ دور", text: "بالاترین کارتِ خال زمینه برنده است؛ مگر آن‌که حکم بازی شود. آس بالاترین کارت است." },
    { num: "۵", title: "بردنِ دست", text: "اولین تیمی که ۷ دور ببرد، دست را می‌برد. بردِ بدون واگذاری دور (کُت) دو امتیاز دارد؛ مسابقه تا ۷ امتیاز است." },
  ];
  return (
    <>
      <div className="dialog-eyebrow"><CircleHelp size={15} /> راهنمای بازی</div>
      <h2 className="dialog-title">قوانینِ <em>حُکم</em></h2>
      <p className="dialog-intro">همه‌چیز آماده است؛ این پنج نکته برای شروع کافی‌ست.</p>
      <div className="rules-list">
        {rules.map((rule) => <div className="rule-row" key={rule.num}><span className="rule-number">{rule.num}</span><div><b>{rule.title}</b><p>{rule.text}</p></div></div>)}
      </div>
      <button className="primary-button dialog-primary" onClick={onClose} type="button">متوجه شدم <ArrowLeft size={17} /></button>
    </>
  );
}

function StatsContent({ game, onClose }: { game: GameState; onClose: () => void }) {
  const totalTricks = game.tricks[0] + game.tricks[1];
  return (
    <>
      <div className="dialog-eyebrow"><BarChart3 size={15} /> وضعیت مسابقه</div>
      <h2 className="dialog-title">آمارِ <em>دست</em></h2>
      <p className="dialog-intro">خلاصه‌ی بازی فعلی شما روی همین دستگاه.</p>
      <div className="stats-score-card">
        <div><span>تیم شما</span><b>{fa(game.matchScore[0])}</b></div>
        <span className="stats-colon">:</span>
        <div><span>حریف</span><b>{fa(game.matchScore[1])}</b></div>
      </div>
      <div className="stats-grid">
        <div className="stat-tile"><small>شماره‌ی دست</small><b>{fa(game.round)}</b></div>
        <div className="stat-tile"><small>دورهای برده‌شده</small><b>{fa(game.tricks[0])} <i>—</i> {fa(game.tricks[1])}</b></div>
        <div className="stat-tile"><small>دورهای بازی‌شده</small><b>{fa(totalTricks)} از ۱۳</b></div>
        <div className="stat-tile"><small>خالِ حکم</small><b>{game.trump ? SUIT_LABELS[game.trump] : "هنوز انتخاب نشده"}</b></div>
      </div>
      <p className="local-note"><span className="local-note-dot" /> این نسخه‌ی تک‌نفره است؛ دست‌ها به‌صورت محلی در مرورگر نگه‌داری می‌شوند.</p>
      <button className="secondary-button dialog-primary" onClick={onClose} type="button">بستن</button>
    </>
  );
}

function RestartContent({ onCancel, onRestart }: { onCancel: () => void; onRestart: () => void }) {
  return (
    <>
      <div className="dialog-eyebrow"><RotateCcw size={15} /> شروع دوباره</div>
      <h2 className="dialog-title">مسابقه‌ی تازه؟</h2>
      <p className="dialog-intro">امتیاز فعلی پاک می‌شود و یک دسته‌ی تازه پخش می‌کنیم. مطمئنی؟</p>
      <div className="dialog-actions">
        <button className="secondary-button" onClick={onCancel} type="button">ادامه‌ی بازی</button>
        <button className="primary-button danger-button" onClick={onRestart} type="button">شروع مسابقه‌ی تازه <RotateCcw size={16} /></button>
      </div>
    </>
  );
}

function HandSummary({ game, onContinue }: { game: GameState; onContinue: () => void }) {
  const result = game.roundResult!;
  const userWon = result.winner === 0;
  return (
    <Dialog onClose={() => undefined} showClose={false}>
      <div className={`result-emblem ${userWon ? "result-win" : "result-loss"}`}>
        {userWon ? <Trophy size={29} /> : <Sparkles size={27} />}
      </div>
      <div className="dialog-eyebrow result-eyebrow">دستِ {fa(game.round)} به پایان رسید</div>
      <h2 className="dialog-title result-title">{userWon ? "آفرین، بردید!" : "این دست برای حریف شد"}</h2>
      <p className="dialog-intro">{userWon ? "همکاریِ خوبی بود؛ یک دست دیگر بازی کنیم؟" : "هنوز فرصت جبران هست؛ مسابقه ادامه دارد."}</p>
      <div className="result-score-line">
        <div><span>تیم شما</span><b>{fa(result.tricks[0])}</b></div>
        <span className="result-score-separator">—</span>
        <div><span>حریف</span><b>{fa(result.tricks[1])}</b></div>
      </div>
      <div className={`result-bonus ${result.shutout ? "bonus-kot" : ""}`}>
        {result.shutout ? <Crown size={15} /> : <Check size={15} />}
        <span>{result.shutout ? "کُت! دو امتیاز برای برنده" : "یک امتیاز برای برنده"}</span>
      </div>
      {result.matchWon && <div className="match-winner-banner"><Trophy size={16} /> {userWon ? "شما قهرمان مسابقه شدید!" : "حریف مسابقه را برد."}</div>}
      <button className="primary-button dialog-primary" onClick={onContinue} type="button">
        {result.matchWon ? "شروع مسابقه‌ی جدید" : "دستِ بعدی"}<ArrowLeft size={17} />
      </button>
      <span className="next-score-note">امتیاز مسابقه: {fa(game.matchScore[0])} — {fa(game.matchScore[1])}</span>
    </Dialog>
  );
}

export default App;
