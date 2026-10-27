const PASS_KEY = 'sisr_admin_password';
let signupsCache = [];

const loginView = document.getElementById('loginView');
const adminView = document.getElementById('adminView');
const loginForm = document.getElementById('loginForm');
const loginMsg = document.getElementById('loginMsg');
const tbody = document.getElementById('tbody');
const search = document.getElementById('search');
const countLine = document.getElementById('countLine');
const adminMsg = document.getElementById('adminMsg');

function getPassword() {
  return sessionStorage.getItem(PASS_KEY) || '';
}

function setPassword(p) {
  sessionStorage.setItem(PASS_KEY, p);
}

function clearPassword() {
  sessionStorage.removeItem(PASS_KEY);
}

function showMsg(el, text, type) {
  el.textContent = text;
  el.className = `msg show ${type}`;
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

function render(list) {
  tbody.innerHTML = '';
  countLine.textContent = `${list.length} signup${list.length === 1 ? '' : 's'}`;
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty">No signups yet.</td></tr>`;
    return;
  }
  for (const s of list) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(formatDate(s.createdAt))}</td>
      <td>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.address)}</td>
      <td>${escapeHtml(s.email)}</td>
      <td>${escapeHtml(s.phone)}</td>
      <td>${escapeHtml(s.preferredContact)}</td>
      <td>${escapeHtml(s.serviceType)}</td>
      <td>${escapeHtml(s.notes || '')}</td>
    `;
    tbody.appendChild(tr);
  }
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function filtered() {
  const q = (search.value || '').trim().toLowerCase();
  if (!q) return signupsCache;
  return signupsCache.filter((s) => {
    const blob = [s.name, s.address, s.email, s.phone, s.preferredContact, s.serviceType, s.notes]
      .join(' ')
      .toLowerCase();
    return blob.includes(q);
  });
}

async function loadSignups() {
  const password = getPassword();
  const res = await fetch('/api/signups', {
    headers: { 'x-admin-password': password }
  });
  if (res.status === 401) {
    clearPassword();
    adminView.hidden = true;
    loginView.hidden = false;
    showMsg(loginMsg, 'Wrong password.', 'error');
    return;
  }
  const data = await res.json();
  signupsCache = data.signups || [];
  render(filtered());
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('password').value;
  setPassword(password);
  try {
    await loadSignups();
    if (getPassword()) {
      loginView.hidden = true;
      adminView.hidden = false;
    }
  } catch {
    showMsg(loginMsg, 'Could not reach server.', 'error');
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  clearPassword();
  adminView.hidden = true;
  loginView.hidden = false;
  document.getElementById('password').value = '';
});

document.getElementById('refreshBtn').addEventListener('click', () => {
  loadSignups().catch(() => showMsg(adminMsg, 'Refresh failed.', 'error'));
});

document.getElementById('exportBtn').addEventListener('click', () => {
  const password = encodeURIComponent(getPassword());
  window.location.href = `/api/signups/export.csv?password=${password}`;
});

search.addEventListener('input', () => render(filtered()));

if (getPassword()) {
  loginView.hidden = true;
  adminView.hidden = false;
  loadSignups().catch(() => {
    clearPassword();
    adminView.hidden = true;
    loginView.hidden = false;
  });
}
