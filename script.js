// script.js

(() => {
  // ------------------------ Config ------------------------
  // URL de l’API backend
  const apiURL = 'https://fnode1.astrast.host:9467';

  // Discord OAuth2 config (Authorization Code Flow)
  const CLIENT_ID    = '1378637692169879632';
  const REDIRECT_URI = 'https://modo-de-sipho.github.io/waythes-calendrier/';
  const SCOPE        = 'identify email';

  let currentUser = null; 
  const today      = new Date();
  let curYear  = today.getFullYear();
  let curMonth = today.getMonth(); // 0..11

  // ---------------- Utilitaires URL ----------------

  function getQueryParams() {
    const params = {};
    const queryString = window.location.search.substring(1);
    if (!queryString) return params;
    queryString.split('&').forEach(pair => {
      const [key, value] = pair.split('=');
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    });
    return params;
  }

  function clearQueryString() {
    history.replaceState(null, '', window.location.pathname);
  }

  // ---------------- Initialisation de currentUser depuis l’URL ----------------

  function initUserFromQuery() {
    const params = getQueryParams();
    if (params.id && params.username && params.role) {
      // Construire l’objet utilisateur basé sur les paramètres renvoyés par le backend
      currentUser = {
        id: params.id,
        username: params.username,
        avatar: params.avatar || null, // avatar peut être vide
        role: params.role
      };
      // Sauvegarder dans localStorage pour persister entre reloads
      localStorage.setItem('wd_user', JSON.stringify(currentUser));
      clearQueryString();
    } else {
      // Sinon, on tente de charger depuis localStorage
      const raw = localStorage.getItem('wd_user');
      if (raw) {
        try {
          currentUser = JSON.parse(raw);
        } catch {
          currentUser = null;
        }
      }
    }
  }

  // ---------------- Fonction “Se connecter” ----------------

  function loginWithDiscord() {
    // Construire l’URL Authorization Code Flow
    const url =
      `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(SCOPE)}`;
    window.location.href = url;
  }

  // ---------------- Fonction “Déconnexion” ----------------

  function logout() {
    localStorage.removeItem('wd_user');
    currentUser = null;
    renderUserInfo();
    renderCalendar();
  }

  // ---------------- Fonctions appels API ----------------

  function apiFetch(path, options = {}) {
    // Ajoute les en-têtes X-User-Id et X-User-Role pour que le backend sache qui fait la requête.
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
    const res = await apiFetch(`/events`, {
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
    const res = await apiFetch(`/events/validate/${id}`, {
      method: 'POST'
    });
    if (!res.ok) {
      const err = await res.json();
      alert('Erreur validation : ' + (err.error || res.status));
    } else {
      renderCalendar();
    }
  }

  async function deleteEvent(id) {
    const res = await apiFetch(`/events/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json();
      alert('Erreur suppression : ' + (err.error || res.status));
    } else {
      renderCalendar();
    }
  }

  // ---------------- Affichage Utilisateur ----------------

  function renderUserInfo() {
    const container = document.getElementById('user-info');

    if (!currentUser) {
      // Afficher le bouton “Se connecter avec Discord”
      container.innerHTML = `
        <button id="login-btn">Se connecter avec Discord</button>
      `;
      document.getElementById('login-btn').onclick = loginWithDiscord;
    } else {
      // Afficher avatar, pseudo, rôle et bouton “Déconnexion”
      const avatarUrl = currentUser.avatar
        ? `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png`
        : 'https://cdn.discordapp.com/embed/avatars/0.png';
      container.innerHTML = `
        <img src="${avatarUrl}" alt="Avatar" />
        <span><strong>${currentUser.username}</strong></span>
        <span class="badge">${currentUser.role}</span>
        <button id="logout-btn">Déconnexion</button>
      `;
      document.getElementById('logout-btn').onclick = logout;
    }
  }

  // ---------------- Affichage Calendrier ----------------

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
    // Cases vides jusqu’au premier jour
    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement('div');
      empty.className = 'day';
      calendarEl.appendChild(empty);
    }

    const monthStr = `${curYear}-${String(curMonth + 1).padStart(2, '0')}`;
    const events   = await loadEvents(monthStr);

    for (let d = 1; d <= totalDays; d++) {
      const fullDate = `${curYear}-${String(curMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const cell = document.createElement('div');
      cell.className = 'day';
      cell.dataset.date = fullDate;
      cell.innerHTML = `<strong>${d}</strong>`;

      // Si connecté et rôle = creator ou admin → bouton “+”
      if (currentUser && (currentUser.role === 'creator' || currentUser.role === 'admin')) {
        const btnAdd = document.createElement('button');
        btnAdd.textContent = '+';
        btnAdd.style.fontSize   = '0.8rem';
        btnAdd.style.marginTop  = '4px';
        btnAdd.onclick = () => {
          const title = prompt(`Titre de l’événement pour le ${fullDate} :`);
          if (title) createEvent(fullDate, title);
        };
        cell.appendChild(btnAdd);
      }

      // Afficher les événements du jour
      const dayEvents = events.filter(e => e.date === fullDate);
      dayEvents.forEach(e => {
        const evDiv = document.createElement('div');
        evDiv.className = 'event';
        evDiv.innerHTML = `${e.title}` + (!e.validated ? `<span> (⏳)</span>` : '');
        // Si admin → boutons valider / supprimer
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

  // ---------------- Navigation mois ----------------

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

  // ---------------- Initialisation ----------------

  window.addEventListener('DOMContentLoaded', () => {
    // 1) On initialise currentUser à partir des paramètres d’URL ou de localStorage
    initUserFromQuery();
    // 2) On affiche le header “user-info”
    renderUserInfo();
    // 3) On génère le calendrier du mois courant
    renderCalendar();
  });

  // Exposer dans le scope global pour les onclick
  window.changeMonth   = changeMonth;
  window.validateEvent = validateEvent;
  window.deleteEvent   = deleteEvent;
  window.createEvent   = createEvent;
})();
