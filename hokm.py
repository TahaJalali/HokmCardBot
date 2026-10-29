# hokm.py
# ===========
# ربات بازی حکم (نسخه بهبودیافته و کامل)
# توسعه و پشتیبانی: @NamePlusUser
# کانال سورس‌ها و آپدیت‌ها: @BotSorce
# Requires: python-telegram-bot==20.7  (یا 21.x)
# Run:      python hokm.py
#
# ویژگی‌های نسخه بهبودیافته:
# - ساخت میز در گروه و اینلاین
# - تیم‌های ۲×۲، انتخاب حاکم، انتخاب حکم، پیگیری تریک و امتیاز
# - Persistence با PicklePersistence
# - پنل ادمین کامل (/admin): لیست میزها، بستن، برادکست، آمار
# - خروج از صندلی، لغو میز توسط سازنده
# - نمایش کارت‌های بازی‌شده در پیام میز
# - ویرایش پیام‌های خصوصی دست به جای اسپم
# - پایان بازی در رسیدن به SETS_TO_WIN ست
# - پاک‌سازی خودکار میزهای قدیمی
# - قوانین کامل‌تر حکم (فالو سوییت اجباری)
# - استفاده از config.py
# — @NamePlusUser | @BotSorce

from __future__ import annotations
import logging
import random
import string
import time
import secrets
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any

from telegram import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    InlineQueryResultArticle,
    InputTextMessageContent,
    Update,
    Message,
)
from telegram.ext import (
    Application,
    ApplicationBuilder,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    InlineQueryHandler,
    MessageHandler,
    PicklePersistence,
    filters,
)
from telegram.error import BadRequest, Forbidden, TelegramError

from config import (
    BOT_TOKEN,
    ADMINS,
    MAX_TABLES,
    STATE_FILE,
    MSG_CHUNK,
    SETS_TO_WIN,
    INACTIVE_TABLE_TIMEOUT,
    ENABLE_DM_HANDS,
    BOT_SIGNATURE,
)

# ---------- Logging ----------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
log = logging.getLogger("hokm-bot")

# ---------- Game Model ----------
SUITS = ["♠", "♥", "♦", "♣"]
RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]
RANK_VAL = {r: i for i, r in enumerate(RANKS)}

Card = Tuple[str, str]  # (rank, suit)


def make_deck() -> List[Card]:
    return [(r, s) for s in SUITS for r in RANKS]


def card_str(card: Card) -> str:
    r, s = card
    return f"{r}{s}"


def sort_hand(hand: List[Card], trump: Optional[str]) -> List[Card]:
    def key(c):
        r, s = c
        # حکم‌ها اول، بعد بقیه بر اساس خال و رتبه
        return (0 if trump and s == trump else 1, SUITS.index(s), RANK_VAL[r])

    return sorted(hand, key=key)


def hand_to_text(hand: List[Card], trump: Optional[str] = None) -> str:
    by_suit = {s: [] for s in SUITS}
    for c in hand:
        by_suit[c[1]].append(c)
    parts = []
    for s in SUITS:
        if by_suit[s]:
            sorted_cards = sort_hand(by_suit[s], trump)
            parts.append(s + ": " + " ".join(card_str(c) for c in sorted_cards))
    return "\n".join(parts) if parts else "—"


def plays_to_text(plays: Dict[int, Card], leader: int, players: List[Optional["Player"]]) -> str:
    """نمایش کارت‌های بازی‌شده در تریک فعلی به ترتیب نشستن."""
    if not plays:
        return "هنوز کارتی بازی نشده."
    lines = []
    for order in range(4):
        seat = (leader + order) % 4
        if seat in plays:
            name = players[seat].name if players[seat] else f"صندلی{seat+1}"
            lines.append(f"  {name}: {card_str(plays[seat])}")
    return "\n".join(lines)


@dataclass
class Player:
    user_id: int
    name: str


@dataclass
class TrickState:
    leader_index: int = 0
    lead_suit: Optional[str] = None
    plays: Dict[int, Card] = field(default_factory=dict)  # seat -> card


