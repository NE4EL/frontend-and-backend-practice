# Практическое занятие 7 — Базовые методы аутентификации

Работа выполнена Евтушенко Егором ЭФБО-08-24
Серверное приложение на Node.js с регистрацией/входом через bcrypt и CRUD-операциями для товаров.

## Стек

- **Node.js**, Express, nanoid, bcrypt, cors
- **Документация:** swagger-jsdoc, swagger-ui-express

## Установка и запуск

```bash
npm install
node app.js
```

Сервер: `http://localhost:3000`  
Swagger UI: `http://localhost:3000/api-docs`

## Маршруты

| Метод | Путь | Описание |
|---|---|---|
| POST | /api/auth/register | Регистрация пользователя |
| POST | /api/auth/login | Вход в систему |
| GET | /api/products | Список товаров |
| GET | /api/products/:id | Товар по ID |
| POST | /api/products | Создать товар |
| PUT | /api/products/:id | Обновить товар |
| DELETE | /api/products/:id | Удалить товар |

## Сущности

**Пользователь:** id, email, first_name, last_name, password (хешируется bcrypt, rounds=10)

**Товар:** id, title, category, description, price


# Практическое занятие 8 — JWT аутентификация

Доработка сервера из практики 7: добавлена выдача JWT-токена при входе и защищённые маршруты.

## Стек

- **Node.js**, Express, nanoid, bcrypt, jsonwebtoken, cors
- **Документация:** swagger-jsdoc, swagger-ui-express

## Установка и запуск

```bash
npm install
node app.js
```

Сервер: `http://localhost:3000`  
Swagger UI: `http://localhost:3000/api-docs`

## Маршруты

| Метод | Путь | Защита | Описание |
|---|---|---|---|
| POST | /api/auth/register | — | Регистрация |
| POST | /api/auth/login | — | Вход, возвращает accessToken |
| GET | /api/auth/me | JWT | Текущий пользователь |
| GET | /api/auth/users | — | Все пользователи (отладка) |
| GET | /api/products | — | Список товаров |
| GET | /api/products/:id | JWT | Товар по ID |
| POST | /api/products | — | Создать товар |
| PUT | /api/products/:id | JWT | Обновить товар |
| DELETE | /api/products/:id | JWT | Удалить товар |

## Как использовать токен

1. Зарегистрироваться через `POST /api/auth/register`
2. Войти через `POST /api/auth/login` — получить `accessToken`
3. В Postman: вкладка **Authorization → Bearer Token** → вставить токен
4. Токен живёт **15 минут** (`ACCESS_EXPIRES_IN = '15m'`)

## JWT токен

Токен содержит: `sub` (id), `email`, `first_name`, `last_name`, `iat`, `exp`  
Передаётся в заголовке: `Authorization: Bearer <token>`

{ "email": "ivan@mail.ru", "first_name": "Иван", "last_name": "Петров", "password": "qwerty123" }
{ "email": "ivan@mail.ru", "password": "qwerty123" }


# Практическое занятие 9 — Refresh-токены

Доработка сервера из практики 8: добавлена генерация refresh-токенов, хранилище токенов и маршрут обновления пары токенов.

## Стек

- **Node.js**, Express, nanoid, bcrypt, jsonwebtoken, cors
- **Документация:** swagger-jsdoc, swagger-ui-express

## Установка и запуск

```bash
npm install
node app.js
```

Сервер: `http://localhost:3000`  
Swagger UI: `http://localhost:3000/api-docs`

## Маршруты

| Метод | Путь | Защита | Описание |
|---|---|---|---|
| POST | /api/auth/register | — | Регистрация |
| POST | /api/auth/login | — | Вход, возвращает accessToken + refreshToken |
| POST | /api/auth/refresh | Bearer refreshToken | Обновление пары токенов |
| GET | /api/auth/me | accessToken | Текущий пользователь |
| GET | /api/auth/users | — | Все пользователи (отладка) |
| GET | /api/products | — | Список товаров |
| GET | /api/products/:id | accessToken | Товар по ID |
| POST | /api/products | — | Создать товар |
| PUT | /api/products/:id | accessToken | Обновить товар |
| DELETE | /api/products/:id | accessToken | Удалить товар |

## Схема работы токенов

1. Логин → получаем `accessToken` (15 мин) + `refreshToken` (7 дней)
2. Запросы к защищённым маршрутам → передаём `accessToken` в заголовке
3. Если `accessToken` истёк → отправляем `refreshToken` на `POST /api/auth/refresh`
4. Получаем новую пару токенов (старый `refreshToken` удаляется — ротация)
5. Если `refreshToken` истёк → нужно заново войти через логин

