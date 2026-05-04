const express = require('express');
const { nanoid } = require('nanoid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
const port = 3000;

// ===== СЕКРЕТЫ И ВРЕМЯ ЖИЗНИ ТОКЕНОВ =====
const ACCESS_SECRET = 'access_secret';
const REFRESH_SECRET = 'refresh_secret';
const ACCESS_EXPIRES_IN = '15m';
const REFRESH_EXPIRES_IN = '7d';

app.use(express.json());
app.use(cors({
  origin: 'http://localhost:3001',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use((req, res, next) => {
  res.on('finish', () => {
    console.log(`[${new Date().toISOString()}] [${req.method}] ${res.statusCode} ${req.path}`);
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      console.log('Body:', req.body);
    }
  });
  next();
});

// ===== ДАННЫЕ =====
let users = [];
let products = [
  { id: nanoid(6), title: 'iPhone 15 Pro', category: 'Смартфоны', description: 'Apple iPhone 15 Pro 256GB', price: 89990 },
  { id: nanoid(6), title: 'MacBook Air M3', category: 'Ноутбуки', description: 'Apple MacBook Air 13" M3, 8GB RAM', price: 119990 },
  { id: nanoid(6), title: 'Sony WH-1000XM5', category: 'Наушники', description: 'Беспроводные наушники с ANC', price: 29990 },
];

// ===== ХРАНИЛИЩЕ REFRESH-ТОКЕНОВ =====
const refreshTokens = new Set();

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

function findUserByEmail(email) {
  return users.find(u => u.email === email);
}

function findProductOr404(id, res) {
  const product = products.find(p => p.id === id);
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return null;
  }
  return product;
}

// ===== ГЕНЕРАЦИЯ ТОКЕНОВ =====
function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
    },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES_IN }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
    },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES_IN }
  );
}