@dataclass
class Table:
    table_id: str
    chat_id: int
    message_id: int
    title: str
    creator_id: int = 0
    players: List[Optional[Player]] = field(default_factory=lambda: [None, None, None, None])
    teams: Dict[int, int] = field(default_factory=dict)  # seat -> team (0 or 1)
    hakem_seat: Optional[int] = None
    trump: Optional[str] = None
    deck: List[Card] = field(default_factory=list)
    hands: Dict[int, List[Card]] = field(default_factory=dict)  # seat -> cards
    turn_seat: Optional[int] = None
    trick: TrickState = field(default_factory=TrickState)
    score_hands: List[int] = field(default_factory=lambda: [0, 0])  # تریک‌های این دست
    score_sets: List[int] = field(default_factory=lambda: [0, 0])   # ست‌ها
    started: bool = False
    finished: bool = False
    winner_team: Optional[int] = None
    created_at: float = field(default_factory=time.time)
    last_activity: float = field(default_factory=time.time)
    # برای ویرایش پیام‌های خصوصی دست به جای ارسال مکرر
    last_dm_msg: Dict[int, int] = field(default_factory=dict)  # user_id -> message_id

    def touch(self):
        self.last_activity = time.time()

    def seats_filled(self) -> int:
        return sum(1 for p in self.players if p)

    def is_full(self) -> bool:
        return self.seats_filled() == 4

    def seat_of(self, user_id: int) -> Optional[int]:
        for i, p in enumerate(self.players):
            if p and p.user_id == user_id:
                return i
        return None

    def teammate_seat(self, seat: int) -> int:
        return (seat + 2) % 4

    def next_seat(self, seat: int) -> int:
        return (seat + 1) % 4

    def ensure_team_mapping(self):
        # تیم ۱: صندلی‌های ۱ و ۳ (ایندکس ۰ و ۲)
        # تیم ۲: صندلی‌های ۲ و ۴ (ایندکس ۱ و ۳)
        self.teams = {0: 0, 2: 0, 1: 1, 3: 1}

    def team_names(self) -> Tuple[str, str]:
        """نام اعضای هر تیم."""
        t1 = []
        t2 = []
        for seat, team in self.teams.items():
            p = self.players[seat]
            if p:
                if team == 0:
                    t1.append(p.name)
                else:
                    t2.append(p.name)
        return (" و ".join(t1) or "تیم۱", " و ".join(t2) or "تیم۲")

    def start_hand(self):
        """شروع یک دست جدید: ۵ کارت به حاکم، بقیه بعد از انتخاب حکم."""
        self.score_hands = [0, 0]
        self.trick = TrickState(leader_index=self.hakem_seat or 0)
        self.trump = None
        self.deck = make_deck()
        random.shuffle(self.deck)
        self.hands = {seat: [] for seat in range(4)}
        # فقط ۵ کارت اولیه به حاکم
        for _ in range(5):
            if self.deck:
                self.hands[self.hakem_seat].append(self.deck.pop())
        self.turn_seat = self.hakem_seat
        self.touch()

    def set_trump(self, suit: str):
        """انتخاب حکم و توزیع بقیه کارت‌ها (هر نفر تا ۱۳)."""
        self.trump = suit
        # توزیع باقی‌مانده تا هر نفر ۱۳ کارت داشته باشد
        while any(len(h) < 13 for h in self.hands.values()) and self.deck:
            for seat in range(4):
                if len(self.hands[seat]) < 13 and self.deck:
                    self.hands[seat].append(self.deck.pop())
        for seat in range(4):
            self.hands[seat] = sort_hand(self.hands[seat], self.trump)
        self.trick = TrickState(leader_index=self.hakem_seat)
        self.turn_seat = self.hakem_seat
        self.touch()

    def legal_moves(self, seat: int) -> List[Card]:
        hand = self.hands.get(seat, [])
        if self.trick.lead_suit is None:
            return hand[:]
        follow = [c for c in hand if c[1] == self.trick.lead_suit]
        return follow if follow else hand[:]

    def play_card(self, seat: int, card: Card) -> Optional[str]:
        """بازی یک کارت. در صورت پایان دست یا بازی، پیام مناسب برمی‌گرداند."""
        if self.finished:
            return "بازی تمام شده است."
        if seat != self.turn_seat:
            return "نوبت شما نیست."
        if card not in self.hands.get(seat, []):
            return "این کارت در دست شما نیست."
        legal = self.legal_moves(seat)
        if card not in legal:
            return "باید از خال شروع‌شده پیروی کنید (فالو سوییت)."
        self.hands[seat].remove(card)
        self.trick.plays[seat] = card
        if self.trick.lead_suit is None:
            self.trick.lead_suit = card[1]
        self.turn_seat = self.next_seat(seat)
        self.touch()

        if len(self.trick.plays) == 4:
            winner = self.determine_trick_winner()
            team = self.teams[winner]
            self.score_hands[team] += 1
            self.trick = TrickState(leader_index=winner)
            self.turn_seat = winner

            if sum(self.score_hands) == 13:
                # پایان دست
                if self.score_hands[0] > self.score_hands[1]:
                    self.score_sets[0] += 1
                    hand_winner_team = 0
                else:
                    self.score_sets[1] += 1
                    hand_winner_team = 1

                # بررسی پایان کل بازی
                if self.score_sets[0] >= SETS_TO_WIN or self.score_sets[1] >= SETS_TO_WIN:
                    self.finished = True
                    self.winner_team = 0 if self.score_sets[0] >= SETS_TO_WIN else 1
                    t1, t2 = self.team_names()
                    winner_name = t1 if self.winner_team == 0 else t2
                    return (
                        f"🏁 بازی تمام شد!\n"
                        f"تیم برنده: {winner_name}\n"
                        f"امتیاز نهایی ست‌ها: {self.score_sets[0]} – {self.score_sets[1]}"
                    )

                # حاکم بعدی = برنده آخرین تریک (ساده و رایج)
                self.hakem_seat = winner
                self.start_hand()
                return (
                    f"✅ دست تمام شد! تیم {hand_winner_team + 1} این دست را برد "
                    f"({self.score_hands[0] if hand_winner_team == 0 else self.score_hands[1]} تریک).\n"
                    f"امتیاز ست‌ها: {self.score_sets[0]} – {self.score_sets[1]}\n"
                    f"حاکم جدید: صندلی {self.hakem_seat + 1}"
                )
        return None

    def determine_trick_winner(self) -> int:
        lead = self.trick.lead_suit
        plays = self.trick.plays
        assert lead is not None and self.trump is not None
        best_seat = None
        best_card = None
        for seat_order in range(4):
            seat = (self.trick.leader_index + seat_order) % 4
            card = plays[seat]
            if best_card is None:
                best_card, best_seat = card, seat
                continue
            # حکم برتر از غیرحکم
            if card[1] == self.trump and best_card[1] != self.trump:
                best_card, best_seat = card, seat
            elif card[1] == self.trump and best_card[1] == self.trump:
                if RANK_VAL[card[0]] > RANK_VAL[best_card[0]]:
                    best_card, best_seat = card, seat
            elif best_card[1] != self.trump:
                # هر دو غیرحکم: فقط خال شروع‌شده مهم است
                if card[1] == lead and best_card[1] == lead:
                    if RANK_VAL[card[0]] > RANK_VAL[best_card[0]]:
                        best_card, best_seat = card, seat
                elif card[1] == lead and best_card[1] != lead:
                    best_card, best_seat = card, seat
        return best_seat


