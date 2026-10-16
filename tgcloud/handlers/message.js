import { api, db } from 'sdk';
import { desc, like } from 'sdk/db';

import { games } from '../schema.js';
import { createGame } from '../lib/game.js';
import { MINI_APP_URL, getBotInfo, miniAppLink } from '../lib/config.js';
import { rememberChat } from '../lib/user.js';

const RULES = [
  "🎴 قوانین حکم",
  "",
  "• چهار بازیکن در دو تیم بازی می‌کنند و یارها روبه‌روی هم می‌نشینند.",
  "• خال‌ها پیک، دل، خشت و خاج هستند. خاج را گشنیز هم می‌نامند.",
  "• ترتیب برگ‌ها از بالا به پایین: آس، شاه، بی‌بی، سرباز، ۱۰ تا ۲.",
  "• حاکم نخست با رسیدن اولین آس تعیین می‌شود و با دیدن پنج برگ نخست، خال حکم را انتخاب می‌کند. سپس هشت برگ دیگر در اختیار هر بازیکن قرار می‌گیرد.",
  "• حاکم دست نخست را آغاز می‌کند. نوبت‌ها پادساعتگرد است.",
  "• اگر از خال زمینه برگ دارید، باید همان خال را بازی کنید؛ در غیر این صورت هر برگی آزاد است. بریدن و بالاتر بریدن اجباری نیست.",
  "• بالاترین حکم برندهٔ دست است؛ اگر حکمی بازی نشده باشد، بالاترین برگ خال زمینه برنده است. برنده، دست بعدی را آغاز می‌کند.",
  "• نخستین تیمی که هفت دست بگیرد برنده می‌شود و یک امتیاز می‌گیرد. برگ‌ها امتیاز جداگانه ندارند و گرفتن آس حکم شرط برد نیست.",
  "• برد هفت بر صفر کت است و دو امتیاز دارد. اگر تیم حاکم کت شود، حاکم‌کتی است و تیم مقابل سه امتیاز می‌گیرد.",
  "• این نسخه یک بازی مستقل تا هفت دست است. دور کامل تا هفت امتیاز، ادامه برای بام و درخواست پخش دوباره هنوز پشتیبانی نمی‌شوند."
].join('\n');

function label(name) {
  return name ? name.split('@')[0] : '';
}

export default async function (message, ctx) {
  const chatId = message.chat?.id;
  const from = message.from;
  if (!chatId || !from?.id) return;

  const userName = [from.first_name, from.last_name].filter(Boolean).join(' ') || 'بازیکن';
  await rememberChat(from.id, chatId, userName, from.username);

  const text = (message.text ?? '').trim();
  const [rawCommand, ...args] = text.split(/\s+/);
  const command = label(rawCommand).toLowerCase();
  const payload = args[0] ?? '';

  const bot = await getBotInfo();
  const openApp = (param) => miniAppLink(param, bot?.username);

  if (command === '/start') {
    if (payload.startsWith('join_')) {
      const code = payload.slice(5).toUpperCase();
      await api.sendMessage({
        chat_id: chatId,
        text: `میز ${code} آماده‌ی بازی است. روی دکمه‌ی زیر بزنید تا وارد شوید:`,
        reply_markup: {
          inline_keyboard: [[{ text: '🎴 ورود به میز', web_app: { url: openApp(`join_${code}`) } }]],
        },
      });
      return;
    }

    await api.sendMessage({
      chat_id: chatId,
      text: [
        '🎴 *به حکم خوش آمدید!*',
        '',
        'بازی ایرانی چهار نفره با برد هفت دست. یک بازی سریع با ربات‌ها بسازید یا میز خصوصی درست کنید و دوستانتان را دعوت کنید.',
      ].join('\n'),
      reply_markup: {
        inline_keyboard: [
          [{ text: '▶️ بازی سریع', web_app: { url: openApp('home') } }],
          [{ text: '📖 قوانین بازی', callback_data: 'rules' }],
        ],
      },
    });
    return;
  }

  if (command === '/new' || command === '/game') {
    const game = await createGame({
      mode: 'solo',
      owner: from.id,
      ownerName: userName,
      ownerTgId: from.id,
      ownerChatId: chatId,
    });

    await api.sendMessage({
      chat_id: chatId,
      text: `بازی تازه ساخته شد.\nکد میز: \`${game.id}\`\n\nبازی را باز کنید؛ حاکم خال حکم را انتخاب می‌کند:`,
      reply_markup: {
        inline_keyboard: [[{ text: '🎴 رفتن به بازی', web_app: { url: openApp(`g_${game.id}`) } }]],
      },
    });
    return;
  }

  if (command === '/play' || command === '/hokm') {
    await api.sendMessage({
      chat_id: chatId,
      text: 'برای شروع بازی روی دکمه‌ی زیر بزنید:',
      reply_markup: {
        inline_keyboard: [[{ text: '🎴 بازی حکم', web_app: { url: openApp('home') } }]],
      },
    });
    return;
  }

  if (command === '/rules' || command === '/help') {
    await api.sendMessage({
      chat_id: chatId,
      text: RULES,
      reply_markup: {
        inline_keyboard: [[{ text: '🎴 شروع بازی', web_app: { url: openApp('home') } }]],
      },
    });
    return;
  }

  if (command === '/games') {
    const rows = await db
      .select()
      .from(games)
      .where(like(games.participants, `%,${from.id},%`))
      .orderBy(desc(games.updated))
      .limit(10)
      .all();

    const active = (rows ?? []).filter((row) => row.status !== 'finished');

    if (!active.length) {
      await api.sendMessage({
        chat_id: chatId,
        text: 'بازی فعالی ندارید. یک بازی تازه بسازید:',
        reply_markup: {
          inline_keyboard: [[{ text: '🎴 بازی سریع', web_app: { url: openApp('home') } }]],
        },
      });
      return;
    }

    const keyboard = active.map((row) => [
      {
        text: `میز ${row.id} — ${row.status === 'waiting' ? 'در انتظار' : 'در حال بازی'}`,
        web_app: { url: openApp(`g_${row.id}`) },
      },
    ]);

    await api.sendMessage({
      chat_id: chatId,
      text: 'بازی‌های شما:',
      reply_markup: { inline_keyboard: keyboard },
    });
    return;
  }

  if (command === '/link') {
    await api.sendMessage({
      chat_id: chatId,
      text: MINI_APP_URL
        ? `نشانی مینی‌اپ: ${MINI_APP_URL}`
        : 'نشانی مینی‌اپ هنوز در `tgcloud/lib/config.js` تنظیم نشده است.',
    });
    return;
  }

  // Anything else: a friendly nudge towards the game.
  if (text && !text.startsWith('/')) {
    await api.sendMessage({
      chat_id: chatId,
      text: 'برای بازی حکم روی دکمه‌ی زیر بزنید 🎴',
      reply_markup: {
        inline_keyboard: [[{ text: '🎴 بازی حکم', web_app: { url: openApp('home') } }]],
      },
    });
  }
}
