# KR4 — Базы данных, кэширование, балансировка и контейнеризация

Контрольная работа №4 охватывает практики 19–23: подключение реляционных и NoSQL СУБД, кэширование через Redis, балансировку нагрузки через Nginx и контейнеризацию с Docker Compose.

---

## Быстрый старт

### Необходимые сервисы

| Сервис | Как запустить |
|--------|--------------|
| PostgreSQL | Уже установлен локально (Homebrew) |
| MongoDB | `docker run -d --name mongo-kr4 -p 27017:27017 mongo:7` |
| Redis | `docker run -d --name redis-kr4 -p 6379:6379 redis:alpine` |
| Nginx (Practice 22) | Встроен в `docker compose up` |
| Docker (Practice 23) | `docker compose up --build` |

---

## Практика 19 — PostgreSQL + Sequelize

**Порт:** `3000`

### Запуск
```bash
cd Practice-19
npm install
node server.js
# База данных kr4_p19 создаётся автоматически
```

### Что реализовано
- Подключение к PostgreSQL через Sequelize ORM
- Автоматическое создание базы данных `kr4_p19` и таблицы `users` при старте
- Сущность **User**: `id`, `first_name`, `last_name`, `age`, `created_at`, `updated_at`

### API

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/users` | Создать пользователя |
| GET | `/api/users` | Список всех пользователей |
| GET | `/api/users/:id` | Получить по ID |
| PATCH | `/api/users/:id` | Обновить |
| DELETE | `/api/users/:id` | Удалить |

### Примеры

```bash
# Создать пользователя
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Иван","last_name":"Иванов","age":25}'

# Получить список
curl http://localhost:3000/api/users

# Обновить
curl -X PATCH http://localhost:3000/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{"age":26}'

# Удалить
curl -X DELETE http://localhost:3000/api/users/1
```

### Архитектура

```
Клиент → Express → Sequelize ORM → PostgreSQL (порт 5432)
```

Sequelize позволяет работать с PostgreSQL через модели JavaScript вместо SQL-запросов. При старте `sequelize.sync()` автоматически создаёт таблицу согласно модели.

---

## Практика 20 — MongoDB + Mongoose

**Порт:** `3001`

### Запуск
```bash
# 1. Запустить MongoDB
docker run -d --name mongo-kr4 -p 27017:27017 mongo:7

# 2. Запустить сервер
cd Practice-20
npm install
node server.js
```

### Что реализовано
- Подключение к MongoDB через Mongoose ODM
- Документная схема с теми же полями что и в Practice 19
- Автоматические `timestamps` (`created_at` / `updated_at`)

### API

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/users` | Создать |
| GET | `/api/users` | Список (сортировка по дате) |
| GET | `/api/users/:id` | По ID (MongoDB ObjectId) |
| PATCH | `/api/users/:id` | Обновить |
| DELETE | `/api/users/:id` | Удалить |

### Примеры

```bash
# Создать
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Мария","last_name":"Петрова","age":30}'

# Получить по ID (используй _id из ответа)
curl http://localhost:3001/api/users/<_id>

# Обновить
curl -X PATCH http://localhost:3001/api/users/<_id> \
  -H "Content-Type: application/json" \
  -d '{"age":31}'
```

### PostgreSQL vs MongoDB

| | PostgreSQL (P19) | MongoDB (P20) |
|--|-----------------|---------------|
| Тип | Реляционная | Документная NoSQL |
| Схема | Жёсткая (заранее описана) | Гибкая (схема опциональна) |
| ID | SERIAL (1, 2, 3...) | ObjectId (hex строка) |
| Запросы | SQL | BSON / методы Mongoose |
| Связи | JOIN через внешние ключи | Embedding / Reference |

---

## Практика 21 — Redis кэширование

**Порт:** `3002` | Основана на KR2 Practice 11-12 (Auth + RBAC)

### Запуск
```bash
# 1. Запустить Redis
docker run -d --name redis-kr4 -p 6379:6379 redis:alpine

# 2. Запустить сервер
cd Practice-21
npm install
node server.js
```

### Что реализовано
- Полная система аутентификации и RBAC из KR2 (bcrypt, JWT, роли)
- Middleware `cacheMiddleware` — перехватывает GET-запросы, проверяет кэш
- Функция `saveToCache` — сохраняет ответ в Redis после получения с сервера
- Инвалидация кэша при мутациях (PUT/DELETE)

### Кэшируемые маршруты

| Маршрут | Метод | TTL | Ключ Redis |
|---------|-------|-----|------------|
| `/api/users` | GET | 60 сек | `users:all` |
| `/api/users/:id` | GET | 60 сек | `users:<id>` |
| `/api/products` | GET | 600 сек | `products:all` |
| `/api/products/:id` | GET | 600 сек | `products:<id>` |

### Как работает кэш

```
1й запрос:  GET /api/products → Redis (miss) → сервер → сохранить в Redis → { source: "server" }
2й запрос:  GET /api/products → Redis (hit) → { source: "cache" }
После PUT:  invalidateProductsCache() → Redis удаляет ключ → следующий GET снова идёт на сервер
```

### Примеры

