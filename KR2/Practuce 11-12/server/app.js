const express = require('express');
const { nanoid } = require('nanoid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
const port = 3000;

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
  });
  next();
});

// ===== ДАННЫЕ =====
let users = [];
let products = [
  { id: nanoid(6), title: 'iPhone 15 Pro', category: 'Смартфоны', description: 'Apple iPhone 15 Pro 256GB', price: 89990 },
  { id: nanoid(6), title: 'MacBook Air M3', category: 'Ноутбуки', description: 'Apple MacBook Air 13" M3', price: 119990 },
  { id: nanoid(6), title: 'Sony WH-1000XM5', category: 'Наушники', description: 'Беспроводные наушники с ANC', price: 29990 },
];

const refreshTokens = new Set();

// ===== РОЛИ =====
const ROLES = {
  USER: 'user',
  SELLER: 'seller',
  ADMIN: 'admin',
};

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
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

function findUserOr404(id, res) {
  const user = users.find(u => u.id === id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return null;
  }
  return user;
}

// ===== ГЕНЕРАЦИЯ ТОКЕНОВ =====
function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, role: user.role },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES_IN }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES_IN }
  );
}

// ===== MIDDLEWARE =====
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

function roleMiddleware(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// ===== SWAGGER =====
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API интернет-магазина с RBAC',
      version: '4.0.0',
      description: 'REST API с системой ролей: user, seller, admin',
    },
    servers: [{ url: `http://localhost:${port}`, description: 'Локальный сервер' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
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
 *         role:
 *           type: string
 *           enum: [user, seller, admin]
 *           example: user
 *     Product:
 *       type: object
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
 *     TokenPair:
 *       type: object
 *       properties:
 *         accessToken:
 *           type: string
 *         refreshToken:
 *           type: string
 */

// ===== AUTH ROUTES =====

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Регистрация (Гость)
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
 *               role:
 *                 type: string
 *                 enum: [user, seller, admin]
 *                 example: user
 *     responses:
 *       201:
 *         description: Пользователь создан
 *       400:
 *         description: Ошибка валидации
 */
app.post('/api/auth/register', async (req, res) => {
  const { email, first_name, last_name, password, role } = req.body;

  if (!email || !first_name || !last_name || !password) {
    return res.status(400).json({ error: 'email, first_name, last_name and password are required' });
  }

  if (findUserByEmail(email.trim().toLowerCase())) {
    return res.status(400).json({ error: 'User with this email already exists' });
  }

  const allowedRoles = Object.values(ROLES);
  const userRole = role && allowedRoles.includes(role) ? role : ROLES.USER;

  const newUser = {
    id: nanoid(6),
    email: email.trim().toLowerCase(),
    first_name: first_name.trim(),
    last_name: last_name.trim(),
    hashedPassword: await bcrypt.hash(password, 10),
    role: userRole,
    blocked: false,
  };

  users.push(newUser);

  res.status(201).json({
    id: newUser.id,
    email: newUser.email,
    first_name: newUser.first_name,
    last_name: newUser.last_name,
    role: newUser.role,
  });
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Вход в систему (Гость)
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
 *         description: Токены выданы
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenPair'
 *       401:
 *         description: Неверные данные или аккаунт заблокирован
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

  if (user.blocked) {
    return res.status(403).json({ error: 'Account is blocked' });
  }

  const isValid = await bcrypt.compare(password, user.hashedPassword);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  refreshTokens.add(refreshToken);

  res.json({ accessToken, refreshToken });
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Обновление пары токенов (Гость)
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
 *       401:
 *         description: Невалидный refresh-токен
 */
app.post('/api/auth/refresh', (req, res) => {
  const header = req.headers.authorization || '';
  const [scheme, refreshToken] = header.split(' ');

  if (scheme !== 'Bearer' || !refreshToken) {
    return res.status(400).json({ error: 'refreshToken is required in Authorization header' });
  }

  if (!refreshTokens.has(refreshToken)) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  try {
    const payload = jwt.verify(refreshToken, REFRESH_SECRET);
    const user = users.find(u => u.id === payload.sub);
    if (!user) return res.status(401).json({ error: 'User not found' });

    refreshTokens.delete(refreshToken);
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    refreshTokens.add(newRefreshToken);

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Текущий пользователь (Пользователь+)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Данные текущего пользователя
 */
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = users.find(u => u.id === req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, role: user.role });
});

// ===== USERS ROUTES (только admin) =====

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Список всех пользователей (Администратор)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Список пользователей
 *       403:
 *         description: Forbidden
 */
app.get('/api/users',
  authMiddleware, roleMiddleware([ROLES.ADMIN]),
  (req, res) => {
    res.json(users.map(u => ({
      id: u.id, email: u.email,
      first_name: u.first_name, last_name: u.last_name,
      role: u.role, blocked: u.blocked,
    })));
  }
);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Получить пользователя по ID (Администратор)
 *     tags: [Users]
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
 *         description: Данные пользователя
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Пользователь не найден
 */
app.get('/api/users/:id',
  authMiddleware, roleMiddleware([ROLES.ADMIN]),
  (req, res) => {
    const user = findUserOr404(req.params.id, res);
    if (!user) return;
    res.json({ id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, role: user.role, blocked: user.blocked });
  }
);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Обновить информацию пользователя (Администратор)
 *     tags: [Users]
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
 *             type: object
 *             properties:
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [user, seller, admin]
 *     responses:
 *       200:
 *         description: Пользователь обновлён
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Пользователь не найден
 */
app.put('/api/users/:id',
  authMiddleware, roleMiddleware([ROLES.ADMIN]),
  (req, res) => {
    const user = findUserOr404(req.params.id, res);
    if (!user) return;

    const { first_name, last_name, role } = req.body;
    if (first_name !== undefined) user.first_name = first_name.trim();
    if (last_name !== undefined) user.last_name = last_name.trim();
    if (role !== undefined && Object.values(ROLES).includes(role)) user.role = role;

    res.json({ id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, role: user.role, blocked: user.blocked });
  }
);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Заблокировать пользователя (Администратор)
 *     tags: [Users]
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
 *         description: Пользователь заблокирован
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Пользователь не найден
 */
app.delete('/api/users/:id',
  authMiddleware, roleMiddleware([ROLES.ADMIN]),
  (req, res) => {
    const user = findUserOr404(req.params.id, res);
    if (!user) return;
    user.blocked = true;
    res.json({ message: `User ${user.email} has been blocked` });
  }
);

// ===== PRODUCTS ROUTES =====

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Список товаров (Пользователь+)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Список товаров
 */
app.get('/api/products',
  authMiddleware, roleMiddleware([ROLES.USER, ROLES.SELLER, ROLES.ADMIN]),
  (req, res) => {
    res.json(products);
  }
);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Товар по ID (Пользователь+)
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
 *       404:
 *         description: Товар не найден
 */
app.get('/api/products/:id',
  authMiddleware, roleMiddleware([ROLES.USER, ROLES.SELLER, ROLES.ADMIN]),
  (req, res) => {
    const product = findProductOr404(req.params.id, res);
    if (!product) return;
    res.json(product);
  }
);

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Создать товар (Продавец, Администратор)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Product'
 *     responses:
 *       201:
 *         description: Товар создан
 *       403:
 *         description: Forbidden
 */
app.post('/api/products',
  authMiddleware, roleMiddleware([ROLES.SELLER, ROLES.ADMIN]),
  (req, res) => {
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
  }
);

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Обновить товар (Продавец, Администратор)
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
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Товар не найден
 */
app.put('/api/products/:id',
  authMiddleware, roleMiddleware([ROLES.SELLER, ROLES.ADMIN]),
  (req, res) => {
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
  }
);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Удалить товар (Администратор)
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
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Товар не найден
 */
app.delete('/api/products/:id',
  authMiddleware, roleMiddleware([ROLES.ADMIN]),
  (req, res) => {
    const exists = products.some(p => p.id === req.params.id);
    if (!exists) return res.status(404).json({ error: 'Product not found' });
    products = products.filter(p => p.id !== req.params.id);
    res.status(204).send();
  }
);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Сервер запущен на http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/api-docs`);
});