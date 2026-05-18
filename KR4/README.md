# KR4 — TechStore: базы данных, кэш, балансировка, контейнеры

KR4 — это продолжение TechStore из KR2. Если в KR2 все данные хранились в памяти (массивы), то здесь каждая практика добавляет новый уровень инфраструктуры: реальные базы данных, кэш, балансировку нагрузки и контейнеризацию.

Все практики используют одно и то же приложение — интернет-магазин TechStore с теми же товарами, пользователями и правами доступа (user / seller / admin).

---

## Как связаны практики

```
KR2 (в памяти)
    │
    ├── Practice 19 ── PostgreSQL (реляционная БД)
    ├── Practice 20 ── MongoDB (документная БД)
    ├── Practice 21 ── KR2 + Redis (кэширование запросов)
    ├── Practice 22 ── Nginx (балансировка между серверами)
    └── Practice 23 ── Docker Compose (разбивка на микросервисы)
```

---

## Practice 19 — PostgreSQL

**Порт:** `3000` | **База данных:** PostgreSQL (локальная, Homebrew)

### Что это

KR2 хранил пользователей и товары в массивах — при перезапуске всё терялось. Practice 19 заменяет массивы на PostgreSQL: данные сохраняются в реальных таблицах и не исчезают после остановки сервера.

### Как запустить

```bash
cd KR4/Practice-19
npm install
node server.js
# База данных kr4_p19 и таблицы создаются автоматически
```

### Что внутри

- Две таблицы: `users` и `products`
- ORM Sequelize — работа с БД через JavaScript-объекты вместо SQL
- При первом запуске автоматически создаётся БД и добавляются 5 стартовых товаров
- Полная авторизация: регистрация, JWT-токены, роли (user / seller / admin)

### API

```
POST /api/auth/register   — регистрация
POST /api/auth/login      — вход, получить токен
POST /api/auth/refresh    — обновить токен
GET  /api/auth/me         — текущий пользователь

GET    /api/products      — список товаров (все роли)
GET    /api/products/:id  — товар по ID
POST   /api/products      — добавить товар (seller, admin)
PUT    /api/products/:id  — изменить товар (seller, admin)
DELETE /api/products/:id  — удалить товар (admin)

GET    /api/users         — список пользователей (admin)
PUT    /api/users/:id     — изменить пользователя (admin)
DELETE /api/users/:id     — заблокировать (admin)
```

### Пример

```bash
# Регистрация
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","first_name":"Иван","last_name":"Петров","password":"pass123","role":"admin"}'

# Вход
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"pass123"}'
# → { "accessToken": "...", "refreshToken": "..." }

# Получить товары
curl http://localhost:3000/api/products \
  -H "Authorization: Bearer <accessToken>"
```

---

## Practice 20 — MongoDB

**Порт:** `3001` | **База данных:** MongoDB (Docker)

### Что это

То же приложение TechStore, но вместо PostgreSQL — MongoDB. Разница в подходе к хранению: PostgreSQL требует заранее описанную схему (таблицы, столбцы, типы), MongoDB хранит документы в виде JSON и позволяет менять структуру на ходу.

### Как запустить

```bash
# 1. Запустить MongoDB
docker run -d --name mongo-kr4 -p 27017:27017 mongo:7

# 2. Запустить сервер
cd KR4/Practice-20
npm install
node server.js
```

### Чем отличается от Practice 19

| | Practice 19 (PostgreSQL) | Practice 20 (MongoDB) |
|--|---|---|
| Тип данных | Таблицы со строгой схемой | Документы (JSON) |
| ID | Число: `1, 2, 3` | Строка: `6a0a339a...` |
| ORM / ODM | Sequelize | Mongoose |
| Запросы | SQL под капотом | MongoDB API |
| Гибкость схемы | Низкая | Высокая |

### API — идентично Practice 19

Те же маршруты `/api/auth/*`, `/api/products`, `/api/users` — только данные хранятся в MongoDB.

---

## Practice 21 — Redis кэширование

**Порт:** `3002` | **Кэш:** Redis (Docker)

### Что это

Расширение KR2 Practice 11-12: добавляет слой кэширования через Redis. При частых одинаковых запросах (например, список товаров открывают 1000 раз в минуту) сервер не идёт в базу каждый раз, а отдаёт сохранённый ответ из Redis.

### Как запустить

```bash
# 1. Запустить Redis
docker run -d --name redis-kr4 -p 6379:6379 redis:alpine

# 2. Запустить сервер
cd KR4/Practice-21
npm install
node server.js
```

### Как работает кэш

```
1-й запрос GET /api/products:
  → Redis: нет данных (cache miss)
  → Сервер считает данные
  → Сохранить в Redis на 10 минут
  → Ответ: { "source": "server", "data": [...] }

2-й запрос GET /api/products:
  → Redis: данные есть (cache hit)
  → Ответ: { "source": "cache", "data": [...] }

После PUT /api/products/:id:
  → Redis: удалить ключ products:all и products:<id>
  → Следующий GET снова пойдёт на сервер
```

### Кэшируемые маршруты

| Маршрут | TTL | Ключ в Redis |
|---------|-----|-------------|
| `GET /api/products` | 10 минут | `products:all` |
| `GET /api/products/:id` | 10 минут | `products:<id>` |
| `GET /api/users` | 1 минута | `users:all` |
| `GET /api/users/:id` | 1 минута | `users:<id>` |

### Проверка кэша

