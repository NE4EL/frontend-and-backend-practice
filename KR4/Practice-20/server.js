const express = require('express');
const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi    = require('swagger-ui-express');

const app = express();
app.use(express.json());

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/kr4_techstore';
const PORT      = process.env.PORT      || 3001;

const ACCESS_SECRET  = 'access_secret';
const REFRESH_SECRET = 'refresh_secret';
const ACCESS_EXPIRES_IN  = '15m';
const REFRESH_EXPIRES_IN = '7d';
const ROLES = { USER: 'user', SELLER: 'seller', ADMIN: 'admin' };

const refreshTokens = new Set();

const swaggerSpec = swaggerJsdoc({
    definition: {
        openapi: '3.0.0',
        info: { title: 'TechStore API — Practice 20 (MongoDB)', version: '1.0.0', description: 'TechStore с хранением данных в MongoDB. Авторизация через JWT.' },
        servers: [{ url: 'http://localhost:3001' }],
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
                    title:       { type: 'string', example: 'iPhone 15 Pro' },
                    category:    { type: 'string', example: 'Смартфоны' },
                    description: { type: 'string', example: 'Apple iPhone 15 Pro 256GB' },
                    price:       { type: 'number', example: 89990 },
                }},
            },
        },
    },
    apis: ['./server.js'],
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ===== СХЕМЫ =====
const userSchema = new mongoose.Schema({
    email:           { type: String, required: true, unique: true, lowercase: true, trim: true },
    first_name:      { type: String, required: true, trim: true },
    last_name:       { type: String, required: true, trim: true },
    hashed_password: { type: String, required: true },
    role:            { type: String, enum: ['user', 'seller', 'admin'], default: 'user' },
    blocked:         { type: Boolean, default: false },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const productSchema = new mongoose.Schema({
    title:       { type: String, required: true, trim: true },
    category:    { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    price:       { type: Number, required: true, min: 0 },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const User    = mongoose.model('User',    userSchema);
const Product = mongoose.model('Product', productSchema);

// ===== HELPERS =====
function generateAccessToken(user) {
    return jwt.sign({ sub: user._id, email: user.email, role: user.role }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
}
function generateRefreshToken(user) {
    return jwt.sign({ sub: user._id, email: user.email, role: user.role }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
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
 * /api/auth/me:
 *   get:
 *     summary: Текущий пользователь
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Данные пользователя }
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
 *         schema: { type: string }
 *     responses:
 *       200: { description: Данные товара }
 *   put:
 *     summary: Изменить товар (seller, admin)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
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
 *         schema: { type: string }
 *     responses:
 *       204: { description: Удалён }
 * /api/users:
 *   get:
 *     summary: Список пользователей (admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Список пользователей }
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
 *         schema: { type: string }
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
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role: { type: string, enum: [user, seller, admin] }
 *               blocked: { type: boolean }
 *     responses:
 *       200: { description: Обновлён }
 *   delete:
 *     summary: Заблокировать (admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Заблокирован }
 */
app.post('/api/auth/register', async (req, res) => {
    const { email, first_name, last_name, password, role } = req.body;
    if (!email || !first_name || !last_name || !password) return res.status(400).json({ error: 'Все поля обязательны' });
    try {
        const hashed_password = await bcrypt.hash(password, 10);
        const userRole = Object.values(ROLES).includes(role) ? role : ROLES.USER;
        const user = await User.create({ email, first_name, last_name, hashed_password, role: userRole });
        res.status(201).json({ id: user._id, email: user.email, first_name: user.first_name, last_name: user.last_name, role: user.role });
    } catch (err) {
        res.status(400).json({ error: err.code === 11000 ? 'Email уже используется' : err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email и password обязательны' });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || user.blocked) return res.status(401).json({ error: 'Неверные данные или аккаунт заблокирован' });
    if (!await bcrypt.compare(password, user.hashed_password)) return res.status(401).json({ error: 'Неверные данные' });
    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    refreshTokens.add(refreshToken);
    res.json({ accessToken, refreshToken });
});

app.post('/api/auth/refresh', (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken || !refreshTokens.has(refreshToken)) return res.status(401).json({ error: 'Invalid refresh token' });
    try {
        const payload = jwt.verify(refreshToken, REFRESH_SECRET);
        User.findById(payload.sub).then(user => {
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

app.get('/api/auth/me', authMiddleware, async (req, res) => {
    const user = await User.findById(req.user.sub, '-hashed_password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
});

// ===== USERS (admin) =====
app.get('/api/users', authMiddleware, roleMiddleware([ROLES.ADMIN]), async (req, res) => {
    const users = await User.find({}, '-hashed_password').sort({ created_at: -1 });
    res.json(users);
});

app.get('/api/users/:id', authMiddleware, roleMiddleware([ROLES.ADMIN]), async (req, res) => {
    try {
        const user = await User.findById(req.params.id, '-hashed_password');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch {
        res.status(404).json({ error: 'User not found' });
    }
});

app.put('/api/users/:id', authMiddleware, roleMiddleware([ROLES.ADMIN]), async (req, res) => {
    try {
        const { first_name, last_name, role, blocked } = req.body;
        const update = {};
        if (first_name !== undefined) update.first_name = first_name;
        if (last_name  !== undefined) update.last_name  = last_name;
        if (role       !== undefined && Object.values(ROLES).includes(role)) update.role = role;
        if (blocked    !== undefined) update.blocked = blocked;
        const user = await User.findByIdAndUpdate(req.params.id, update, { new: true, select: '-hashed_password' });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch {
        res.status(404).json({ error: 'User not found' });
    }
});

app.delete('/api/users/:id', authMiddleware, roleMiddleware([ROLES.ADMIN]), async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, { blocked: true }, { new: true });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ message: `Пользователь ${user.email} заблокирован` });
    } catch {
        res.status(404).json({ error: 'User not found' });
    }
});

// ===== PRODUCTS =====
app.get('/api/products', authMiddleware, async (req, res) => {
    const products = await Product.find().sort({ created_at: -1 });
    res.json(products);
});

app.get('/api/products/:id', authMiddleware, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json(product);
    } catch {
        res.status(404).json({ error: 'Product not found' });
    }
});

app.post('/api/products', authMiddleware, roleMiddleware([ROLES.SELLER, ROLES.ADMIN]), async (req, res) => {
    const { title, category, description, price } = req.body;
    if (!title || !category || !description || price === undefined) return res.status(400).json({ error: 'Все поля обязательны' });
    const product = await Product.create({ title, category, description, price: Number(price) });
    res.status(201).json(product);
});

app.put('/api/products/:id', authMiddleware, roleMiddleware([ROLES.SELLER, ROLES.ADMIN]), async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json(product);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/products/:id', authMiddleware, roleMiddleware([ROLES.ADMIN]), async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.status(204).send();
    } catch {
        res.status(404).json({ error: 'Product not found' });
    }
});

async function seedProducts() {
    const count = await Product.countDocuments();
    if (count === 0) {
        await Product.insertMany([
            { title: 'iPhone 15 Pro',    category: 'Смартфоны',  description: 'Apple iPhone 15 Pro 256GB',          price: 89990 },
            { title: 'MacBook Air M3',   category: 'Ноутбуки',   description: 'Apple MacBook Air 13" M3 256GB',    price: 119990 },
            { title: 'Sony WH-1000XM5', category: 'Наушники',   description: 'Беспроводные наушники с ANC',        price: 29990 },
            { title: 'iPad Pro 13"',     category: 'Планшеты',   description: 'Apple iPad Pro 13" M4 256GB Wi-Fi', price: 109990 },
            { title: 'Samsung 4K TV',    category: 'Телевизоры', description: 'Samsung QLED 55" 4K Smart TV',       price: 79990 },
        ]);
        console.log('Стартовые товары добавлены');
    }
}

mongoose.connect(MONGO_URL)
    .then(async () => {
        console.log('MongoDB подключена');
        await seedProducts();
        app.listen(PORT, () => console.log(`TechStore API (MongoDB) запущен на http://localhost:${PORT}`));
    })
    .catch(err => { console.error('MongoDB ошибка:', err.message); process.exit(1); });
