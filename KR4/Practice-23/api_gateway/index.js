const express = require('express');
const fetch   = require('node-fetch');

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
