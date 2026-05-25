const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672';
const WORKER_ID    = process.env.WORKER_ID    || '1';
const QUEUE        = 'tasks';
const DLQ          = 'tasks.dlq';
const MAX_RETRIES  = 3;
const BASE_DELAY   = 1000; // 1s
const MAX_DELAY    = 15000;

// Exponential backoff with jitter
function backoffDelay(attempt) {
  const exp   = Math.min(BASE_DELAY * 2 ** attempt, MAX_DELAY);
  const jitter = Math.random() * 0.3 * exp;
  return Math.floor(exp + jitter);
}

// Simulate task processing — randomly fails 30% of the time
async function processTask(task) {
  console.log(`[Worker-${WORKER_ID}] Обрабатываю задачу ${task.id} (type=${task.type})`);
  await new Promise(r => setTimeout(r, 500 + Math.random() * 500));

  if (Math.random() < 0.3) {
    throw new Error(`Случайный сбой при обработке задачи ${task.id}`);
  }

  console.log(`[Worker-${WORKER_ID}] ✅ Задача ${task.id} выполнена`);
}

async function connectRabbitMQ() {
  let retries = 15;
  while (retries > 0) {
    try {
      const conn    = await amqp.connect(RABBITMQ_URL);
      const channel = await conn.createChannel();

      // DLQ
      await channel.assertQueue(DLQ, { durable: true });

      // Main queue
      await channel.assertQueue(QUEUE, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': DLQ,
        },
      });

      // Process one message at a time
      channel.prefetch(1);

      console.log(`[Worker-${WORKER_ID}] Подключён к RabbitMQ, ожидаю задачи из "${QUEUE}"...`);

      channel.consume(QUEUE, async (msg) => {
        if (!msg) return;

        let task;
        try {
          task = JSON.parse(msg.content.toString());
        } catch {
          console.error(`[Worker-${WORKER_ID}] Невалидный JSON, отправляю в DLQ`);
          channel.nack(msg, false, false);
          return;
        }

        const attempt   = (msg.properties.headers?.['x-retry-count'] ?? 0);
        const taskLabel = `${task.id}[attempt ${attempt + 1}/${MAX_RETRIES + 1}]`;

        try {
          await processTask(task);
          channel.ack(msg);
        } catch (err) {
          console.warn(`[Worker-${WORKER_ID}] ❌ Ошибка ${taskLabel}: ${err.message}`);

          if (attempt < MAX_RETRIES) {
            const delay = backoffDelay(attempt);
            console.log(`[Worker-${WORKER_ID}] Повтор через ${delay}ms...`);

            // Reject without requeue, then re-publish with incremented retry counter
            channel.nack(msg, false, false);
            setTimeout(() => {
              channel.sendToQueue(QUEUE, Buffer.from(JSON.stringify(task)), {
                persistent: true,
                headers: { 'x-retry-count': attempt + 1 },
              });
            }, delay);
          } else {
            console.error(`[Worker-${WORKER_ID}] 💀 Задача ${task.id} исчерпала попытки → DLQ`);
            channel.sendToQueue(DLQ, Buffer.from(JSON.stringify({
              ...task,
              failedAt: new Date().toISOString(),
              reason:   err.message,
            })), { persistent: true });
            channel.ack(msg);
          }
        }
      });

      return;
    } catch (err) {
      retries--;
      console.log(`[Worker-${WORKER_ID}] Ожидание RabbitMQ... (${retries} попыток)`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  throw new Error('Не удалось подключиться к RabbitMQ');
}

connectRabbitMQ().catch(console.error);