# ---------- Persistence & Registry ----------
# مدیریت میزها و آمار | @NamePlusUser | @BotSorce
class Registry:
    def __init__(self):
        self.tables: Dict[str, Table] = {}
        self.stats: Dict[str, Any] = {
            "games_started": 0,
            "games_finished": 0,
            "total_tables_created": 0,
        }


REGISTRY_KEY = "registry"


def get_registry(context: ContextTypes.DEFAULT_TYPE) -> Registry:
    reg = context.application.bot_data.get(REGISTRY_KEY)
    if not reg:
        reg = Registry()
        context.application.bot_data[REGISTRY_KEY] = reg
    return reg


def gen_id(k: int = 6) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(k))


# ---------- UI Helpers ----------

def table_inline_keyboard(t: Table) -> InlineKeyboardMarkup:
    rows = []
    if not t.started and not t.finished:
        join_buttons = []
        for i in range(4):
            p = t.players[i]
            label = f"صندلی {i + 1} {'✅ ' + (p.name[:8] if p else '') if p else '➕'}"
            join_buttons.append(
                InlineKeyboardButton(label, callback_data=f"join|{t.table_id}|{i}")
            )
        rows.append(join_buttons[0:2])
        rows.append(join_buttons[2:4])
        rows.append([
            InlineKeyboardButton("شروع بازی ▶️", callback_data=f"start|{t.table_id}"),
            InlineKeyboardButton("خروج از صندلی 🚪", callback_data=f"leave|{t.table_id}"),
        ])
        rows.append([
            InlineKeyboardButton("لغو میز ❌", callback_data=f"cancel|{t.table_id}"),
        ])
    elif t.started and t.trump is None and t.hakem_seat is not None and not t.finished:
        # فقط حاکم می‌تواند حکم انتخاب کند (دکمه‌ها برای همه نمایش داده می‌شود ولی چک می‌شود)
        rows.append([
            InlineKeyboardButton("♠ حکم", callback_data=f"trump|{t.table_id}|♠"),
            InlineKeyboardButton("♥ حکم", callback_data=f"trump|{t.table_id}|♥"),
            InlineKeyboardButton("♦ حکم", callback_data=f"trump|{t.table_id}|♦"),
            InlineKeyboardButton("♣ حکم", callback_data=f"trump|{t.table_id}|♣"),
        ])
        rows.append([
            InlineKeyboardButton("خروج از بازی 🚪", callback_data=f"leave|{t.table_id}"),
        ])
    elif t.finished:
        rows.append([
            InlineKeyboardButton("بستن میز", callback_data=f"close_finished|{t.table_id}"),
        ])
    else:
        # در حال بازی
        rows.append([
            InlineKeyboardButton("خروج از بازی 🚪", callback_data=f"leave|{t.table_id}"),
        ])
    return InlineKeyboardMarkup(rows)


