
(() => {

  const API_BASE = 'http://localhost:9467'; 7".

  let currentUser    = null;
  let isBackendMode  = false;
  let curYear, curMonth;

  // Récupère la date d'aujourd'hui
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

  function updateStatusIndicator() {
    const indicator = document.getElementById('status-indicator');
    const toggleBtn = document.getElementById('mode-toggle');

    if (isBackendMode) {
      indicator.textContent = 'Mode Backend';
      indicator.classList.remove('status-offline');
      indicator.classList.add('status-online');
      toggleBtn.textContent = 'Basculer vers Local';
    } else {
      indicator.textContent = 'Mode Local';
      indicator.classList.remove('status-online');
      indicator.classList.add('status-offline');
      toggleBtn.textContent = 'Basculer vers Backend';
    }
  }


  function renderUserInfo() {
    const container = document.getElementById('user-info');
    container.innerHTML = '';

    if (!currentUser) {
      if (isBackendMode) {
        const loginBtn = document.createElement('button');
        loginBtn.id = 'login-btn';
        loginBtn.textContent = 'Se connecter (simulé)';
        loginBtn.onclick = () => {

          const fakeUser = {
            id: String(Date.now()),
            username: 'DiscordUser#1234',
            avatar: null,
            email: null,
            role: 'visitor'
          };
          currentUser = fakeUser;
          saveUserLocally(currentUser);
          renderUserInfo();
          renderCalendar();
        };
        container.appendChild(loginBtn);
      } else {
        // Mode local: formulaire de login simple
        container.innerHTML = `
          <div id="login-section">
            <div id="login-form">
              <input type="text" id="username-input" placeholder="Nom d'utilisateur" />
              <select id="role-select">
                <option value="visitor">Visiteur</option>
                <option value="creator">Créateur</option>
                <option value="admin">Admin</option>
              </select>
              <button id="login-btn">Se connecter</button>
            </div>
          </div>
        `;
        document.getElementById('login-btn').onclick = () => {
          const username = document.getElementById('username-input').value.trim();
          const role = document.getElementById('role-select').value;
          if (!username) {
            alert('Veuillez entrer un nom d\'utilisateur 😅');
            return;
          }
          currentUser = { id: Date.now().toString(), username, role };
          saveUserLocally(currentUser);
          renderUserInfo();
          renderCalendar();
        };
      }
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

  function getEventsLocal() {
    const stored = sessionStorage.getItem('wc_events');
    return stored ? JSON.parse(stored) : [];
  }
  function saveEventsLocal(evtList) {
    sessionStorage.setItem('wc_events', JSON.stringify(evtList));
  }

  async function fetchEventsBackend(monthStr) {
    if (!currentUser) throw new Error('Utilisateur non connecté');
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
    } catch (e) {
      console.warn("⚠️ Problème backend, je retombe en local :", e.message);
      return getEventsLocal().filter(e => e.date.startsWith(monthStr));
    }
  }

  async function createEvent(date, title) {
    if (isBackendMode && currentUser && (currentUser.role === 'creator' || currentUser.role === 'admin')) {
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
        return;
      } catch (e) {
        alert('Erreur backend : ' + e.message);
        return;
      }
    }

    const events = getEventsLocal();
    const newEvent = {
      id: Date.now().toString(),
      date,
      title,
      validated: (currentUser.role === 'admin'),
      creatorId: currentUser.id
    };
    events.push(newEvent);
    saveEventsLocal(events);
    renderCalendar();
  }

  async function validateEvent(id) {
    if (isBackendMode && currentUser && currentUser.role === 'admin') {
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
        return;
      } catch (e) {
        alert('Erreur validation backend : ' + e.message);
        return;
      }
    }

    const events = getEventsLocal();
    const ev = events.find(e => e.id === id);
    if (ev) {
      ev.validated = true;
      saveEventsLocal(events);
      renderCalendar();
    }
  }

  async function deleteEvent(id) {
    if (isBackendMode && currentUser && currentUser.role === 'admin') {
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
        return;
      } catch (e) {
        alert('Erreur suppression backend : ' + e.message);
        return;
      }
    }

    const events = getEventsLocal();
    const filtered = events.filter(e => e.id !== id);
    saveEventsLocal(filtered);
    renderCalendar();
  }

  async function renderCalendar() {
    const container = document.getElementById('calendar-days');
    const headerEl = document.getElementById('month-year');
    if (!container || !headerEl) return;

    const date = new Date(curYear, curMonth);
    const monthNameFR = date.toLocaleString('fr-FR', { month: 'long' });
    headerEl.textContent = `${monthNameFR.charAt(0).toUpperCase() + monthNameFR.slice(1)} ${curYear}`;

    const firstDay = new Date(curYear, curMonth, 1).getDay();
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
    const totalDays = new Date(curYear, curMonth + 1, 0).getDate();

    container.innerHTML = '';

    const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    dayNames.forEach(dn => {
      const header = document.createElement('div');
      header.style.cssText = 'padding: 8px; text-align: center; font-weight: bold; background: #36393f; border: 1px solid #444;';
      header.textContent = dn;
      container.appendChild(header);
    });

    // Cases vides pour décalage
    for (let i = 0; i < adjustedFirstDay; i++) {
      const empty = document.createElement('div');
      empty.className = 'day';
      container.appendChild(empty);
    }

    const monthStr = `${curYear}-${String(curMonth + 1).padStart(2, '0')}`;
    const events = await (isBackendMode ? fetchEventsBackend(monthStr) : Promise.resolve(getEventsLocal().filter(e => e.date.startsWith(monthStr))));

    for (let d = 1; d <= totalDays; d++) {
      const fullDate = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const cell = document.createElement('div');
      cell.className = 'day';
      cell.dataset.date = fullDate;
      cell.innerHTML = `<strong>${d}</strong>`;

      if (currentUser && (currentUser.role === 'creator' || currentUser.role === 'admin')) {
        const btnAdd = document.createElement('button');
        btnAdd.textContent = '+';
        btnAdd.style.fontSize = '0.8rem';
        btnAdd.style.marginTop = '4px';
        btnAdd.onclick = () => {
          const title = prompt(`Titre événement pour ${fullDate} :`);
          if (title && title.trim()) createEvent(fullDate, title.trim());
        };
        cell.appendChild(btnAdd);
      }

      const dayEvents = events.filter(e => e.date === fullDate);
      dayEvents.forEach(e => {
        const evDiv = document.createElement('div');
        evDiv.className = e.validated ? 'event' : 'event pending';
        evDiv.innerHTML = `${e.title}` + (!e.validated ? `<span> (⏳)</span>` : '');

        if (currentUser && currentUser.role === 'admin') {
          if (!e.validated) {
            const btnVal = document.createElement('button');
            btnVal.textContent = '✔';
            btnVal.title = 'Valider';
            btnVal.onclick = () => validateEvent(e.id);
            evDiv.appendChild(btnVal);
          }
          const btnDel = document.createElement('button');
          btnDel.textContent = '✖';
          btnDel.title = 'Supprimer';
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


  async function toggleMode() {
    if (!isBackendMode) {
      try {
        const res = await fetch(`${API_BASE}/admin/users`, {
          method: 'GET',
          headers: { 
            'X-User-Id': 'test', 
            'X-User-Role': 'admin' 
          }
        });
        if (!res.ok) throw new Error('Backend non disponible');
        isBackendMode = true;
        currentUser = null;
      } catch (e) {
        alert('Le backend est indisponible. On reste en mode local 😅');
        isBackendMode = false;
      }
    } else {
      isBackendMode = false;
      currentUser = null;
    }
    updateStatusIndicator();
    renderUserInfo();
    renderCalendar();
  }

  window.addEventListener('DOMContentLoaded', async () => {
    currentUser = loadUserLocally();

    document.getElementById('mode-toggle').onclick = toggleMode;

    updateStatusIndicator();
    renderUserInfo();
    renderCalendar();
  });

  window.changeMonth = changeMonth;
})();
