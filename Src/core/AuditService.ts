/**
 * Сервис аудита для TGAuth
 * Обеспечивает детальное отслеживание всех действий авторизации и сессий для целей безопасности
 */

import { logger, LogCategory, LogLevel } from './Logger.js'
import { AuthResult } from '../types.js'

export enum AuditEventType {
  // События авторизации
  AUTH_DEEPLINK_GENERATED = 'auth.deeplink.generated',
  AUTH_DEEPLINK_USED = 'auth.deeplink.used',
  AUTH_DEEPLINK_INVALID = 'auth.deeplink.invalid',
  AUTH_DEEPLINK_EXPIRED = 'auth.deeplink.expired',

  AUTH_CODE_GENERATED = 'auth.code.generated',
  AUTH_CODE_USED = 'auth.code.used',
  AUTH_CODE_INVALID = 'auth.code.invalid',
  AUTH_CODE_EXPIRED = 'auth.code.expired',

  AUTH_WIDGET_SUCCESS = 'auth.widget.success',
  AUTH_WIDGET_INVALID = 'auth.widget.invalid',

  AUTH_2FA_INITIATED = 'auth.2fa.initiated',
  AUTH_2FA_SUCCESS = 'auth.2fa.success',
  AUTH_2FA_FAILED = 'auth.2fa.failed',

  // События сессий
  SESSION_CREATED = 'session.created',
  SESSION_ACCESSED = 'session.accessed',
  SESSION_UPDATED = 'session.updated',
  SESSION_EXPIRED = 'session.expired',
  SESSION_DELETED = 'session.deleted',

  // События безопасности
  SECURITY_SUSPICIOUS_IP = 'security.suspicious_ip',
  SECURITY_TOO_MANY_ATTEMPTS = 'security.too_many_attempts',
  SECURITY_INVALID_TOKEN = 'security.invalid_token',

  // События интеграций
  INTEGRATION_WEBHOOK_RECEIVED = 'integration.webhook.received',
  INTEGRATION_WEBHOOK_ERROR = 'integration.webhook.error',
  INTEGRATION_BOT_COMMAND = 'integration.bot.command',
}

export interface AuditEventData {
  // Общие поля
  timestamp: number
  eventType: AuditEventType
  eventId: string

  // Данные пользователя (если есть)
  userId?: number
  username?: string

  // Метаданные
  ip?: string
  userAgent?: string

  // Прочие данные события
  metadata?: Record<string, any>
}

export interface AuditStorageAdapter {
  saveEvent(event: AuditEventData): Promise<void>
  getEvents(options: {
    fromTimestamp?: number
    toTimestamp?: number
    eventTypes?: AuditEventType[]
    userId?: number
    limit?: number
    offset?: number
  }): Promise<AuditEventData[]>
}

/** Хранилище аудита в памяти (для тестирования или небольших приложений) */
export class MemoryAuditStorage implements AuditStorageAdapter {
  private events: AuditEventData[] = []
  private readonly maxEvents: number

  constructor(options: { maxEvents?: number } = {}) {
    this.maxEvents = options.maxEvents || 10000
  }

  async saveEvent(event: AuditEventData): Promise<void> {
    this.events.push({ ...event })

    // Ограничиваем размер хранилища
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents)
    }
  }

  async getEvents(options: {
    fromTimestamp?: number
    toTimestamp?: number
    eventTypes?: AuditEventType[]
    userId?: number
    limit?: number
    offset?: number
  }): Promise<AuditEventData[]> {
    let filteredEvents = [...this.events]

    // Применяем фильтры
    if (options.fromTimestamp !== undefined) {
      filteredEvents = filteredEvents.filter(
        (e) => e.timestamp >= options.fromTimestamp!
      )
    }

    if (options.toTimestamp !== undefined) {
      filteredEvents = filteredEvents.filter(
        (e) => e.timestamp <= options.toTimestamp!
      )
    }

    if (options.eventTypes !== undefined && options.eventTypes.length > 0) {
      filteredEvents = filteredEvents.filter((e) =>
        options.eventTypes!.includes(e.eventType)
      )
    }

    if (options.userId !== undefined) {
      filteredEvents = filteredEvents.filter((e) => e.userId === options.userId)
    }

    // Сортировка по времени (от новых к старым)
    filteredEvents.sort((a, b) => b.timestamp - a.timestamp)

    // Применяем пагинацию
    const offset = options.offset || 0
    const limit = options.limit || filteredEvents.length

    return filteredEvents.slice(offset, offset + limit)
  }

  /** Очистить все события */
  clear(): void {
    this.events = []
  }
}

