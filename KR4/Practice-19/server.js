const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const { Client } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
app.use(express.json());

const DB_NAME = 'kr4_p19';
const DB_USER = process.env.DB_USER || require('os').userInfo().username;
const DB_PASS = process.env.DB_PASS || null;
const DB_HOST = process.env.DB_HOST || 'localhost';
const PORT    = process.env.PORT    || 3000;

const ACCESS_SECRET  = 'access_secret';
const REFRESH_SECRET = 'refresh_secret';
const ACCESS_EXPIRES_IN  = '15m';
const REFRESH_EXPIRES_IN = '7d';
const ROLES = { USER: 'user', SELLER: 'seller', ADMIN: 'admin' };

const refreshTokens = new Set();

const swaggerSpec = swaggerJsdoc({
    definition: {
        openapi: '3.0.0',
        info: { title: 'TechStore API — Practice 19 (PostgreSQL)', version: '1.0.0', description: 'TechStore с хранением данных в PostgreSQL. Авторизация через JWT.' },
        servers: [{ url: `http://localhost:3000` }],
        components: {
            securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
            schemas: {
                RegisterBody: { type: 'object', required: ['email','first_name','last_name','password'], properties: {
                    email:      { type: 'string', example: 'admin@test.com' },
                    first_name: { type: 'string', example: 'Иван' },
                    last_name:  { type: 'string', example: 'Петров' },
                    password:   { type: 'string', example: 'pass123' },
                    role:       { type: 'string', enum: ['user','seller','admin'], example: 'admin' },
                }},
                LoginBody: { type: 'object', required: ['email','password'], properties: {
                    email:    { type: 'string', example: 'admin@test.com' },
                    password: { type: 'string', example: 'pass123' },
                }},
                ProductBody: { type: 'object', required: ['title','category','description','price'], properties: {
                    title:       { type: 'string',  example: 'iPhone 15 Pro' },
                    category:    { type: 'string',  example: 'Смартфоны' },
                    description: { type: 'string',  example: 'Apple iPhone 15 Pro 256GB' },
                    price:       { type: 'number',  example: 89990 },
                }},
            },
        },
    },
    apis: ['./server.js'],
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

async function ensureDatabase() {
    const client = new Client({ user: DB_USER, password: DB_PASS, host: DB_HOST, database: 'postgres', port: 5432 });
    await client.connect();
    const res = await client.query(`SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'`);
    if (res.rowCount === 0) {
        await client.query(`CREATE DATABASE ${DB_NAME}`);
        console.log(`База данных ${DB_NAME} создана`);
    }
    await client.end();
}

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
    host: DB_HOST, dialect: 'postgres', logging: false,
});

