<template>
  <div class="tg-auth-code-container">
    <div v-if="mode === 'display'" class="tg-auth-code-display">
      <div class="tg-auth-code-header">
        <h3>{{ title }}</h3>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>

      <div class="tg-auth-code-digits">
        <span
          v-for="(digit, index) in codeDigits"
          :key="index"
          class="tg-auth-code-digit"
        >
          {{ digit }}
        </span>
      </div>

      <div class="tg-auth-code-instructions">
        <p>{{ instructions }}</p>
      </div>

      <template v-if="showTimer">
        <div
          class="tg-auth-code-timer"
          :class="{ 'tg-auth-code-timer-low': secondsLeft < 30 }"
        >
          <span>{{ formattedTime }}</span>
        </div>
      </template>
    </div>

    <div v-else-if="mode === 'input'" class="tg-auth-code-input-container">
      <div class="tg-auth-code-header">
        <h3>{{ title }}</h3>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>

      <div class="tg-auth-code-inputs">
        <input
          v-for="(_, index) in inputLength"
          :key="index"
          type="text"
          maxlength="1"
          class="tg-auth-code-input"
          :class="{ 'tg-auth-code-input-error': hasError }"
          :ref="
            (el) => {
              if (el) inputRefs[index] = el
            }
          "
          v-model="inputValues[index]"
          @input="handleInput(index)"
          @keydown="handleKeyDown($event, index)"
          @paste="handlePaste"
          @focus="handleFocus(index)"
        />
      </div>

      <div v-if="hasError" class="tg-auth-code-error">
        {{ errorMessage }}
      </div>

      <div v-if="canRequestNew" class="tg-auth-code-request-new">
        <button
          class="tg-auth-code-request-button"
          @click="$emit('request-new-code')"
          :disabled="isRequestingNew"
        >
          {{ isRequestingNew ? 'Запрашиваем...' : 'Запросить новый код' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {
  defineComponent,
  ref,
  computed,
  PropType,
  watchEffect,
  onMounted,
} from 'vue'

export default defineComponent({
  name: 'TelegramAuthCode',
  props: {
    /**
     * Режим компонента: 'display' - показ кода, 'input' - ввод кода
     */
    mode: {
      type: String as PropType<'display' | 'input'>,
      default: 'display',
    },
    /**
     * Код для отображения (только для mode='display')
     */
    code: {
      type: String,
      default: '',
    },
    /**
     * Заголовок
     */
    title: {
      type: String,
      default: 'Код авторизации',
    },
    /**
     * Подзаголовок
     */
    subtitle: {
      type: String,
      default: '',
    },
    /**
     * Инструкции (только для mode='display')
     */
    instructions: {
      type: String,
      default: 'Введите этот код в Telegram боте для авторизации',
    },
    /**
     * Показывать таймер действия кода (только для mode='display')
     */
    showTimer: {
      type: Boolean,
      default: true,
    },
    /**
     * Время жизни кода в секундах (только для mode='display' и showTimer=true)
     */
    codeLifetime: {
      type: Number,
      default: 300, // 5 минут по умолчанию
    },
    /**
     * Длина кода для ввода (только для mode='input')
     */
    inputLength: {
      type: Number,
      default: 6,
    },
    /**
     * Ошибка валидации (только для mode='input')
     */
    hasError: {
      type: Boolean,
      default: false,
    },
    /**
     * Сообщение об ошибке (только для mode='input')
     */
    errorMessage: {
      type: String,
      default: 'Неверный код',
    },
    /**
     * Возможность запросить новый код (только для mode='input')
     */
    canRequestNew: {
      type: Boolean,
      default: true,
    },
    /**
     * Индикатор запроса нового кода (только для mode='input')
     */
    isRequestingNew: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['code-entered', 'request-new-code'],
  setup(props, { emit }) {
    // Для режима отображения кода
    const codeDigits = computed(() => {
      return props.code.split('')
    })

    // Таймер
    const secondsLeft = ref(props.codeLifetime)
    const formattedTime = computed(() => {
      const minutes = Math.floor(secondsLeft.value / 60)
      const seconds = secondsLeft.value % 60
      return `${minutes.toString().padStart(2, '0')}:${seconds
        .toString()
        .padStart(2, '0')}`
    })

    // Запускаем таймер для отображения кода
    let timer: any = null
    watchEffect(() => {
      if (props.mode === 'display' && props.showTimer) {
        // Очищаем предыдущий таймер, если есть
        if (timer) clearInterval(timer)

        // Устанавливаем начальное значение
        secondsLeft.value = props.codeLifetime

        // Запускаем таймер
        timer = setInterval(() => {
          if (secondsLeft.value > 0) {
            secondsLeft.value--
          } else {
            clearInterval(timer)
          }
        }, 1000)
      }
    })

    // Для режима ввода кода
    const inputValues = ref(Array(props.inputLength).fill(''))
    const inputRefs = ref<HTMLInputElement[]>([])

    // Обработка ввода в поле
    const handleInput = (index: number) => {
      // Проверяем, что введен только цифровой символ
      const value = inputValues.value[index]
      if (!/^\d$/.test(value) && value !== '') {
        inputValues.value[index] = ''
        return
      }

      // Если введена цифра, переходим к следующему полю
      if (value !== '' && index < props.inputLength - 1) {
        inputRefs.value[index + 1].focus()
      }

      // Проверяем, все ли поля заполнены
      if (inputValues.value.every((v) => v !== '')) {
        emit('code-entered', inputValues.value.join(''))
      }
    }

    // Обработка клавиш
    const handleKeyDown = (event: KeyboardEvent, index: number) => {
      if (
        event.key === 'Backspace' &&
        inputValues.value[index] === '' &&
        index > 0
      ) {
        // Если текущее поле пустое и нажата клавиша Backspace, переходим к предыдущему полю
        inputRefs.value[index - 1].focus()
      } else if (event.key === 'ArrowLeft' && index > 0) {
        // Навигация стрелками влево
        inputRefs.value[index - 1].focus()
      } else if (event.key === 'ArrowRight' && index < props.inputLength - 1) {
        // Навигация стрелками вправо
        inputRefs.value[index + 1].focus()
      }
    }

    // Обработка вставки из буфера
    const handlePaste = (event: ClipboardEvent) => {
      event.preventDefault()

      const pastedData = event.clipboardData?.getData('text') || ''
      const digits = pastedData
        .replace(/\D/g, '')
        .slice(0, props.inputLength)
        .split('')

      for (let i = 0; i < props.inputLength; i++) {
        if (i < digits.length) {
          inputValues.value[i] = digits[i]
        }
      }

      // Проверяем, все ли поля заполнены
      if (inputValues.value.every((v) => v !== '')) {
        emit('code-entered', inputValues.value.join(''))
      }
    }

    // Обработка фокуса
    const handleFocus = (index: number) => {
      // При получении фокуса выделяем текст в поле
      setTimeout(() => {
        inputRefs.value[index].select()
      }, 0)
    }

    // При монтировании фокусируемся на первом поле ввода
    onMounted(() => {
      if (props.mode === 'input' && inputRefs.value.length > 0) {
        inputRefs.value[0].focus()
      }
    })

    return {
      codeDigits,
      secondsLeft,
      formattedTime,
      inputValues,
      inputRefs,
      handleInput,
      handleKeyDown,
      handlePaste,
      handleFocus,
    }
  },
})
</script>

<style scoped>
.tg-auth-code-container {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  max-width: 400px;
  margin: 0 auto;
  padding: 20px;
  border-radius: 8px;
  background-color: #f5f5f5;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.tg-auth-code-header {
  text-align: center;
  margin-bottom: 20px;
}

.tg-auth-code-header h3 {
  margin: 0 0 8px;
  font-size: 18px;
  color: #333;
}

.tg-auth-code-header p {
  margin: 0;
  font-size: 14px;
  color: #666;
}

/* Отображение кода */
.tg-auth-code-digits {
  display: flex;
  justify-content: center;
  margin: 20px 0;
}

.tg-auth-code-digit {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 50px;
  margin: 0 4px;
  font-size: 24px;
  font-weight: bold;
  background-color: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  color: #0088cc;
}

.tg-auth-code-instructions {
  text-align: center;
  margin: 20px 0;
  font-size: 14px;
  color: #666;
}

.tg-auth-code-timer {
  text-align: center;
  font-size: 16px;
  font-weight: bold;
  color: #0088cc;
  margin-top: 20px;
}

.tg-auth-code-timer-low {
  color: #ff3b30;
}

/* Ввод кода */
.tg-auth-code-inputs {
  display: flex;
  justify-content: center;
  margin: 20px 0;
}

.tg-auth-code-input {
  width: 40px;
  height: 50px;
  margin: 0 4px;
  text-align: center;
  font-size: 20px;
  font-weight: bold;
  border: 1px solid #ddd;
  border-radius: 4px;
  outline: none;
  transition: border-color 0.3s;
}

.tg-auth-code-input:focus {
  border-color: #0088cc;
  box-shadow: 0 0 0 2px rgba(0, 136, 204, 0.2);
}

.tg-auth-code-input-error {
  border-color: #ff3b30;
}

.tg-auth-code-input-error:focus {
  border-color: #ff3b30;
  box-shadow: 0 0 0 2px rgba(255, 59, 48, 0.2);
}

.tg-auth-code-error {
  text-align: center;
  color: #ff3b30;
  margin: 10px 0;
  font-size: 14px;
}

.tg-auth-code-request-new {
  text-align: center;
  margin-top: 20px;
}

.tg-auth-code-request-button {
  background-color: transparent;
  border: none;
  color: #0088cc;
  font-size: 14px;
  cursor: pointer;
  padding: 5px 10px;
  text-decoration: underline;
}

.tg-auth-code-request-button:hover {
  color: #006699;
}

.tg-auth-code-request-button:disabled {
  color: #999;
  cursor: not-allowed;
  text-decoration: none;
}
</style>
