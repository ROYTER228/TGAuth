import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  DeeplinkAuth,
  CodeAuth,
  WidgetAuth,
  TwoFAAuth,
  AuthResult,
} from '../Src/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(express.json())

const botToken =
  process.env.BOT_TOKEN || '7935582771:AAGsPyE5K6l6AUD2_blvWaVgSBSJ748fBio'

// --- DeeplinkAuth ---
const deeplinkAuth = new DeeplinkAuth({
  botToken: botToken,
  botUsername: 'BattleshipTonBot',
  transport: ['callback', 'rest', 'websocket'],
  onAuth: (user) => {
    safeLog('DeeplinkAuth (callback):', user)
  },
  restEndpoint: 'http://localhost:3000/api/auth',
  wsServer: {
    emit: (event, data) => safeLog('WS emit', event, data),
  },
  saveHandler: (data) => safeLog('DeeplinkAuth (saveHandler):', data),
})

const deeplink = deeplinkAuth.generateDeeplink()
safeLog('Deeplink:', deeplink)

// --- CodeAuth ---
const codeAuth = new CodeAuth({
  botToken: botToken,
  transport: ['callback', 'rest', 'websocket'],
  onAuth: (user) => {
    safeLog('CodeAuth (callback):', user)
  },
  restEndpoint: 'http://localhost:3000/api/auth',
  wsServer: {
    emit: (event, data) => safeLog('WS emit', event, data),
  },
  saveHandler: (data) => safeLog('CodeAuth (saveHandler):', data),
})

const code = codeAuth.generateCode()
safeLog('Code:', code)

// --- WidgetAuth ---
const widgetAuth = new WidgetAuth({
  botToken: botToken,
  transport: ['callback'],
  onAuth: (user) => {
    safeLog('WidgetAuth (callback):', user)
  },
})
// Пример вызова (данные с фронта):
// widgetAuth.handleAuth(widgetData)

// --- TwoFAAuth ---
const twoFAAuth = new TwoFAAuth({
  botToken: botToken,
  transport: ['callback'],
  onAuth: (user) => {
    safeLog('TwoFAAuth (callback):', user)
  },
})
// Пример вызова (логика 2FA):
// twoFAAuth.start2FA(userId)

safeLog('Тестовая страница авторизации инициализирована!')

// --- Express сервер ---

// Отдаём testAuth.html по GET /
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'testAuth.html'))
})

// Отдаём статику из папки Test (если нужно)
app.use(express.static(__dirname))

// REST endpoint для теста restEndpoint
app.post('/api/auth', (req, res) => {
  safeLog('REST /api/auth:', req.body)
  // Гарантируем, что user — обычный объект
  const user =
    req.body && typeof req.body === 'object'
      ? JSON.parse(JSON.stringify(req.body))
      : req.body
  res.json({ status: 'ok', user })
})

// Безопасный логгер, чтобы не было проблем с null prototype
function safeLog(...args: any[]) {
  const safeArgs = args.map((arg) => {
    if (arg && typeof arg === 'object' && Object.getPrototypeOf(arg) === null) {
      return JSON.parse(JSON.stringify(arg))
    }
    return arg
  })
  console.log(...safeArgs)
}

const PORT = 3000
app.listen(PORT, () => {
  safeLog(`Тестовый сервер запущен: http://localhost:${PORT}`)
})

// Глобальный обработчик ошибок
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err, err?.stack)
})
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason)
})
