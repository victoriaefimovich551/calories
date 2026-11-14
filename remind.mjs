// Ежедневное напоминание от бота. Запускается по расписанию из GitHub Actions
// (.github/workflows/remind.yml). Токен и список чатов берутся из секретов репозитория —
// в этот файл их вписывать нельзя.

const TOKEN = process.env.BOT_TOKEN;
const CHAT_IDS = (process.env.CHAT_IDS || '').split(/[\s,;]+/).filter(Boolean);
const EVENT_DATE = process.env.EVENT_DATE || '2027-01-01'; // до какой даты считать дни
const EVENT_TITLE = process.env.EVENT_TITLE || 'Нового года'; // в родительном падеже: «до чего?»
const TIMEZONE = process.env.TIMEZONE || 'Europe/Moscow';
const DRY_RUN = process.env.DRY_RUN === '1';

const REMINDERS = [
  'Не забудьте отметить, что вы сегодня ели 🤗',
  'Как прошёл день? Самое время записать завтрак, обед и ужин 🍽',
  'Минутка честности: что сегодня было на тарелке? 😉',
  'Дневник питания скучает без вас — загляните на минутку 📒',
  'Маленькая привычка — большой результат. Отметьте сегодняшнюю еду 💪',
  'Пока не забылось: запишите всё, что съели за день ✍️',
  'Вечерняя перекличка! Все приёмы пищи на месте? 🥗',
];
const TIPS = [
  'Совет дня: стакан воды перед едой помогает не переедать.',
  'Совет дня: белок в каждом приёме пищи дольше сохраняет сытость.',
  'Совет дня: записывайте еду сразу — вечером половина перекусов уже не вспомнится.',
  'Совет дня: овощи на половину тарелки — самый простой способ снизить калорийность.',
  'Совет дня: один «неидеальный» день ничего не портит, важна неделя в целом.',
  'Совет дня: взвесьте порцию хотя бы раз — глазомер обычно занижает.',
  'Совет дня: соусы и масло легко добавляют 200–300 ккал, не забывайте их записывать.',
  'Совет дня: сон меньше 7 часов усиливает аппетит на следующий день.',
];

function plural(n, forms) {
  const a = Math.abs(n) % 100, b = a % 10;
  return forms[a > 10 && a < 20 ? 2 : b === 1 ? 0 : b >= 2 && b <= 4 ? 1 : 2];
}

// Сегодняшняя дата в нужном часовом поясе как число дней от начала эпохи
function todayDayNumber() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return Math.round(Date.parse(parts + 'T00:00:00Z') / 864e5);
}

function buildText() {
  const day = todayDayNumber();
  const lines = [REMINDERS[day % REMINDERS.length]];
  const target = Date.parse(EVENT_DATE + 'T00:00:00Z');
  if (!Number.isNaN(target)) {
    const left = Math.round(target / 864e5) - day;
    if (left > 0) lines.push(`⏳ До ${EVENT_TITLE} ${plural(left, ['остался', 'осталось', 'осталось'])} ${left} ${plural(left, ['день', 'дня', 'дней'])}`);
    else if (left === 0) lines.push('🎉 Тот самый день настал — поздравляем!');
  }
  lines.push('💡 ' + TIPS[day % TIPS.length]);
  return lines.join('\n\n');
}

async function api(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`${method}: ${data.description || res.status}`);
  return data.result;
}

const text = buildText();
if (DRY_RUN) {
  console.log(text);
  process.exit(0);
}
if (!TOKEN) throw new Error('Не задан секрет BOT_TOKEN');
if (!CHAT_IDS.length) throw new Error('Не задан секрет CHAT_IDS');

const me = await api('getMe');
const reply_markup = { inline_keyboard: [[{ text: '🍽 Открыть дневник', url: `https://t.me/${me.username}?startapp` }]] };

let failed = 0;
for (let i = 0; i < CHAT_IDS.length; i++) {
  try {
    await api('sendMessage', { chat_id: CHAT_IDS[i], text, reply_markup });
    console.log(`Чат №${i + 1}: отправлено`);
  } catch (e) {
    failed++;
    console.log(`Чат №${i + 1}: ошибка — ${e.message}`);
  }
}
if (failed === CHAT_IDS.length) process.exit(1);
