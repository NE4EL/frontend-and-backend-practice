# TechStore E-commerce — Practice 28 (КР5)

Финальный проект контрольной работы №5. Полноценный интернет-магазин с каталогом товаров, корзиной, оформлением заказов и панелью администратора. Является расширением TechStore из KR2.

## Стек технологий

| Слой | Технология |
|------|-----------|
| Frontend | React 18 + Vite 5 (lazy loading, code splitting) |
| Backend | Express 4 + Sequelize ORM |
| База данных | PostgreSQL 16 |
| Авторизация | JWT (access 15m + refresh 7d) + RBAC |
| Контейнеризация | Docker + docker-compose |
| Тесты | Jest + Supertest (покрытие ≥ 50%) |

## Запуск (один командой)

**Требования:** Docker Desktop

```bash
cd KR5/Practice-28
docker compose up --build
```

Приложение: http://localhost:3000  
Swagger: http://localhost:3000/api-docs

По умолчанию создаётся аккаунт: **admin@techstore.com / admin123**

## Переменные окружения

| Переменная | По умолчанию | Описание |
|-----------|-------------|---------|
| `PORT` | 3000 | Порт сервера |
| `DB_HOST` | localhost | Хост PostgreSQL |
| `DB_NAME` | kr5_techstore | Имя базы данных |
| `DB_USER` | postgres | Пользователь |
| `DB_PASS` | *(пусто)* | Пароль |
| `ACCESS_SECRET` | *(встроенный)* | Секрет JWT access токена |
| `REFRESH_SECRET` | *(встроенный)* | Секрет JWT refresh токена |

## Запуск без Docker (для разработки)

```bash
# PostgreSQL должен быть запущен локально

# Backend
cd backend
npm install
node server.js   # :3000

# Frontend (в отдельном терминале)
cd frontend
npm install
npm run dev      # :5174 (proxy /api → :3000)
```

## Запуск тестов

```bash
cd backend
npm install
npm test
# или с отчётом покрытия:
npm test -- --coverage
```

## Функциональность

### Роли
- **customer** — просмотр каталога, корзина, оформление заказов, история заказов
- **admin** — всё + управление товарами, смена статусов заказов, управление пользователями

### API

| Метод | Путь | Auth | Описание |
|-------|------|------|---------|
| POST | `/api/auth/register` | — | Регистрация |
| POST | `/api/auth/login` | — | Вход |
| POST | `/api/auth/refresh` | refreshToken | Обновление токена |
| GET  | `/api/auth/me` | JWT | Текущий пользователь |
| GET  | `/api/products` | — | Каталог (поиск, фильтр по категории) |
| POST | `/api/products` | admin | Создать товар |
| PUT  | `/api/products/:id` | admin | Изменить товар |
| DELETE | `/api/products/:id` | admin | Удалить товар |
| GET  | `/api/cart` | JWT | Корзина |
| POST | `/api/cart` | JWT | Добавить в корзину |
| PUT  | `/api/cart/:productId` | JWT | Изменить количество |
| DELETE | `/api/cart/:productId` | JWT | Удалить из корзины |
| POST | `/api/orders` | JWT | Оформить заказ |
| GET  | `/api/orders` | JWT | История заказов |
| PUT  | `/api/orders/:id/status` | admin | Изменить статус заказа |
| GET  | `/api/users` | admin | Список пользователей |
| PUT  | `/api/users/:id` | admin | Изменить пользователя |

## Связь с KR2

Данный проект является прямым расширением TechStore из KR2 (Practuce 11-12):
- Те же роли: customer ≈ user, admin
- Та же схема JWT (access + refresh)
- Аналогичная структура API
- Добавлены: корзина (CartItem), заказы (Order + OrderItem), склад (stock)

## Архитектура

```
docker-compose.yml
├── postgres:16   — база данных (volume: pgdata)
└── backend       — Express API + статика фронтенда
    ├── Sequelize ORM (User, Product, CartItem, Order, OrderItem)
    ├── JWT middleware
    ├── Swagger UI (/api-docs)
    └── /frontend/dist  — собранный Vite React SPA
```
