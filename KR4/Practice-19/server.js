const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const { Client } = require('pg');

const app = express();
app.use(express.json());

const DB_NAME = 'kr4_p19';
const DB_USER = process.env.DB_USER || require('os').userInfo().username;
const DB_PASS = process.env.DB_PASS || null;
const DB_HOST = process.env.DB_HOST || 'localhost';
const PORT = process.env.PORT || 3000;

async function ensureDatabase() {
    const client = new Client({ user: DB_USER, password: DB_PASS, host: DB_HOST, database: 'postgres', port: 5432 });
    await client.connect();
    const result = await client.query(`SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'`);
    if (result.rowCount === 0) {
        await client.query(`CREATE DATABASE ${DB_NAME}`);
        console.log(`База данных ${DB_NAME} создана`);
    }
    await client.end();
}

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
    host: DB_HOST,
    dialect: 'postgres',
    logging: false,
});

const User = sequelize.define('User', {
    first_name: { type: DataTypes.STRING(100), allowNull: false },
    last_name:  { type: DataTypes.STRING(100), allowNull: false },
    age:        { type: DataTypes.INTEGER,     allowNull: false },
}, {
    tableName:  'users',
    timestamps: true,
    createdAt:  'created_at',
    updatedAt:  'updated_at',
});

// POST /api/users
app.post('/api/users', async (req, res) => {
    const { first_name, last_name, age } = req.body;
    if (!first_name || !last_name || age === undefined) {
        return res.status(400).json({ error: 'first_name, last_name и age обязательны' });
    }
    try {
        const user = await User.create({ first_name, last_name, age: Number(age) });
        res.status(201).json(user);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// GET /api/users
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.findAll({ order: [['created_at', 'DESC']] });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/users/:id
app.get('/api/users/:id', async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/users/:id
app.patch('/api/users/:id', async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
        const { first_name, last_name, age } = req.body;
        if (first_name !== undefined) user.first_name = first_name;
        if (last_name  !== undefined) user.last_name  = last_name;
        if (age        !== undefined) user.age         = Number(age);
        await user.save();
        res.json(user);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE /api/users/:id
app.delete('/api/users/:id', async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
        await user.destroy();
        res.json({ message: 'Пользователь удалён' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

async function start() {
    await ensureDatabase();
    await sequelize.sync();
    app.listen(PORT, () => console.log(`Practice 19 (PostgreSQL) запущен на http://localhost:${PORT}`));
}

start().catch(err => { console.error('Ошибка запуска:', err.message); process.exit(1); });
