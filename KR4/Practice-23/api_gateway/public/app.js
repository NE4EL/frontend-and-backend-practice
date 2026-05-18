const API = '';

let accessToken = localStorage.getItem('accessToken') || '';
let currentUser = null;

// ── UTILS ──────────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  let res = await fetch(API + path, { ...options, headers });

  if (res.status === 401 && localStorage.getItem('refreshToken')) {
    const rr = await fetch(API + '/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: localStorage.getItem('refreshToken') }),
    });
    if (rr.ok) {
      const data = await rr.json();
      accessToken = data.accessToken;
      localStorage.setItem('accessToken', accessToken);
      if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
      headers['Authorization'] = `Bearer ${accessToken}`;
      res = await fetch(API + path, { ...options, headers });
    } else {
      doLogout();
      return null;
    }
  }
  return res;
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideError(id) { document.getElementById(id).classList.add('hidden'); }

// ── AUTH ───────────────────────────────────────────────────────────────────

function switchTab(tab) {
  document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
  document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
  document.getElementById('tabLogin').classList.toggle('tab--active', tab === 'login');
  document.getElementById('tabRegister').classList.toggle('tab--active', tab === 'register');
}

async function doLogin(e) {
  e.preventDefault();
  hideError('loginError');
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  const res = await fetch(API + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) return showError('loginError', data.error || 'Ошибка входа');

  accessToken = data.accessToken;
  localStorage.setItem('accessToken', accessToken);
  if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
  await loadCurrentUser();
  enterApp();
}

