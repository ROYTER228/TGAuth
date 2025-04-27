/**
 * Модуль логирования для TGAuth
 * Предоставляет гибкий механизм логирования с поддержкой различных транспортов и уровней
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 999, // Отключить логирование
}

export enum LogCategory {
  AUTH = 'auth',
  SECURITY = 'security',
  API = 'api',
  WEBHOOK = 'webhook',
  INTEGRATION = 'integration',
  SESSION = 'session',
  GENERAL = 'general',
}

export interface LogEntry {
  timestamp: number
  level: LogLevel
  category: LogCategory
  message: string
  data?: any
}

export interface LogTransport {
  log(entry: LogEntry): void
}

/** Транспорт логирования в консоль */
export class ConsoleTransport implements LogTransport {
  private static readonly LEVEL_STYLES = {
    [LogLevel.DEBUG]: '\x1b[36m', // Cyan
    [LogLevel.INFO]: '\x1b[32m', // Green
    [LogLevel.WARN]: '\x1b[33m', // Yellow
    [LogLevel.ERROR]: '\x1b[31m', // Red
    [LogLevel.NONE]: '',
  }

  private static readonly RESET_STYLE = '\x1b[0m'
  private readonly useColors: boolean

  constructor(options: { useColors?: boolean } = {}) {
    this.useColors = options.useColors !== undefined ? options.useColors : true
  }

  log(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString()
    const level = LogLevel[entry.level]
    const category = entry.category
    const message = entry.message

    let logMessage = `[${timestamp}] [${level}] [${category}] ${message}`

    if (entry.data) {
      try {
        const dataStr =
          typeof entry.data === 'string'
            ? entry.data
            : JSON.stringify(entry.data, null, 2)
        logMessage += `\n${dataStr}`
      } catch (e) {
        logMessage += `\n[Неудалось сериализовать данные: ${e}]`
      }
    }

    // Выбор метода консоли в зависимости от уровня
    let consoleMethod: 'log' | 'info' | 'warn' | 'error'
    switch (entry.level) {
      case LogLevel.DEBUG:
        consoleMethod = 'log'
        break
      case LogLevel.INFO:
        consoleMethod = 'info'
        break
      case LogLevel.WARN:
        consoleMethod = 'warn'
        break
      case LogLevel.ERROR:
        consoleMethod = 'error'
        break
      default:
        consoleMethod = 'log'
    }

    // Добавление цвета, если включено
    if (this.useColors) {
      const style = ConsoleTransport.LEVEL_STYLES[entry.level]
      console[consoleMethod](
        `${style}${logMessage}${ConsoleTransport.RESET_STYLE}`
      )
    } else {
      console[consoleMethod](logMessage)
    }
  }
}

/** Транспорт логирования в файл */
export class FileTransport implements LogTransport {
  private readonly filePath: string
  private readonly fs: any

  constructor(options: { filePath: string }) {
    this.filePath = options.filePath

    // Динамический импорт fs, так как это Node.js модуль
    try {
      // Используем dynamic import для поддержки ESM
      this.fs = import('fs').then((module) => module.default || module)
    } catch (e) {
      throw new Error('FileTransport требует Node.js окружения с модулем fs')
    }
  }

  async log(entry: LogEntry): Promise<void> {
    const fs = await this.fs
    const timestamp = new Date(entry.timestamp).toISOString()
    const level = LogLevel[entry.level]
    const category = entry.category
    const message = entry.message

    let logMessage = `[${timestamp}] [${level}] [${category}] ${message}`

    if (entry.data) {
      try {
        const dataStr =
          typeof entry.data === 'string'
            ? entry.data
            : JSON.stringify(entry.data)
        logMessage += `\n${dataStr}`
      } catch (e) {
        logMessage += `\n[Неудалось сериализовать данные]`
      }
    }

    logMessage += '\n'

    try {
      fs.appendFileSync(this.filePath, logMessage)
    } catch (error) {
      console.error(`Ошибка при записи в лог-файл: ${error}`)
    }
  }
}

