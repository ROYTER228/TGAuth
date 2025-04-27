/**
 * Фабрика для создания экземпляра TGAuth с необходимыми методами авторизации
 */

import { DeeplinkAuth } from './Auth/DeeplinkAuth.js'
import { CodeAuth } from './Auth/CodeAuth.js'
import { WidgetAuth } from './Auth/WidgetAuth.js'
import { TwoFAAuth, type TwoFAOptions } from './Auth/TwoFAAuth.js'
import { TelegramBotSettings } from './core/TelegramBotSettings.js'
import { SessionManager, type SessionOptions } from './Auth/SessionManager.js'
import { logger, LogLevel, LogCategory } from './core/Logger.js'

/**
 * Настройки транспорта для обмена данными
 */
interface TransportOptions {
  useWebSocket?: boolean
  socketInstance?: any // WebSocket или совместимый сервер
  callbacks?: {
    onLogin?: (userId: number, session: any) => void
    on2FA?: (userId: number, action: string) => void
    onError?: (error: Error) => void
  }
}

/**
 * Настройки методов авторизации
 */
interface AuthMethodsOptions {
  codeAuth?: boolean
  deeplinkV1?: boolean
  deeplinkV2?: boolean
  widgetAuth?: boolean
}

/**
 * Настройки двухфакторной аутентификации
 */
interface TwoFactorOptions {
  enabled: boolean
  actions?: string[]
  verificationTimeout?: number // в секундах
}

/**
 * Полные настройки для создания экземпляра TGAuth
 */
interface TelegramAuthOptions {
  botUsername: string
  botToken: string
  frontendUrl: string
  transports: TransportOptions
  enableAuthMethods?: AuthMethodsOptions
  twoFactor?: TwoFactorOptions
  sessionOptions?: SessionOptions
  logLevel?: LogLevel
}

/**
 * Интерфейс созданного экземпляра TGAuth
 */
interface TGAuth {
  codeAuth?: CodeAuth
  deeplinkV1?: DeeplinkAuth
  deeplinkV2?: DeeplinkAuth
  widgetAuth?: WidgetAuth
  twoFA?: TwoFAAuth
  session: SessionManager
}

/**
 * Создает экземпляр TGAuth с настроенными методами авторизации
 * @param options Настройки для создания TGAuth
 * @returns Экземпляр TGAuth с настроенными методами
 */
export function createTelegramAuth(options: TelegramAuthOptions): TGAuth {
  // Устанавливаем уровень логирования
  if (options.logLevel) {
    logger.info(
      LogCategory.GENERAL,
      `Установка уровня логирования: ${LogLevel[options.logLevel]}`
    )
  }

  // Настраиваем бота
  const botSettings = new TelegramBotSettings({
    botToken: options.botToken,
    botUsername: options.botUsername,
  })

  // Создаем менеджер сессий
  const sessionManager = new SessionManager(options.sessionOptions || {})

  // Результирующий объект
  const auth: TGAuth = {
    session: sessionManager,
  }

  // Настраиваем колбеки
  const callbacks = options.transports?.callbacks || {}

  // Базовые настройки для всех методов авторизации
  const baseAuthOptions = {
    botSettings,
    transport: options.transports.useWebSocket ? ['websocket'] : ['callback'],
    wsServer: options.transports.socketInstance,
    onAuth: callbacks.onLogin,
    saveHandler: callbacks.onLogin,
    frontendUrl: options.frontendUrl,
  }

  // Включаем методы авторизации в соответствии с настройками
  if (options.enableAuthMethods?.codeAuth) {
    auth.codeAuth = new CodeAuth(baseAuthOptions)
  }

  if (options.enableAuthMethods?.deeplinkV1) {
    auth.deeplinkV1 = new DeeplinkAuth(baseAuthOptions)
  }

  if (options.enableAuthMethods?.deeplinkV2) {
    auth.deeplinkV2 = new DeeplinkAuth({
      ...baseAuthOptions,
      // Дополнительные параметры для версии 2, если необходимо
    })
  }

  if (options.enableAuthMethods?.widgetAuth) {
    auth.widgetAuth = new WidgetAuth(baseAuthOptions)
  }

  // Настраиваем 2FA если включено
  if (options.twoFactor?.enabled) {
    auth.twoFA = new TwoFAAuth({
      ...baseAuthOptions,
      verificationTimeout: options.twoFactor.verificationTimeout || 300, // 5 минут по умолчанию
      onVerify: callbacks.on2FA,
    })
  }

  return auth
}