def table_header(t: Table) -> str:
    names = []
    for i, p in enumerate(t.players):
        team_mark = ""
        if t.started and t.teams:
            team_mark = f" [تیم{t.teams.get(i, 0) + 1}]"
        names.append(f"{i + 1}:{p.name if p else '—'}{team_mark}")

    status = []
    if t.finished:
        t1, t2 = t.team_names()
        winner = t1 if t.winner_team == 0 else t2
        status.append(f"🏁 بازی تمام شد — برنده: {winner}")
        status.append(f"امتیاز نهایی: تیم۱ {t.score_sets[0]} – تیم۲ {t.score_sets[1]}")
    elif not t.started:
        status.append("وضعیت: در انتظار بازیکنان و شروع")
        status.append(f"بازیکنان: {t.seats_filled()}/4")
    elif t.trump is None:
        hakem_name = t.players[t.hakem_seat].name if t.hakem_seat is not None and t.players[t.hakem_seat] else "?"
        status.append(f"حاکم: {hakem_name} (صندلی {(t.hakem_seat or 0) + 1}) → انتخاب حکم")
    else:
        turn_name = t.players[t.turn_seat].name if t.turn_seat is not None and t.players[t.turn_seat] else "?"
        status.append(f"حکم: {t.trump} | نوبت: {turn_name} (صندلی {(t.turn_seat or 0) + 1})")
        status.append(f"تریک‌های این دست: تیم۱ {t.score_hands[0]} – تیم۲ {t.score_hands[1]}")
        status.append(f"ست‌ها: تیم۱ {t.score_sets[0]} – تیم۲ {t.score_sets[1]} (تا {SETS_TO_WIN})")
        # نمایش کارت‌های تریک فعلی
        if t.trick.plays:
            status.append("کارت‌های بازی‌شده:")
            status.append(plays_to_text(t.trick.plays, t.trick.leader_index, t.players))

    header = (
        f"🎴 میز حکم «{t.title}»\n"
        f"بازیکنان: " + " | ".join(names) + "\n"
        + "\n".join(status)
        + "\n— @NamePlusUser | @BotSorce"
    )
    return header


async def refresh_table_message(context: ContextTypes.DEFAULT_TYPE, t: Table):
    try:
        await context.bot.edit_message_text(
            chat_id=t.chat_id,
            message_id=t.message_id,
            text=table_header(t),
            reply_markup=table_inline_keyboard(t),
        )
    except BadRequest as e:
        if "message is not modified" not in str(e).lower():
            log.warning(f"edit_message failed: {e}")
    except Exception as e:
        log.warning(f"edit_message failed: {e}")


# ---------- Commands ----------
async def start_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = (
        "سلام! من ربات بازی حکم هستم 🎴\n\n"
        "📌 در گروه:\n"
        "  /table [عنوان میز] — ساخت میز جدید\n\n"
        "📌 اینلاین:\n"
        "  @نام_ربات شما ایجاد میز\n\n"
        "📌 دستورات دیگر:\n"
        "  /help — راهنما\n"
        "  /id — نمایش آیدی عددی شما\n"
        "  /rules — قوانین مختصر حکم\n\n"
        "برای شروع، ربات را به گروه اضافه کنید و /table بزنید."
        f"{BOT_SIGNATURE}"
    )
    await update.message.reply_text(text)


async def help_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = (
        "📖 راهنمای ربات حکم\n\n"
        "• /table [عنوان] — ساخت میز جدید در همین چت\n"
        "• اینلاین: @BotName ایجاد میز — ساخت میز و دعوت دوستان\n"
        "• /id — آیدی عددی خودت را ببین (برای ادمین شدن)\n"
        "• /rules — قوانین بازی حکم\n\n"
        "در میز:\n"
        "  - روی صندلی‌ها بنشینید (۴ نفر)\n"
        "  - یکی «شروع بازی» را بزند\n"
        "  - حاکم ۵ کارت می‌بیند و حکم را انتخاب می‌کند\n"
        "  - کارت‌ها از طریق پیام خصوصی (با دکمه‌ها) بازی می‌شوند\n"
        "  - فالو سوییت اجباری است\n"
        "  - اولین تیمی که به ۷ ست برسد برنده است\n\n"
        "ادمین‌ها: /admin"
        f"{BOT_SIGNATURE}"
    )
    await update.message.reply_text(text)


async def rules_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = (
        "📜 قوانین مختصر حکم\n\n"
        "• ۴ بازیکن در دو تیم ۲ نفره (روبرو هم تیمی هستند)\n"
        "• هر دست ۱۳ تریک دارد\n"
        "• حاکم (Hakem) ۵ کارت اول را می‌بیند و حکم (Trump) را انتخاب می‌کند\n"
        "• سپس بقیه کارت‌ها توزیع می‌شود\n"
        "• باید از خال شروع‌شده پیروی کنید (اگر داشته باشید)\n"
        "• حکم بر همه خال‌ها برتری دارد\n"
        "• تیمی که تریک بیشتری ببرد، ست را می‌برد\n"
        "• اولین تیمی که به ۷ ست برسد، بازی را می‌برد\n"
        "• حاکم دست بعدی معمولاً برنده آخرین تریک دست قبلی است"
        f"{BOT_SIGNATURE}"
    )
    await update.message.reply_text(text)


