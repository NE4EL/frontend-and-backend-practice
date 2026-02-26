const express = require('express');
const app = express();
const port = 3000;

let users = [
  { id: 1, name: 'Tech Store', price: 123000000},
  { id: 2, name: 'Cat&Dog', price: 23000000},
  { id: 3, name: 'White', price: 23095600},
];

// Middleware для парсинга JSON
app.use(express.json());

// Главная страница
app.get('/', (req, res) => {
  res.send('Главная страница');
});

// Создание нового пользователя
app.post('/users', (req, res) => {
  const { name, age } = req.body;
  const newUser = {
    id: Date.now(),
    name,
    age
  };
  users.push(newUser);
  res.status(201).json(newUser);
});

// Получить всех пользователей
app.get('/users', (req, res) => {
  res.json(users);
});

// Получить пользователя по ID
app.get('/users/:id', (req, res) => {
  const user = users.find(u => u.id == req.params.id);
  if (user) {
    res.json(user);
  } else {
    res.status(404).send('Пользователь не найден');
  }
});

// Обновить пользователя по ID
app.patch('/users/:id', (req, res) => {
  const user = users.find(u => u.id == req.params.id);
  if (!user) {
    return res.status(404).send('Пользователь не найден');
  }

  const { name, age } = req.body;
  if (name !== undefined) user.name = name;
  if (age !== undefined) user.age = age;

  res.json(user);
});

// Удалить пользователя по ID
app.delete('/users/:id', (req, res) => {
  users = users.filter(u => u.id != req.params.id);
  res.send('Ok');
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен на http://localhost:${port}`);
});