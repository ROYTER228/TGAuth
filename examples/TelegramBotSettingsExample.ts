/**
 * Примеры использования TelegramBotSettings
 */

import {
  TelegramBotSettings,
  DeeplinkAuth,
  CodeAuth,
  TwoFAAuth,
  type BotMessages,
} from '../Src/index.js'

// Пример 1: Базовое использование TelegramBotSettings
const basicSettings = new TelegramBotSettings({
  botToken: 'YOUR_BOT_TOKEN',
  botUsername: 'your_bot_username',
})

// Пример 2: Настройка с кастомными сообщениями
const customMessages: BotMessages = {
  authSuccess: 'Вы успешно авторизованы! Добро пожаловать!',
  authError: 'Произошла ошибка при авторизации. Пожалуйста, попробуйте снова.',
  twoFACode:
    'Ваш код для входа в систему: {code}. Он действителен в течение 5 минут.',
  twoFASuccess: 'Двухфакторная аутентификация успешно пройдена!',
  twoFAInvalidCode: 'Неверный код. Пожалуйста, проверьте и попробуйте снова.',
  twoFAExpired: 'Срок действия кода истек. Запросите новый код.',
  twoFAMaxAttempts:
    'Превышено максимальное количество попыток. Запросите новый код.',
}

const settingsWithCustomMessages = new TelegramBotSettings({
  botToken: 'YOUR_BOT_TOKEN',
  botUsername: 'your_bot_username',
  messages: customMessages,
})

// Пример 3: Использование с DeeplinkAuth
const deeplinkAuth = new DeeplinkAuth({
  botSettings: settingsWithCustomMessages,
  transport: ['callback'],
  onAuth: (userData) => {
    console.log('Пользователь авторизован:', userData)
  },
})

// Генерация deeplink для авторизации
const deeplink = deeplinkAuth.generateDeeplink()
console.log('Deeplink для авторизации:', deeplink)

// Пример 4: Использование с CodeAuth
const codeAuth = new CodeAuth({
  botSettings: settingsWithCustomMessages,
  transport: ['callback'],
  onAuth: (userData) => {
    console.log('Пользователь авторизован по коду:', userData)
  },
})

// Генерация кода для авторизации
const code = codeAuth.generateCode()
console.log('Код для авторизации:', code)

// Пример 5: Использование с TwoFAAuth
const twoFAAuth = new TwoFAAuth({
  botSettings: settingsWithCustomMessages,
  transport: ['callback'],
  onAuth: (userData) => {
    console.log('Двухфакторная аутентификация успешна:', userData)
  },
  codeLifetime: 1000 * 60 * 5, // 5 минут
  codeLength: 6,
  maxAttempts: 3,
})

// Инициирование 2FA для пользователя с отправкой сообщения
const userId = '123456789'
const twoFACode = twoFAAuth.start2FA(userId, undefined, true)
console.log('Код 2FA для пользователя:', twoFACode)

// Пример 6: Обратная совместимость (старый способ)
const legacyAuth = new DeeplinkAuth({
  botToken: 'YOUR_BOT_TOKEN',
  botUsername: 'your_bot_username',
  transport: ['callback'],
  onAuth: (userData) => {
    console.log('Пользователь авторизован (старый способ):', userData)
  },
})

// Генерация deeplink для авторизации (старый способ)
const legacyDeeplink = legacyAuth.generateDeeplink()
console.log('Deeplink для авторизации (старый способ):', legacyDeeplink)
