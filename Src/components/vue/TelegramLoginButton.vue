<template>
  <div class="tg-auth-button-container">
    <button
      v-if="!loading"
      class="tg-auth-button"
      :class="{
        'tg-auth-button-large': size === 'large',
        'tg-auth-button-medium': size === 'medium',
        'tg-auth-button-small': size === 'small',
      }"
      @click="handleAuth"
      :disabled="disabled"
    >
      <span class="tg-auth-button-icon">
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
      <span class="tg-auth-button-text">{{ text }}</span>
    </button>
    <div v-else class="tg-auth-button-loading">
      <div class="tg-auth-spinner"></div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, PropType } from 'vue'

export default defineComponent({
  name: 'TelegramLoginButton',
  props: {
    /**
     * URL для запроса deeplink или кода авторизации
     */
    authUrl: {
      type: String,
      required: true,
    },
    /**
     * Тип авторизации: 'deeplink' или 'code'
     */
    authType: {
      type: String as PropType<'deeplink' | 'code'>,
      default: 'deeplink',
    },
    /**
     * Текст кнопки
     */
    text: {
      type: String,
      default: 'Войти через Telegram',
    },
    /**
     * Размер кнопки: 'small', 'medium', 'large'
     */
    size: {
      type: String as PropType<'small' | 'medium' | 'large'>,
      default: 'medium',
    },
    /**
     * Отключение кнопки
     */
    disabled: {
      type: Boolean,
      default: false,
    },
    /**
     * Функция для отображения кода (для authType = 'code')
     */
    onCodeReceived: {
      type: Function as PropType<(code: string) => void>,
      default: undefined,
    },
  },
  emits: ['auth-success', 'auth-error', 'auth-start'],
  setup(props, { emit }) {
    const loading = ref(false)

    const handleAuth = async () => {
      try {
        loading.value = true
        emit('auth-start')

        const response = await fetch(props.authUrl)
        const data = await response.json()

        if (!data.success) {
          throw new Error(
            data.message || 'Ошибка получения данных для авторизации'
          )
        }

        if (props.authType === 'deeplink') {
          // Для deeplink просто перенаправляем на ссылку
          window.location.href = data.deeplink
        } else if (props.authType === 'code') {
          // Для кода показываем его пользователю
          if (props.onCodeReceived) {
            props.onCodeReceived(data.code)
          } else {
            // Если обработчик не предоставлен, просто показываем код в alert
            alert(
              `Ваш код для входа: ${data.code}\nВведите его в Telegram боте.`
            )
          }
          loading.value = false
          emit('auth-success', { authType: 'code', code: data.code })
        }
      } catch (error) {
        loading.value = false
        console.error('Ошибка авторизации через Telegram:', error)
        emit('auth-error', error)
      }
    }

    return {
      loading,
      handleAuth,
    }
  },
})
</script>

<style scoped>
.tg-auth-button-container {
  display: inline-block;
}

.tg-auth-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background-color: #0088cc;
  color: white;
  border: none;
  border-radius: 4px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.tg-auth-button:hover {
  background-color: #0077b3;
}

.tg-auth-button:active {
  background-color: #006699;
}

.tg-auth-button:disabled {
  background-color: #80c4e6;
  cursor: not-allowed;
}

.tg-auth-button-small {
  padding: 6px 12px;
  font-size: 12px;
}

.tg-auth-button-medium {
  padding: 8px 16px;
  font-size: 14px;
}

.tg-auth-button-large {
  padding: 10px 20px;
  font-size: 16px;
}

.tg-auth-button-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5em;
  height: 1.5em;
}

.tg-auth-button-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
}

.tg-auth-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
