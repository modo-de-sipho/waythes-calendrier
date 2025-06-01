// script.js

(() => {
  // URL de l’API backend
  const apiURL = 'https://fnode1.astrast.host:9467';

  let currentUser = null;
  const today = new Date();
  let curYear  = today.getFullYear();
  let curMonth = today.getMonth(); // 0 à 11

  // ---------------- Fonctions API ----------------

  // 1) Récupérer le profil (session)
  async function fetchProfile() {
    try {
      const res = await fetch(`${apiURL}/profile`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Non connecté');
      const data = await res.json();
      currentUser = data.user;
    } catch {
      currentUser = null;
    }
    renderUserInfo();
    renderCalendar();
  }

  // 2) Déconnexion
  async function doLogout() {
    await fetch(`${apiURL}/logout`, {
      method: 'POST',
      credentials: 'include'
    });
    currentUser = null;
    renderUserInfo();
    renderCalendar();
  }

  // 3) Charger les événements du mois
  async function loadEvents(monthStr) {
    const res = await fetch(`${apiURL}/events?month=${monthStr}`, {
      credentials: 'include'
    });
    if (!res.ok) return [];
    return await res.json();
  }

  // 4) Créer un événement
  async function createEvent(date, title) {
    const res = await fetch(`${apiURL}/events`, {
      method: 'POST',
      credentials: 'include',
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

  // 5) Valider un événement (admin)
  async function validateEvent(id) {
    const res = await fetch(`${apiURL}/events/validate/${id}`, {
      method: 'POST',
      credentials: 'include'
    });
    if (!res.ok) {
      const err = await res.json();
      alert('Erreur validation : ' + (err.error || res.status));
    } else {
      renderCalendar();
    }
  }

  // 6) Supprimer un événement (admin)
  async function deleteEvent(id) {
    const res = await fetch(`${apiURL}/events/${id}`, {
      method: 'DELETE',
      credentials: 'include'
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
      container.innerHTML = `
        <button id="login-btn">Se connecter avec Discord</button>
      `;
      document.getElementById('login-btn').onclick = () => {
        window.location.href = `${apiURL}/auth/discord`;
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
      document.getElementById('logout-btn').onclick = doLogout;
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
    // Cases vides avant le 1er
    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement('div');
      empty.className = 'day';
      calendarEl.appendChild(empty);
    }

    // Charger les events de ce mois
    const monthStr = `${curYear}-${String(curMonth + 1).padStart(2, '0')}`;
    const events   = await loadEvents(monthStr);

    // Générer chaque jour
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
        // Si admin, afficher “✔” et “✖”
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

  // Navigation de mois
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
  window.addEventListener('DOMContentLoaded', fetchProfile);
  // Exposer pour les onclick
  window.changeMonth   = changeMonth;
  window.validateEvent = validateEvent;
  window.deleteEvent   = deleteEvent;
  window.createEvent   = createEvent;
})();
