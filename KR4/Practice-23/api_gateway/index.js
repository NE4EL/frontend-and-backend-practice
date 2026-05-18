const express = require('express');
const fetch   = require('node-fetch');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi    = require('swagger-ui-express');

const app = express();
app.use(express.json());

const PORT                = process.env.PORT                 || 8000;
const USERS_SERVICE_URL   = process.env.USERS_SERVICE_URL    || 'http://service_users:8000';
const PRODUCTS_SERVICE_URL = process.env.PRODUCTS_SERVICE_URL || 'http://service_products:8000';

// ===== CIRCUIT BREAKER =====
class CircuitBreaker {
    constructor(name, { failureThreshold = 3, recoveryTimeout = 10000 } = {}) {
        this.name             = name;
        this.failureThreshold = failureThreshold;
        this.recoveryTimeout  = recoveryTimeout;
        this.state            = 'CLOSED';
        this.failures         = 0;
        this.lastFailureTime  = null;
    }

    async call(fn) {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
                this.state = 'HALF_OPEN';
                console.log(`[CB:${this.name}] → HALF_OPEN`);
            } else {
                throw new Error(`${this.name} service temporarily unavailable`);
            }
        }
        try {
            const result = await fn();
            if (this.state === 'HALF_OPEN') { this.reset(); console.log(`[CB:${this.name}] → CLOSED`); }
            return result;
        } catch (err) {
            this.failures++;
            this.lastFailureTime = Date.now();
            if (this.failures >= this.failureThreshold) {
                this.state = 'OPEN';
                console.log(`[CB:${this.name}] → OPEN (${this.failures} failures)`);
            }
            throw err;
        }
    }

    reset() { this.failures = 0; this.state = 'CLOSED'; }
    getStatus() { return { name: this.name, state: this.state, failures: this.failures }; }
}

const usersBreaker    = new CircuitBreaker('users');
const productsBreaker = new CircuitBreaker('products');

