import { api, db } from 'sdk';
import { desc, like } from 'sdk/db';

import { games } from '../schema.js';
import { createGame } from '../lib/game.js';
import { MINI_APP_URL, getBotInfo, miniAppLink } from '../lib/config.js';
import { rememberChat } from '../lib/user.js';

const RULES = [
  '🎴 *قوانین خوکم*',
  '',
  '• ۴ بازیکن، دو تیم دو نفره. هر کارت یک ترک.',
  '• بازیکن اعلان‌کننده *خوکم* (سوت) را انتخاب می‌کند؛ آس خوکم، «کارت خوکم» است.',
  '• باید سوت بزنی. اگر نتوانستی، خوکم بزن. اگر خوکمِ بازی‌شده را می‌توانی بزنی، *باید* بزنی.',
  '• برنده‌ی هر ترک، ترک بعدی را شروع می‌کند.',
  '• تیمی که ۷ ترک یا بیشتر بگیرد برنده‌ی دست است.',
  '• اگر یک تیم هر ۱۳ ترک را بگیرد، بازی به تیم دیگر می‌رسد.',
  '• اگر تیم برنده، کارت خوکم را نگرفته باشد، دست به تیم مقابل می‌رسد.',
  '• امتیاز کارت‌ها: آس و ۱۰ ده‌امتیاز، شاه ۴، خانم ۳، ب ۲. ترک آخر ۱۰ امتیاز اضافه دارد.',
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
        '🎴 *به خوکم خوش آمدید!*',
        '',
        'بازی ایرانی چهار نفره با ۱۳ ترک. یک بازی سریع با ربات‌ها بسازید یا میز خصوصی درست کنید و دوستانتان را دعوت کنید.',
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
      text: `بازی تازه ساخته شد.\nکد میز: \`${game.id}\`\n\nخوکم (سوت) را انتخاب کنید و بازی را شروع کنید:`,
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
        inline_keyboard: [[{ text: '🎴 بازی خوکم', web_app: { url: openApp('home') } }]],
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
      text: 'برای بازی خوکم روی دکمه‌ی زیر بزنید 🎴',
      reply_markup: {
        inline_keyboard: [[{ text: '🎴 بازی خوکم', web_app: { url: openApp('home') } }]],
      },
    });
  }
}
