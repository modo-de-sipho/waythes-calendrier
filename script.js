// script.js

(() => {
  // URL de l’API backend
  const apiURL = 'https://fnode1.astrast.host:9467';

  // Infos Discord OAuth (Implicit Grant)
  const CLIENT_ID = '1378637692169879632';
  const REDIRECT_URI = 'https://modo-de-sipho.github.io/waythes-calendrier/';
  const SCOPE = 'identify';
  // Le “response_type=token” permet d'obtenir le token directement dans le hash de l'URL.

  let currentUser = null;
  const today = new Date();
  let curYear  = today.getFullYear();
  let curMonth = today.getMonth(); // 0..11

  // ------------- 1) Gestion du hash OAuth ----------------

  function parseHash(hash) {
    // Exemple de hash : "#access_token=XYZ&token_type=Bearer&expires_in=604800"
    const params = {};
    hash.substring(1).split('&').forEach(pair => {
      const [key, value] = pair.split('=');
      params[key] = value;
    });
    return params;
  }

  async function handleDiscordOAuthCallback() {
    if (window.location.hash.includes('access_token=')) {
      const params = parseHash(window.location.hash);
      const token = params['access_token'];
      // On nettoie le hash pour ne pas polluer l’URL
      history.replaceState(null, '', window.location.pathname);

      // a) On récupère les infos utilisateur Discord
      try {
        const res = await fetch('https://discord.com/api/users/@me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Impossible de récupérer le profil Discord');
        const discordUser = await res.json();
        // discordUser contient { id, username, discriminator, avatar, … }

        // b) On construit notre objet “currentUser”
        currentUser = {
          id: discordUser.id,
          username: discordUser.username,
          avatar: discordUser.avatar,
          role: 'visitor' // rôle par défaut
        };
        // c) On stocke en localStorage (pour persistance au reload)
        localStorage.setItem('wd_user', JSON.stringify(currentUser));

        // d) Rafraîchir l’UI
        renderUserInfo();
        renderCalendar();
      } catch (e) {
        console.error(e);
        alert('Échec de connexion Discord.');
      }
    }
  }

  // Au chargement de la page, on gère le cas où Discord redirige avec un hash “#access_token=…”
  window.addEventListener('DOMContentLoaded', handleDiscordOAuthCallback);

  // ------------- 2) Utilitaires pour persistance -------------
  function loadLocalUser() {
    const raw = localStorage.getItem('wd_user');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return null;
  }

  // ------------- 3) Affichage Utilisateur ----------------

  function renderUserInfo() {
    const container = document.getElementById('user-info');
    // Si pas connecté en local, on propose le bouton “Se connecter avec Discord”
    if (!currentUser) {
      container.innerHTML = `
        <button id="login-btn">Se connecter avec Discord</button>
      `;
      document.getElementById('login-btn').onclick = () => {
        // On lance l'Implicit Grant : redirection vers Discord
        const discordAuthUrl =
          `https://discord.com/api/oauth2/authorize` +
          `?client_id=${CLIENT_ID}` +
          `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
          `&response_type=token` +
          `&scope=${encodeURIComponent(SCOPE)}`;
        window.location.href = discordAuthUrl;
      };
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
      document.getElementById('logout-btn').onclick = () => {
        localStorage.removeItem('wd_user');
        currentUser = null;
        renderUserInfo();
        renderCalendar();
      };
    }
  }

  // ------------- 4) Appels API Événements ----------------

  // Ajout d'en-têtes “X-User-Id” et “X-User-Role” pour informer le backend de qui joue
  function apiFetch(path, options = {}) {
    const headers = options.headers || {};
    if (currentUser) {
      headers['X-User-Id'] = currentUser.id;
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

  // ------------- 5) Affichage Calendrier ----------------

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
      const fullDate = `${curYear}-${String(curMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const cell = document.createElement('div');
      cell.className = 'day';
      cell.dataset.date = fullDate;
      cell.innerHTML = `<strong>${d}</strong>`;

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

  // ------------- Initialisation -------------
  window.addEventListener('DOMContentLoaded', () => {
    // Si on a déjà un utilisateur stocké en local, on le restaure
    const stored = localStorage.getItem('wd_user');
    if (stored) {
      try {
        currentUser = JSON.parse(stored);
      } catch {
        currentUser = null;
      }
    }
    renderUserInfo();
    renderCalendar();
  });

  // Exposer global pour les onclick
  window.changeMonth   = changeMonth;
  window.validateEvent = validateEvent;
  window.deleteEvent   = deleteEvent;
  window.createEvent   = createEvent;
})();