async def id_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    name = update.effective_user.full_name or update.effective_user.first_name
    await update.message.reply_text(f"👤 نام: {name}\n🆔 User ID: `{uid}`", parse_mode="Markdown")


async def table_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.effective_chat or not update.effective_user:
        return
    reg = get_registry(context)
    # پاک‌سازی میزهای قدیمی قبل از ساخت
    await cleanup_inactive_tables(context)

    if len(reg.tables) >= MAX_TABLES:
        await update.message.reply_text(
            "🚫 به سقف میزهای فعال رسیدیم. لطفاً یکی را ببندید و دوباره تلاش کنید."
        )
        return

    title = " ".join(context.args) if context.args else f"میز {gen_id(4)}"
    table_id = gen_id()
    t = Table(
        table_id=table_id,
        chat_id=update.effective_chat.id,
        message_id=0,
        title=title,
        creator_id=update.effective_user.id,
    )
    reg.tables[table_id] = t
    reg.stats["total_tables_created"] = reg.stats.get("total_tables_created", 0) + 1

    msg = await update.message.reply_text(
        table_header(t), reply_markup=table_inline_keyboard(t)
    )
    t.message_id = msg.message_id

    # در گروه دستور را پاک کن برای تمیزی
    try:
        if update.effective_chat.type != "private":
            await update.message.delete()
    except Exception:
        pass


# ---------- Inline Mode ----------
async def inline_query(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = (update.inline_query.query or "").strip()
    title = query if query else "میز جدید حکم"
    table_id = gen_id()
    content = InputTextMessageContent(
        f"🎴 ایجاد میز حکم: «{title}»\nبرای ساخت و پیوستن روی دکمه بزنید.\n— @NamePlusUser | @BotSorce"
    )
    keyboard = InlineKeyboardMarkup(
        [[InlineKeyboardButton("ساخت میز و پیوستن", callback_data=f"inline_create|{table_id}|{title}")]]
    )
    results = [
        InlineQueryResultArticle(
            id=table_id,
            title=f"ایجاد میز: {title}",
            description="یک میز جدید بساز و دوستانت را دعوت کن | @BotSorce",
            input_message_content=content,
            reply_markup=keyboard,
        )
    ]
    await update.inline_query.answer(results, cache_time=0, is_personal=True)


# ---------- Admin Helpers ----------
def admin_only(func):
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE, *args, **kwargs):
        if not update.effective_user:
            return
        uid = update.effective_user.id
        if uid not in ADMINS:
            if update.message:
                await update.message.reply_text("🚫 شما ادمین نیستید.")
            return
        return await func(update, context, *args, **kwargs)
    return wrapper


def chunk_text(s: str) -> List[str]:
    if len(s) <= MSG_CHUNK:
        return [s]
    out = []
    i = 0
    while i < len(s):
        out.append(s[i : i + MSG_CHUNK])
        i += MSG_CHUNK
    return out


@admin_only
async def admin_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    reg = get_registry(context)
    tables = reg.tables
    stats = reg.stats
    lines = [
        "📊 پنل ادمین ربات حکم",
        f"میزهای فعال: {len(tables)}",
        f"کل میزهای ساخته‌شده: {stats.get('total_tables_created', 0)}",
        f"بازی‌های شروع‌شده: {stats.get('games_started', 0)}",
        f"بازی‌های تمام‌شده: {stats.get('games_finished', 0)}",
        "توسعه: @NamePlusUser | کانال: @BotSorce",
        "",
    ]
    if not tables:
        lines.append("— هیچ میزی فعال نیست.")
    else:
        lines.append("لیست میزها:")
        for tid, t in list(tables.items())[:30]:  # حداکثر ۳۰ تا
            status = "تمام" if t.finished else ("در حال بازی" if t.started else "منتظر")
            lines.append(
                f" • `{tid}` | «{t.title}» | {t.seats_filled()}/4 | {status} | chat:{t.chat_id}"
            )
        if len(tables) > 30:
            lines.append(f"... و {len(tables) - 30} میز دیگر")
        lines.append("\nدستورات:")
        lines.append("/close <TABLE_ID> — بستن میز")
        lines.append("/broadcast <متن> — ارسال به همه چت‌های میزها")
        lines.append("/cleanup — پاک‌سازی میزهای قدیمی")
    txt = "\n".join(lines)
    for ch in chunk_text(txt):
        await update.message.reply_text(ch, parse_mode="Markdown")


