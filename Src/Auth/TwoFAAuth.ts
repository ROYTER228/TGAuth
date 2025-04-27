import { randomBytes } from 'crypto'
import { AuthTransportOptions } from './DeeplinkAuth.js'
import { AuthResult } from '../types.js'
import { logger, LogCategory, LogLevel } from '../core/Logger.js'
import { TelegramBotSettings } from '../core/TelegramBotSettings.js'

interface TwoFASession {
  userId: string | number
  code: string
  createdAt: number
  expiresAt: number
  used: boolean
  verified: boolean
  userData?: AuthResult
}

export interface TwoFAOptions extends AuthTransportOptions {
  /** Время жизни кода 2FA в миллисекундах. По умолчанию 5 минут */
  codeLifetime?: number
  /** Длина кода 2FA. По умолчанию 6 символов */
  codeLength?: number
  /** Максимальное количество попыток ввода кода. По умолчанию 3 */
  maxAttempts?: number
}

/**
 * Класс для реализации двухфакторной аутентификации через Telegram
 *
 * Пример использования:
 * ```typescript
 * const twoFAAuth = new TwoFAAuth({
 *   botToken: 'YOUR_BOT_TOKEN',
 *   transport: ['callback'],
 *   onAuth: (userData) => {
 *     console.log('2FA успешно пройдена:', userData)
 *   },
 *   codeLifetime: 1000 * 60 * 5, // 5 минут
 *   codeLength: 6,
 *   maxAttempts: 3
 * })
 *
 * // Инициировать 2FA для пользователя
 * const code = twoFAAuth.start2FA(userId)
 *
 * // Проверить код 2FA
 * const isValid = twoFAAuth.verify2FA(userId, userEnteredCode)
 * ```
 */
export class TwoFAAuth {
  private sessions: Map<string, TwoFASession> = new Map()
  private attempts: Map<string, number> = new Map()
  private botSettings: TelegramBotSettings
  private options: Required<TwoFAOptions>

  constructor(options: TwoFAOptions) {
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

    this.options = {
      ...options,
      codeLifetime: options.codeLifetime || 1000 * 60 * 5, // 5 минут по умолчанию
      codeLength: options.codeLength || 6,
      maxAttempts: options.maxAttempts || 3,
    }
  }

  /**
   * Инициирует процесс 2FA для пользователя
   * @param userId ID пользователя
   * @param userData Дополнительные данные пользователя (опционально)
   * @param sendMessage Отправить сообщение с кодом пользователю (опционально)
   * @returns Сгенерированный код 2FA
   */
  start2FA(
    userId: string | number,
    userData?: AuthResult,
    sendMessage: boolean = false
  ): string {
    // Генерируем код нужной длины
    const code = this.generateCode(this.options.codeLength)

    // Создаем сессию 2FA
    const sessionKey = `${userId}`
    this.sessions.set(sessionKey, {
      userId,
      code,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.options.codeLifetime,
      used: false,
      verified: false,
      userData,
    })

    // Сбрасываем счетчик попыток
    this.attempts.set(sessionKey, 0)

    logger.log({
      level: LogLevel.INFO,
      category: LogCategory.AUTH,
      message: `2FA initiated for user ${userId}`,
      data: { userId },
    })

    // Если нужно отправить сообщение пользователю
    if (sendMessage) {
      // Здесь можно реализовать отправку сообщения через Telegram API
      // Используем кастомное сообщение или сообщение по умолчанию
      const message = this.botSettings.getMessage(
        'twoFACode',
        'Ваш код для входа: {code}',
        { code }
      )

      // TODO: Реализовать отправку сообщения через Telegram API
      // Пример: this.sendTelegramMessage(userId, message)
    }

    return code
  }

