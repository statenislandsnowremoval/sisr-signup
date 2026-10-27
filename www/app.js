const STORAGE_KEY = 'sisr_signups_local';
const ALERTS_KEY = 'sisr_storm_alerts_opt_in';
const PROPERTY_KEY = 'sisr_property_profile';
const REQUESTS_KEY = 'sisr_requests';
const REWARDS_KEY = 'sisr_rewards';
const REWARDS_GOAL = 5;

function apiBase() {
  const raw = (window.SISR_CONFIG && window.SISR_CONFIG.API_BASE_URL) || '';
  return String(raw).replace(/\/$/, '');
}

function isNativeApp() {
  try {
    if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function') {
      return window.Capacitor.isNativePlatform();
    }
  } catch (_) {}
  const proto = window.location.protocol || '';
  return proto === 'capacitor:' || proto === 'ionic:';
}

function apiUrl(path) {
  const base = apiBase();
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!base) return p;
  return `${base}${p}`;
}

function showMsg(el, text, type) {
  if (!el) return;
  el.textContent = text;
  el.className = `msg show ${type}`;
}

function hideMsg(el) {
  if (!el) return;
  el.className = 'msg';
  el.textContent = '';
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (_) {
    return false;
  }
}

function saveLocal(signup) {
  try {
    const list = readJson(STORAGE_KEY, []);
    list.push(signup);
    writeJson(STORAGE_KEY, list);
  } catch (_) {
    /* ignore quota / private mode */
  }
}

function makeConfirmationId() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `SI-${Date.now().toString(36).toUpperCase()}-${n}`;
}

/* ---------- Rewards (Boro Winter Stamps) ---------- */
function readRewards() {
  const data = readJson(REWARDS_KEY, null);
  if (data && typeof data.stamps === 'number') {
    return {
      stamps: Math.max(0, data.stamps),
      history: Array.isArray(data.history) ? data.history : [],
      claimed: !!data.claimed
    };
  }
  return { stamps: 0, history: [], claimed: false };
}

function writeRewards(data) {
  writeJson(REWARDS_KEY, data);
}

function awardStamp(reason) {
  const rewards = readRewards();
  const before = rewards.stamps;
  rewards.stamps = Math.min(REWARDS_GOAL, rewards.stamps + 1);
  rewards.history.push({
    at: new Date().toISOString(),
    reason: reason || 'request',
    stampsAfter: rewards.stamps
  });
  writeRewards(rewards);
  return {
    awarded: rewards.stamps > before,
    stamps: rewards.stamps,
    goal: REWARDS_GOAL,
    filled: rewards.stamps >= REWARDS_GOAL
  };
}

function renderRewards() {
  const rewards = readRewards();
  const row = document.getElementById('stampRow');
  const progress = document.getElementById('rewardsProgress');
  const prize = document.getElementById('rewardsPrize');
  if (row) {
    row.innerHTML = '';
    for (let i = 0; i < REWARDS_GOAL; i++) {
      const stamp = document.createElement('span');
      stamp.className = 'stamp' + (i < rewards.stamps ? ' is-filled' : '');
      stamp.setAttribute('aria-hidden', 'true');
      stamp.title = i < rewards.stamps ? `Stamp ${i + 1} earned` : `Stamp ${i + 1} empty`;
      stamp.textContent = i < rewards.stamps ? '❄' : '';
      row.appendChild(stamp);
    }
  }
  if (progress) {
    if (rewards.stamps >= REWARDS_GOAL) {
      progress.textContent = `${REWARDS_GOAL} of ${REWARDS_GOAL} stamps — card complete`;
    } else {
      progress.textContent = `${rewards.stamps} of ${REWARDS_GOAL} stamps · ${REWARDS_GOAL - rewards.stamps} to go`;
    }
  }
  if (prize) {
    prize.hidden = rewards.stamps < REWARDS_GOAL;
  }
}

/* ---------- Property profile ---------- */
function readProperty() {
  return readJson(PROPERTY_KEY, {
    name: '',
    address: '',
    notes: '',
    preferredContact: ''
  });
}

function writeProperty(profile) {
  return writeJson(PROPERTY_KEY, profile);
}