// ===== AUTH MIDDLEWARE (верифицирует через service_users) =====
async function authMiddleware(req, res, next) {
    try {
        const response = await usersBreaker.call(() =>
            fetch(`${USERS_SERVICE_URL}/auth/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': req.headers.authorization || '' },
            })
        );
        const data = await response.json();
        if (!response.ok || !data.valid) return res.status(401).json({ error: data.error || 'Unauthorized' });
        req.user = data.user;
        next();
    } catch (err) {
        res.status(503).json({ error: err.message });
    }
}

function roleMiddleware(allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
        next();
    };
}

// ===== PROXY HELPER =====
async function proxy(breaker, targetUrl, req, res) {
    try {
        const response = await breaker.call(async () => {
            return fetch(targetUrl, {
                method:  req.method,
                headers: { 'Content-Type': 'application/json' },
                body:    ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined,
            });
        });
        const ct   = response.headers.get('content-type') || '';
        const body = ct.includes('application/json') ? await response.json() : await response.text();
        res.status(response.status).json(body);
    } catch (err) {
        res.status(503).json({ error: err.message });
    }
}

const swaggerSpec = swaggerJsdoc({
    definition: {
        openapi: '3.0.0',
        info: { title: 'TechStore API Gateway — Practice 23 (Docker Microservices)', version: '1.0.0', description: 'Единая точка входа TechStore. Все запросы проходят через этот gateway, который маршрутизирует их к service_users или service_products. Реализован Circuit Breaker.' },
        servers: [{ url: 'http://localhost:8000' }],
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
    apis: ['./index.js'],
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * /status:
 *   get:
 *     summary: Состояние gateway и Circuit Breaker
 *     tags: [Gateway]
 *     responses:
 *       200: { description: "{ gateway, circuitBreakers: [{name, state, failures}] }" }
 * /api/auth/register:
 *   post:
 *     summary: Регистрация → service_users
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
 *     summary: Вход → service_users
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginBody'
 *     responses:
 *       200: { description: "{ accessToken, refreshToken }" }
 * /api/products:
 *   get:
 *     summary: Список товаров → service_products
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Список товаров }
 *       503: { description: Circuit Breaker открыт }
 *   post:
 *     summary: Добавить товар (seller, admin) → service_products
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
 *     summary: Товар по ID → service_products
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
 *       200: { description: Обновлён }
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
 * /api/users:
 *   get:
 *     summary: Список пользователей (admin) → service_users
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
 *               role: { type: string, enum: [user, seller, admin] }
 *               blocked: { type: boolean }
 *     responses:
 *       200: { description: Обновлён }
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
 *       200: { description: Заблокирован }
 * /api/users/{id}/overview:
 *   get:
 *     summary: "Агрегация: пользователь + все товары (admin)"
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: "{ user: {...}, totalProducts: N, products: [...] }" }
 */

// ===== STATUS =====
app.get('/status', (req, res) => {
    res.json({ gateway: 'TechStore API Gateway', circuitBreakers: [usersBreaker.getStatus(), productsBreaker.getStatus()] });
});

// ===== AUTH ROUTES (проксируем в service_users) =====
app.post('/api/auth/register', (req, res) => proxy(usersBreaker, `${USERS_SERVICE_URL}/auth/register`, req, res));
app.post('/api/auth/login',    (req, res) => proxy(usersBreaker, `${USERS_SERVICE_URL}/auth/login`,    req, res));
app.post('/api/auth/refresh',  (req, res) => proxy(usersBreaker, `${USERS_SERVICE_URL}/auth/refresh`,  req, res));

// ===== USERS ROUTES (admin only) =====
app.get('/api/users',     authMiddleware, roleMiddleware(['admin']), (req, res) => proxy(usersBreaker, `${USERS_SERVICE_URL}/users`,              req, res));
app.get('/api/users/:id', authMiddleware, roleMiddleware(['admin']), (req, res) => proxy(usersBreaker, `${USERS_SERVICE_URL}/users/${req.params.id}`, req, res));
app.put('/api/users/:id', authMiddleware, roleMiddleware(['admin']), (req, res) => proxy(usersBreaker, `${USERS_SERVICE_URL}/users/${req.params.id}`, req, res));
app.delete('/api/users/:id', authMiddleware, roleMiddleware(['admin']), (req, res) => proxy(usersBreaker, `${USERS_SERVICE_URL}/users/${req.params.id}`, req, res));

// ===== PRODUCTS ROUTES =====
app.get('/api/products',     authMiddleware,                                    (req, res) => proxy(productsBreaker, `${PRODUCTS_SERVICE_URL}/products`,               req, res));
app.get('/api/products/:id', authMiddleware,                                    (req, res) => proxy(productsBreaker, `${PRODUCTS_SERVICE_URL}/products/${req.params.id}`, req, res));
app.post('/api/products',    authMiddleware, roleMiddleware(['seller', 'admin']), (req, res) => proxy(productsBreaker, `${PRODUCTS_SERVICE_URL}/products`,               req, res));
app.put('/api/products/:id', authMiddleware, roleMiddleware(['seller', 'admin']), (req, res) => proxy(productsBreaker, `${PRODUCTS_SERVICE_URL}/products/${req.params.id}`, req, res));
app.delete('/api/products/:id', authMiddleware, roleMiddleware(['admin']),        (req, res) => proxy(productsBreaker, `${PRODUCTS_SERVICE_URL}/products/${req.params.id}`, req, res));

// ===== AGGREGATION: пользователь + товары по категории =====
app.get('/api/users/:id/overview', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const [userRes, productsRes] = await Promise.all([
            usersBreaker.call(() => fetch(`${USERS_SERVICE_URL}/users/${req.params.id}`)),
            productsBreaker.call(() => fetch(`${PRODUCTS_SERVICE_URL}/products`)),
        ]);
        const user     = await userRes.json();
        const products = await productsRes.json();
        if (userRes.status === 404) return res.status(404).json(user);
        res.json({ user, totalProducts: products.length, products });
    } catch (err) {
        res.status(503).json({ error: err.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`TechStore API Gateway запущен на порту ${PORT}`);
});
