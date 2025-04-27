import { randomBytes } from 'crypto'
import { AuthResult } from '../types.js'
import { TelegramBotSettings } from '../core/TelegramBotSettings.js'

export interface AuthTransportOptions {
  transport?: Array<'websocket' | 'rest' | 'callback'>
  restEndpoint?: string
  wsServer?: any // типизировать позже
  onAuth?: (userData: any) => void
  saveHandler?: (data: any) => void
  botSettings: TelegramBotSettings
  // Для обратной совместимости
  botToken?: string
  botUsername?: string
}

interface DeeplinkSession {
  token: string
  createdAt: number
  used: boolean
  userData?: AuthResult
}

export class DeeplinkAuth {
  private sessions: Map<string, DeeplinkSession> = new Map()
  private botSettings: TelegramBotSettings

  constructor(private options: AuthTransportOptions) {
    // Поддержка обратной совместимости
    if (options.botSettings) {
      this.botSettings = options.botSettings
    } else if (options.botToken) {
      this.botSettings = new TelegramBotSettings({
        botToken: options.botToken,
        botUsername: options.botUsername,
      })
    } else {
      throw new Error('Необходимо указать botSettings или botToken')
    }
    // Здесь можно инициализировать бота, если нужно
  }

  /** Генерация уникального deeplink */
  generateDeeplink(): string {
    const token = randomBytes(16).toString('hex')
    this.sessions.set(token, {
      token,
      createdAt: Date.now(),
      used: false,
    })
    // Формируем ссылку для Telegram
    return `https://t.me/${this.botSettings.getBotUsername()}?start=${token}`
  }

  /** Проверка и обработка deeplink */
  handleAuth(token: string, userData: AuthResult) {
    const session = this.sessions.get(token)
    if (!session || session.used) return false
    session.used = true
    session.userData = userData
    this.sessions.set(token, session)
    this.sendResult(userData)
    return true
  }

  /** Инвалидировать deeplink вручную */
  invalidateDeeplink(token: string) {
    const session = this.sessions.get(token)
    if (session) session.used = true
  }

  /** Передача результата через выбранный транспорт */
  private sendResult(userData: AuthResult) {
    if (typeof this.options.saveHandler === 'function') {
      this.options.saveHandler(userData)
    }
    if (
      this.options.transport?.includes('callback') &&
      typeof this.options.onAuth === 'function'
    ) {
      this.options.onAuth(userData)
    }
    if (
      this.options.transport?.includes('rest') &&
      typeof this.options.restEndpoint === 'string'
    ) {
      // Пример отправки через fetch (node-fetch или axios)
      // fetch(this.options.restEndpoint, { method: 'POST', body: JSON.stringify(userData), headers: { 'Content-Type': 'application/json' } })
    }
    if (
      this.options.transport?.includes('websocket') &&
      this.options.wsServer?.emit
    ) {
      this.options.wsServer.emit('tg-auth', userData)
    }
  }

  /**
   * @deprecated Используйте botSettings.getBotUsername() вместо этого метода
   */
  private getBotUsername(): string {
    return this.botSettings.getBotUsername()
  }
}
