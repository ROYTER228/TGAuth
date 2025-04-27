/**
 * TGAuth - Универсальная авторизация через Telegram
 *
 * Основной модуль, экспортирующий все компоненты библиотеки
 */

// Методы авторизации
export { DeeplinkAuth } from './Auth/DeeplinkAuth.js'
export { CodeAuth } from './Auth/CodeAuth.js'
export { WidgetAuth, type WidgetAuthOptions } from './Auth/WidgetAuth.js'
export { TwoFAAuth, type TwoFAOptions } from './Auth/TwoFAAuth.js'

// Управление сессиями
export {
  SessionManager,
  type SessionOptions,
  type Session,
} from './Auth/SessionManager.js'

// Интеграции с фреймворками
export {
  WebhookIntegration,
  type WebhookOptions,
} from './Auth/WebhookIntegration.js'
export {
  TelegrafIntegration,
  type TelegrafIntegrationOptions,
} from './integrations/TelegrafIntegration.js'
export {
  NestJSIntegration,
  type NestJSIntegrationOptions,
} from './integrations/NestJSIntegration.js'

// Типы данных
export * from './types.js'

// Логирование и аудит
export { logger, LogLevel, LogCategory } from './core/Logger.js'
export { AuditEventType } from './core/AuditService.js'

// Настройки бота
export {
  TelegramBotSettings,
  type BotMessages,
} from './core/TelegramBotSettings.js'

// Компоненты для Vue и React экспортируются отдельно через подпути:
// import { TelegramLoginButton } from 'tgauth/vue'
// import { TelegramLoginButton } from 'tgauth/react'

// Примеры использования:
// import './exampleGrammyIntegration.js'
