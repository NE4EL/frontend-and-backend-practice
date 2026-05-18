const express = require('express');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');

const app = express();
app.use(express.json());

const PORT           = process.env.PORT    || 8000;
const ACCESS_SECRET  = process.env.JWT_SECRET || 'access_secret';
const REFRESH_SECRET = 'refresh_secret';
const ROLES = { USER: 'user', SELLER: 'seller', ADMIN: 'admin' };

const users = {};
let nextId = 1;
const refreshTokens = new Set();

function generateAccessToken(user) {
    return jwt.sign({ sub: user.id, email: user.email, role: user.role }, ACCESS_SECRET, { expiresIn: '15m' });
}
function generateRefreshToken(user) {
    return jwt.sign({ sub: user.id, email: user.email, role: user.role }, REFRESH_SECRET, { expiresIn: '7d' });
}

// AUTH
app.post('/auth/register', async (req, res) => {
    const { email, first_name, last_name, password, role } = req.body;
    if (!email || !first_name || !last_name || !password) return res.status(400).json({ error: 'Все поля обязательны' });
    if (Object.values(users).some(u => u.email === email.toLowerCase())) return res.status(409).json({ error: 'Email уже используется' });
    const hashed_password = await bcrypt.hash(password, 10);
    const id = nextId++;
    users[id] = { id, email: email.toLowerCase(), first_name, last_name, hashed_password, role: Object.values(ROLES).includes(role) ? role : ROLES.USER, blocked: false };
    const u = users[id];
    res.status(201).json({ id: u.id, email: u.email, first_name: u.first_name, last_name: u.last_name, role: u.role });
});

app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = Object.values(users).find(u => u.email === email?.toLowerCase());
    if (!user || user.blocked || !await bcrypt.compare(password, user.hashed_password)) return res.status(401).json({ error: 'Неверные данные или аккаунт заблокирован' });
    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    refreshTokens.add(refreshToken);
    res.json({ accessToken, refreshToken });
});

app.post('/auth/refresh', (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken || !refreshTokens.has(refreshToken)) return res.status(401).json({ error: 'Invalid refresh token' });
    try {
        const payload = jwt.verify(refreshToken, REFRESH_SECRET);
        const user = users[payload.sub];
        if (!user || user.blocked) return res.status(401).json({ error: 'User not found or blocked' });
        refreshTokens.delete(refreshToken);
        const newAccess  = generateAccessToken(user);
        const newRefresh = generateRefreshToken(user);
        refreshTokens.add(newRefresh);
        res.json({ accessToken: newAccess, refreshToken: newRefresh });
    } catch {
        res.status(401).json({ error: 'Invalid refresh token' });
    }
});

// Верификация токена (используется gateway для проверки авторизации)
app.post('/auth/verify', (req, res) => {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Missing token' });
    try {
        const payload = jwt.verify(token, ACCESS_SECRET);
        const user = users[payload.sub];
        if (!user || user.blocked) return res.status(401).json({ error: 'User not found or blocked' });
        res.json({ valid: true, user: { id: user.id, email: user.email, role: user.role } });
    } catch {
        res.status(401).json({ valid: false, error: 'Invalid token' });
    }
});

// USERS CRUD (admin)
app.get('/users', (req, res) => {
    res.json(Object.values(users).map(u => ({ id: u.id, email: u.email, first_name: u.first_name, last_name: u.last_name, role: u.role, blocked: u.blocked })));
});

app.get('/users/:id', (req, res) => {
    const user = users[req.params.id];
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, role: user.role, blocked: user.blocked });
});

app.put('/users/:id', (req, res) => {
    const user = users[req.params.id];
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { first_name, last_name, role, blocked } = req.body;
    if (first_name !== undefined) user.first_name = first_name;
    if (last_name  !== undefined) user.last_name  = last_name;
    if (role       !== undefined && Object.values(ROLES).includes(role)) user.role = role;
    if (blocked    !== undefined) user.blocked = blocked;
    res.json({ id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, role: user.role, blocked: user.blocked });
});

app.delete('/users/:id', (req, res) => {
    const user = users[req.params.id];
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.blocked = true;
    res.json({ message: `Пользователь ${user.email} заблокирован` });
});

app.listen(PORT, '0.0.0.0', () => console.log(`Users service running on port ${PORT}`));