```bash
# После логина получить токен
TOKEN="<accessToken>"

# Первый вызов — source: "server"
curl http://localhost:3002/api/products -H "Authorization: Bearer $TOKEN"

# Второй вызов — source: "cache"
curl http://localhost:3002/api/products -H "Authorization: Bearer $TOKEN"
```

---

## Practice 22 — Nginx балансировка нагрузки

**Порт:** `8080` (Nginx) → три backend-сервера

### Что это

Один сервер TechStore не может обработать миллион запросов в секунду. Решение — запустить несколько одинаковых серверов и поставить перед ними Nginx, который равномерно распределяет запросы между ними.

### Как запустить

```bash
cd KR4/Practice-22
npm install        # зависимости для Node.js
docker compose up --build

# Остановить
docker compose down
```

### Как устроено

```
Клиент → :8080 → Nginx (балансировщик)
                    ├── backend-1:3000
                    ├── backend-2:3000  (Round Robin)
                    └── backend-3:3000  (резервный, включается если 1 и 2 недоступны)
```

- **Round Robin** — запросы распределяются по кругу: 1-й → backend-1, 2-й → backend-2, 3-й → backend-1...
- **Backup** — backend-3 не получает запросы пока работают основные
- **Отказоустойчивость** — если сервер не ответил 2 раза (`max_fails=2`), Nginx исключает его на 30 секунд (`fail_timeout=30s`)

### Тестирование

```bash
# Видно чередование серверов
for i in {1..4}; do curl -s http://localhost:8080/ | grep server; done
# → backend-1
# → backend-2
# → backend-1
# → backend-2

# Остановить один сервер
docker compose stop backend1

# Теперь весь трафик идёт через backend-2
curl http://localhost:8080/api/products
```

---

## Practice 23 — Docker Compose + Микросервисы

**Порт:** `8000` (API Gateway)

### Что это

В предыдущих практиках TechStore — это один сервер, который делает всё: авторизацию, управление пользователями, управление товарами. В Practice 23 приложение разбито на три независимых сервиса, каждый в своём Docker-контейнере.

### Как запустить

```bash
cd KR4/Practice-23
docker compose up --build

# Остановить
docker compose down
```

### Архитектура

```
Клиент → :8000
              ↓
        api_gateway          ← единственная точка входа
        (Circuit Breaker)
          /         \
service_users     service_products
(auth + RBAC)     (товары TechStore)
```

- **service_users** — регистрация, логин, управление пользователями. Никто снаружи не может обратиться к нему напрямую.
- **service_products** — CRUD товаров TechStore. Тоже закрыт снаружи.
- **api_gateway** — принимает все запросы, проверяет авторизацию через service_users, проксирует к нужному сервису.

Сервисы общаются по именам (`http://service_users:8000`) — Docker сам резолвит их в IP-адреса внутри сети.

### Circuit Breaker

Защищает от каскадных сбоев. Если service_products упал, gateway не будет каждый раз ждать таймаута — после 3 ошибок он «открывается» и сразу возвращает понятное сообщение об ошибке. Через 10 секунд делает пробный запрос, и если сервис восстановился — снова начинает пропускать трафик.

```
Нормальная работа:   CLOSED → запросы проходят
После 3 ошибок:      OPEN   → сразу возвращает ошибку (без ожидания)
Через 10 секунд:     HALF_OPEN → пробный запрос
Если сервис ожил:    CLOSED → снова нормальная работа
```

### API

```
GET  /status                    — состояние gateway и Circuit Breaker

POST /api/auth/register         — регистрация
POST /api/auth/login            — вход
POST /api/auth/refresh          — обновить токен

GET    /api/products            — список товаров
GET    /api/products/:id        — товар по ID
POST   /api/products            — добавить (seller, admin)
PUT    /api/products/:id        — изменить (seller, admin)
DELETE /api/products/:id        — удалить (admin)

GET    /api/users               — список пользователей (admin)
PUT    /api/users/:id           — изменить (admin)
DELETE /api/users/:id           — заблокировать (admin)

GET    /api/users/:id/overview  — агрегация: пользователь + все товары (admin)
```

### Пример работы

```bash
# Регистрация через gateway (он проксирует в service_users)
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ts.com","first_name":"Иван","last_name":"Петров","password":"pass123","role":"admin"}'

# Вход
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ts.com","password":"pass123"}'

# Товары (gateway проверяет токен через service_users, затем запрашивает service_products)
curl http://localhost:8000/api/products \
  -H "Authorization: Bearer <accessToken>"

# Проверить Circuit Breaker
docker compose stop service_products
curl http://localhost:8000/api/products -H "Authorization: Bearer <accessToken>"
# → {"error": "products service temporarily unavailable"}

curl http://localhost:8000/status
# → {"circuitBreakers": [{"name": "products", "state": "OPEN", "failures": 3}]}
```

---

## Запуск всех сервисов

| Практика | Команда | Порт |
|----------|---------|------|
| Practice 19 | `cd Practice-19 && node server.js` | 3000 |
| Practice 20 | `docker run -d --name mongo-kr4 -p 27017:27017 mongo:7` → `cd Practice-20 && node server.js` | 3001 |
| Practice 21 | `docker run -d --name redis-kr4 -p 6379:6379 redis:alpine` → `cd Practice-21 && node server.js` | 3002 |
| Practice 22 | `cd Practice-22 && docker compose up --build` | 8080 |
| Practice 23 | `cd Practice-23 && docker compose up --build` | 8000 |
