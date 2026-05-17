const express = require('express');
const fetch   = require('node-fetch');

const app = express();
app.use(express.json());

const PORT              = process.env.PORT              || 8000;
const USERS_SERVICE_URL  = process.env.USERS_SERVICE_URL  || 'http://service_users:8000';
const ORDERS_SERVICE_URL = process.env.ORDERS_SERVICE_URL || 'http://service_orders:8000';

// ===== CIRCUIT BREAKER =====
class CircuitBreaker {
    constructor(name, { failureThreshold = 3, recoveryTimeout = 10000 } = {}) {
        this.name             = name;
        this.failureThreshold = failureThreshold;
        this.recoveryTimeout  = recoveryTimeout;
        this.state            = 'CLOSED'; // CLOSED | OPEN | HALF_OPEN
        this.failures         = 0;
        this.lastFailureTime  = null;
    }

    async call(fn) {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
                this.state = 'HALF_OPEN';
                console.log(`[CB:${this.name}] → HALF_OPEN (testing recovery)`);
            } else {
                throw new Error(`${this.name} service temporarily unavailable`);
            }
        }

        try {
            const result = await fn();
            if (this.state === 'HALF_OPEN') {
                this.reset();
                console.log(`[CB:${this.name}] → CLOSED (recovered)`);
            }
            return result;
        } catch (err) {
            this.recordFailure();
            throw err;
        }
    }

    recordFailure() {
        this.failures++;
        this.lastFailureTime = Date.now();
        if (this.failures >= this.failureThreshold) {
            this.state = 'OPEN';
            console.log(`[CB:${this.name}] → OPEN (${this.failures} failures)`);
        }
    }

    reset() {
        this.failures = 0;
        this.state    = 'CLOSED';
    }

    getStatus() {
        return { name: this.name, state: this.state, failures: this.failures };
    }
}

const usersBreaker  = new CircuitBreaker('users');
const ordersBreaker = new CircuitBreaker('orders');

// ===== PROXY HELPER =====
async function proxyRequest(breaker, targetUrl, req, res) {
    try {
        const response = await breaker.call(async () => {
            const r = await fetch(targetUrl, {
                method:  req.method,
                headers: { 'Content-Type': 'application/json' },
                body:    ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined,
            });
            return r;
        });

        const contentType = response.headers.get('content-type') || '';
        const body = contentType.includes('application/json') ? await response.json() : await response.text();
        res.status(response.status).json(body);
    } catch (err) {
        res.status(503).json({ error: err.message });
    }
}

// ===== STATUS =====
app.get('/status', (req, res) => {
    res.json({
        gateway: 'ok',
        circuitBreakers: [usersBreaker.getStatus(), ordersBreaker.getStatus()],
    });
});

// ===== USERS ROUTES =====
app.get('/users', (req, res) => {
    proxyRequest(usersBreaker, `${USERS_SERVICE_URL}/users`, req, res);
});
app.get('/users/:id', (req, res) => {
    proxyRequest(usersBreaker, `${USERS_SERVICE_URL}/users/${req.params.id}`, req, res);
});
app.post('/users', (req, res) => {
    proxyRequest(usersBreaker, `${USERS_SERVICE_URL}/users`, req, res);
});
app.put('/users/:id', (req, res) => {
    proxyRequest(usersBreaker, `${USERS_SERVICE_URL}/users/${req.params.id}`, req, res);
});
app.delete('/users/:id', (req, res) => {
    proxyRequest(usersBreaker, `${USERS_SERVICE_URL}/users/${req.params.id}`, req, res);
});

// ===== ORDERS ROUTES =====
app.get('/orders', (req, res) => {
    proxyRequest(ordersBreaker, `${ORDERS_SERVICE_URL}/orders${req.query.userId ? `?userId=${req.query.userId}` : ''}`, req, res);
});
app.get('/orders/:id', (req, res) => {
    proxyRequest(ordersBreaker, `${ORDERS_SERVICE_URL}/orders/${req.params.id}`, req, res);
});
app.post('/orders', (req, res) => {
    proxyRequest(ordersBreaker, `${ORDERS_SERVICE_URL}/orders`, req, res);
});
app.put('/orders/:id', (req, res) => {
    proxyRequest(ordersBreaker, `${ORDERS_SERVICE_URL}/orders/${req.params.id}`, req, res);
});
app.delete('/orders/:id', (req, res) => {
    proxyRequest(ordersBreaker, `${ORDERS_SERVICE_URL}/orders/${req.params.id}`, req, res);
});

// ===== AGGREGATION: user + orders =====
app.get('/users/:id/details', async (req, res) => {
    try {
        const [userRes, ordersRes] = await Promise.all([
            usersBreaker.call(() => fetch(`${USERS_SERVICE_URL}/users/${req.params.id}`)),
            ordersBreaker.call(() => fetch(`${ORDERS_SERVICE_URL}/orders?userId=${req.params.id}`)),
        ]);

        const user   = await userRes.json();
        const orders = await ordersRes.json();

        if (userRes.status === 404) return res.status(404).json(user);

        res.json({ user, orders });
    } catch (err) {
        res.status(503).json({ error: err.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`API Gateway running on port ${PORT}`);
});