  /**
   * Проверяет код 2FA
   * @param userId ID пользователя
   * @param code Код 2FA для проверки
   * @returns true если код верный, иначе false
   */
  verify2FA(userId: string | number, code: string): boolean {
    const sessionKey = `${userId}`
    const session = this.sessions.get(sessionKey)

    // Проверяем существование сессии
    if (!session) {
      logger.log({
        level: LogLevel.WARN,
        category: LogCategory.AUTH,
        message: `2FA session not found for user ${userId}`,
        data: { userId },
      })
      return false
    }

    // Проверяем, не истекла ли сессия
    if (Date.now() > session.expiresAt) {
      logger.log({
        level: LogLevel.WARN,
        category: LogCategory.AUTH,
        message: `2FA code expired for user ${userId}`,
        data: { userId },
      })
      return false
    }

    // Проверяем, не использована ли уже сессия
    if (session.used) {
      logger.log({
        level: LogLevel.WARN,
        category: LogCategory.AUTH,
        message: `2FA code already used for user ${userId}`,
        data: { userId },
      })
      return false
    }

    // Проверяем количество попыток
    const attempts = this.attempts.get(sessionKey) || 0
    if (attempts >= this.options.maxAttempts) {
      logger.log({
        level: LogLevel.WARN,
        category: LogCategory.AUTH,
        message: `Too many 2FA attempts for user ${userId}`,
        data: { userId, attempts },
      })
      return false
    }

    // Увеличиваем счетчик попыток
    this.attempts.set(sessionKey, attempts + 1)

    // Проверяем код
    if (session.code !== code) {
      logger.log({
        level: LogLevel.WARN,
        category: LogCategory.AUTH,
        message: `Invalid 2FA code for user ${userId}`,
        data: { userId, attempts: attempts + 1 },
      })
      return false
    }

    // Код верный, отмечаем сессию как использованную
    session.used = true
    session.verified = true
    this.sessions.set(sessionKey, session)

    // Отправляем результат через выбранный транспорт
    if (session.userData) {
      this.sendResult(session.userData)
    } else {
      this.sendResult({
        id: userId,
        is_bot: false,
        first_name: 'Unknown',
        twofa_verified: true,
      })
    }

    logger.log({
      level: LogLevel.INFO,
      category: LogCategory.AUTH,
      message: `2FA verified successfully for user ${userId}`,
      data: { userId },
    })

    return true
  }

  /**
   * Проверяет, прошел ли пользователь 2FA
   * @param userId ID пользователя
   * @returns true если 2FA пройдена, иначе false
   */
  isVerified(userId: string | number): boolean {
    const sessionKey = `${userId}`
    const session = this.sessions.get(sessionKey)
    return session ? session.verified : false
  }

  /**
   * Сбрасывает 2FA для пользователя
   * @param userId ID пользователя
   */
  reset2FA(userId: string | number): void {
    const sessionKey = `${userId}`
    this.sessions.delete(sessionKey)
    this.attempts.delete(sessionKey)

    logger.log({
      level: LogLevel.INFO,
      category: LogCategory.AUTH,
      message: `2FA reset for user ${userId}`,
      data: { userId },
    })
  }

  /**
   * Генерирует случайный код указанной длины
   * @param length Длина кода
   * @returns Сгенерированный код
   */
  private generateCode(length: number): string {
    // Для простых случаев используем числовой код
    if (length <= 8) {
      const min = Math.pow(10, length - 1)
      const max = Math.pow(10, length) - 1
      return Math.floor(min + Math.random() * (max - min + 1)).toString()
    }

    // Для более длинных кодов используем криптографически стойкий генератор
    return randomBytes(Math.ceil(length / 2))
      .toString('hex')
      .slice(0, length)
  }

  /**
   * Передача результата через выбранный транспорт
   * @param userData Данные пользователя
   */
  private sendResult(userData: AuthResult): void {
    // Callback
    if (
      this.options.transport?.includes('callback') &&
      this.options.onAuth &&
      typeof this.options.onAuth === 'function'
    ) {
      try {
        this.options.onAuth(userData)
      } catch (error) {
        logger.log({
          level: LogLevel.ERROR,
          category: LogCategory.AUTH,
          message: 'Error in onAuth callback',
          data: { error },
        })
      }
    }

    // REST API
    if (this.options.transport?.includes('rest') && this.options.restEndpoint) {
      fetch(this.options.restEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      }).catch((error) => {
        logger.log({
          level: LogLevel.ERROR,
          category: LogCategory.AUTH,
          message: 'Error sending REST request',
          data: { error, endpoint: this.options.restEndpoint },
        })
      })
    }

    // WebSocket
    if (
      this.options.transport?.includes('websocket') &&
      this.options.wsServer &&
      typeof this.options.wsServer.emit === 'function'
    ) {
      try {
        this.options.wsServer.emit('tgauth:2fa', userData)
      } catch (error) {
        logger.log({
          level: LogLevel.ERROR,
          category: LogCategory.AUTH,
          message: 'Error sending WebSocket message',
          data: { error },
        })
      }
    }

    // Дополнительный обработчик сохранения
    if (
      this.options.saveHandler &&
      typeof this.options.saveHandler === 'function'
    ) {
      try {
        this.options.saveHandler(userData)
      } catch (error) {
        logger.log({
          level: LogLevel.ERROR,
          category: LogCategory.AUTH,
          message: 'Error in saveHandler',
          data: { error },
        })
      }
    }
  }
}
