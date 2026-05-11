const VAPID_PUBLIC_KEY = 'BNZBr2P-LZCBUGZrlB4XH6flNF6-Y6w-d8lhQDC6RBtySW_T7Ct8yitCcJ1i_KLVsZHQcJ7gpVqEjiNZk4K5L-I';
const SERVER_URL = 'https://localhost:3001';

const contentDiv = document.getElementById('app-content');
const homeBtn = document.getElementById('home-btn');
const aboutBtn = document.getElementById('about-btn');
const swStatus = document.getElementById('sw-status');

const socket = io(SERVER_URL);

socket.on('connect', () => {
    console.log('WebSocket подключён:', socket.id);
});

socket.on('taskAdded', (task) => {
    showToast(`Новая задача: ${task.text}`);
});

function showToast(msg) {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = `
        position:fixed;top:10px;right:10px;background:#4285f4;color:#fff;
        padding:0.75rem 1rem;border-radius:6px;z-index:1000;max-width:300px;
        box-shadow:0 2px 8px rgba(0,0,0,.3);
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

function setActiveButton(id) {
    [homeBtn, aboutBtn].forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

async function loadContent(page) {
    try {
        const res = await fetch(`/content/${page}.html`);
        const html = await res.text();
        contentDiv.innerHTML = html;
        if (page === 'home') initNotes();
    } catch (err) {
        contentDiv.innerHTML = `<p class="is-center text-error">Ошибка загрузки страницы. Возможно, нет сети.</p>`;
        console.error(err);
    }
}

homeBtn.addEventListener('click', () => { setActiveButton('home-btn'); loadContent('home'); });
aboutBtn.addEventListener('click', () => { setActiveButton('about-btn'); loadContent('about'); });

loadContent('home');

function initNotes() {
    const form = document.getElementById('note-form');
    const input = document.getElementById('note-input');
    const reminderForm = document.getElementById('reminder-form');
    const reminderText = document.getElementById('reminder-text');
    const reminderTime = document.getElementById('reminder-time');
    const list = document.getElementById('notes-list');

    function loadNotes() {
        const notes = JSON.parse(localStorage.getItem('notes') || '[]');
        if (notes.length === 0) {
            list.innerHTML = '<li style="color:#888;text-align:center;padding:1rem;">Заметок пока нет</li>';
            return;
        }
        list.innerHTML = notes.map(note => {
            let reminderInfo = '';
            if (note.reminder) {
                const d = new Date(note.reminder);
                reminderInfo = `<br><small style="color:#4285f4;">🔔 Напоминание: ${d.toLocaleString('ru')}</small>`;
            }
            return `<li class="card" style="margin-bottom:0.5rem;padding:0.75rem;display:flex;justify-content:space-between;align-items:flex-start;">
                <span>${note.text}${reminderInfo}</span>
                <button onclick="deleteNote(${note.id})" style="background:none;border:none;cursor:pointer;color:#e74c3c;font-size:1.1rem;padding:0 0.25rem;">✕</button>
            </li>`;
        }).join('');
    }

    window.deleteNote = function(id) {
        let notes = JSON.parse(localStorage.getItem('notes') || '[]');
        notes = notes.filter(n => n.id !== id);
        localStorage.setItem('notes', JSON.stringify(notes));
        loadNotes();
    };

    function addNote(text, reminderTimestamp = null) {
        const notes = JSON.parse(localStorage.getItem('notes') || '[]');
        const newNote = { id: Date.now(), text, reminder: reminderTimestamp };
        notes.push(newNote);
        localStorage.setItem('notes', JSON.stringify(notes));
        loadNotes();

        if (reminderTimestamp) {
            socket.emit('newReminder', { id: newNote.id, text, reminderTime: reminderTimestamp });
        } else {
            socket.emit('newTask', { text, timestamp: Date.now() });
        }
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (text) { addNote(text); input.value = ''; }
    });

    reminderForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = reminderText.value.trim();
        const datetime = reminderTime.value;
        if (!text || !datetime) return;
        const ts = new Date(datetime).getTime();
        if (ts <= Date.now()) {
            alert('Дата напоминания должна быть в будущем');
            return;
        }
        addNote(text, ts);
        reminderText.value = '';
        reminderTime.value = '';
    });

    loadNotes();
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
}

async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        await fetch(`${SERVER_URL}/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sub)
        });
        console.log('Подписка на push оформлена');
    } catch (err) {
        console.error('Ошибка подписки:', err);
    }
}

async function unsubscribeFromPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
        await fetch(`${SERVER_URL}/unsubscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint })
        });
        await sub.unsubscribe();
        console.log('Отписка выполнена');
    }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const reg = await navigator.serviceWorker.register('/sw.js');
            swStatus.textContent = 'Service Worker: активен ✓';
            console.log('SW зарегистрирован:', reg.scope);

            const enableBtn = document.getElementById('enable-push');
            const disableBtn = document.getElementById('disable-push');

            if (enableBtn && disableBtn) {
                const existingSub = await reg.pushManager.getSubscription();
                if (existingSub) {
                    enableBtn.style.display = 'none';
                    disableBtn.style.display = 'inline-block';
                }

                enableBtn.addEventListener('click', async () => {
                    if (Notification.permission === 'denied') {
                        alert('Уведомления запрещены. Разрешите их в настройках браузера.');
                        return;
                    }
                    if (Notification.permission === 'default') {
                        const perm = await Notification.requestPermission();
                        if (perm !== 'granted') { alert('Необходимо разрешить уведомления.'); return; }
                    }
                    await subscribeToPush();
                    enableBtn.style.display = 'none';
                    disableBtn.style.display = 'inline-block';
                });

                disableBtn.addEventListener('click', async () => {
                    await unsubscribeFromPush();
                    disableBtn.style.display = 'none';
                    enableBtn.style.display = 'inline-block';
                });
            }
        } catch (err) {
            swStatus.textContent = 'Service Worker: ошибка';
            console.error('SW ошибка:', err);
        }
    });
}
