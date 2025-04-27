/**
 * Пример использования пакета TGAuth
 */

import { createTelegramAuth, LogLevel } from '../Src/index.js'

// Настройки Telegram бота
const BOT_TOKEN = 'YOUR_BOT_TOKEN'
const BOT_USERNAME = 'your_bot_username'

// 1. Простая авторизация через код и deeplink
const simpleAuth = createTelegramAuth({
  botToken: BOT_TOKEN,
  botUsername: BOT_USERNAME,
  frontendUrl: 'https://your-app.com',
  transports: {
    useWebSocket: false,
    callbacks: {
      onLogin: (userId, session) => {
        console.log(`Пользователь ${userId} вошел в систему`)
        console.log('Данные сессии:', session)
      },
      onError: (error) => {
        console.error('Ошибка авторизации:', error.message)
      },
    },
  },
  enableAuthMethods: {
    codeAuth: true,
    deeplinkV1: true,
  },
  logLevel: LogLevel.INFO,
})

// Генерация deeplink для отправки пользователю
const deeplinkUrl = simpleAuth.deeplinkV1?.generateDeeplink()
console.log('Deeplink для авторизации:', deeplinkUrl)

// 2. Полная конфигурация с WebSocket и 2FA
import * as http from 'http'
import { Server } from 'socket.io'

// Создаем HTTP сервер и Socket.IO сервер
const httpServer = http.createServer()
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

// Авторизация с поддержкой WebSocket и 2FA
const advancedAuth = createTelegramAuth({
  botToken: BOT_TOKEN,
  botUsername: BOT_USERNAME,
  frontendUrl: 'https://your-app.com',
  transports: {
    useWebSocket: true,
    socketInstance: io,
    callbacks: {
      onLogin: (userId, session) => {
        console.log(`Пользователь ${userId} вошел в систему`)
      },
      on2FA: (userId, action) => {
        console.log(
          `Пользователь ${userId} запросил 2FA для действия "${action}"`
        )
      },
    },
  },
  enableAuthMethods: {
    codeAuth: true,
    deeplinkV1: true,
    deeplinkV2: true,
    widgetAuth: true,
  },
  twoFactor: {
    enabled: true,
    actions: ['withdraw', 'change_password', 'delete_account'],
    verificationTimeout: 180, // 3 минуты
  },
  logLevel: LogLevel.DEBUG,
})

// Запускаем WebSocket сервер
httpServer.listen(3000, () => {
  console.log('WebSocket сервер запущен на порту 3000')
})

// 3. Интеграция с ботом Telegram
// Это пример того, как можно интегрировать API с вашим ботом

// Обработка команды /start с токеном для авторизации (DeeplinkAuth)
function handleStart(ctx: any) {
  const text = ctx.message?.text || ''
  const userId = ctx.from?.id

  const args = text.split(' ')
  if (args.length > 1) {
    const token = args[1]
    const userData = {
      id: userId,
      is_bot: false,
      first_name: ctx.from?.first_name || '',
      last_name: ctx.from?.last_name,
      username: ctx.from?.username,
      language_code: ctx.from?.language_code,
    }

    // Обработка deeplink авторизации
    const authOk = advancedAuth.deeplinkV1?.handleAuth(token, userData)
    if (authOk) {
      ctx.reply('Вы успешно авторизованы!')
    } else {
      ctx.reply('Ошибка авторизации. Ссылка недействительна или устарела.')
    }
  } else {
    // Можно отправить инструкции или сгенерировать код
    const code = advancedAuth.codeAuth?.generateCode()
    ctx.reply(`Ваш код для авторизации: ${code}`)
  }
}

// Запрос 2FA для критической операции
function requestTwoFA(userId: number, action: string) {
  if (advancedAuth.twoFA) {
    const verificationId = advancedAuth.twoFA.startVerification(userId, action)
    return verificationId
  }
  return null
}

// Проверка кода 2FA
function verifyTwoFA(verificationId: string, code: string) {
  if (advancedAuth.twoFA) {
    return advancedAuth.twoFA.verifyCode(verificationId, code)
  }
  return false
}

// Пример экспорта функций для использования в приложении
export { simpleAuth, advancedAuth, handleStart, requestTwoFA, verifyTwoFA }
