import { AuthResult } from '../types.js'

export interface SessionOptions {
  /** Время жизни сессии в миллисекундах. По умолчанию 30 дней */
  sessionLifetime?: number
  /** Функция для сохранения сессий (например, в БД) */
  persistentStore?: {
    save: (sessions: Map<string, Session>) => Promise<void>
    load: () => Promise<Map<string, Session>>
  }
  /** Генератор сессионного токена */
  tokenGenerator?: () => string
}

export interface Session {
  /** ID сессии */
  id: string
  /** Данные пользователя */
  userData: AuthResult
  /** Время создания сессии */
  createdAt: number
  /** Время последней активности */
  lastActivity: number
  /** Дополнительные данные сессии */
  metadata?: Record<string, any>
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map()
  private options: Required<SessionOptions>

  constructor(options: SessionOptions = {}) {
    this.options = {
      sessionLifetime: options.sessionLifetime || 1000 * 60 * 60 * 24 * 30, // 30 дней
      persistentStore: options.persistentStore || {
        save: async () => {
          /* По умолчанию только в памяти */
        },
        load: async () => new Map(),
      },
      tokenGenerator:
        options.tokenGenerator ||
        (() => {
          return (
            Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15)
          )
        }),
    }

    // Запускаем периодическую очистку устаревших сессий
    setInterval(() => this.cleanExpiredSessions(), 1000 * 60 * 60) // Каждый час

    // Загрузка сессий из хранилища при инициализации
    this.loadSessions()
  }

  /** Создает новую сессию для пользователя */
  async createSession(
    userData: AuthResult,
    metadata?: Record<string, any>
  ): Promise<Session> {
    const sessionId = this.options.tokenGenerator()
    const now = Date.now()

    const session: Session = {
      id: sessionId,
      userData,
      createdAt: now,
      lastActivity: now,
      metadata,
    }

    this.sessions.set(sessionId, session)
    await this.saveSessions()

    return session
  }

  /** Получает сессию по ID */
  getSession(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId)

    if (!session) return undefined

    // Проверяем, не истекла ли сессия
    if (Date.now() - session.lastActivity > this.options.sessionLifetime) {
      this.sessions.delete(sessionId)
      this.saveSessions()
      return undefined
    }

    // Обновляем время последней активности
    session.lastActivity = Date.now()
    this.sessions.set(sessionId, session)

    return session
  }

  /** Обновляет метаданные сессии */
  async updateSession(
    sessionId: string,
    metadata: Record<string, any>
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId)
    if (!session) return false

    session.metadata = { ...session.metadata, ...metadata }
    session.lastActivity = Date.now()

    this.sessions.set(sessionId, session)
    await this.saveSessions()

    return true
  }

  /** Удаляет сессию */
  async deleteSession(sessionId: string): Promise<boolean> {
    const result = this.sessions.delete(sessionId)
    await this.saveSessions()
    return result
  }

  /** Очищает все сессии пользователя */
  async clearUserSessions(userId: number): Promise<number> {
    let count = 0

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userData.id === userId) {
        this.sessions.delete(sessionId)
        count++
      }
    }

    if (count > 0) {
      await this.saveSessions()
    }

    return count
  }

  /** Очищает устаревшие сессии */
  private cleanExpiredSessions(): void {
    const now = Date.now()
    let hasDeleted = false

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > this.options.sessionLifetime) {
        this.sessions.delete(sessionId)
        hasDeleted = true
      }
    }

    if (hasDeleted) {
      this.saveSessions()
    }
  }

  /** Сохраняет сессии в постоянное хранилище */
  private async saveSessions(): Promise<void> {
    await this.options.persistentStore.save(this.sessions)
  }

  /** Загружает сессии из постоянного хранилища */
  private async loadSessions(): Promise<void> {
    try {
      this.sessions = await this.options.persistentStore.load()
    } catch (error) {
      console.error('Ошибка загрузки сессий:', error)
    }
  }
}
