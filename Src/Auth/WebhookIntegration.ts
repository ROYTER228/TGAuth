import express from 'express'
import { Bot } from 'grammy'
import { AuthResult } from '../types.js'
import { DeeplinkAuth, AuthTransportOptions } from './DeeplinkAuth.js'
import { CodeAuth } from './CodeAuth.js'
import { SessionManager } from './SessionManager.js'

export interface WebhookOptions {
  /** Токен бота Telegram */
  botToken: string
  /** Секретный ключ для защиты webhook */
  secretToken?: string
  /** Базовый URL для webhook */
  webhookBaseUrl: string
  /** Путь для webhook */
  webhookPath?: string
  /** Порт для запуска Express сервера */
  port?: number
  /** Обработчик при успешной авторизации */
  onAuth?: (userData: AuthResult, sessionId?: string) => void
  /** Использовать механизм сессий */
  useSessionManager?: boolean
  /** Опции менеджера сессий */
  sessionOptions?: Record<string, any>
}

export class WebhookIntegration {
  private bot: Bot
  private app: express.Express
  private deeplinkAuth: DeeplinkAuth
  private codeAuth: CodeAuth
  private sessionManager?: SessionManager
  private options: Required<Omit<WebhookOptions, 'sessionOptions'>> & {
    sessionOptions?: Record<string, any>
  }

  constructor(options: WebhookOptions) {
    this.options = {
      botToken: options.botToken,
      secretToken: options.secretToken || '',
      webhookBaseUrl: options.webhookBaseUrl,
      webhookPath: options.webhookPath || '/telegram-webhook',
      port: options.port || 3000,
      onAuth: options.onAuth || (() => {}),
      useSessionManager: options.useSessionManager ?? true,
      sessionOptions: options.sessionOptions,
    }

    this.bot = new Bot(this.options.botToken)
    this.app = express()

    // Инициализация DeeplinkAuth и CodeAuth
    const authOptions: AuthTransportOptions = {
      botToken: this.options.botToken,
      transport: ['callback'],
      onAuth: (userData: AuthResult) => {
        if (this.options.onAuth) {
          if (this.options.useSessionManager && this.sessionManager) {
            this.sessionManager.createSession(userData).then((session) => {
              this.options.onAuth!(userData, session.id)
            })
          } else {
            this.options.onAuth(userData)
          }
        }
      },
    }

    this.deeplinkAuth = new DeeplinkAuth(authOptions)
    this.codeAuth = new CodeAuth(authOptions)

    // Инициализация SessionManager если нужно
    if (this.options.useSessionManager) {
      this.sessionManager = new SessionManager(this.options.sessionOptions)
    }

    this.setupBot()
    this.setupWebhook()
  }

  /** Настройка бота */
  private setupBot() {
    // Обработка команды /start с токеном (deeplink)
    this.bot.command('start', async (ctx) => {
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
        }
        const ok = this.deeplinkAuth.handleAuth(token, user)
        if (ok) {
          await ctx.reply('Вы успешно авторизованы через ссылку!')
        } else {
          await ctx.reply('Ссылка недействительна или уже использована.')
        }
        return
      }

      // CodeAuth: просто /start — генерируем код
      const code = this.codeAuth.generateCode()
      await ctx.reply(`Ваш код для авторизации: ${code}`)
    })

    // Обработка кодов
    this.bot.on('message', async (ctx) => {
      const text = ctx.message?.text?.trim()
      if (!text || text.startsWith('/') || !ctx.from) return

      // Проверяем, есть ли такой код
      const user: AuthResult = {
        id: ctx.from.id,
        is_bot: ctx.from.is_bot,
        first_name: ctx.from.first_name,
        last_name: ctx.from.last_name,
        username: ctx.from.username,
        language_code: ctx.from.language_code,
      }
      const ok = this.codeAuth.handleAuth(text, user)
      if (ok) {
        await ctx.reply('Вы успешно авторизованы по коду!')
      }
    })
  }

  /** Настройка webhook сервера */
  private setupWebhook() {
    this.app.use(express.json())

    // Обработка webhook от Telegram
    this.app.post(this.options.webhookPath, (req, res) => {
      // Проверка secretToken, если задан
      if (
        this.options.secretToken &&
        req.headers['x-telegram-bot-api-secret-token'] !==
          this.options.secretToken
      ) {
        return res.status(403).send('Forbidden')
      }

      this.bot.handleUpdate(req.body)
      res.sendStatus(200)
    })

    // API для генерации deeplink
    this.app.get('/generate-deeplink', (req, res) => {
      const deeplink = this.deeplinkAuth.generateDeeplink()
      res.json({ success: true, deeplink })
    })

    // API для генерации кода
    this.app.get('/generate-code', (req, res) => {
      const code = this.codeAuth.generateCode()
      res.json({ success: true, code })
    })

    // API для проверки сессии (если включен механизм сессий)
    if (this.options.useSessionManager && this.sessionManager) {
      this.app.get('/check-session/:sessionId', (req, res) => {
        const { sessionId } = req.params
        const session = this.sessionManager?.getSession(sessionId)
        if (session) {
          res.json({ success: true, session })
        } else {
          res
            .status(404)
            .json({ success: false, message: 'Сессия не найдена или истекла' })
        }
      })
    }
  }

  /** Запуск сервера webhook */
  async start() {
    // Настройка webhook в Telegram Bot API
    await this.bot.api.setWebhook(
      `${this.options.webhookBaseUrl}${this.options.webhookPath}`,
      {
        secret_token: this.options.secretToken || undefined,
      }
    )

    // Запуск Express сервера
    this.app.listen(this.options.port, () => {
      console.log(`Webhook сервер запущен на порту ${this.options.port}`)
    })
  }

  /** Остановка сервера и удаление webhook */
  async stop() {
    try {
      await this.bot.api.deleteWebhook()
    } catch (error) {
      console.error('Ошибка при удалении webhook:', error)
    }
  }

  /** Получить Express приложение для дополнительной настройки */
  getExpressApp() {
    return this.app
  }

  /** Получить экземпляр бота для дополнительной настройки */
  getBot() {
    return this.bot
  }

  /** Получить DeeplinkAuth для дополнительной настройки */
  getDeeplinkAuth() {
    return this.deeplinkAuth
  }

  /** Получить CodeAuth для дополнительной настройки */
  getCodeAuth() {
    return this.codeAuth
  }

  /** Получить SessionManager для дополнительной настройки */
  getSessionManager() {
    return this.sessionManager
  }
}
