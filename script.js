(() => {
  const API_BASE     = 'https://fnode1.astrast.host:7172';
  const CLIENT_ID    = '1378637692169879632';
  const REDIRECT_URI = 'https://fnode1.astrast.host:7172/callback';
  const SCOPE        = 'identify email';

  let currentUser = null;
  let curYear, curMonth;

  const today = new Date();
  curYear  = today.getFullYear();
  curMonth = today.getMonth();

  function saveUserLocally(user) {
    if (user) sessionStorage.setItem('wc_user', JSON.stringify(user));
    else sessionStorage.removeItem('wc_user');
  }

  function loadUserLocally() {
    const raw = sessionStorage.getItem('wc_user');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return null;
  }

  function parseQuery(queryString) {
    const params = {};
    queryString.substring(1).split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      params[k] = decodeURIComponent(v);
    });
    return params;
  }

  async function handleDiscordRedirect() {
    const params = parseQuery(window.location.search);
    const code = params.code;
    if (code) {
      history.replaceState(null, '', window.location.pathname);
      try {
        const res = await fetch(`${API_BASE}/callback?code=${encodeURIComponent(code)}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        currentUser = {
          id: data.user.id,
          username: data.user.username,
          avatar: data.user.avatar,
          email: data.user.email,
          role: data.user.role
        };
        saveUserLocally(currentUser);
        renderUserInfo();
        renderCalendar();
      } catch (err) {
        alert('Échec connexion Discord : ' + err.message);
      }
    }
  }

  function renderUserInfo() {
    const container = document.getElementById('user-info');
    container.innerHTML = '';

    if (!currentUser) {
      const btn = document.createElement('button');
      btn.id = 'login-btn';
      btn.textContent = 'Se connecter avec Discord';
      btn.onclick = () => {
        window.location.href =
          `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}` +
          `&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
          `&scope=${encodeURIComponent(SCOPE)}`;
      };
      container.appendChild(btn);
      return;
    }

    const avatarUrl = currentUser.avatar
      ? `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png`
      : 'https://cdn.discordapp.com/embed/avatars/0.png';

    const img = document.createElement('img');
    img.src = avatarUrl;
    img.alt = 'Avatar';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = currentUser.username;

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = currentUser.role;

    const logoutBtn = document.createElement('button');
    logoutBtn.textContent = 'Déconnexion';
    logoutBtn.onclick = () => {
      currentUser = null;
      saveUserLocally(null);
      renderUserInfo();
      renderCalendar();
    };

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '8px';
    wrapper.append(img, nameSpan, badge, logoutBtn);

    container.appendChild(wrapper);
  }

  async function fetchEventsBackend(monthStr) {
    try {
      const res = await fetch(`${API_BASE}/events?month=${monthStr}`, {
        headers: {
          'X-User-Id': currentUser.id,
          'X-User-Role': currentUser.role
        }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      return data.events;
    } catch {
      return [];
    }
  }

  async function createEvent(date, title) {
    if (!currentUser) return;
    if (currentUser.role === 'creator' || currentUser.role === 'admin') {
      try {
        const res = await fetch(`${API_BASE}/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': currentUser.id,
            'X-User-Role': currentUser.role
          },
          body: JSON.stringify({ date, title })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        await renderCalendar();
      } catch (e) {
        alert('Erreur backend : ' + e.message);
      }
    }
  }

  async function validateEvent(id) {
    if (!currentUser || currentUser.role !== 'admin') return;
    try {
      const res = await fetch(`${API_BASE}/events/validate/${id}`, {
        method: 'POST',
        headers: {
          'X-User-Id': currentUser.id,
          'X-User-Role': currentUser.role
        }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      await renderCalendar();
    } catch {
      alert('Erreur validation backend');
    }
  }

  async function deleteEvent(id) {
    if (!currentUser || currentUser.role !== 'admin') return;
    try {
      const res = await fetch(`${API_BASE}/events/${id}`, {
        method: 'DELETE',
        headers: {
          'X-User-Id': currentUser.id,
          'X-User-Role': currentUser.role
        }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      await renderCalendar();
    } catch {
      alert('Erreur suppression backend');
    }
  }

  async function renderCalendar() {
    const container = document.getElementById('calendar-days');
    const headerEl  = document.getElementById('month-year');
    const date      = new Date(curYear, curMonth);
    const monthName = date.toLocaleString('fr-FR', { month: 'long' });
    headerEl.textContent = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${curYear}`;

    const firstDay = new Date(curYear, curMonth, 1).getDay();
    const offset   = firstDay === 0 ? 6 : firstDay - 1;
    const totalDays = new Date(curYear, curMonth + 1, 0).getDate();

    container.innerHTML = '';
    const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    dayNames.forEach(dn => {
      const header = document.createElement('div');
      header.style.cssText = 'padding:8px;text-align:center;font-weight:bold;background:#36393f;color:#fff;border:1px solid #444;';
      header.textContent = dn;
      container.appendChild(header);
    });

    for (let i = 0; i < offset; i++) {
      const empty = document.createElement('div');
      empty.className = 'day';
      container.appendChild(empty);
    }

    const monthStr = `${curYear}-${String(curMonth + 1).padStart(2, '0')}`;
    const events   = currentUser ? await fetchEventsBackend(monthStr) : [];

    for (let d = 1; d <= totalDays; d++) {
      const fullDate = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const cell     = document.createElement('div');
      cell.className = 'day';
      cell.dataset.date = fullDate;
      cell.innerHTML = `<strong>${d}</strong>`;

      if (currentUser && (currentUser.role === 'creator' || currentUser.role === 'admin')) {
        const btnAdd = document.createElement('button');
        btnAdd.textContent = '+';
        btnAdd.style.fontSize = '0.8rem';
        btnAdd.style.marginTop = '6px';
        btnAdd.onclick = () => {
          const title = prompt(`Titre événement pour ${fullDate} :`);
          if (title && title.trim()) createEvent(fullDate, title.trim());
        };
        cell.appendChild(btnAdd);
      }

      events.filter(e => e.date === fullDate).forEach(e => {
        const evDiv = document.createElement('div');
        evDiv.className = e.validated ? 'event' : 'event pending';
        evDiv.innerHTML = e.title + (!e.validated ? `<span> (⏳)</span>` : '');

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
            if (confirm('Supprimer cet événement ?')) deleteEvent(e.id);
          };
          evDiv.appendChild(btnDel);
        }
        cell.appendChild(evDiv);
      });

      container.appendChild(cell);
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
    currentUser = loadUserLocally();
    await handleDiscordRedirect();
    renderUserInfo();
    renderCalendar();
  });

  window.changeMonth = changeMonth;
})();