async function doRegister(e) {
  e.preventDefault();
  hideError('registerError');
  const body = {
    email:      document.getElementById('regEmail').value,
    first_name: document.getElementById('regFirstName').value,
    last_name:  document.getElementById('regLastName').value,
    password:   document.getElementById('regPassword').value,
    role:       document.getElementById('regRole').value,
  };

  const res = await fetch(API + '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) return showError('registerError', data.error || 'Ошибка регистрации');

  document.getElementById('loginEmail').value = body.email;
  document.getElementById('loginPassword').value = body.password;
  switchTab('login');
  await doLogin({ preventDefault: () => {}, target: null });
}

async function loadCurrentUser() {
  const res = await apiFetch('/api/auth/me');
  if (!res || !res.ok) return;
  const data = await res.json();
  currentUser = data.user || data;
}

function doLogout() {
  accessToken = '';
  currentUser = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  document.getElementById('authPage').classList.remove('hidden');
  document.getElementById('appPage').classList.add('hidden');
}

function enterApp() {
  document.getElementById('authPage').classList.add('hidden');
  document.getElementById('appPage').classList.remove('hidden');

  const isAdmin = currentUser && currentUser.role === 'admin';
  const isSeller = currentUser && (currentUser.role === 'seller' || currentUser.role === 'admin');

  document.getElementById('navUsers').classList.toggle('hidden', !isAdmin);
  document.getElementById('btnAddProduct').style.display = isSeller ? '' : 'none';

  const role = currentUser ? currentUser.role : '';
  const email = currentUser ? currentUser.email : '';
  document.getElementById('userInfo').textContent = `${email} [${role}]`;

  showSection('products');
}

// ── NAV ────────────────────────────────────────────────────────────────────

function showSection(name) {
  ['products', 'users', 'status'].forEach(s => {
    document.getElementById('section' + s.charAt(0).toUpperCase() + s.slice(1)).classList.toggle('hidden', s !== name);
    const btn = document.getElementById('nav' + s.charAt(0).toUpperCase() + s.slice(1));
    if (btn) btn.classList.toggle('navBtn--active', s === name);
  });

  if (name === 'products') loadProducts();
  if (name === 'users')    loadUsers();
  if (name === 'status')   loadStatus();
}

// ── PRODUCTS ───────────────────────────────────────────────────────────────

async function loadProducts() {
  const res = await apiFetch('/api/products');
  if (!res) return;
  const products = await res.json();
  const list = document.getElementById('productsList');
  if (!products.length) {
    list.innerHTML = '<p class="empty">Нет товаров</p>';
    return;
  }
  const isSeller = currentUser && (currentUser.role === 'seller' || currentUser.role === 'admin');
  const isAdmin  = currentUser && currentUser.role === 'admin';

  list.innerHTML = products.map(p => `
    <div class="card">
      <span class="card__category">${p.category}</span>
      <p class="card__title">${p.title}</p>
      <p class="card__desc">${p.description}</p>
      <p class="card__price">${Number(p.price).toLocaleString('ru-RU')} ₽</p>
      <div class="card__actions">
        ${isSeller ? `<button class="btn btn--ghost btn--sm" onclick="openProductModal(${JSON.stringify(p).replace(/"/g,'&quot;')})">Изменить</button>` : ''}
        ${isAdmin  ? `<button class="btn btn--danger btn--sm" onclick="deleteProduct(${p.id})">Удалить</button>` : ''}
      </div>
    </div>
  `).join('');
}

function openProductModal(product) {
  document.getElementById('productError').classList.add('hidden');
  document.getElementById('productId').value     = product ? product.id : '';
  document.getElementById('pTitle').value        = product ? product.title : '';
  document.getElementById('pCategory').value     = product ? product.category : '';
  document.getElementById('pDescription').value  = product ? product.description : '';
  document.getElementById('pPrice').value        = product ? product.price : '';
  document.getElementById('modalTitle').textContent    = product ? 'Изменить товар' : 'Добавить товар';
  document.getElementById('modalSubmitBtn').textContent = product ? 'Сохранить' : 'Добавить';
  document.getElementById('productModal').classList.remove('hidden');
}

function closeProductModal() {
  document.getElementById('productModal').classList.add('hidden');
}

async function submitProduct(e) {
  e.preventDefault();
  hideError('productError');
  const id = document.getElementById('productId').value;
  const body = {
    title:       document.getElementById('pTitle').value,
    category:    document.getElementById('pCategory').value,
    description: document.getElementById('pDescription').value,
    price:       Number(document.getElementById('pPrice').value),
  };

  const res = await apiFetch(id ? `/api/products/${id}` : '/api/products', {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(body),
  });
  if (!res) return;
  const data = await res.json();
  if (!res.ok) return showError('productError', data.error || 'Ошибка');
  closeProductModal();
  loadProducts();
}

async function deleteProduct(id) {
  if (!confirm('Удалить товар?')) return;
  await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
  loadProducts();
}

// ── USERS ─────────────────────────────────────────────────────────────────

async function loadUsers() {
  const res = await apiFetch('/api/users');
  if (!res) return;
  const users = await res.json();
  const tbody = document.getElementById('usersBody');
  tbody.innerHTML = users.map(u => `
    <tr>
      <td>${u.id}</td>
      <td>${u.email}</td>
      <td><span class="badge badge--${u.role}">${u.role}</span></td>
      <td><span class="badge ${u.blocked ? 'badge--blocked' : 'badge--ok'}">${u.blocked ? 'Заблокирован' : 'Активен'}</span></td>
      <td>
        <div style="display:flex;gap:6px">
          ${!u.blocked ? `<button class="btn btn--danger btn--sm" onclick="blockUser(${u.id})">Блок</button>` : `<button class="btn btn--ghost btn--sm" onclick="unblockUser(${u.id})">Разблок</button>`}
          <select onchange="changeRole(${u.id}, this.value)" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:12px;cursor:pointer">
            <option value="">роль…</option>
            <option value="user">user</option>
            <option value="seller">seller</option>
            <option value="admin">admin</option>
          </select>
        </div>
      </td>
    </tr>
  `).join('');
}

async function blockUser(id) {
  await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
  loadUsers();
}

async function unblockUser(id) {
  await apiFetch(`/api/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ blocked: false }),
  });
  loadUsers();
}

async function changeRole(id, role) {
  if (!role) return;
  await apiFetch(`/api/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  });
  loadUsers();
}

// ── STATUS ────────────────────────────────────────────────────────────────

async function loadStatus() {
  const res = await fetch(API + '/status');
  const data = await res.json();
  const container = document.getElementById('statusCards');
  container.innerHTML = `
    <div class="statusCard">
      <p class="statusCard__name">Gateway</p>
      <p class="statusCard__state state--CLOSED">${data.gateway}</p>
      <p class="statusCard__meta">Единая точка входа — маршрутизирует к service_users и service_products</p>
    </div>
    ${(data.circuitBreakers || []).map(cb => `
      <div class="statusCard">
        <p class="statusCard__name">Circuit Breaker: ${cb.name}</p>
        <p class="statusCard__state state--${cb.state}">${cb.state}</p>
        <p class="statusCard__meta">Сбоев: ${cb.failures} / порог: 3 / восстановление: 10с</p>
      </div>
    `).join('')}
  `;
}

// ── INIT ──────────────────────────────────────────────────────────────────

(async function init() {
  if (accessToken) {
    await loadCurrentUser();
    if (currentUser) {
      enterApp();
      return;
    }
  }
  document.getElementById('authPage').classList.remove('hidden');
})();
