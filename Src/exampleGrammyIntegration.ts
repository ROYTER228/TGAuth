import { Bot } from 'grammy'
import { DeeplinkAuth, CodeAuth, AuthResult } from './index.js'

const botToken =
  process.env.BOT_TOKEN || '7935582771:AAGsPyE5K6l6AUD2_blvWaVgSBSJ748fBio'

// --- DeeplinkAuth ---
const deeplinkAuth = new DeeplinkAuth({
  botToken,
  transport: ['callback'],
  onAuth: (user) => {
    console.log('Deeplink авторизация:', user)
  },
})

// --- CodeAuth ---
const codeAuth = new CodeAuth({
  botToken,
  transport: ['callback'],
  onAuth: (user) => {
    console.log('Code авторизация:', user)
  },
})

const bot = new Bot(botToken)

// Deeplink: /start <token>
bot.command('start', async (ctx) => {
  const args = ctx.message?.text?.split(' ')
  if (args && args.length > 1 && ctx.from) {
    // Deeplink с токеном
    const token = args[1]
    const user: AuthResult = {
      id: ctx.from.id,
      is_bot: ctx.from.is_bot,
      first_name: ctx.from.first_name,
      last_name: ctx.from.last_name,
      username: ctx.from.username,
      language_code: ctx.from.language_code,
      // можно добавить фото и другие поля
    }
    const ok = deeplinkAuth.handleAuth(token, user)
    if (ok) {
      await ctx.reply('Вы успешно авторизованы через ссылку!')
    } else {
      await ctx.reply('Ссылка недействительна или уже использована.')
    }
    return
  }

  // CodeAuth: просто /start — генерируем код
  const code = codeAuth.generateCode()
  await ctx.reply(`Ваш код для авторизации: ${code}`)
})

// CodeAuth: пользователь отправляет код
bot.on('message', async (ctx) => {
  const text = ctx.message?.text?.trim()
  if (!text || text.startsWith('/')) return
  if (!ctx.from) return
  // Проверяем, есть ли такой код
  const user: AuthResult = {
    id: ctx.from.id,
    is_bot: ctx.from.is_bot,
    first_name: ctx.from.first_name,
    last_name: ctx.from.last_name,
    username: ctx.from.username,
    language_code: ctx.from.language_code,
  }
  const ok = codeAuth.handleAuth(text, user)
  if (ok) {
    await ctx.reply('Вы успешно авторизованы по коду!')
  }
})

bot.start({
  drop_pending_updates: false,
  allowed_updates: undefined,
  onStart: () => {
    console.log('Бот успешно запущен!')
  },
})
