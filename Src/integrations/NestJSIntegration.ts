import { DeeplinkAuth, AuthTransportOptions } from '../Auth/DeeplinkAuth.js'
import { CodeAuth } from '../Auth/CodeAuth.js'
import { AuthResult } from '../types.js'
import { SessionManager } from '../Auth/SessionManager.js'

/**
 * Интеграция TGAuth с NestJS
 *
 * Пример использования:
 * ```typescript
 * // auth.module.ts
 * import { Module } from '@nestjs/common';
 * import { NestJSIntegration } from 'tgauth';
 * import { AuthController } from './auth.controller';
 * import { AuthService } from './auth.service';
 *
 * @Module({
 *   controllers: [AuthController],
 *   providers: [
 *     AuthService,
 *     {
 *       provide: 'TG_AUTH',
 *       useFactory: () => {
 *         return new NestJSIntegration({
 *           botToken: process.env.BOT_TOKEN,
 *           useSessionManager: true,
 *         });
 *       },
 *     },
 *   ],
 *   exports: ['TG_AUTH'],
 * })
 * export class AuthModule {}
 * ```
 */
export interface NestJSIntegrationOptions {
  /** Токен бота Telegram */
  botToken: string
  /** Использовать механизм сессий */
  useSessionManager?: boolean
  /** Опции для авторизации */
  authOptions?: Partial<AuthTransportOptions>
  /** Опции менеджера сессий */
  sessionOptions?: Record<string, any>
}

export class NestJSIntegration {
  private deeplinkAuth: DeeplinkAuth
  private codeAuth: CodeAuth
  private sessionManager?: SessionManager
  private options: Required<
    Omit<NestJSIntegrationOptions, 'authOptions' | 'sessionOptions'>
  > & {
    authOptions?: Partial<AuthTransportOptions>
    sessionOptions?: Record<string, any>
  }

  constructor(options: NestJSIntegrationOptions) {
    this.options = {
      botToken: options.botToken,
      useSessionManager: options.useSessionManager ?? true,
      authOptions: options.authOptions,
      sessionOptions: options.sessionOptions,
    }

    // Инициализация DeeplinkAuth и CodeAuth
    const authOptions: AuthTransportOptions = {
      botToken: this.options.botToken,
      transport: ['callback'],
      onAuth: (userData: AuthResult) => {
        if (this.options.authOptions?.onAuth) {
          if (this.options.useSessionManager && this.sessionManager) {
            this.sessionManager.createSession(userData).then((session) => {
              this.options.authOptions?.onAuth?.(userData)
            })
          } else {
            this.options.authOptions.onAuth(userData)
          }
        }
      },
      ...this.options.authOptions,
    }

    this.deeplinkAuth = new DeeplinkAuth(authOptions)
    this.codeAuth = new CodeAuth(authOptions)

    // Инициализация SessionManager если нужно
    if (this.options.useSessionManager) {
      this.sessionManager = new SessionManager(this.options.sessionOptions)
    }
  }

  /** Получить DeeplinkAuth для интеграции с NestJS контроллерами */
  getDeeplinkAuth() {
    return this.deeplinkAuth
  }

  /** Получить CodeAuth для интеграции с NestJS контроллерами */
  getCodeAuth() {
    return this.codeAuth
  }

  /** Получить SessionManager для интеграции с NestJS контроллерами */
  getSessionManager() {
    return this.sessionManager
  }

  /** Генерировать deeplink для авторизации */
  generateDeeplink(): string {
    return this.deeplinkAuth.generateDeeplink()
  }

  /** Генерировать код для авторизации */
  generateCode(): string {
    return this.codeAuth.generateCode()
  }

  /** Проверить и обработать deeplink */
  handleDeeplinkAuth(token: string, userData: AuthResult): boolean {
    return this.deeplinkAuth.handleAuth(token, userData)
  }

  /** Проверить и обработать код */
  handleCodeAuth(code: string, userData: AuthResult): boolean {
    return this.codeAuth.handleAuth(code, userData)
  }

  /** Проверить сессию по ID */
  getSession(sessionId: string) {
    if (!this.sessionManager) {
      throw new Error(
        'SessionManager не инициализирован. Установите опцию useSessionManager: true'
      )
    }
    return this.sessionManager.getSession(sessionId)
  }

  /** Создать новую сессию */
  async createSession(userData: AuthResult, metadata?: Record<string, any>) {
    if (!this.sessionManager) {
      throw new Error(
        'SessionManager не инициализирован. Установите опцию useSessionManager: true'
      )
    }
    return this.sessionManager.createSession(userData, metadata)
  }

  /** Удалить сессию */
  async deleteSession(sessionId: string) {
    if (!this.sessionManager) {
      throw new Error(
        'SessionManager не инициализирован. Установите опцию useSessionManager: true'
      )
    }
    return this.sessionManager.deleteSession(sessionId)
  }
}
