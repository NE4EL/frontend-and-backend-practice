const express = require('express');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const VAPID_PUBLIC_KEY = 'BNZBr2P-LZCBUGZrlB4XH6flNF6-Y6w-d8lhQDC6RBtySW_T7Ct8yitCcJ1i_KLVsZHQcJ7gpVqEjiNZk4K5L-I';
const VAPID_PRIVATE_KEY = 'VOP3kC7d5DArkAkUTDEeSIKgYNsn8O_8BzJ2QIHaeAE';

webpush.setVapidDetails('mailto:evtushenkoem7@gmail.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, './')));

let subscriptions = [];
const reminders = new Map();

const server = https.createServer({
    cert: fs.readFileSync(path.join(__dirname, 'localhost+2.pem')),
    key: fs.readFileSync(path.join(__dirname, 'localhost+2-key.pem'))
}, app);
const io = socketIo(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

io.on('connection', (socket) => {
    console.log('Клиент подключён:', socket.id);

    socket.on('newTask', (task) => {
        io.emit('taskAdded', task);
        const payload = JSON.stringify({ title: '📝 Новая задача', body: task.text });
        subscriptions.forEach(sub => {
            webpush.sendNotification(sub, payload).catch(err => console.error('Push error:', err));
        });
    });

    socket.on('newReminder', (reminder) => {
        const { id, text, reminderTime } = reminder;
        const delay = reminderTime - Date.now();
        if (delay <= 0) return;

        const timeoutId = setTimeout(() => {
            const payload = JSON.stringify({ title: '🔔 Напоминание', body: text, reminderId: id });
            subscriptions.forEach(sub => {
                webpush.sendNotification(sub, payload).catch(err => console.error('Push error:', err));
            });
            reminders.delete(id);
        }, delay);

        reminders.set(id, { timeoutId, text, reminderTime });
        console.log(`Напоминание запланировано: "${text}" через ${Math.round(delay / 1000)}с`);
    });

    socket.on('disconnect', () => {
        console.log('Клиент отключён:', socket.id);
    });
});

app.post('/subscribe', (req, res) => {
    const sub = req.body;
    const exists = subscriptions.some(s => s.endpoint === sub.endpoint);
    if (!exists) subscriptions.push(sub);
    res.status(201).json({ message: 'Подписка сохранена' });
});

app.post('/unsubscribe', (req, res) => {
    const { endpoint } = req.body;
    subscriptions = subscriptions.filter(s => s.endpoint !== endpoint);
    res.status(200).json({ message: 'Подписка удалена' });
});

app.post('/snooze', (req, res) => {
    const reminderId = parseInt(req.query.reminderId, 10);
    if (!reminderId || !reminders.has(reminderId)) {
        return res.status(404).json({ error: 'Reminder not found' });
    }

    const reminder = reminders.get(reminderId);
    clearTimeout(reminder.timeoutId);

    const newDelay = 5 * 60 * 1000;
    const newTimeoutId = setTimeout(() => {
        const payload = JSON.stringify({ title: '⏰ Напоминание отложено', body: reminder.text, reminderId });
        subscriptions.forEach(sub => {
            webpush.sendNotification(sub, payload).catch(err => console.error('Push error:', err));
        });
        reminders.delete(reminderId);
    }, newDelay);

    reminders.set(reminderId, { timeoutId: newTimeoutId, text: reminder.text, reminderTime: Date.now() + newDelay });
    console.log(`Напоминание ${reminderId} отложено на 5 минут`);
    res.status(200).json({ message: 'Reminder snoozed for 5 minutes' });
});

app.get('/vapidPublicKey', (req, res) => {
    res.json({ publicKey: VAPID_PUBLIC_KEY });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Сервер запущен на https://localhost:${PORT}`);
});