function fillPropertyForm() {
  const form = document.getElementById('propertyForm');
  if (!form) return;
  const p = readProperty();
  const name = document.getElementById('propName');
  const address = document.getElementById('propAddress');
  const notes = document.getElementById('propNotes');
  if (name) name.value = p.name || '';
  if (address) address.value = p.address || '';
  if (notes) notes.value = p.notes || '';
  form.querySelectorAll('input[name="propContact"]').forEach((input) => {
    input.checked = input.value === (p.preferredContact || '');
  });
}

function initPropertyForm() {
  const form = document.getElementById('propertyForm');
  const msg = document.getElementById('propertyMsg');
  if (!form) return;
  fillPropertyForm();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    hideMsg(msg);
    const fd = new FormData(form);
    const profile = {
      name: String(fd.get('propName') || '').trim(),
      address: String(fd.get('propAddress') || '').trim(),
      notes: String(fd.get('propNotes') || '').trim(),
      preferredContact: String(fd.get('propContact') || '').trim(),
      updatedAt: new Date().toISOString()
    };
    if (!profile.address) {
      showMsg(msg, 'Add your Staten Island address so we know where to clear.', 'error');
      return;
    }
    if (!writeProperty(profile)) {
      showMsg(msg, 'Could not save on this device. Check storage settings.', 'error');
      return;
    }
    showMsg(msg, 'Property saved on this phone. You’re set for the next storm.', 'success');
  });
}

/* ---------- Requests ---------- */
function readRequests() {
  const list = readJson(REQUESTS_KEY, []);
  return Array.isArray(list) ? list : [];
}

function writeRequests(list) {
  writeJson(REQUESTS_KEY, list);
}

function addRequestStub(payload, confirmationId) {
  const list = readRequests();
  const stub = {
    id: confirmationId,
    status: 'new',
    type: 'winter_list',
    name: payload.name || '',
    address: payload.address || '',
    email: payload.email || '',
    phone: payload.phone || '',
    preferredContact: payload.preferredContact || '',
    serviceType: payload.serviceType || '',
    notes: payload.notes || '',
    createdAt: new Date().toISOString()
  };
  list.unshift(stub);
  writeRequests(list);
  return stub;
}

function statusLabel(status) {
  const map = {
    new: 'New',
    contacted: 'Contacted',
    scheduled: 'Scheduled',
    done: 'Done'
  };
  return map[status] || 'New';
}

function formatRequestDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  } catch (_) {
    return iso || '';
  }
}

function renderRequests() {
  const listEl = document.getElementById('requestList');
  const emptyEl = document.getElementById('requestEmpty');
  if (!listEl) return;
  const list = readRequests();
  listEl.innerHTML = '';
  if (!list.length) {
    if (emptyEl) emptyEl.hidden = false;
    return;
  }
  if (emptyEl) emptyEl.hidden = true;
  list.forEach((req) => {
    const li = document.createElement('li');
    li.className = 'request-item';
    const title = document.createElement('div');
    title.className = 'request-id';
    title.textContent = req.id || 'Request';
    const meta = document.createElement('div');
    meta.className = 'request-meta';
    const bits = [
      statusLabel(req.status),
      req.serviceType || 'Winter list',
      formatRequestDate(req.createdAt)
    ].filter(Boolean);
    meta.textContent = bits.join(' · ');
    const addr = document.createElement('div');
    addr.className = 'request-address';
    addr.textContent = req.address || 'Address on file';
    li.appendChild(title);
    li.appendChild(meta);
    li.appendChild(addr);
    listEl.appendChild(li);
  });
}

function refreshAccountScreen() {
  renderRewards();
  fillPropertyForm();
  renderRequests();
}

/* ---------- Navigation ---------- */
const SCREENS = ['home', 'signup', 'services', 'area', 'alerts', 'contact', 'account', 'about', 'privacy'];

function showScreen(name) {
  const target = SCREENS.includes(name) ? name : 'home';
  SCREENS.forEach((id) => {
    const el = document.getElementById(`screen-${id}`);
    if (!el) return;
    const active = id === target;
    el.classList.toggle('is-active', active);
    if (active) {
      el.removeAttribute('hidden');
    } else {
      el.setAttribute('hidden', '');
    }
  });
  window.scrollTo(0, 0);
  if (target === 'account') refreshAccountScreen();
  if (location.hash !== `#${target}`) {
    try {
      history.replaceState(null, '', `#${target}`);
    } catch (_) {
      location.hash = target;
    }
  }
}