// ===== JWT MIDDLEWARE =====
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  try {
    const payload = jwt.verify(token, ACCESS_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ===== SWAGGER =====
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API интернет-магазина с Refresh-токенами',
      version: '3.0.0',
      description: 'REST API с JWT + Refresh-токенами и CRUD товаров',
    },
    servers: [{ url: `http://localhost:${port}`, description: 'Локальный сервер' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./app.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required: [email, first_name, last_name, password]
 *       properties:
 *         id:
 *           type: string
 *         email:
 *           type: string
 *           example: ivan@mail.ru
 *         first_name:
 *           type: string
 *           example: Иван
 *         last_name:
 *           type: string
 *           example: Петров
 *         password:
 *           type: string
 *           example: qwerty123
 *
 *     TokenPair:
 *       type: object
 *       properties:
 *         accessToken:
 *           type: string
 *           description: JWT access-токен (живёт 15 минут)
 *         refreshToken:
 *           type: string
 *           description: JWT refresh-токен (живёт 7 дней)
 *
 *     Product:
 *       type: object
 *       required: [title, category, description, price]
 *       properties:
 *         id:
 *           type: string
 *         title:
 *           type: string
 *           example: iPhone 15 Pro
 *         category:
 *           type: string
 *           example: Смартфоны
 *         description:
 *           type: string
 *           example: Apple iPhone 15 Pro 256GB
 *         price:
 *           type: number
 *           example: 89990
 */

// ===== AUTH ROUTES =====

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Регистрация пользователя
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, first_name, last_name, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: ivan@mail.ru
 *               first_name:
 *                 type: string
 *                 example: Иван
 *               last_name:
 *                 type: string
 *                 example: Петров
 *               password:
 *                 type: string
 *                 example: qwerty123
 *     responses:
 *       201:
 *         description: Пользователь создан
 *       400:
 *         description: Некорректные данные или email уже занят
 */
app.post('/api/auth/register', async (req, res) => {
  const { email, first_name, last_name, password } = req.body;

  if (!email || !first_name || !last_name || !password) {
    return res.status(400).json({ error: 'email, first_name, last_name and password are required' });
  }

  if (findUserByEmail(email.trim().toLowerCase())) {
    return res.status(400).json({ error: 'User with this email already exists' });
  }

  const newUser = {
    id: nanoid(6),
    email: email.trim().toLowerCase(),
    first_name: first_name.trim(),
    last_name: last_name.trim(),
    hashedPassword: await hashPassword(password),
  };

  users.push(newUser);

  res.status(201).json({
    id: newUser.id,
    email: newUser.email,
    first_name: newUser.first_name,
    last_name: newUser.last_name,
  });
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Вход в систему — возвращает пару access + refresh токенов
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: ivan@mail.ru
 *               password:
 *                 type: string
 *                 example: qwerty123
 *     responses:
 *       200:
 *         description: Успешный вход
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenPair'
 *       400:
 *         description: Отсутствуют обязательные поля
 *       401:
 *         description: Неверные учётные данные
 *       404:
 *         description: Пользователь не найден
 */
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = findUserByEmail(email.trim().toLowerCase());
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const isValid = await verifyPassword(password, user.hashedPassword);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Сохраняем refresh-токен в хранилище
  refreshTokens.add(refreshToken);

  res.json({ accessToken, refreshToken });
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Обновление пары токенов по refresh-токену
 *     description: Принимает refresh-токен из заголовка Authorization и возвращает новую пару токенов (ротация)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Новая пара токенов
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenPair'
 *       400:
 *         description: Refresh-токен не передан
 *       401:
 *         description: Невалидный или просроченный refresh-токен
 */
app.post('/api/auth/refresh', (req, res) => {
  // Получаем refresh-токен из заголовка Authorization
  const header = req.headers.authorization || '';
  const [scheme, refreshToken] = header.split(' ');

  if (scheme !== 'Bearer' || !refreshToken) {
    return res.status(400).json({ error: 'refreshToken is required in Authorization header' });
  }

  // Проверяем что токен есть в нашем хранилище
  if (!refreshTokens.has(refreshToken)) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  try {
    const payload = jwt.verify(refreshToken, REFRESH_SECRET);

    const user = users.find(u => u.id === payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Ротация: удаляем старый refresh-токен, создаём новую пару
    refreshTokens.delete(refreshToken);

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    refreshTokens.add(newRefreshToken);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });

  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Получить текущего авторизованного пользователя
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Данные текущего пользователя
 *       401:
 *         description: Токен отсутствует или недействителен
 *       404:
 *         description: Пользователь не найден
 */
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = users.find(u => u.id === req.user.sub);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
  });
});

/**
 * @swagger
 * /api/auth/users:
 *   get:
 *     summary: Список всех пользователей с хешами (только для отладки)
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Список пользователей
 */
app.get('/api/auth/users', (req, res) => {
  res.json(users);
});

// ===== PRODUCTS ROUTES =====

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Получить список всех товаров
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Список товаров
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 */
app.get('/api/products', (req, res) => {
  res.json(products);
});

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Получить товар по ID (требует авторизации)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Данные товара
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       401:
 *         description: Не авторизован
 *       404:
 *         description: Товар не найден
 */
app.get('/api/products/:id', authMiddleware, (req, res) => {
  const product = findProductOr404(req.params.id, res);
  if (!product) return;
  res.json(product);
});

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Создать новый товар
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Product'
 *     responses:
 *       201:
 *         description: Товар создан
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         description: Отсутствуют обязательные поля
 */
app.post('/api/products', (req, res) => {
  const { title, category, description, price } = req.body;

  if (!title || !category || !description || price === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const newProduct = {
    id: nanoid(6),
    title: title.trim(),
    category: category.trim(),
    description: description.trim(),
    price: Number(price),
  };

  products.push(newProduct);
  res.status(201).json(newProduct);
});

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Обновить товар (требует авторизации)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Product'
 *     responses:
 *       200:
 *         description: Товар обновлён
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       401:
 *         description: Не авторизован
 *       404:
 *         description: Товар не найден
 */
app.put('/api/products/:id', authMiddleware, (req, res) => {
  const product = findProductOr404(req.params.id, res);
  if (!product) return;

  const { title, category, description, price } = req.body;

  if (!title || !category || !description || price === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  product.title = title.trim();
  product.category = category.trim();
  product.description = description.trim();
  product.price = Number(price);

  res.json(product);
});

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Удалить товар (требует авторизации)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Товар удалён
 *       401:
 *         description: Не авторизован
 *       404:
 *         description: Товар не найден
 */
app.delete('/api/products/:id', authMiddleware, (req, res) => {
  const exists = products.some(p => p.id === req.params.id);
  if (!exists) return res.status(404).json({ error: 'Product not found' });
  products = products.filter(p => p.id !== req.params.id);
  res.status(204).send();
});

// ===== ОБРАБОТЧИКИ ОШИБОК =====
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Сервер запущен на http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/api-docs`);
});