/** Адаптер для хранения аудита в файле (для простых приложений) */
export class FileAuditStorage implements AuditStorageAdapter {
  private readonly filePath: string
  private fs: any

  constructor(options: { filePath: string }) {
    this.filePath = options.filePath

    // Динамический импорт fs, так как это Node.js модуль
    try {
      this.fs = import('fs').then((module) => module.default || module)
    } catch (e) {
      throw new Error('FileAuditStorage требует Node.js окружения с модулем fs')
    }
  }

  async saveEvent(event: AuditEventData): Promise<void> {
    const fs = await this.fs
    const eventStr = JSON.stringify(event) + '\n'

    try {
      fs.appendFileSync(this.filePath, eventStr)
    } catch (error) {
      console.error(`Ошибка при записи события аудита в файл: ${error}`)
      // Перенаправляем в лог
      logger.error(LogCategory.SECURITY, 'Ошибка записи аудита в файл', {
        error,
        event,
      })
    }
  }

  async getEvents(options: {
    fromTimestamp?: number
    toTimestamp?: number
    eventTypes?: AuditEventType[]
    userId?: number
    limit?: number
    offset?: number
  }): Promise<AuditEventData[]> {
    const fs = await this.fs

    try {
      // Читаем файл построчно
      const content = fs.readFileSync(this.filePath, 'utf8')
      const lines = content
        .split('\n')
        .filter((line: string) => line.trim() !== '')

      // Парсим события
      const events: AuditEventData[] = []
      for (const line of lines) {
        try {
          const event = JSON.parse(line)
          events.push(event)
        } catch (e) {
          logger.warn(
            LogCategory.SECURITY,
            'Не удалось разобрать строку аудита',
            {
              line,
              error: e,
            }
          )
        }
      }

      // Применяем те же фильтры, что и в MemoryAuditStorage
      let filteredEvents = [...events]

      if (options.fromTimestamp !== undefined) {
        filteredEvents = filteredEvents.filter(
          (e) => e.timestamp >= options.fromTimestamp!
        )
      }

      if (options.toTimestamp !== undefined) {
        filteredEvents = filteredEvents.filter(
          (e) => e.timestamp <= options.toTimestamp!
        )
      }

      if (options.eventTypes !== undefined && options.eventTypes.length > 0) {
        filteredEvents = filteredEvents.filter((e) =>
          options.eventTypes!.includes(e.eventType)
        )
      }

      if (options.userId !== undefined) {
        filteredEvents = filteredEvents.filter(
          (e) => e.userId === options.userId
        )
      }

      // Сортировка по времени (от новых к старым)
      filteredEvents.sort((a, b) => b.timestamp - a.timestamp)

      // Применяем пагинацию
      const offset = options.offset || 0
      const limit = options.limit || filteredEvents.length

      return filteredEvents.slice(offset, offset + limit)
    } catch (error) {
      logger.error(LogCategory.SECURITY, 'Ошибка чтения аудита из файла', {
        error,
      })
      return []
    }
  }
}

/** Главный класс сервиса аудита */
export class AuditService {
  private static instance: AuditService
  private storage: AuditStorageAdapter | null = null
  private enabled: boolean = false

  // Для генерации уникальных ID событий
  private idCounter: number = 0

  private constructor() {
    // Приватный конструктор для паттерна Singleton
  }

