/**
 * Настройки Telegram бота для авторизации
 */

export interface BotMessages {
  /** Сообщение при успешной авторизации */
  authSuccess?: string
  /** Сообщение при ошибке авторизации */
  authError?: string
  /** Сообщение с кодом для двухфакторной авторизации */
  twoFACode?: string
  /** Сообщение при успешной двухфакторной авторизации */
  twoFASuccess?: string
  /** Сообщение при неверном коде двухфакторной авторизации */
  twoFAInvalidCode?: string
  /** Сообщение при истечении срока действия кода */
  twoFAExpired?: string
  /** Сообщение при превышении максимального количества попыток */
  twoFAMaxAttempts?: string
}

/**
 * Класс для централизованного хранения настроек Telegram бота
 *
 * Пример использования:
 * ```typescript
 * const botSettings = new TelegramBotSettings({
 *   botToken: 'YOUR_BOT_TOKEN',
 *   botUsername: 'your_bot_username',
 *   messages: {
 *     authSuccess: 'Вы успешно авторизованы!',
 *     twoFACode: 'Ваш код для входа: {code}'
 *   }
 * })
 *
 * const deeplinkAuth = new DeeplinkAuth({ botSettings })
 * ```
 */
export class TelegramBotSettings {
  /** Токен Telegram бота */
  readonly botToken: string

  /** Имя пользователя Telegram бота (без символа @) */
  readonly botUsername?: string

  /** Кастомные сообщения бота */
  readonly messages: BotMessages

  /**
   * Создает экземпляр настроек Telegram бота
   * @param options Параметры настроек
   */
  constructor(options: {
    botToken: string
    botUsername?: string
    messages?: BotMessages
  }) {
    this.botToken = options.botToken
    this.botUsername = options.botUsername
    this.messages = options.messages || {}
  }

  /**
   * Получить имя пользователя бота
   * @returns Имя пользователя бота или значение по умолчанию
   */
  getBotUsername(): string {
    return this.botUsername || 'YOUR_BOT_USERNAME'
  }

  /**
   * Получить сообщение с подстановкой параметров
   * @param key Ключ сообщения
   * @param defaultMessage Сообщение по умолчанию
   * @param params Параметры для подстановки в формате {key: value}
   * @returns Отформатированное сообщение
   */
  getMessage(
    key: keyof BotMessages,
    defaultMessage: string,
    params?: Record<string, string | number>
  ): string {
    let message = this.messages[key] || defaultMessage

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        message = message.replace(`{${key}}`, String(value))
      })
    }

    return message
  }
}
