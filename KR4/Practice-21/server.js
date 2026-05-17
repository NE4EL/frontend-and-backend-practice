const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { createClient } = require('redis');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3002;
const ACCESS_SECRET  = 'access_secret';
const REFRESH_SECRET = 'refresh_secret';
const ACCESS_EXPIRES_IN  = '15m';
const REFRESH_EXPIRES_IN = '7d';
const USERS_CACHE_TTL    = 60;   // 1 минута
const PRODUCTS_CACHE_TTL = 600;  // 10 минут

let users    = [];
let products = [
    { id: '1', title: 'iPhone 15 Pro',    category: 'Смартфоны', description: 'Apple iPhone 15 Pro 256GB', price: 89990 },
    { id: '2', title: 'MacBook Air M3',   category: 'Ноутбуки',  description: 'Apple MacBook Air 13" M3',  price: 119990 },
    { id: '3', title: 'Sony WH-1000XM5', category: 'Наушники',  description: 'Беспроводные наушники ANC',  price: 29990 },
];
let nextUserId    = 1;
let nextProductId = 4;
const refreshTokens = new Set();

const ROLES = { USER: 'user', SELLER: 'seller', ADMIN: 'admin' };

const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://127.0.0.1:6379' });
redisClient.on('error', err => console.error('Redis error:', err));