## Формат ответа /api/auth/login и /api/auth/refresh

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

# Практическое занятие 10 

Практическое занятие 10 — Хранение токенов на фронтенде
Фронтенд на React.js, связанный с сервером из практики 9. Реализованы страницы входа, регистрации и управления товарами. Токены хранятся в localStorage, обновление происходит автоматически через axios interceptors.
Стек

Фронтенд: React.js, React Router DOM, Axios, Sass
Бэкенд: Node.js, Express, JWT, bcrypt (практика 9)

Установка и запуск
Бэкенд
bashcd server
npm install
node app.js
Фронтенд
bashcd client
npm install
npm run dev
Приложение: http://localhost:3001
Swagger UI: http://localhost:3000/api-docs
Страницы
ПутьОписаниеЗащита/loginСтраница входа—/registerСтраница регистрации—/productsУправление товарами✅ JWT
Функциональность

Регистрация и вход с сохранением accessToken + refreshToken в localStorage
Автоматическая подстановка токена в каждый запрос (axios request interceptor)
Автоматическое обновление токена при истечении 401 (axios response interceptor)
Просмотр списка товаров, детальная карточка по ID
Создание, редактирование, удаление товаров
Кнопка выхода — очищает токены и редиректит на /login

Схема работы токенов
Логин → accessToken (15 мин) + refreshToken (7 дней) → localStorage
↓
Запрос → interceptor подставляет accessToken в заголовок
↓
401 → interceptor отправляет refreshToken → получает новую пару → повторяет запрос
↓
Ошибка обновления → очищает localStorage → редирект на /login

## how

Шаг 1 — Регистрация
POST http://localhost:3000/api/auth/register
Body (raw JSON):
{
  "email": "ivan@mail.ru",
  "first_name": "Иван",
  "last_name": "Петров",
  "password": "qwerty123"
}

Шаг 2 — Вход
POST http://localhost:3000/api/auth/login
Body:
{
  "email": "ivan@mail.ru",
  "password": "qwerty123"
}

Шаг 3 — Защищённый маршрут
GET http://localhost:3000/api/auth/me
Authorization → Bearer Token → вставить accessToken

Шаг 4 — Работа с товарами
GET    http://localhost:3000/api/products           (без токена)
GET    http://localhost:3000/api/products/:id       (с accessToken)
POST   http://localhost:3000/api/products           (без токена)
PUT    http://localhost:3000/api/products/:id       (с accessToken)
DELETE http://localhost:3000/api/products/:id       (с accessToken)

Шаг 5 — Обновление токена
POST http://localhost:3000/api/auth/refresh
Authorization → Bearer Token → вставить refreshToken


# Практическое занятие 11 — RBAC (Role-Based Access Control)

Доработка сервера и фронтенда из практики 10: добавлена система ролей с разграничением прав доступа.

## Стек

- **Бэкенд:** Node.js, Express, nanoid, bcrypt, jsonwebtoken, cors, swagger-jsdoc, swagger-ui-express
- **Фронтенд:** React.js, React Router DOM, Axios, Sass, jwt-decode

## Установка и запуск

### Бэкенд
```bash
cd server
npm install
node app.js
```

### Фронтенд
```bash
cd client
npm install
npm start
```

Приложение: `http://localhost:3000`  
Swagger UI: `http://localhost:3000/api-docs` (бэкенд на 3000, фронтенд на 3001)

## Роли

| Роль | Описание |
|---|---|
| `user` | Только просмотр товаров |
| `seller` | Просмотр + создание и редактирование товаров |
| `admin` | Все права продавца + удаление товаров + управление пользователями |

## Маршруты и права доступа

| Метод | Путь | Доступ |
|---|---|---|
| POST | /api/auth/register | Гость |
| POST | /api/auth/login | Гость |
| POST | /api/auth/refresh | Гость |
| GET | /api/auth/me | user, seller, admin |
| GET | /api/users | admin |
| GET | /api/users/:id | admin |
| PUT | /api/users/:id | admin |
| DELETE | /api/users/:id | admin (блокировка) |
| GET | /api/products | user, seller, admin |
| GET | /api/products/:id | user, seller, admin |
| POST | /api/products | seller, admin |
| PUT | /api/products/:id | seller, admin |
| DELETE | /api/products/:id | admin |

## Как тестировать

1. Зарегистрировать пользователей с разными ролями через `POST /api/auth/register` (передать поле `role`)
2. Войти — получить токен
3. Обратиться к защищённым маршрутам с токеном
4. Убедиться что `user` получает `403` при попытке создать товар
5. Убедиться что `seller` получает `403` при попытке удалить товар