const User = sequelize.define('User', {
    email:          { type: DataTypes.STRING(100), unique: true, allowNull: false },
    first_name:     { type: DataTypes.STRING(100), allowNull: false },
    last_name:      { type: DataTypes.STRING(100), allowNull: false },
    hashed_password:{ type: DataTypes.TEXT, allowNull: false },
    role:           { type: DataTypes.ENUM('user', 'seller', 'admin'), defaultValue: 'user' },
    blocked:        { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'users', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

const Product = sequelize.define('Product', {
    title:       { type: DataTypes.STRING(200), allowNull: false },
    category:    { type: DataTypes.STRING(100), allowNull: false },
    description: { type: DataTypes.TEXT,        allowNull: false },
    price:       { type: DataTypes.DECIMAL(10, 2), allowNull: false },
}, { tableName: 'products', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

// ===== HELPERS =====
function generateAccessToken(user) {
    return jwt.sign({ sub: user.id, email: user.email, role: user.role }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
}
function generateRefreshToken(user) {
    return jwt.sign({ sub: user.id, email: user.email, role: user.role }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
}

function authMiddleware(req, res, next) {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Missing Authorization header' });
    try {
        req.user = jwt.verify(token, ACCESS_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

function roleMiddleware(allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
        next();
    };
}

// ===== AUTH =====
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Регистрация
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterBody'
 *     responses:
 *       201: { description: Пользователь создан }
 *       400: { description: Ошибка валидации }
 */
app.post('/api/auth/register', async (req, res) => {
    const { email, first_name, last_name, password, role } = req.body;
    if (!email || !first_name || !last_name || !password) return res.status(400).json({ error: 'Все поля обязательны' });
    try {
        const hashed_password = await bcrypt.hash(password, 10);
        const userRole = Object.values(ROLES).includes(role) ? role : ROLES.USER;
        const user = await User.create({ email: email.toLowerCase(), first_name, last_name, hashed_password, role: userRole });
        res.status(201).json({ id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, role: user.role });
    } catch (err) {
        res.status(400).json({ error: err.message.includes('unique') ? 'Email уже используется' : err.message });
    }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Вход (получить токен)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginBody'
 *     responses:
 *       200: { description: "{ accessToken, refreshToken }" }
 *       401: { description: Неверные данные }
 */
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email и password обязательны' });
    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user || user.blocked) return res.status(401).json({ error: 'Неверные данные или аккаунт заблокирован' });
    if (!await bcrypt.compare(password, user.hashed_password)) return res.status(401).json({ error: 'Неверные данные' });
    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    refreshTokens.add(refreshToken);
    res.json({ accessToken, refreshToken });
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Обновить токен
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: Новая пара токенов }
 */
app.post('/api/auth/refresh', (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken || !refreshTokens.has(refreshToken)) return res.status(401).json({ error: 'Invalid refresh token' });
    try {
        const payload = jwt.verify(refreshToken, REFRESH_SECRET);
        User.findByPk(payload.sub).then(user => {
            if (!user || user.blocked) return res.status(401).json({ error: 'User not found or blocked' });
            refreshTokens.delete(refreshToken);
            const newAccess  = generateAccessToken(user);
            const newRefresh = generateRefreshToken(user);
            refreshTokens.add(newRefresh);
            res.json({ accessToken: newAccess, refreshToken: newRefresh });
        });
    } catch {
        res.status(401).json({ error: 'Invalid refresh token' });
    }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Текущий пользователь
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Данные текущего пользователя }
 */
app.get('/api/auth/me', authMiddleware, async (req, res) => {
    const user = await User.findByPk(req.user.sub, { attributes: ['id', 'email', 'first_name', 'last_name', 'role'] });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
});

// ===== USERS (admin) =====
/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Список пользователей (только admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Список пользователей }
 *       403: { description: Нет прав }
 */
app.get('/api/users', authMiddleware, roleMiddleware([ROLES.ADMIN]), async (req, res) => {
    const users = await User.findAll({ attributes: { exclude: ['hashed_password'] }, order: [['created_at', 'DESC']] });
    res.json(users);
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Пользователь по ID (admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Данные пользователя }
 *   put:
 *     summary: Изменить пользователя (admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               first_name: { type: string }
 *               last_name:  { type: string }
 *               role:       { type: string, enum: [user, seller, admin] }
 *               blocked:    { type: boolean }
 *     responses:
 *       200: { description: Пользователь обновлён }
 *   delete:
 *     summary: Заблокировать пользователя (admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Пользователь заблокирован }
 */
app.get('/api/users/:id', authMiddleware, roleMiddleware([ROLES.ADMIN]), async (req, res) => {
    const user = await User.findByPk(req.params.id, { attributes: { exclude: ['hashed_password'] } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
});

app.put('/api/users/:id', authMiddleware, roleMiddleware([ROLES.ADMIN]), async (req, res) => {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { first_name, last_name, role, blocked } = req.body;
    if (first_name !== undefined) user.first_name = first_name;
    if (last_name  !== undefined) user.last_name  = last_name;
    if (role       !== undefined && Object.values(ROLES).includes(role)) user.role = role;
    if (blocked    !== undefined) user.blocked = blocked;
    await user.save();
    res.json({ id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, role: user.role, blocked: user.blocked });
});

app.delete('/api/users/:id', authMiddleware, roleMiddleware([ROLES.ADMIN]), async (req, res) => {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.blocked = true;
    await user.save();
    res.json({ message: `Пользователь ${user.email} заблокирован` });
});

// ===== PRODUCTS =====
/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Список товаров
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Список товаров }
 *   post:
 *     summary: Добавить товар (seller, admin)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductBody'
 *     responses:
 *       201: { description: Товар создан }
 *       403: { description: Нет прав }
 */
app.get('/api/products', authMiddleware, async (req, res) => {
    const products = await Product.findAll({ order: [['created_at', 'DESC']] });
    res.json(products);
});

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Товар по ID
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Данные товара }
 *       404: { description: Не найден }
 *   put:
 *     summary: Изменить товар (seller, admin)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductBody'
 *     responses:
 *       200: { description: Товар обновлён }
 *   delete:
 *     summary: Удалить товар (admin)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Удалён }
 */
app.get('/api/products/:id', authMiddleware, async (req, res) => {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
});

app.post('/api/products', authMiddleware, roleMiddleware([ROLES.SELLER, ROLES.ADMIN]), async (req, res) => {
    const { title, category, description, price } = req.body;
    if (!title || !category || !description || price === undefined) return res.status(400).json({ error: 'Все поля обязательны' });
    const product = await Product.create({ title, category, description, price: Number(price) });
    res.status(201).json(product);
});

app.put('/api/products/:id', authMiddleware, roleMiddleware([ROLES.SELLER, ROLES.ADMIN]), async (req, res) => {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const { title, category, description, price } = req.body;
    if (title       !== undefined) product.title       = title;
    if (category    !== undefined) product.category    = category;
    if (description !== undefined) product.description = description;
    if (price       !== undefined) product.price       = Number(price);
    await product.save();
    res.json(product);
});

app.delete('/api/products/:id', authMiddleware, roleMiddleware([ROLES.ADMIN]), async (req, res) => {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    await product.destroy();
    res.status(204).send();
});

async function start() {
    await ensureDatabase();
    await sequelize.sync();

    // Добавить стартовые товары если таблица пустая
    const count = await Product.count();
    if (count === 0) {
        await Product.bulkCreate([
            { title: 'iPhone 15 Pro',    category: 'Смартфоны', description: 'Apple iPhone 15 Pro 256GB',          price: 89990 },
            { title: 'MacBook Air M3',   category: 'Ноутбуки',  description: 'Apple MacBook Air 13" M3 256GB',    price: 119990 },
            { title: 'Sony WH-1000XM5', category: 'Наушники',  description: 'Беспроводные наушники с ANC',        price: 29990 },
            { title: 'iPad Pro 13"',     category: 'Планшеты',  description: 'Apple iPad Pro 13" M4 256GB Wi-Fi', price: 109990 },
            { title: 'Samsung 4K TV',    category: 'Телевизоры',description: 'Samsung QLED 55" 4K Smart TV',       price: 79990 },
        ]);
        console.log('Стартовые товары добавлены');
    }

    app.listen(PORT, () => {
        console.log(`TechStore API (PostgreSQL) запущен на http://localhost:${PORT}`);
    });
}

start().catch(err => { console.error('Ошибка запуска:', err.message); process.exit(1); });
