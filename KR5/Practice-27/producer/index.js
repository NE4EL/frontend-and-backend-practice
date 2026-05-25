const express = require('express');
const amqp    = require('amqplib');

const app          = express();
const PORT         = process.env.PORT         || 3001;
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672';
const QUEUE        = 'tasks';
const DLQ          = 'tasks.dlq';

app.use(express.json());

let channel = null;

async function connectRabbitMQ() {
  let retries = 10;
  while (retries > 0) {
    try {
      const conn = await amqp.connect(RABBITMQ_URL);
      channel = await conn.createChannel();

      // Dead Letter Queue
      await channel.assertQueue(DLQ, { durable: true });

      // Main queue with DLQ reference
      await channel.assertQueue(QUEUE, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': DLQ,
        },
      });

      console.log('[Producer] Подключён к RabbitMQ');
      return;
    } catch (err) {
      retries--;
      console.log(`[Producer] Ожидание RabbitMQ... (осталось ${retries} попыток)`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  throw new Error('Не удалось подключиться к RabbitMQ');
}

/**
 * POST /tasks
 * Body: { type: string, payload: any }
 * Puts a task into the RabbitMQ queue
 */
app.post('/tasks', (req, res) => {
  if (!channel) return res.status(503).json({ error: 'RabbitMQ недоступен' });

  const { type, payload } = req.body;
  if (!type) return res.status(400).json({ error: 'type обязателен' });

  const task = {
    id:        Date.now().toString(),
    type,
    payload:   payload ?? {},
    createdAt: new Date().toISOString(),
  };

  channel.sendToQueue(QUEUE, Buffer.from(JSON.stringify(task)), {
    persistent: true,
    contentType: 'application/json',
  });

  console.log(`[Producer] Задача отправлена: ${task.id} (type=${type})`);
  res.status(201).json({ message: 'Задача добавлена в очередь', task });
});

app.get('/status', (req, res) => {
  res.json({
    service:  'TechStore Task Producer',
    queue:    QUEUE,
    dlq:      DLQ,
    connected: channel !== null,
  });
});

connectRabbitMQ().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Producer] API запущен на порту ${PORT}`);
    console.log(`  POST /tasks  — отправить задачу в очередь`);
    console.log(`  GET  /status — статус подключения`);
  });
});