/** Транспорт логирования через callback функцию */
export class CallbackTransport implements LogTransport {
  private readonly callback: (entry: LogEntry) => void

  constructor(callback: (entry: LogEntry) => void) {
    this.callback = callback
  }

  log(entry: LogEntry): void {
    try {
      this.callback(entry)
    } catch (error) {
      console.error(`Ошибка в callback-транспорте: ${error}`)
    }
  }
}

/** Транспорт логирования в память (для тестирования или буферизации) */
export class MemoryTransport implements LogTransport {
  private logs: LogEntry[] = []
  private readonly maxLength: number

  constructor(options: { maxLength?: number } = {}) {
    this.maxLength = options.maxLength || 1000 // По умолчанию хранить последние 1000 записей
  }

  log(entry: LogEntry): void {
    this.logs.push({ ...entry }) // Копируем запись

    // Следим за размером буфера
    if (this.logs.length > this.maxLength) {
      this.logs = this.logs.slice(-this.maxLength)
    }
  }

  /** Получить все логи */
  getLogs(): LogEntry[] {
    return [...this.logs] // Возвращаем копию массива
  }

  /** Получить логи по уровню */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter((entry) => entry.level === level)
  }

  /** Получить логи по категории */
  getLogsByCategory(category: LogCategory): LogEntry[] {
    return this.logs.filter((entry) => entry.category === category)
  }

  /** Очистить логи */
  clear(): void {
    this.logs = []
  }
}

/** Главный класс логгера */
export class Logger {
  private static instance: Logger
  private transports: LogTransport[] = []
  private minLevel: LogLevel = LogLevel.INFO
  private enabled: boolean = true

  private constructor() {
    // Приватный конструктор для паттерна Singleton
  }

  /**
   * Получить экземпляр логгера (Singleton)
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  /**
   * Инициализация логгера с транспортами
   */
  public init(options?: {
    transports?: LogTransport[]
    minLevel?: LogLevel
    enabled?: boolean
  }): Logger {
    if (options?.transports) {
      this.transports = options.transports
    }

    if (options?.minLevel !== undefined) {
      this.minLevel = options.minLevel
    }

    if (options?.enabled !== undefined) {
      this.enabled = options.enabled
    }

    return this
  }

  /**
   * Добавить транспорт логирования
   */
  public addTransport(transport: LogTransport): Logger {
    this.transports.push(transport)
    return this
  }

  /**
   * Удалить все транспорты
   */
  public clearTransports(): Logger {
    this.transports = []
    return this
  }

  /**
   * Установить минимальный уровень логирования
   */
  public setMinLevel(level: LogLevel): Logger {
    this.minLevel = level
    return this
  }

  /**
   * Включить/выключить логирование
   */
  public setEnabled(enabled: boolean): Logger {
    this.enabled = enabled
    return this
  }

  /**
   * Создать запись лога и отправить в транспорты
   */
  public log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    data?: any
  ): void {
    if (
      !this.enabled ||
      level < this.minLevel ||
      this.transports.length === 0
    ) {
      return
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
    }

    for (const transport of this.transports) {
      try {
        transport.log(entry)
      } catch (error) {
        console.error(`Ошибка в транспорте логирования: ${error}`)
      }
    }
  }

  /**
   * Методы логирования для различных уровней
   */
  public debug(category: LogCategory, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, category, message, data)
  }

  public info(category: LogCategory, message: string, data?: any): void {
    this.log(LogLevel.INFO, category, message, data)
  }

  public warn(category: LogCategory, message: string, data?: any): void {
    this.log(LogLevel.WARN, category, message, data)
  }

  public error(category: LogCategory, message: string, data?: any): void {
    this.log(LogLevel.ERROR, category, message, data)
  }
}

// Экспортируем готовый экземпляр для удобства использования
export const logger = Logger.getInstance()