// ===== HELPERS =====
function generateAccessToken(user) {
    return jwt.sign({ sub: user.id, email: user.email, role: user.role }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
}
function generateRefreshToken(user) {
    return jwt.sign({ sub: user.id, email: user.email, role: user.role }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
}

// ===== MIDDLEWARE =====
function authMiddleware(req, res, next) {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Missing Authorization header' });
    try {
        const payload = jwt.verify(token, ACCESS_SECRET);
        const user = users.find(u => u.id === payload.sub);
        if (!user || user.blocked) return res.status(401).json({ error: 'User not found or blocked' });
        req.user = payload;
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

function cacheMiddleware(keyBuilder, ttl) {
    return async (req, res, next) => {
        try {
            const key = keyBuilder(req);
            const cached = await redisClient.get(key);
            if (cached) return res.json({ source: 'cache', data: JSON.parse(cached) });
            req.cacheKey = key;
            req.cacheTTL = ttl;
            next();
        } catch {
            next();
        }
    };
}

async function saveToCache(key, data, ttl) {
    try { await redisClient.set(key, JSON.stringify(data), { EX: ttl }); } catch {}
}

async function invalidateUsersCache(userId = null) {
    try {
        await redisClient.del('users:all');
        if (userId) await redisClient.del(`users:${userId}`);
    } catch {}
}

async function invalidateProductsCache(productId = null) {
    try {
        await redisClient.del('products:all');
        if (productId) await redisClient.del(`products:${productId}`);
    } catch {}
}

// ===== AUTH =====
app.post('/api/auth/register', async (req, res) => {
    const { email, first_name, last_name, password, role } = req.body;
    if (!email || !first_name || !last_name || !password) return res.status(400).json({ error: 'Все поля обязательны' });
    if (users.some(u => u.email === email)) return res.status(409).json({ error: 'Email уже используется' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = { id: String(nextUserId++), email, first_name, last_name, passwordHash, role: Object.values(ROLES).includes(role) ? role : ROLES.USER, blocked: false };
    users.push(user);
    res.status(201).json({ id: user.id, email, first_name, last_name, role: user.role });
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email и password обязательны' });
    const user = users.find(u => u.email === email);
    if (!user || user.blocked) return res.status(401).json({ error: 'Неверные данные или аккаунт заблокирован' });
    if (!await bcrypt.compare(password, user.passwordHash)) return res.status(401).json({ error: 'Неверные данные' });
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
        const user = users.find(u => u.id === payload.sub);
        if (!user || user.blocked) return res.status(401).json({ error: 'User not found or blocked' });
        refreshTokens.delete(refreshToken);
        const newAccessToken  = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);
        refreshTokens.add(newRefreshToken);
        res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
    } catch {
        res.status(401).json({ error: 'Invalid refresh token' });
    }
});

// ===== USERS (admin only, кэш 1 мин) =====
app.get('/api/users',
    authMiddleware, roleMiddleware([ROLES.ADMIN]),
    cacheMiddleware(() => 'users:all', USERS_CACHE_TTL),
    async (req, res) => {
        const data = users.map(u => ({ id: u.id, email: u.email, first_name: u.first_name, last_name: u.last_name, role: u.role, blocked: u.blocked }));
        await saveToCache(req.cacheKey, data, req.cacheTTL);
        res.json({ source: 'server', data });
    }
);

app.get('/api/users/:id',
    authMiddleware, roleMiddleware([ROLES.ADMIN]),
    cacheMiddleware(req => `users:${req.params.id}`, USERS_CACHE_TTL),
    async (req, res) => {
        const user = users.find(u => u.id === req.params.id);
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
        const data = { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, role: user.role, blocked: user.blocked };
        await saveToCache(req.cacheKey, data, req.cacheTTL);
        res.json({ source: 'server', data });
    }
);

app.put('/api/users/:id', authMiddleware, roleMiddleware([ROLES.ADMIN]), async (req, res) => {
    const user = users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    const { first_name, last_name, role, blocked } = req.body;
    if (first_name !== undefined) user.first_name = first_name;
    if (last_name  !== undefined) user.last_name  = last_name;
    if (role       !== undefined && Object.values(ROLES).includes(role)) user.role = role;
    if (blocked    !== undefined) user.blocked = blocked;
    await invalidateUsersCache(user.id);
    res.json({ id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, role: user.role, blocked: user.blocked });
});

app.delete('/api/users/:id', authMiddleware, roleMiddleware([ROLES.ADMIN]), async (req, res) => {
    const user = users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    user.blocked = true;
    await invalidateUsersCache(user.id);
    res.json({ message: 'Пользователь заблокирован', id: user.id });
});

// ===== PRODUCTS (кэш 10 мин) =====
app.get('/api/products',
    authMiddleware,
    cacheMiddleware(() => 'products:all', PRODUCTS_CACHE_TTL),
    async (req, res) => {
        await saveToCache(req.cacheKey, products, req.cacheTTL);
        res.json({ source: 'server', data: products });
    }
);

app.get('/api/products/:id',
    authMiddleware,
    cacheMiddleware(req => `products:${req.params.id}`, PRODUCTS_CACHE_TTL),
    async (req, res) => {
        const product = products.find(p => p.id === req.params.id);
        if (!product) return res.status(404).json({ error: 'Товар не найден' });
        await saveToCache(req.cacheKey, product, req.cacheTTL);
        res.json({ source: 'server', data: product });
    }
);

app.post('/api/products', authMiddleware, roleMiddleware([ROLES.SELLER, ROLES.ADMIN]), async (req, res) => {
    const { title, category, description, price } = req.body;
    if (!title || !category || !description || price === undefined) return res.status(400).json({ error: 'Все поля обязательны' });
    const product = { id: String(nextProductId++), title, category, description, price: Number(price) };
    products.push(product);
    await invalidateProductsCache();
    res.status(201).json(product);
});

app.put('/api/products/:id', authMiddleware, roleMiddleware([ROLES.SELLER, ROLES.ADMIN]), async (req, res) => {
    const product = products.find(p => p.id === req.params.id);
    if (!product) return res.status(404).json({ error: 'Товар не найден' });
    const { title, category, description, price } = req.body;
    if (title       !== undefined) product.title       = title;
    if (category    !== undefined) product.category    = category;
    if (description !== undefined) product.description = description;
    if (price       !== undefined) product.price       = Number(price);
    await invalidateProductsCache(product.id);
    res.json(product);
});

app.delete('/api/products/:id', authMiddleware, roleMiddleware([ROLES.ADMIN]), async (req, res) => {
    const idx = products.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Товар не найден' });
    products.splice(idx, 1);
    await invalidateProductsCache(req.params.id);
    res.status(204).send();
});

async function start() {
    await redisClient.connect();
    console.log('Redis подключён');
    app.listen(PORT, () => console.log(`Practice 21 (Redis cache) запущен на http://localhost:${PORT}`));
}

start().catch(err => { console.error('Ошибка запуска:', err.message); process.exit(1); });
