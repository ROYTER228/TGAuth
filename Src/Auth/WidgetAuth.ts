import { createHash, createHmac } from 'crypto'
import { AuthTransportOptions } from './DeeplinkAuth.js'
import { AuthResult } from '../types.js'
import { logger, LogCategory, LogLevel } from '../core/Logger.js'

export interface WidgetAuthOptions extends AuthTransportOptions {
  /** Секретный ключ для проверки данных виджета */
  botToken: string
  /** Проверять подпись данных виджета */
  validateSignature?: boolean
}

/**
 * Класс для авторизации через Telegram Login Widget
 *
 * Пример использования:
 * ```typescript
 * const widgetAuth = new WidgetAuth({
 *   botToken: 'YOUR_BOT_TOKEN',
 *   transport: ['callback'],
 *   onAuth: (userData) => {
 *     console.log('Пользователь авторизован через виджет:', userData)
 *   },
 *   validateSignature: true
 * })
 *
 * // Обработка данных от виджета (например, в Express)
 * app.post('/auth/telegram-widget', (req, res) => {
 *   const widgetData = req.body
 *   const isValid = widgetAuth.handleAuth(widgetData)
 *
 *   if (isValid) {
 *     res.json({ success: true })
 *   } else {
 *     res.status(400).json({ success: false, message: 'Invalid widget data' })
 *   }
 * })
 * ```
 */
export class WidgetAuth {
  private options: Required<WidgetAuthOptions>

  constructor(options: WidgetAuthOptions) {
    this.options = {
      ...options,
      validateSignature:
        options.validateSignature !== undefined
          ? options.validateSignature
          : true,
    }
  }

  /**
   * Обрабатывает данные, полученные от Telegram Login Widget
   * @param data Данные от виджета
   * @returns true если данные валидны, иначе false
   */
  handleAuth(data: any): boolean {
    if (!data || typeof data !== 'object') {
      logger.log({
        level: LogLevel.WARN,
        category: LogCategory.AUTH,
        message: 'Invalid widget data: not an object',
        data: { data },
      })
      return false
    }

    // Проверяем обязательные поля
    const requiredFields = ['id', 'first_name', 'auth_date', 'hash']
    for (const field of requiredFields) {
      if (!data[field]) {
        logger.log({
          level: LogLevel.WARN,
          category: LogCategory.AUTH,
          message: `Invalid widget data: missing ${field}`,
          data: { data },
        })
        return false
      }
    }

    // Проверяем, не устарели ли данные (не старше 24 часов)
    const authDate = parseInt(data.auth_date)
    const now = Math.floor(Date.now() / 1000)
    if (now - authDate > 86400) {
      logger.log({
        level: LogLevel.WARN,
        category: LogCategory.AUTH,
        message: 'Widget data expired',
        data: { authDate, now, diff: now - authDate },
      })
      return false
    }

    // Проверяем подпись, если включена валидация
    if (this.options.validateSignature) {
      const isValid = this.validateSignature(data)
      if (!isValid) {
        logger.log({
          level: LogLevel.WARN,
          category: LogCategory.AUTH,
          message: 'Invalid widget signature',
          data: { hash: data.hash },
        })
        return false
      }
    }

    // Преобразуем данные в AuthResult
    const userData: AuthResult = {
      id: parseInt(data.id),
      is_bot: false,
      first_name: data.first_name,
      last_name: data.last_name,
      username: data.username,
      language_code: data.language_code,
      photo_url: data.photo_url,
    }

    // Отправляем результат через выбранный транспорт
    this.sendResult(userData)

    logger.log({
      level: LogLevel.INFO,
      category: LogCategory.AUTH,
      message: 'User authenticated via widget',
      data: { userId: userData.id, username: userData.username },
    })

    return true
  }

  /**
   * Проверяет подпись данных виджета
   * @param data Данные от виджета
   * @returns true если подпись валидна, иначе false
   */
  private validateSignature(data: any): boolean {
    const hash = data.hash
    delete data.hash

    // Создаем строку проверки
    const dataCheckArr: string[] = []
    Object.keys(data)
      .sort()
      .forEach((key) => {
        if (data[key]) {
          dataCheckArr.push(`${key}=${data[key]}`)
        }
      })
    const dataCheckString = dataCheckArr.join('\n')

    // Создаем секретный ключ из токена бота
    const secretKey = createHash('sha256')
      .update(this.options.botToken)
      .digest()

    // Вычисляем HMAC-SHA-256
    const hmac = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex')

    // Восстанавливаем hash в данных
    data.hash = hash

    return hmac === hash
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
        this.options.wsServer.emit('tgauth:widget', userData)
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
