import { Bot } from 'grammy'

const bot = new Bot(process.env.BOT_TOKEN)

bot.on('message', (ctx) => {
  ctx.reply('Hello, world!')
})

bot.start()
