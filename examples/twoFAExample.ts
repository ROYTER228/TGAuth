/**
 * Пример использования TwoFAAuth для двухфакторной аутентификации
 *
 * Этот пример демонстрирует, как использовать TwoFAAuth в различных сценариях:
 * 1. Базовое использование
 * 2. Интеграция с Grammy
 * 3. Интеграция с Express
 * 4. Интеграция с WebSocket
 */

import { Bot } from 'grammy'
import express from 'express'
import { Server } from 'socket.io'
import http from 'http'
import { TwoFAAuth, SessionManager, AuthResult } from '../Src/index.js'

// Конфигурация
const botToken = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN'
const port = 3000

// Создаем менеджер сессий
const sessionManager = new SessionManager({
  sessionLifetime: 1000 * 60 * 60 * 24, // 1 день
})

// Создаем Express приложение
const app = express()
const server = http.createServer(app)
const io = new Server(server)

app.use(express.json())

// Настраиваем WebSocket
io.on('connection', (socket) => {
  console.log('Клиент подключился к WebSocket')

  socket.on('disconnect', () => {
    console.log('Клиент отключился от WebSocket')
  })
})

// Создаем экземпляр TwoFAAuth
const twoFAAuth = new TwoFAAuth({
  botToken,
  transport: ['callback', 'rest', 'websocket'],
  onAuth: async (userData) => {
    console.log('2FA успешно пройдена (callback):', userData)

    // Создаем сессию для пользователя
    const session = await sessionManager.createSession(userData)
    console.log(`Создана сессия: ${session.id}`)
  },
  restEndpoint: 'http://localhost:3000/api/auth/2fa',
  wsServer: io,
  codeLifetime: 1000 * 60 * 5, // 5 минут
  codeLength: 6,
  maxAttempts: 3,
})

// Создаем бота Grammy
const bot = new Bot(botToken)

// Обработка команды /start
bot.command('start', async (ctx) => {
  await ctx.reply('Привет! Я бот для демонстрации 2FA. Используйте /2fa для начала процесса двухфакторной аутентификации.')
})

// Обработка команды /2fa
bot.command('2fa', async (ctx) => {
  if (!ctx.from) return

  const userId = ctx.from.id
  const userData: AuthResult = {
    id: userId,
    is_bot: ctx.from.is_bot,
    first_name: ctx.from.first_name,
    last_name: ctx.from.last_name,
    username: ctx.from.username,
    language_code: ctx.from.language_code,
  }

  // Генерируем код 2FA
  const code = twoFAAuth.start2FA(userId, userData)

  await ctx.reply(`Ваш код для 2FA: ${code}\n\nВведите его на сайте или отправьте мне в формате /verify <код>`)
})

// Обработка команды /verify для проверки кода
bot.command('verify', async (ctx) => {
  if (!ctx.from) return

  const args = ctx.message?.text?.split(' ')
  if (!args || args.length < 2) {
    await ctx.reply('Пожалуйста, укажите код в формате: /verify <код>')
    return
  }

  const code = args[1]
  const userId = ctx.from.id

  // Проверяем код 2FA
  const isValid = twoFAAuth.verify2FA(userId, code)

  if (isValid) {
    await ctx.reply('Код верный! Двухфакторная аутентификация пройдена успешно.')
  } else {
    await ctx.reply('Неверный код или истекло время действия. Попробуйте снова.')
  }
})

// Обработка команды /reset для сброса 2FA
bot.command('reset', async (ctx) => {
  if (!ctx.from) return

  const userId = ctx.from.id
  twoFAAuth.reset2FA(userId)

  await ctx.reply('Ваша 2FA сессия сброшена. Используйте /2fa для генерации нового кода.')
})

// Обработка команды /status для проверки статуса 2FA
bot.command('status', async (ctx) => {
  if (!ctx.from) return

  const userId = ctx.from.id
  const isVerified = twoFAAuth.isVerified(userId)

  if (isVerified) {
    await ctx.reply('Ваша 2FA верификация активна.')
  } else {
    await ctx.reply('Вы не прошли 2FA верификацию. Используйте /2fa для начала процесса.')
  }
})

// Настраиваем Express маршруты

