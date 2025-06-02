(() => {
  const apiURL = 'https://fnode1.astrast.host:9467';
  const CLIENT_ID    = '1378637692169879632';
  const REDIRECT_URI = 'https://modo-de-sipho.github.io/waythes-calendrier/';
  const SCOPE        = 'identify%20email';

  let currentUser = null;
  const today      = new Date();
  let curYear  = today.getFullYear();
  let curMonth = today.getMonth();

  function parseHash(hash) {
    const params = {};
    hash.substring(1).split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      params[k] = v;
    });
    return params;
  }

  async function handleDiscordRedirect() {
    if (window.location.hash.includes('access_token=')) {
      const { access_token } = parseHash(window.location.hash);
      history.replaceState(null, '', window.location.pathname);
      try {
        const res = await fetch('https://discord.com/api/users/@me', {
          headers: { Authorization: `Bearer ${access_token}` }
        });
        if (!res.ok) throw new Error();
        const discordUser = await res.json();
        currentUser = {
          id:            discordUser.id,
          username:      discordUser.username + '#' + discordUser.discriminator,
          avatar:        discordUser.avatar,
          email:         discordUser.email,
          role:          'visitor'
        };
        const saveRes = await fetch(`${apiURL}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentUser)
        });
        if (saveRes.ok) {
          const data = await saveRes.json();
          currentUser = data.user;
          localStorage.setItem('wc_user', JSON.stringify(currentUser));
        }
      } catch {
        alert('Échec de la connexion Discord.');
      }
    }
  }

  function initUserFromStorage() {
    const raw = localStorage.getItem('wc_user');
    if (raw) {
      try {
        currentUser = JSON.parse(raw);
      } catch {
        currentUser = null;
      }
    }
  }

  function renderUserInfo() {
    const container = document.getElementById('user-info');
    if (!currentUser) {
      container.innerHTML = `<button id="login-btn">Se connecter avec Discord</button>`;
      document.getElementById('login-btn').onclick = () => {
        const url =
          `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}` +
          `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
          `&response_type=token` +
          `&scope=${SCOPE}`;
        window.location.href = url;
      };
    } else {
      const avatarUrl = currentUser.avatar
        ? `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png`
        : 'https://cdn.discordapp.com/embed/avatars/0.png';
      container.innerHTML = `
        <img src="${avatarUrl}" alt="Avatar" />
        <span><strong>${currentUser.username}</strong></span>
        <span class="badge">${currentUser.role}</span>
        <button id="logout-btn">Déconnexion</button>
      `;
      document.getElementById('logout-btn').onclick = () => {
        localStorage.removeItem('wc_user');
        currentUser = null;
        renderUserInfo();
        renderCalendar();
      };
    }
  }

  function apiFetch(path, options = {}) {
    const headers = options.headers || {};
    if (currentUser) {
      headers['X-User-Id']   = currentUser.id;
      headers['X-User-Role'] = currentUser.role;
    }
    return fetch(`${apiURL}${path}`, {
      ...options,
      headers,
      credentials: 'include'
    });
  }

  async function loadEvents(monthStr) {
    try {
      const res = await apiFetch(`/events?month=${monthStr}`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  async function createEvent(date, title) {
    const res = await apiFetch('/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, title })
    });
    if (!res.ok) {
      const err = await res.json();
      alert('Erreur création : ' + (err.error || res.status));
    } else {
      renderCalendar();
    }
  }

  async function validateEvent(id) {
    const res = await apiFetch(`/events/validate/${id}`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      alert('Erreur validation : ' + (err.error || res.status));
    } else {
      renderCalendar();
    }
  }

  async function deleteEvent(id) {
    const res = await apiFetch(`/events/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      alert('Erreur suppression : ' + (err.error || res.status));
    } else {
      renderCalendar();
    }
  }

  async function renderCalendar() {
    const calendarEl = document.getElementById('calendar-days');
    const headerEl   = document.getElementById('month-year');
    if (!calendarEl || !headerEl) return;
    const date = new Date(curYear, curMonth);
    const monthName = date.toLocaleString('default', { month: 'long' });
    headerEl.textContent = `${monthName} ${curYear}`;
    const firstDay  = new Date(curYear, curMonth, 1).getDay();
    const totalDays = new Date(curYear, curMonth + 1, 0).getDate();
    calendarEl.innerHTML = '';
    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement('div');
      empty.className = 'day';
      calendarEl.appendChild(empty);
    }
    const monthStr = `${curYear}-${String(curMonth + 1).padStart(2, '0')}`;
    const events   = await loadEvents(monthStr);
    for (let d = 1; d <= totalDays; d++) {
      const fullDate = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const cell = document.createElement('div');
      cell.className = 'day';
      cell.dataset.date = fullDate;
      cell.innerHTML = `<strong>${d}</strong>`;
      if (currentUser && (currentUser.role === 'creator' || currentUser.role === 'admin')) {
        const btnAdd = document.createElement('button');
        btnAdd.textContent = '+';
        btnAdd.style.fontSize  = '0.8rem';
        btnAdd.style.marginTop = '4px';
        btnAdd.onclick = () => {
          const title = prompt(`Titre de l’événement pour le ${fullDate} :`);
          if (title) createEvent(fullDate, title);
        };
        cell.appendChild(btnAdd);
      }
      const dayEvents = events.filter(e => e.date === fullDate);
      dayEvents.forEach(e => {
        const evDiv = document.createElement('div');
        evDiv.className = 'event';
        evDiv.innerHTML = `${e.title}` + (!e.validated ? `<span> (⏳)</span>` : '');
        if (currentUser && currentUser.role === 'admin') {
          if (!e.validated) {
            const btnVal = document.createElement('button');
            btnVal.textContent = '✔';
            btnVal.onclick = () => validateEvent(e.id);
            evDiv.appendChild(btnVal);
          }
          const btnDel = document.createElement('button');
          btnDel.textContent = '✖';
          btnDel.onclick = () => {
            if (confirm('Supprimer cet événement ?')) {
              deleteEvent(e.id);
            }
          };
          evDiv.appendChild(btnDel);
        }
        cell.appendChild(evDiv);
      });
      calendarEl.appendChild(cell);
    }
  }

  function changeMonth(delta) {
    curMonth += delta;
    if (curMonth < 0) {
      curMonth = 11;
      curYear--;
    } else if (curMonth > 11) {
      curMonth = 0;
      curYear++;
    }
    renderCalendar();
  }

  window.addEventListener('DOMContentLoaded', async () => {
    initUserFromStorage();
    await handleDiscordRedirect();
    renderUserInfo();
    renderCalendar();
  });

  window.changeMonth   = changeMonth;
  window.validateEvent = validateEvent;
  window.deleteEvent   = deleteEvent;
  window.createEvent   = createEvent;
})();