```bash
# Регистрация
curl -X POST http://localhost:3002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","first_name":"Admin","last_name":"User","password":"pass123","role":"admin"}'

# Логин → получить токен
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"pass123"}'

# 1й запрос (source: "server")
curl http://localhost:3002/api/products \
  -H "Authorization: Bearer <token>"

# 2й запрос (source: "cache")
curl http://localhost:3002/api/products \
  -H "Authorization: Bearer <token>"
```

---

## Практика 22 — Балансировка нагрузки (Nginx)

**Порт:** `8080` (Nginx) → 3 backend-сервера

### Запуск
```bash
cd Practice-22
npm install          # зависимости для Node.js backend
docker compose up --build
```

### Что реализовано
- Три идентичных backend-сервера (`backend-1`, `backend-2`, `backend-3`)
- Nginx как балансировщик нагрузки (Round Robin)
- `backend-3` настроен как резервный (`backup`)
- Настройки отказоустойчивости: `max_fails=2 fail_timeout=30s`

### Структура

```
Клиент :8080
    ↓
  Nginx (Round Robin)
   ├── backend1:3000 (SERVER_ID=1)
   ├── backend2:3000 (SERVER_ID=2)
   └── backend3:3000 (SERVER_ID=3, backup)
```

### nginx.conf

```nginx
upstream backend {
    server backend1:3000 max_fails=2 fail_timeout=30s;
    server backend2:3000 max_fails=2 fail_timeout=30s;
    server backend3:3000 backup;
}
```

### Тестирование

```bash
# Запросы по кругу (Round Robin)
for i in {1..6}; do curl -s http://localhost:8080/; echo; done
# → backend-1, backend-2, backend-1, backend-2 ...

# Остановить один бэкенд
docker compose stop backend1

# Трафик идёт только через backend2
curl http://localhost:8080/
```

---

## Практика 23 — Docker Compose + Микросервисы

**Порт:** `8000` (API Gateway)

### Запуск
```bash
cd Practice-23
docker compose up --build

# Остановить
docker compose down
```

### Архитектура

```
Клиент :8000
    ↓
API Gateway (Circuit Breaker + Aggregation)
   ├── service_users:8000    (CRUD пользователей)
   └── service_orders:8000   (CRUD заказов)
```

Все сервисы в изолированной Docker-сети `app-network`. Только API Gateway доступен снаружи.

### Circuit Breaker

Защищает от каскадных сбоев. Три состояния:
- **CLOSED** — нормальная работа
- **OPEN** — сервис недоступен, сразу возвращает ошибку без ожидания
- **HALF_OPEN** — тестовый запрос для проверки восстановления

Параметры: `failureThreshold=3`, `recoveryTimeout=10s`

### API

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/status` | Статус gateway и Circuit Breaker |
| GET | `/users` | Список пользователей |
| POST | `/users` | Создать пользователя |
| GET | `/users/:id` | Пользователь по ID |
| PUT | `/users/:id` | Обновить пользователя |
| DELETE | `/users/:id` | Удалить |
| GET | `/orders` | Список заказов (`?userId=N` для фильтрации) |
| POST | `/orders` | Создать заказ |
| GET | `/orders/:id` | Заказ по ID |
| GET | `/users/:id/details` | Агрегация: пользователь + его заказы |

### Примеры

```bash
# Статус системы
curl http://localhost:8000/status

# Создать пользователя
curl -X POST http://localhost:8000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Иван Иванов","email":"ivan@example.com"}'

# Создать заказ
curl -X POST http://localhost:8000/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"product":"Ноутбук","price":75000}'

# Агрегация: пользователь + все его заказы одним запросом
curl http://localhost:8000/users/1/details
```

### Тестирование Circuit Breaker

```bash
# Остановить сервис пользователей
docker compose stop service_users

# Первые 3 запроса — реальные ошибки
curl http://localhost:8000/users
# → {"error": "request failed, reason: ..."}

# После 3 ошибок — Circuit Breaker открывается
curl http://localhost:8000/users
# → {"error": "users service temporarily unavailable"}

# Проверить состояние (state: "OPEN")
curl http://localhost:8000/status
```

### docker-compose.yml ключевые моменты

```yaml
services:
  api_gateway:
    build: api_gateway
    ports:
      - "8000:8000"        # только gateway доступен снаружи
    networks:
      - app-network

  service_users:
    build: service_users   # порт не проброшен — закрыт снаружи
    networks:
      - app-network
```

Сервисы общаются между собой по имени: `http://service_users:8000` — Docker резолвит в IP контейнера.

---

## Сравнение технологий

| | Practice 19 | Practice 20 | Practice 21 | Practice 22 | Practice 23 |
|--|-------------|-------------|-------------|-------------|-------------|
| **Тема** | PostgreSQL | MongoDB | Redis Cache | Nginx LB | Docker |
| **Порт** | 3000 | 3001 | 3002 | 8080 | 8000 |
| **Зависимости** | Локальный PG | Docker mongo | Docker redis | Docker nginx | Docker Compose |
| **Данные** | Реляционные | Документы | In-memory | In-memory | In-memory |

---

## Полезные команды Docker

```bash
# Посмотреть запущенные контейнеры
docker ps

# Логи сервиса
docker compose logs -f api_gateway

# Зайти внутрь контейнера
docker compose exec service_users sh

# Остановить и удалить всё
docker compose down -v
```