// Главная страница
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>TwoFAAuth Demo</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          .container { border: 1px solid #ddd; padding: 20px; border-radius: 5px; }
          .code-input { display: flex; margin: 20px 0; }
          .code-input input { width: 40px; height: 40px; margin: 0 5px; text-align: center; font-size: 20px; }
          button { padding: 10px 15px; background: #0088cc; color: white; border: none; border-radius: 5px; cursor: pointer; }
        </style>
      </head>
      <body>
        <h1>TwoFAAuth Demo</h1>
        <div class="container">
          <h2>Двухфакторная аутентификация</h2>
          <p>Для начала процесса 2FA, отправьте команду /2fa боту в Telegram.</p>
          <p>Затем введите полученный код ниже:</p>

          <div class="code-input">
            <input type="text" maxlength="1" id="code1">
            <input type="text" maxlength="1" id="code2">
            <input type="text" maxlength="1" id="code3">
            <input type="text" maxlength="1" id="code4">
            <input type="text" maxlength="1" id="code5">
            <input type="text" maxlength="1" id="code6">
          </div>

          <div>
            <button id="verify">Проверить код</button>
            <button id="reset">Сбросить</button>
          </div>

          <div id="result" style="margin-top: 20px;"></div>
        </div>

        <script src="/socket.io/socket.io.js"></script>
        <script>
          // Подключаемся к WebSocket
          const socket = io();

          // Обработка ввода кода
          const inputs = Array.from({ length: 6 }, (_, i) => document.getElementById(`code${i+1}`));
          inputs.forEach((input, index) => {
            input.addEventListener('input', () => {
              if (input.value && index < 5) {
                inputs[index + 1].focus();
              }
            });

            input.addEventListener('keydown', (e) => {
              if (e.key === 'Backspace' && !input.value && index > 0) {
                inputs[index - 1].focus();
              }
            });
          });

          // Обработка кнопки проверки
          document.getElementById('verify').addEventListener('click', async () => {
            const code = inputs.map(input => input.value).join('');
            if (code.length !== 6) {
              document.getElementById('result').innerHTML = '<p style="color: red;">Введите 6-значный код</p>';
              return;
            }

            try {
              const response = await fetch('/api/verify-2fa', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: prompt('Введите ваш Telegram ID:'), code })
              });

              const data = await response.json();
              if (data.success) {
                document.getElementById('result').innerHTML = '<p style="color: green;">Код верный! 2FA пройдена успешно.</p>';
              } else {
                document.getElementById('result').innerHTML = `<p style="color: red;">${data.message}</p>`;
              }
            } catch (error) {
              document.getElementById('result').innerHTML = '<p style="color: red;">Ошибка при проверке кода</p>';
            }
          });

          // Обработка кнопки сброса
          document.getElementById('reset').addEventListener('click', () => {
            inputs.forEach(input => input.value = '');
            inputs[0].focus();
            document.getElementById('result').innerHTML = '';
          });

          // Обработка событий WebSocket
          socket.on('tgauth:2fa', (data) => {
            console.log('Получено событие 2FA:', data);
            document.getElementById('result').innerHTML = `<p style="color: green;">Получено подтверждение 2FA для пользователя ${data.id}</p>`;
          });
        </script>
      </body>
    </html>
  `);
});

// API для проверки кода 2FA
app.post('/api/verify-2fa', (req, res) => {
  const { userId, code } = req.body;

  if (!userId || !code) {
    return res.status(400).json({ success: false, message: 'Отсутствует userId или code' });
  }

  const isValid = twoFAAuth.verify2FA(userId, code);

  if (isValid) {
    res.json({ success: true, message: 'Код верный! 2FA пройдена успешно.' });
  } else {
    res.json({ success: false, message: 'Неверный код или истекло время действия.' });
  }
});

// API для REST endpoint 2FA
app.post('/api/auth/2fa', (req, res) => {
  console.log('Получен запрос на /api/auth/2fa:', req.body);
  res.json({ success: true, message: 'Данные 2FA получены' });
});

// Запускаем сервер и бота
async function start() {
  try {
    // Запускаем Express сервер
    server.listen(port, () => {
      console.log(`Сервер запущен на http://localhost:${port}`);
    });

    // Запускаем бота
    await bot.start();
    console.log('Бот запущен');
  } catch (error) {
    console.error('Ошибка при запуске:', error);
  }
}

start();