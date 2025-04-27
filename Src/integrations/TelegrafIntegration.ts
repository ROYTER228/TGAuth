import { Telegraf, Context } from 'telegraf'
import { DeeplinkAuth, AuthTransportOptions } from '../Auth/DeeplinkAuth.js'
import { CodeAuth } from '../Auth/CodeAuth.js'
import { AuthResult } from '../types.js'
import { SessionManager } from '../Auth/SessionManager.js'

export interface TelegrafIntegrationOptions {
  /** Токен бота Telegram */
  botToken: string
  /** Использовать механизм сессий */
  useSessionManager?: boolean
  /** Опции для авторизации */
  authOptions?: Partial<AuthTransportOptions>
  /** Опции менеджера сессий */
  sessionOptions?: Record<string, any>
}

export class TelegrafIntegration {
  private bot: Telegraf
  private deeplinkAuth: DeeplinkAuth
  private codeAuth: CodeAuth
  private sessionManager?: SessionManager
  private options: Required<
    Omit<TelegrafIntegrationOptions, 'authOptions' | 'sessionOptions'>
  > & {
    authOptions?: Partial<AuthTransportOptions>
    sessionOptions?: Record<string, any>
  }

  constructor(options: TelegrafIntegrationOptions) {
    this.options = {
      botToken: options.botToken,
      useSessionManager: options.useSessionManager ?? true,
      authOptions: options.authOptions,
      sessionOptions: options.sessionOptions,
    }

    this.bot = new Telegraf(this.options.botToken)

    // Инициализация DeeplinkAuth и CodeAuth
    const authOptions: AuthTransportOptions = {
      botToken: this.options.botToken,
      transport: ['callback'],
      onAuth: (userData: AuthResult) => {
        if (this.options.authOptions?.onAuth) {
          if (this.options.useSessionManager && this.sessionManager) {
            this.sessionManager.createSession(userData).then((session) => {
              this.options.authOptions?.onAuth?.(userData)
            })
          } else {
            this.options.authOptions.onAuth(userData)
          }
        }
      },
      ...this.options.authOptions,
    }

    this.deeplinkAuth = new DeeplinkAuth(authOptions)
    this.codeAuth = new CodeAuth(authOptions)

    // Инициализация SessionManager если нужно
    if (this.options.useSessionManager) {
      this.sessionManager = new SessionManager(this.options.sessionOptions)
    }

    this.setupBot()
  }

  /** Настройка бота */
  private setupBot() {
    // Обработка команды /start с токеном (deeplink)
    this.bot.command('start', async (ctx) => {
      const text = ctx.message?.text || ''
      const args = text.split(' ')
      const from = ctx.from

      if (args && args.length > 1 && from) {
        // Deeplink с токеном
        const token = args[1]
        const user: AuthResult = {
          id: from.id,
          is_bot: from.is_bot,
          first_name: from.first_name,
          last_name: from.last_name,
          username: from.username,
          language_code: from.language_code,
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
    this.bot.on('text', async (ctx) => {
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

  /** Запуск бота */
  async start() {
    await this.bot.launch()
    console.log('Telegraf бот успешно запущен!')
  }

  /** Остановка бота */
  async stop() {
    this.bot.stop()
  }

  /** Получить экземпляр Telegraf бота для дополнительной настройки */
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

  /** Генерировать deeplink для авторизации */
  generateDeeplink() {
    return this.deeplinkAuth.generateDeeplink()
  }

  /** Генерировать код для авторизации */
  generateCode() {
    return this.codeAuth.generateCode()
  }
}