function screenFromHash() {
  const h = (location.hash || '').replace(/^#/, '');
  return SCREENS.includes(h) ? h : 'home';
}

document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-nav]');
  if (!nav) return;
  e.preventDefault();
  showScreen(nav.getAttribute('data-nav'));
});

window.addEventListener('hashchange', () => {
  showScreen(screenFromHash());
});

/* ---------- Home carousel (soft cover-flow peek) ---------- */
(function initHomeCarousel() {
  const root = document.getElementById('homeCarousel');
  const viewport = document.getElementById('homeCarouselViewport');
  const track = document.getElementById('homeCarouselTrack');
  const slides = Array.from(track ? track.querySelectorAll('.carousel-slide') : []);
  const dots = Array.from(document.querySelectorAll('#homeCarouselDots .carousel-dot'));
  if (!root || !viewport || !track || !dots.length || !slides.length) return;

  const COUNT = dots.length;
  // Must match .carousel-slide flex-basis in styles.css
  const SLIDE_RATIO = 0.52;
  let index = 0;
  let dragX = 0;
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let lockedAxis = null; // 'x' | 'y' | null
  let moved = false;
  let width = 0;
  let slideW = 0;

  function measure() {
    width = viewport.clientWidth || root.clientWidth || 1;
    const first = slides[0];
    slideW = first ? first.getBoundingClientRect().width : width * SLIDE_RATIO;
    if (!slideW) slideW = width * SLIDE_RATIO;
  }

  function centerOffsetFor(i) {
    // Center the active slide in the viewport; neighbors peek on both sides
    return (width - slideW) / 2 - i * slideW;
  }

  function nearestIndexFromDrag() {
    if (!slideW) return index;
    const raw = index - dragX / slideW;
    return Math.max(0, Math.min(COUNT - 1, Math.round(raw)));
  }

  function syncSlideClasses(activeIdx) {
    slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === activeIdx);
    });
  }

  function applyTransform(withTransition) {
    track.classList.toggle('is-dragging', !withTransition);
    const offset = centerOffsetFor(index) + dragX;
    track.style.transform = `translate3d(${offset}px, 0, 0)`;
    // Soft live peek: highlight nearest while dragging
    syncSlideClasses(dragging ? nearestIndexFromDrag() : index);
  }

  function setIndex(next, { animate = true } = {}) {
    index = Math.max(0, Math.min(COUNT - 1, next));
    dragX = 0;
    applyTransform(animate);
    syncSlideClasses(index);
    dots.forEach((dot, i) => {
      const on = i === index;
      dot.classList.toggle('is-active', on);
      dot.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    root.setAttribute('aria-label', `Main menu, item ${index + 1} of ${COUNT}`);
  }

  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      const i = Number(dot.getAttribute('data-carousel-index'));
      if (!Number.isNaN(i)) setIndex(i);
    });
  });

  // Suppress accidental nav tap after a swipe
  track.addEventListener(
    'click',
    (e) => {
      if (!moved) return;
      const orb = e.target.closest('[data-nav]');
      if (!orb) return;
      e.preventDefault();
      e.stopPropagation();
    },
    true
  );

  function onPointerDown(clientX, clientY) {
    measure();
    dragging = true;
    moved = false;
    lockedAxis = null;
    startX = clientX;
    startY = clientY;
    dragX = 0;
    viewport.classList.add('is-dragging');
    applyTransform(false);
  }

  function onPointerMove(clientX, clientY) {
    if (!dragging) return;
    const dx = clientX - startX;
    const dy = clientY - startY;
    if (!lockedAxis) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      lockedAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (lockedAxis === 'y') return;
    moved = Math.abs(dx) > 8;
    // Rubber-band a little at ends
    let next = dx;
    if ((index === 0 && dx > 0) || (index === COUNT - 1 && dx < 0)) {
      next = dx * 0.35;
    }
    dragX = next;
    applyTransform(false);
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    viewport.classList.remove('is-dragging');
    const threshold = Math.max(36, slideW * 0.22);
    let next = index;
    if (lockedAxis === 'x' && Math.abs(dragX) > threshold) {
      next = dragX < 0 ? index + 1 : index - 1;
    } else if (lockedAxis === 'x') {
      next = nearestIndexFromDrag();
    }
    setIndex(next, { animate: true });
    // Keep moved true briefly so the synthetic click is ignored
    if (moved) {
      setTimeout(() => {
        moved = false;
      }, 280);
    }
  }

  viewport.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) return;
      onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
    },
    { passive: true }
  );
  viewport.addEventListener(
    'touchmove',
    (e) => {
      if (!dragging) return;
      if (lockedAxis === 'x') e.preventDefault();
      onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
    },
    { passive: false }
  );
  viewport.addEventListener('touchend', onPointerUp, { passive: true });
  viewport.addEventListener('touchcancel', onPointerUp, { passive: true });

  viewport.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    onPointerDown(e.clientX, e.clientY);
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    onPointerMove(e.clientX, e.clientY);
  });
  window.addEventListener('mouseup', onPointerUp);

  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setIndex(index + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setIndex(index - 1);
    }
  });
  if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '0');

  window.addEventListener('resize', () => {
    measure();
    applyTransform(false);
  });

  measure();
  setIndex(0, { animate: false });
})();

