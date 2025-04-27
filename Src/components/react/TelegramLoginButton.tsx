import React, { useState, useEffect } from 'react'

interface TelegramLoginButtonProps {
  /**
   * URL для запроса deeplink или кода авторизации
   */
  authUrl: string
  /**
   * Тип авторизации: 'deeplink' или 'code'
   */
  authType: 'deeplink' | 'code'
  /**
   * Текст кнопки
   */
  text?: string
  /**
   * Размер кнопки: 'small', 'medium', 'large'
   */
  size?: 'small' | 'medium' | 'large'
  /**
   * Отключить кнопку
   */
  disabled?: boolean
  /**
   * Обработчик успешной авторизации
   */
  onAuthSuccess?: (data: any) => void
  /**
   * Обработчик ошибки авторизации
   */
  onAuthError?: (error: Error) => void
}

/**
 * Компонент кнопки авторизации через Telegram
 *
 * Пример использования:
 * ```tsx
 * <TelegramLoginButton
 *   authUrl="/api/auth/deeplink"
 *   authType="deeplink"
 *   text="Войти через Telegram"
 *   onAuthSuccess={(data) => console.log('Успешная авторизация:', data)}
 *   onAuthError={(error) => console.error('Ошибка авторизации:', error)}
 * />
 * ```
 */
const TelegramLoginButton: React.FC<TelegramLoginButtonProps> = ({
  authUrl,
  authType,
  text = 'Войти через Telegram',
  size = 'medium',
  disabled = false,
  onAuthSuccess,
  onAuthError,
}) => {
  const [loading, setLoading] = useState(false)

  // Обработчик авторизации
  const handleAuth = async () => {
    if (disabled || loading) return

    setLoading(true)

    try {
      const response = await fetch(authUrl)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || 'Ошибка авторизации')
      }

      if (authType === 'deeplink' && data.deeplink) {
        // Открываем deeplink в новой вкладке
        window.open(data.deeplink, '_blank')
      } else if (authType === 'code' && data.code) {
        // Для кода можно показать модальное окно или другой UI
        console.log('Получен код авторизации:', data.code)
      }

      if (onAuthSuccess) {
        onAuthSuccess(data)
      }
    } catch (error) {
      console.error('Ошибка при авторизации:', error)
      if (onAuthError && error instanceof Error) {
        onAuthError(error)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="tg-auth-button-container">
      {!loading ? (
        <button
          className={`tg-auth-button tg-auth-button-${size}`}
          onClick={handleAuth}
          disabled={disabled}
        >
          <span className="tg-auth-button-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 240 240"
              width="1em"
              height="1em"
            >
              <path
                d="M120 240c66.274 0 120-53.726 120-120S186.274 0 120 0 0 53.726 0 120s53.726 120 120 120zm-22.789-124.921l61.11-23.95c2.817-1.046 4.954.681 4.143 4.902l.002-.001-10.418 49.105c-.768 3.682-2.864 4.582-5.787 2.85l-15.979-11.763-7.715 7.473c-.853.856-1.582 1.583-3.244 1.583l1.134-16.4 29.905-27.103c1.308-1.159-.285-1.799-2.026-.641l-36.937 23.24-15.909-5.003c-3.464-.927-3.535-3.472.721-5.102z"
                fill="#fff"
              />
            </svg>
          </span>
          <span className="tg-auth-button-text">{text}</span>
        </button>
      ) : (
        <div className="tg-auth-button-loading">
          <div className="tg-auth-spinner"></div>
        </div>
      )}

      <style jsx>{`
        .tg-auth-button-container {
          display: inline-block;
        }
        .tg-auth-button {
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #0088cc;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
            Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          transition: background-color 0.2s ease;
        }
        .tg-auth-button:hover {
          background-color: #0077b5;
        }
        .tg-auth-button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }
        .tg-auth-button-small {
          padding: 6px 12px;
          font-size: 14px;
        }
        .tg-auth-button-medium {
          padding: 8px 16px;
          font-size: 16px;
        }
        .tg-auth-button-large {
          padding: 10px 20px;
          font-size: 18px;
        }
        .tg-auth-button-icon {
          margin-right: 8px;
          display: flex;
          align-items: center;
        }
        .tg-auth-button-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px 16px;
        }
        .tg-auth-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 1s ease-in-out infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}

export default TelegramLoginButton