@admin_only
async def close_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args
    if not args:
        await update.message.reply_text("استفاده: /close <TABLE_ID>")
        return
    tid = args[0].upper()
    reg = get_registry(context)
    t = reg.tables.get(tid)
    if not t:
        await update.message.reply_text("این Table ID یافت نشد.")
        return
    try:
        await context.bot.delete_message(chat_id=t.chat_id, message_id=t.message_id)
    except Exception as e:
        log.warning(f"delete table message failed: {e}")
    del reg.tables[tid]
    await update.message.reply_text(f"✅ میز `{tid}` بسته شد.", parse_mode="Markdown")


@admin_only
async def broadcast_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg = " ".join(context.args).strip()
    if not msg:
        await update.message.reply_text("استفاده: /broadcast متن پیام")
        return
    reg = get_registry(context)
    chats = {t.chat_id for t in reg.tables.values()}
    sent, fail = 0, 0
    for cid in chats:
        try:
            await context.bot.send_message(chat_id=cid, text=f"📢 پیام ادمین:\n{msg}")
            sent += 1
        except Exception:
            fail += 1
    await update.message.reply_text(f"برادکست انجام شد ✅ ارسال‌شده: {sent} | ناموفق: {fail}")


@admin_only
async def cleanup_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    removed = await cleanup_inactive_tables(context, force=True)
    await update.message.reply_text(f"🧹 {removed} میز قدیمی پاک شد.")


async def cleanup_inactive_tables(context: ContextTypes.DEFAULT_TYPE, force: bool = False) -> int:
    """پاک کردن میزهایی که شروع نشده و قدیمی هستند."""
    reg = get_registry(context)
    now = time.time()
    to_remove = []
    for tid, t in reg.tables.items():
        if t.finished:
            # میزهای تمام‌شده را بعد از مدتی پاک کن
            if now - t.last_activity > INACTIVE_TABLE_TIMEOUT:
                to_remove.append(tid)
        elif not t.started and (now - t.created_at > INACTIVE_TABLE_TIMEOUT or force):
            to_remove.append(tid)
    for tid in to_remove:
        t = reg.tables.pop(tid, None)
        if t:
            try:
                await context.bot.edit_message_text(
                    chat_id=t.chat_id,
                    message_id=t.message_id,
                    text=f"🎴 میز «{t.title}» به دلیل عدم فعالیت بسته شد.",
                )
            except Exception:
                pass
    return len(to_remove)