/* ---------- Signup form ---------- */
const form = document.getElementById('signupForm');
const formCard = document.getElementById('formCard');
const successCard = document.getElementById('successCard');
const formMsg = document.getElementById('formMsg');
const submitBtn = document.getElementById('submitBtn');
const anotherBtn = document.getElementById('anotherBtn');
const successRewardNote = document.getElementById('successRewardNote');
const successRequestNote = document.getElementById('successRequestNote');

function afterSignupSuccess(payload, signupRecord) {
  const confirmationId =
    (signupRecord && (signupRecord.confirmationId || signupRecord.id)) || makeConfirmationId();

  // Seed / refresh saved property from this signup
  const existing = readProperty();
  writeProperty({
    name: payload.name || existing.name || '',
    address: payload.address || existing.address || '',
    notes: payload.notes || existing.notes || '',
    preferredContact: payload.preferredContact || existing.preferredContact || '',
    updatedAt: new Date().toISOString()
  });

  addRequestStub(payload, confirmationId);
  const stampResult = awardStamp('winter_list');

  if (successRequestNote) {
    successRequestNote.hidden = false;
    successRequestNote.textContent = `Confirmation ID: ${confirmationId} — saved under My account.`;
  }
  if (successRewardNote) {
    successRewardNote.hidden = false;
    if (stampResult.filled) {
      successRewardNote.textContent =
        '❄ Stamp card complete! Ask the crew about a free driveway touch-up or priority storm slot.';
    } else if (stampResult.awarded) {
      successRewardNote.textContent = `❄ +1 Boro Winter Stamp · ${stampResult.stamps} of ${stampResult.goal}. Keep stacking for a free touch-up or priority storm slot.`;
    } else {
      successRewardNote.textContent = `❄ Stamp card already full (${stampResult.goal}/${stampResult.goal}).`;
    }
  }
}

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMsg(formMsg);

    const fd = new FormData(form);
    const preferredContact = fd.get('preferredContact');
    const serviceType = fd.get('serviceType');

    const payload = {
      name: String(fd.get('name') || '').trim(),
      address: String(fd.get('address') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      preferredContact,
      serviceType,
      notes: String(fd.get('notes') || '').trim()
    };

    if (!payload.name || !payload.address || !payload.email || !payload.phone) {
      showMsg(formMsg, 'Please fill in name, address, email, and phone.', 'error');
      return;
    }
    if (!preferredContact) {
      showMsg(formMsg, 'Please choose a preferred contact method.', 'error');
      return;
    }
    if (!serviceType) {
      showMsg(formMsg, 'Please choose a service type.', 'error');
      return;
    }

    if (isNativeApp() && !apiBase()) {
      showMsg(
        formMsg,
        'App is not pointed at a live server yet. Set API_BASE_URL in www/config.js to your hosted HTTPS API, then rebuild.',
        'error'
      );
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    try {
      const res = await fetch(apiUrl('/api/signups'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        const err =
          (data.errors && data.errors.join(' ')) || data.error || 'Could not save. Try again.';
        showMsg(formMsg, err, 'error');
        return;
      }
      const signupRecord = data.signup || { ...payload, id: makeConfirmationId() };
      saveLocal(signupRecord);
      afterSignupSuccess(payload, signupRecord);
      form.reset();
      formCard.hidden = true;
      successCard.hidden = false;
    } catch (_) {
      // Web demo / offline: still create local request + stamp so My account grows
      const localSignup = {
        ...payload,
        id: makeConfirmationId(),
        createdAt: new Date().toISOString()
      };
      saveLocal(localSignup);
      afterSignupSuccess(payload, localSignup);
      form.reset();
      formCard.hidden = true;
      successCard.hidden = false;
      if (successRequestNote) {
        successRequestNote.textContent +=
          ' (Saved on this phone — server unreachable, so email may not have gone out yet.)';
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Join winter list';
    }
  });
}

if (anotherBtn) {
  anotherBtn.addEventListener('click', () => {
    successCard.hidden = true;
    formCard.hidden = false;
    hideMsg(formMsg);
    if (successRewardNote) {
      successRewardNote.hidden = true;
      successRewardNote.textContent = '';
    }
    if (successRequestNote) {
      successRequestNote.hidden = true;
      successRequestNote.textContent = '';
    }
  });
}

/* ---------- Storm alerts ---------- */
const alertToggle = document.getElementById('alertToggle');
const alertStatus = document.getElementById('alertStatus');
const alertMsg = document.getElementById('alertMsg');

function readAlertsOptIn() {
  try {
    return localStorage.getItem(ALERTS_KEY) === '1';
  } catch (_) {
    return false;
  }
}

function writeAlertsOptIn(on) {
  try {
    localStorage.setItem(ALERTS_KEY, on ? '1' : '0');
  } catch (_) {
    /* ignore */
  }
}

function syncAlertUI() {
  const on = readAlertsOptIn();
  if (alertToggle) {
    alertToggle.setAttribute('aria-checked', on ? 'true' : 'false');
  }
  if (alertStatus) {
    alertStatus.textContent = on
      ? 'On — preference saved on this device'
      : 'Currently off';
  }
}

if (alertToggle) {
  syncAlertUI();
  alertToggle.addEventListener('click', () => {
    const next = !readAlertsOptIn();
    writeAlertsOptIn(next);
    syncAlertUI();
    if (next) {
      showMsg(
        alertMsg,
        'You’re opted in. Push / text storm notices will activate with the store build — we’ll keep watching Staten Island forecasts.',
        'success'
      );
    } else {
      showMsg(alertMsg, 'Storm alerts turned off on this device.', 'success');
    }
  });
}

/* ---------- Account boot ---------- */
initPropertyForm();
refreshAccountScreen();

/* ---------- Splash → home ---------- */
(function initSplash() {
  const splash = document.getElementById('splash');
  const startScreen = screenFromHash();
  // Always land on home after a fresh open unless user deep-linked
  if (!location.hash || location.hash === '#') {
    showScreen('home');
  } else {
    showScreen(startScreen);
  }

  if (!splash) return;

  const finish = () => {
    splash.classList.add('is-gone');
    splash.removeEventListener('transitionend', onEnd);
  };

  const onEnd = (e) => {
    if (e.target !== splash || e.propertyName !== 'opacity') return;
    finish();
  };

  splash.addEventListener('transitionend', onEnd);

  setTimeout(() => {
    splash.classList.add('is-hiding');
  }, 1000);

  setTimeout(finish, 2400);
})();

/* ---------- PWA service worker (web / Add to Home Screen only) ---------- */
(function registerSw() {
  if (!('serviceWorker' in navigator)) return;
  try {
    if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
      return;
    }
  } catch (_) {}
  const proto = window.location.protocol || '';
  if (proto === 'capacitor:' || proto === 'ionic:' || proto === 'file:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
})();
