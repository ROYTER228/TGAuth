import { randomBytes } from 'crypto'
import { AuthTransportOptions } from './DeeplinkAuth.js'
import { AuthResult } from '../types.js'
import { TelegramBotSettings } from '../core/TelegramBotSettings.js'

interface CodeSession {
  code: string
  createdAt: number
  used: boolean
  userData?: AuthResult
}

export class CodeAuth {
  private sessions: Map<string, CodeSession> = new Map()
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

  /** Генерация уникального кода */
  generateCode(): string {
    const code = Math.floor(100000 + Math.random() * 900000).toString() // 6-значный код
    this.sessions.set(code, {
      code,
      createdAt: Date.now(),
      used: false,
    })
    return code
  }

  /** Проверка и обработка кода */
  handleAuth(code: string, userData: AuthResult) {
    const session = this.sessions.get(code)
    if (!session || session.used) return false
    session.used = true
    session.userData = userData
    this.sessions.set(code, session)
    this.sendResult(userData)
    return true
  }

  /** Инвалидировать код вручную */
  invalidateCode(code: string) {
    const session = this.sessions.get(code)
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
}