# ---------- Callbacks ----------
async def callback_query(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.callback_query:
        return
    q = update.callback_query
    data = q.data or ""
    parts = data.split("|")
    action = parts[0]
    reg = get_registry(context)

    if action == "noop":
        await q.answer()
        return

    if action == "inline_create":
        if len(parts) < 3:
            await q.answer("درخواست نامعتبر.", show_alert=True)
            return
        table_id, title = parts[1], parts[2]
        chat_id = q.message.chat_id if q.message else q.from_user.id
        if table_id in reg.tables:
            t = reg.tables[table_id]
        else:
            if len(reg.tables) >= MAX_TABLES:
                await q.answer("سقف میزها پر است.", show_alert=True)
                return
            t = Table(
                table_id=table_id,
                chat_id=chat_id,
                message_id=q.message.message_id if q.message else 0,
                title=title,
                creator_id=q.from_user.id,
            )
            reg.tables[table_id] = t
            reg.stats["total_tables_created"] = reg.stats.get("total_tables_created", 0) + 1
        await q.answer("میز ساخته شد. یک صندلی انتخاب کن.")
        await refresh_table_message(context, t)
        return

    try:
        table_id = parts[1]
    except Exception:
        await q.answer("درخواست نامعتبر.")
        return

    t = reg.tables.get(table_id)
    if not t:
        await q.answer("این میز وجود ندارد یا پاک شده است.", show_alert=True)
        return

    # ---------- join ----------
    if action == "join":
        if t.started or t.finished:
            await q.answer("بازی شروع شده یا تمام شده. نمی‌توانید بپیوندید.", show_alert=True)
            return
        seat = int(parts[2])
        user = q.from_user
        prev = t.seat_of(user.id)
        if prev is not None and prev != seat:
            t.players[prev] = None
        if t.players[seat] and t.players[seat].user_id != user.id:
            await q.answer("این صندلی پر است.")
            return
        t.players[seat] = Player(user_id=user.id, name=user.first_name or f"user{user.id}")
        t.ensure_team_mapping()
        t.touch()
        await q.answer(f"روی صندلی {seat + 1} نشستی.")
        await refresh_table_message(context, t)
        return

    # ---------- leave ----------
    if action == "leave":
        user = q.from_user
        seat = t.seat_of(user.id)
        if seat is None:
            await q.answer("شما روی هیچ صندلی نیستید.")
            return
        if t.started and not t.finished:
            # در حین بازی خروج = حذف بازیکن و احتمالاً توقف بازی
            t.players[seat] = None
            t.finished = True
            await q.answer("از بازی خارج شدید. میز متوقف شد.", show_alert=True)
            await refresh_table_message(context, t)
            try:
                await context.bot.send_message(
                    chat_id=t.chat_id,
                    text=f"⚠️ {user.first_name} از بازی خارج شد. میز متوقف شد.",
                )
            except Exception:
                pass
        else:
            t.players[seat] = None
            await q.answer("از صندلی خارج شدید.")
            await refresh_table_message(context, t)
        t.touch()
        return

    # ---------- cancel (فقط سازنده یا ادمین) ----------
    if action == "cancel":
        user = q.from_user
        if t.started:
            await q.answer("بازی شروع شده. نمی‌توان لغو کرد.", show_alert=True)
            return
        if user.id != t.creator_id and user.id not in ADMINS:
            await q.answer("فقط سازنده میز یا ادمین می‌تواند لغو کند.", show_alert=True)
            return
        try:
            await context.bot.edit_message_text(
                chat_id=t.chat_id,
                message_id=t.message_id,
                text=f"🎴 میز «{t.title}» توسط سازنده لغو شد.",
            )
        except Exception:
            pass
        del reg.tables[table_id]
        await q.answer("میز لغو شد.")
        return

    # ---------- close_finished ----------
    if action == "close_finished":
        try:
            await context.bot.edit_message_text(
                chat_id=t.chat_id,
                message_id=t.message_id,
                text=table_header(t) + "\n\n(میز بسته شد)",
            )
        except Exception:
            pass
        if table_id in reg.tables:
            del reg.tables[table_id]
        await q.answer("میز بسته شد.")
        return

    # ---------- start ----------
    if action == "start":
        if t.started:
            await q.answer("بازی شروع شده.")
            return
        if not t.is_full():
            await q.answer("چهار نفر کامل نیست.", show_alert=True)
            return
        t.hakem_seat = secrets.randbelow(4)
        t.started = True
        t.finished = False
        t.score_hands = [0, 0]
        t.score_sets = [0, 0]
        t.trick = TrickState(leader_index=t.hakem_seat)
        t.start_hand()
        t.ensure_team_mapping()
        reg.stats["games_started"] = reg.stats.get("games_started", 0) + 1
        await q.answer("بازی شروع شد! حاکم ۵ کارت گرفت و حکم را انتخاب می‌کند.")
        await refresh_table_message(context, t)
        # ارسال دست به حاکم
        await send_hand_dm(context, t, t.hakem_seat)
        return

    # ---------- trump ----------
    if action == "trump":
        suit = parts[2]
        if t.hakem_seat is None or not t.players[t.hakem_seat]:
            await q.answer("حاکم مشخص نیست.", show_alert=True)
            return
        if q.from_user.id != t.players[t.hakem_seat].user_id:
            await q.answer("فقط حاکم می‌تواند حکم را انتخاب کند.", show_alert=True)
            return
        if t.trump:
            await q.answer("حکم قبلاً انتخاب شده.")
            return
        if t.finished:
            await q.answer("بازی تمام شده.")
            return
        t.set_trump(suit)
        await q.answer(f"حکم شد: {suit}")
        await refresh_table_message(context, t)
        for seat in range(4):
            await send_hand_dm(context, t, seat)
        return

    # ---------- play ----------
    if action == "play":
        if len(parts) < 4:
            await q.answer("داده نامعتبر.")
            return
        seat = int(parts[2])
        try:
            r, s = parts[3].split("_", 1)
            card = (r, s)
        except Exception:
            await q.answer("کارت نامعتبر.")
            return
        if not t.players[seat] or q.from_user.id != t.players[seat].user_id:
            await q.answer("این دکمه برای شما نیست.", show_alert=True)
            return
        if t.finished:
            await q.answer("بازی تمام شده.")
            return

        err = t.play_card(seat, card)
        if err and "دست تمام شد" not in err and "بازی تمام شد" not in err:
            await q.answer(err, show_alert=True)
            await refresh_table_message(context, t)
            for seat2 in range(4):
                await send_hand_dm(context, t, seat2)
            return

        await q.answer("بازی شد ✅")
        await refresh_table_message(context, t)

        # اگر پیام پایان دست یا بازی وجود دارد، در گروه اعلام کن
        if err:
            try:
                await context.bot.send_message(chat_id=t.chat_id, text=err)
            except Exception:
                pass
            if t.finished:
                reg.stats["games_finished"] = reg.stats.get("games_finished", 0) + 1

        # به‌روزرسانی دست همه
        for seat2 in range(4):
            await send_hand_dm(context, t, seat2)
        return

    await q.answer()


# ---------- DM helpers ----------
async def send_hand_dm(context: ContextTypes.DEFAULT_TYPE, t: Table, seat: int):
    if not ENABLE_DM_HANDS:
        return
    player = t.players[seat]
    if not player:
        return
    hand = t.hands.get(seat, [])
    header = f"🎴 میز «{t.title}» | صندلی {seat + 1}\n"

    if t.finished:
        t1, t2 = t.team_names()
        winner = t1 if t.winner_team == 0 else t2
        txt = header + f"🏁 بازی تمام شد.\nبرنده: {winner}\nامتیاز: {t.score_sets[0]} – {t.score_sets[1]}"
        await _send_or_edit_dm(context, t, player, txt, None)
        return

    if t.trump is None:
        if seat == t.hakem_seat:
            txt = header + "۵ کارت اولیه شما (حکم را انتخاب کنید):\n" + hand_to_text(hand)
        else:
            txt = header + "در انتظار انتخاب حکم توسط حاکم…"
        await _send_or_edit_dm(context, t, player, txt, None)
        return

    legal = t.legal_moves(seat) if t.turn_seat == seat else []
    keyboard_rows = []
    if legal:
        row = []
        for c in legal:
            label = card_str(c)
            row.append(
                InlineKeyboardButton(
                    label, callback_data=f"play|{t.table_id}|{seat}|{c[0]}_{c[1]}"
                )
            )
            if len(row) == 5:
                keyboard_rows.append(row)
                row = []
        if row:
            keyboard_rows.append(row)
    else:
        keyboard_rows = [[InlineKeyboardButton("⏳ نوبت شما نیست", callback_data="noop")]]

    kb = InlineKeyboardMarkup(keyboard_rows) if keyboard_rows else None

    turn_info = (
        "✅ نوبت شماست — یک کارت بازی کنید.\n"
        if t.turn_seat == seat
        else "صبر کنید تا نوبت شما شود.\n"
    )
    # نمایش مختصر تریک فعلی
    trick_info = ""
    if t.trick.plays:
        trick_info = "کارت‌های این تریک:\n" + plays_to_text(
            t.trick.plays, t.trick.leader_index, t.players
        ) + "\n"

    txt = (
        header
        + f"حکم: {t.trump} | "
        + turn_info
        + trick_info
        + "دست شما:\n"
        + hand_to_text(hand, t.trump)
    )
    await _send_or_edit_dm(context, t, player, txt, kb)


async def _send_or_edit_dm(
    context: ContextTypes.DEFAULT_TYPE,
    t: Table,
    player: Player,
    text: str,
    reply_markup: Optional[InlineKeyboardMarkup],
):
    """سعی می‌کند پیام قبلی را ویرایش کند؛ در غیر این صورت پیام جدید می‌فرستد."""
    uid = player.user_id
    last_mid = t.last_dm_msg.get(uid)
    try:
        if last_mid:
            try:
                await context.bot.edit_message_text(
                    chat_id=uid,
                    message_id=last_mid,
                    text=text,
                    reply_markup=reply_markup,
                )
                return
            except BadRequest:
                # پیام قدیمی دیگر قابل ویرایش نیست
                pass
            except Forbidden:
                log.warning(f"Cannot DM user {uid} (blocked?)")
                return
        # ارسال جدید
        msg = await context.bot.send_message(
            chat_id=uid, text=text, reply_markup=reply_markup
        )
        t.last_dm_msg[uid] = msg.message_id
    except Forbidden:
        log.warning(f"Cannot DM user {uid} (blocked or never started bot)")
    except Exception as e:
        log.warning(f"DM fail for {uid}: {e}")


# ---------- App ----------
def build_app() -> Application:
    persistence = PicklePersistence(filepath=STATE_FILE)
    app = (
        ApplicationBuilder()
        .token(BOT_TOKEN)
        .persistence(persistence)
        .build()
    )

    app.add_handler(CommandHandler("start", start_cmd))
    app.add_handler(CommandHandler("help", help_cmd))
    app.add_handler(CommandHandler("rules", rules_cmd))
    app.add_handler(CommandHandler("id", id_cmd))
    app.add_handler(CommandHandler("table", table_cmd))

    # Admin
    app.add_handler(CommandHandler("admin", admin_cmd))
    app.add_handler(CommandHandler("close", close_cmd))
    app.add_handler(CommandHandler("broadcast", broadcast_cmd))
    app.add_handler(CommandHandler("cleanup", cleanup_cmd))

    # Inline + Callbacks
    app.add_handler(InlineQueryHandler(inline_query))
    app.add_handler(CallbackQueryHandler(callback_query))

    # Unknown commands
    app.add_handler(MessageHandler(filters.COMMAND, help_cmd))

    async def post_init(application: Application):
        if REGISTRY_KEY not in application.bot_data:
            application.bot_data[REGISTRY_KEY] = Registry()
        log.info("Bot is up. Ready. | @NamePlusUser | @BotSorce")

    app.post_init = post_init
    return app


if __name__ == "__main__":
    application = build_app()
    log.info("Hokm bot (improved) is running… | Developed by @NamePlusUser | Channel: @BotSorce")
    application.run_polling(
        allowed_updates=["message", "callback_query", "inline_query", "chosen_inline_result"]
    )
