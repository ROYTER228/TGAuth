# TGAuth

Универсальная библиотека для авторизации через Telegram с поддержкой различных методов и интеграций.

## Особенности

- 🔐 **Разные методы авторизации**:

  - Авторизация через код
  - Авторизация через deeplink (две версии)
  - Авторизация через Telegram Widget
  - Двухфакторная аутентификация (2FA)

- 🔄 **Гибкие транспорты данных**:

  - WebSocket (Socket.IO)
  - Callbacks
  - REST API (в разработке)

- 🧩 **Интеграции с фреймворками**:

  - [NestJS](https://nestjs.com/)
  - [Telegraf](https://telegraf.js.org/)
  - [Grammy](https://grammy.dev/)
  - Свои интеграции через Webhook

- ⚙️ **Настраиваемость**:

  - Гибкая конфигурация через объекты
  - Возможность переопределения сообщений и поведения
  - Детальное логирование и аудит

- 🛡️ **Безопасность**:
  - Защита от повторных атак
  - Строгая проверка данных и сроков действия ссылок/кодов
  - Подробный аудит безопасности

## Установка

```bash
npm install tgauth
# или
yarn add tgauth
```

## Быстрый старт

### Простая авторизация через код и deeplink

```typescript
import { createTelegramAuth, LogLevel } from 'tgauth'

const auth = createTelegramAuth({
  botUsername: 'your_bot_username',
  botToken: 'YOUR_BOT_TOKEN',
  frontendUrl: 'https://your-app.com',
  transports: {
    useWebSocket: false,
    callbacks: {
      onLogin: (userId, session) => {
        console.log(`Пользователь ${userId} вошел в систему`)
      },
      onError: (error) => {
        console.error('Ошибка авторизации:', error.message)
      },
    },
  },
  enableAuthMethods: {
    codeAuth: true,
    deeplinkV1: true,
  },
  logLevel: LogLevel.INFO,
})

// Генерация deeplink для отправки пользователю
const deeplinkUrl = auth.deeplinkV1?.generateDeeplink()
```

### Интеграция с ботом Telegram

```typescript
// Обработка команды /start с токеном для авторизации (DeeplinkAuth)
bot.command('start', (ctx) => {
  const text = ctx.message?.text || ''
  const userId = ctx.from?.id

  const args = text.split(' ')
  if (args.length > 1) {
    const token = args[1]
    const userData = {
      id: userId,
      is_bot: false,
      first_name: ctx.from?.first_name || '',
      last_name: ctx.from?.last_name,
      username: ctx.from?.username,
      language_code: ctx.from?.language_code,
    }

    // Обработка deeplink авторизации
    const authOk = auth.deeplinkV1?.handleAuth(token, userData)
    if (authOk) {
      ctx.reply('Вы успешно авторизованы!')
    } else {
      ctx.reply('Ошибка авторизации. Ссылка недействительна или устарела.')
    }
  } else {
    // Можно отправить инструкции или сгенерировать код
    const code = auth.codeAuth?.generateCode()
    ctx.reply(`Ваш код для авторизации: ${code}`)
  }
})
```

### Полная конфигурация с WebSocket и 2FA

```typescript
import { createTelegramAuth, LogLevel } from 'tgauth'
import * as http from 'http'
import { Server } from 'socket.io'

// Создаем HTTP сервер и Socket.IO сервер
const httpServer = http.createServer()
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
})

// Авторизация с поддержкой WebSocket и 2FA
const auth = createTelegramAuth({
  botToken: 'YOUR_BOT_TOKEN',
  botUsername: 'your_bot_username',
  frontendUrl: 'https://your-app.com',
  transports: {
    useWebSocket: true,
    socketInstance: io,
    callbacks: {
      onLogin: (userId, session) => {
        console.log(`Пользователь ${userId} вошел в систему`)
      },
      on2FA: (userId, action) => {
        console.log(`Пользователь ${userId} запросил 2FA для "${action}"`)
      },
    },
  },
  enableAuthMethods: {
    codeAuth: true,
    deeplinkV1: true,
    deeplinkV2: true,
    widgetAuth: true,
  },
  twoFactor: {
    enabled: true,
    actions: ['withdraw', 'change_password', 'delete_account'],
    verificationTimeout: 180, // 3 минуты
  },
  logLevel: LogLevel.DEBUG,
})

// Запускаем WebSocket сервер
httpServer.listen(3000, () => {
  console.log('WebSocket сервер запущен на порту 3000')
})
```

## Фронтенд компоненты

### React

```tsx
import { TelegramLoginButton } from 'tgauth/react'

function LoginPage() {
  return (
    <div>
      <h1>Вход через Telegram</h1>
      <TelegramLoginButton
        botName="your_bot_username"
        onAuth={(user) => console.log('Пользователь авторизован:', user)}
      />
    </div>
  )
}
```

### Vue

```vue
<template>
  <div>
    <h1>Вход через Telegram</h1>
    <TelegramLoginButton :botName="botName" @auth="handleAuth" />
  </div>
</template>

<script setup>
import { TelegramLoginButton } from 'tgauth/vue'
import { ref } from 'vue'

const botName = ref('your_bot_username')
function handleAuth(user) {
  console.log('Пользователь авторизован:', user)
}
</script>
```

## Документация

Подробная документация доступна на нашем [сайте](#) или в [Wiki](#) проекта.

## Лицензия

MIT
