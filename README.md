# TGAuth - Универсальная авторизация через Telegram

TGAuth - это универсальный npm-пакет для авторизации через Telegram, который предоставляет несколько способов аутентификации пользователей и работает как связующее звено между вашим приложением и Telegram Bot API.

## Особенности

- **Несколько способов авторизации**:

  - Авторизация через Deeplink
  - Авторизация через Коды
  - Авторизация через Telegram Widget
  - Двухфакторная авторизация (2FA)

- **Управление сессиями**:

  - Создание и управление сессиями пользователей
  - Настраиваемое время жизни сессий
  - Возможность сохранения сессий в внешнем хранилище

- **Гибкие транспорты данных**:

  - WebSocket
  - REST API
  - Callback функции

- **Интеграции с популярными фреймворками**:

  - Grammy
  - Telegraf
  - NestJS
  - WebHook интеграция для Express

- **UI компоненты**:
  - Компоненты для Vue 3

## Установка

```bash
npm install tgauth
# или
yarn add tgauth
```

## Быстрый старт

### 1. Создание Telegram бота

Перед началом работы создайте бота в Telegram через [@BotFather](https://t.me/BotFather) и получите токен.

### 2. Базовая авторизация через Deeplink

```typescript
import { DeeplinkAuth } from 'tgauth'

// Создание экземпляра DeeplinkAuth
const deeplinkAuth = new DeeplinkAuth({
  botToken: 'YOUR_BOT_TOKEN',
  transport: ['callback'],
  onAuth: (user) => {
    console.log('Пользователь авторизован:', user)
    // Дальнейшая обработка данных пользователя
  },
})

// Генерация ссылки для авторизации
const link = deeplinkAuth.generateDeeplink()
console.log(`Deeplink для авторизации: ${link}`)
```

### 3. Авторизация через коды

```typescript
import { CodeAuth } from 'tgauth'

// Создание экземпляра CodeAuth
const codeAuth = new CodeAuth({
  botToken: 'YOUR_BOT_TOKEN',
  transport: ['callback'],
  onAuth: (user) => {
    console.log('Пользователь авторизован по коду:', user)
    // Дальнейшая обработка данных пользователя
  },
})

// Генерация кода для авторизации
const code = codeAuth.generateCode()
console.log(`Код для авторизации: ${code}`)
```

## Использование с Grammy

```typescript
import { Bot } from 'grammy'
import { DeeplinkAuth, CodeAuth } from 'tgauth'

const botToken = 'YOUR_BOT_TOKEN'

// Создание экземпляров авторизации
const deeplinkAuth = new DeeplinkAuth({
  botToken,
  transport: ['callback'],
  onAuth: (user) => {
    console.log('Deeplink авторизация:', user)
  },
})

const codeAuth = new CodeAuth({
  botToken,
  transport: ['callback'],
  onAuth: (user) => {
    console.log('Code авторизация:', user)
  },
})

const bot = new Bot(botToken)

// Обработка команды /start с токеном (deeplink)
bot.command('start', async (ctx) => {
  const args = ctx.message?.text?.split(' ')
  if (args && args.length > 1 && ctx.from) {
    // Deeplink с токеном
    const token = args[1]
    const user = {
      id: ctx.from.id,
      is_bot: ctx.from.is_bot,
      first_name: ctx.from.first_name,
      last_name: ctx.from.last_name,
      username: ctx.from.username,
      language_code: ctx.from.language_code,
    }
    const ok = deeplinkAuth.handleAuth(token, user)
    if (ok) {
      await ctx.reply('Вы успешно авторизованы через ссылку!')
    } else {
      await ctx.reply('Ссылка недействительна или уже использована.')
    }
    return
  }

  // CodeAuth: просто /start — генерируем код
  const code = codeAuth.generateCode()
  await ctx.reply(`Ваш код для авторизации: ${code}`)
})

// Запуск бота
bot.start()
```

## Управление сессиями

```typescript
import { SessionManager, DeeplinkAuth } from 'tgauth'

// Создание менеджера сессий
const sessionManager = new SessionManager({
  sessionLifetime: 1000 * 60 * 60 * 24 * 7, // 1 неделя
  // Опционально - постоянное хранилище сессий
  persistentStore: {
    save: async (sessions) => {
      // Сохранение сессий в БД или файл
      await fs.writeFile('sessions.json', JSON.stringify([...sessions]), 'utf8')
    },
    load: async () => {
      // Загрузка сессий из БД или файла
      try {
        const data = await fs.readFile('sessions.json', 'utf8')
        return new Map(JSON.parse(data))
      } catch (e) {
        return new Map()
      }
    },
  },
})

// Интеграция с DeeplinkAuth
const deeplinkAuth = new DeeplinkAuth({
  botToken: 'YOUR_BOT_TOKEN',
  transport: ['callback'],
  onAuth: async (userData) => {
    // Создание сессии при авторизации
    const session = await sessionManager.createSession(userData)
    console.log(`Создана новая сессия: ${session.id}`)
  },
})
```

## WebHook интеграция

```typescript
import { WebhookIntegration } from 'tgauth'

const webhook = new WebhookIntegration({
  botToken: 'YOUR_BOT_TOKEN',
  webhookBaseUrl: 'https://your-app.com',
  secretToken: 'your-secret-token', // Для безопасности
  port: 3000,
  useSessionManager: true,
  onAuth: (userData, sessionId) => {
    console.log(
      `Пользователь авторизован: ${userData.username}, sessionId: ${sessionId}`
    )
  },
})

// Запуск сервера
webhook.start()
```

## Интеграция с Telegraf

```typescript
import { TelegrafIntegration } from 'tgauth'

const telegrafAuth = new TelegrafIntegration({
  botToken: 'YOUR_BOT_TOKEN',
  useSessionManager: true,
  authOptions: {
    onAuth: (userData) => {
      console.log('Пользователь авторизован:', userData)
    },
  },
})

// Получение экземпляра бота для дополнительной настройки
const bot = telegrafAuth.getBot()

// Дополнительная настройка бота
bot.help((ctx) =>
  ctx.reply('Этот бот для авторизации. Отправьте /start для начала.')
)

// Запуск бота
telegrafAuth.start()
```

## Интеграция с NestJS

```typescript
// auth.module.ts
import { Module } from '@nestjs/common'
import { NestJSIntegration } from 'tgauth'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: 'TG_AUTH',
      useFactory: () => {
        return new NestJSIntegration({
          botToken: process.env.BOT_TOKEN,
          useSessionManager: true,
        })
      },
    },
  ],
  exports: ['TG_AUTH'],
})
export class AuthModule {}

// auth.controller.ts
import { Controller, Get, Inject, Param, Post, Body } from '@nestjs/common'
import { NestJSIntegration } from 'tgauth'

@Controller('auth')
export class AuthController {
  constructor(@Inject('TG_AUTH') private tgAuth: NestJSIntegration) {}

  @Get('deeplink')
  generateDeeplink() {
    const deeplink = this.tgAuth.generateDeeplink()
    return { success: true, deeplink }
  }

  @Get('code')
  generateCode() {
    const code = this.tgAuth.generateCode()
    return { success: true, code }
  }

  @Get('session/:id')
  getSession(@Param('id') id: string) {
    const session = this.tgAuth.getSession(id)
    if (!session) {
      return { success: false, message: 'Сессия не найдена' }
    }
    return { success: true, session }
  }
}
```

## Vue 3 компоненты

### Кнопка входа через Telegram

```vue
<template>
  <TelegramLoginButton
    auth-url="/api/auth/deeplink"
    auth-type="deeplink"
    text="Войти через Telegram"
    @auth-success="onAuthSuccess"
    @auth-error="onAuthError"
  />
</template>

<script setup>
import { TelegramLoginButton } from 'tgauth/vue'

const onAuthSuccess = (data) => {
  console.log('Успешная авторизация:', data)
}

const onAuthError = (error) => {
  console.error('Ошибка авторизации:', error)
}
</script>
```

### Компонент кода авторизации

```vue
<template>
  <div>
    <!-- Отображение кода -->
    <TelegramAuthCode
      mode="display"
      :code="authCode"
      title="Ваш код для входа"
      subtitle="Используйте этот код в Telegram"
      :show-timer="true"
      :code-lifetime="300"
    />

    <!-- Или ввод кода -->
    <TelegramAuthCode
      mode="input"
      title="Введите код из Telegram"
      :input-length="6"
      :has-error="hasError"
      error-message="Неверный код"
      @code-entered="onCodeEntered"
      @request-new-code="requestNewCode"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { TelegramAuthCode } from 'tgauth/vue'

const authCode = ref('123456')
const hasError = ref(false)

const onCodeEntered = (code) => {
  console.log('Введен код:', code)
  // Проверка кода на сервере
}

const requestNewCode = async () => {
  try {
    const response = await fetch('/api/auth/code')
    const data = await response.json()
    authCode.value = data.code
  } catch (error) {
    console.error('Ошибка получения нового кода:', error)
  }
}
</script>
```

## Лицензия

MIT
