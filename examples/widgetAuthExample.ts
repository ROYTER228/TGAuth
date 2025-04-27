/**
 * Пример использования WidgetAuth для авторизации через Telegram Login Widget
 *
 * Этот пример демонстрирует, как интегрировать Telegram Login Widget с веб-приложением
 * и обрабатывать данные авторизации с проверкой подписи.
 */

import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { WidgetAuth, SessionManager } from '../Src/index.js'

// Получаем текущую директорию
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Конфигурация
const botToken = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN'
const port = 3000

// Создаем менеджер сессий
const sessionManager = new SessionManager({
  sessionLifetime: 1000 * 60 * 60 * 24, // 1 день
})

// Создаем экземпляр WidgetAuth
const widgetAuth = new WidgetAuth({
  botToken,
  transport: ['callback'],
  onAuth: async (userData) => {
    console.log('Пользователь авторизован через виджет:', userData)

    // Создаем сессию для пользователя
    const session = await sessionManager.createSession(userData)
    console.log(`Создана сессия: ${session.id}`)
  },
  validateSignature: true, // Проверять подпись данных от виджета
})

// Создаем Express приложение
const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Главная страница с виджетом
app.get('/', (req, res) => {
  // Получаем имя бота из токена (для примера)
  const botUsername = 'YourBot' // В реальном приложении получите имя бота из BotFather

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Telegram Login Widget Example</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .container { border: 1px solid #ddd; padding: 20px; border-radius: 5px; }
        .user-info { margin-top: 20px; display: none; }
        .user-info.visible { display: block; }
        .user-avatar { width: 64px; height: 64px; border-radius: 50%; }
        .user-name { font-weight: bold; }
        .logout-btn { margin-top: 10px; padding: 5px 10px; background: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer; }
      </style>
    </head>
    <body>
      <h1>Telegram Login Widget Example</h1>

      <div class="container">
        <h2>Авторизация через Telegram</h2>
        <p>Нажмите на кнопку ниже, чтобы авторизоваться через Telegram:</p>

        <!-- Telegram Login Widget -->
        <script async src="https://telegram.org/js/telegram-widget.js?22"
          data-telegram-login="${botUsername}"
          data-size="large"
          data-auth-url="/auth/telegram-widget"
          data-request-access="write"></script>

        <div id="userInfo" class="user-info">
          <h3>Информация о пользователе</h3>
          <div>
            <img id="userAvatar" class="user-avatar" src="" alt="Avatar">
            <p>ID: <span id="userId"></span></p>
            <p>Имя: <span id="userName"></span></p>
            <p>Username: <span id="userUsername"></span></p>
          </div>
          <button id="logoutBtn" class="logout-btn">Выйти</button>
        </div>
      </div>

      <script>
        // Проверяем, авторизован ли пользователь
        fetch('/auth/check')
          .then(response => response.json())
          .then(data => {
            if (data.authenticated) {
              showUserInfo(data.user);
            }
          });

        // Функция для отображения информации о пользователе
        function showUserInfo(user) {
          document.getElementById('userInfo').classList.add('visible');
          document.getElementById('userId').textContent = user.id;
          document.getElementById('userName').textContent = user.first_name + (user.last_name ? ' ' + user.last_name : '');
          document.getElementById('userUsername').textContent = user.username || 'Не указан';

          if (user.photo_url) {
            document.getElementById('userAvatar').src = user.photo_url;
          } else {
            document.getElementById('userAvatar').src = 'https://telegram.org/img/t_logo.png';
          }
        }

        // Обработчик кнопки выхода
        document.getElementById('logoutBtn').addEventListener('click', () => {
          fetch('/auth/logout', { method: 'POST' })
            .then(() => {
              document.getElementById('userInfo').classList.remove('visible');
              window.location.reload();
            });
        });
      </script>
    </body>
    </html>
  `)
})

// Обработка данных от Telegram Login Widget
app.post('/auth/telegram-widget', (req, res) => {
  const widgetData = req.body
  console.log('Получены данные от виджета:', widgetData)

  const isValid = widgetAuth.handleAuth(widgetData)

  if (isValid) {
    // Сохраняем данные пользователя в сессии
    req.session = { user: widgetData, authenticated: true }

    // Перенаправляем на главную страницу
    res.redirect('/')
  } else {
    res.status(400).send('Ошибка авторизации: недействительные данные виджета')
  }
})

// Обработка GET запроса от Telegram Login Widget (для случаев, когда виджет настроен на GET)
app.get('/auth/telegram-widget', (req, res) => {
  const widgetData = req.query
  console.log('Получены данные от виджета (GET):', widgetData)

  const isValid = widgetAuth.handleAuth(widgetData)

  if (isValid) {
    // Сохраняем данные пользователя в сессии
    req.session = { user: widgetData, authenticated: true }

    // Перенаправляем на главную страницу
    res.redirect('/')
  } else {
    res.status(400).send('Ошибка авторизации: недействительные данные виджета')
  }
})

// Проверка статуса авторизации
app.get('/auth/check', (req, res) => {
  if (req.session && req.session.authenticated) {
    res.json({ authenticated: true, user: req.session.user })
  } else {
    res.json({ authenticated: false })
  }
})

// Выход из системы
app.post('/auth/logout', (req, res) => {
  req.session = null
  res.json({ success: true })
})

// Запускаем сервер
app.listen(port, () => {
  console.log(`Сервер запущен на http://localhost:${port}`)
  console.log('Для работы виджета необходимо:')
  console.log('1. Настроить бота через @BotFather')
  console.log('2. Включить Login Widget в настройках бота')
  console.log('3. Указать правильное имя бота в переменной botUsername')
})

// Примечание: для работы с сессиями в реальном приложении
// необходимо добавить middleware для работы с сессиями, например:
// import session from 'express-session';
// app.use(session({
//   secret: 'your-secret-key',
//   resave: false,
//   saveUninitialized: true,
//   cookie: { secure: process.env.NODE_ENV === 'production' }
// }));