  /**
   * Получить экземпляр сервиса аудита (Singleton)
   */
  public static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService()
    }
    return AuditService.instance
  }

  /**
   * Инициализировать сервис аудита
   */
  public init(options: {
    storage: AuditStorageAdapter
    enabled?: boolean
  }): AuditService {
    this.storage = options.storage
    this.enabled = options.enabled !== undefined ? options.enabled : true

    logger.info(LogCategory.SECURITY, 'Сервис аудита инициализирован', {
      enabled: this.enabled,
      storageType: this.storage.constructor.name,
    })

    return this
  }

  /**
   * Включить/выключить аудит
   */
  public setEnabled(enabled: boolean): AuditService {
    this.enabled = enabled
    return this
  }

  /**
   * Получить статус аудита
   */
  public isEnabled(): boolean {
    return this.enabled && this.storage !== null
  }

  /**
   * Записать событие аудита
   */
  public async recordEvent(
    eventType: AuditEventType,
    userData?: Partial<AuthResult>,
    metadata?: Record<string, any>,
    contextData?: {
      ip?: string
      userAgent?: string
    }
  ): Promise<void> {
    if (!this.isEnabled()) {
      return
    }

    try {
      const event: AuditEventData = {
        timestamp: Date.now(),
        eventType,
        eventId: this.generateEventId(),
        userId: userData?.id,
        username: userData?.username,
        ip: contextData?.ip,
        userAgent: contextData?.userAgent,
        metadata,
      }

      await this.storage!.saveEvent(event)

      // Дублируем в лог для отладки
      logger.debug(LogCategory.SECURITY, `Аудит: ${eventType}`, {
        eventId: event.eventId,
        userId: event.userId,
        metadata: event.metadata,
      })
    } catch (error) {
      logger.error(LogCategory.SECURITY, 'Ошибка при записи события аудита', {
        error,
        eventType,
        userData,
        metadata,
      })
    }
  }

  /**
   * Получить события аудита
   */
  public async getEvents(options: {
    fromTimestamp?: number
    toTimestamp?: number
    eventTypes?: AuditEventType[]
    userId?: number
    limit?: number
    offset?: number
  }): Promise<AuditEventData[]> {
    if (!this.isEnabled()) {
      return []
    }

    try {
      return await this.storage!.getEvents(options)
    } catch (error) {
      logger.error(
        LogCategory.SECURITY,
        'Ошибка при получении событий аудита',
        {
          error,
          options,
        }
      )
      return []
    }
  }

  /**
   * Записать различные события авторизации
   */
  public async recordDeeplinkGenerated(
    token: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.recordEvent(AuditEventType.AUTH_DEEPLINK_GENERATED, undefined, {
      token: token.substring(0, 4) + '...',
      ...metadata,
    })
  }

  public async recordDeeplinkUsed(
    userData: AuthResult,
    token: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.recordEvent(AuditEventType.AUTH_DEEPLINK_USED, userData, {
      token: token.substring(0, 4) + '...',
      ...metadata,
    })
  }

  public async recordCodeGenerated(
    code: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.recordEvent(AuditEventType.AUTH_CODE_GENERATED, undefined, {
      code: code.substring(0, 2) + '...',
      ...metadata,
    })
  }

  public async recordCodeUsed(
    userData: AuthResult,
    code: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.recordEvent(AuditEventType.AUTH_CODE_USED, userData, {
      code: code.substring(0, 2) + '...',
      ...metadata,
    })
  }

  public async recordSessionCreated(
    userId: number,
    sessionId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.recordEvent(
      AuditEventType.SESSION_CREATED,
      { id: userId },
      {
        sessionId: sessionId.substring(0, 4) + '...',
        ...metadata,
      }
    )
  }

  public async recordSessionAccessed(
    userId: number,
    sessionId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.recordEvent(
      AuditEventType.SESSION_ACCESSED,
      { id: userId },
      {
        sessionId: sessionId.substring(0, 4) + '...',
        ...metadata,
      }
    )
  }

  /**
   * Генерировать уникальный ID события
   */
  private generateEventId(): string {
    const timestamp = Date.now().toString(36)
    const counter = (this.idCounter++).toString(36).padStart(4, '0')
    const random = Math.random().toString(36).substring(2, 6)

    return `${timestamp}-${counter}-${random}`
  }
}

// Экспортируем готовый экземпляр для удобства использования
export const auditService = AuditService.getInstance()
