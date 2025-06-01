const api = 'http://fnode1.astrast.host:9467';
let user = null;

// OAuth Discord
function startOAuth() {
  const clientId = '1378637692169879632';
  const redirectUri = window.location.origin;
  const scope = 'identify email';
  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${scope}`;
  window.location.href = url;
}

// Traitement post-OAuth
window.addEventListener('DOMContentLoaded', async () => {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('access_token');
  if (!token) return;

  const res = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${token}` }
  });
  user = await res.json();

  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('calendarPage').style.display = 'block';
  document.getElementById('userName').textContent = `${user.username}#${user.discriminator}`;
  document.getElementById('userEmail').textContent = user.email;
  document.getElementById('userAvatar').src = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;

  chargerEvenements();
});

function logout() {
  window.location.href = window.location.origin;
}

function openAddEventModal() {
  document.getElementById('addEventModal').style.display = 'flex';
}

function closeAddEventModal() {
  document.getElementById('addEventModal').style.display = 'none';
}

async function chargerEvenements() {
  const res = await fetch(`${api}/api/events`);
  const events = await res.json();
  const cal = document.getElementById('calendarDays');
  cal.innerHTML = '';
  for (let i = 1; i <= 30; i++) {
    const d = document.createElement('div');
    d.className = 'day-cell';
    const date = `2025-06-${String(i).padStart(2, '0')}`;
    d.innerHTML = `<div class="day-number">${i}</div>`;

    events.filter(e => e.date === date).forEach(e => {
      const el = document.createElement('div');
      el.className = 'event';
      el.textContent = e.title;
      d.appendChild(el);
    });

    cal.appendChild(d);
  }
}

async function addEvent() {
  const newEvent = {
    userId: user.id,
    title: document.getElementById('eventTitle').value,
    date: document.getElementById('eventDate').value,
    category: document.getElementById('eventCategory').value,
    description: document.getElementById('eventDescription').value
  };

  await fetch(`${api}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newEvent)
  });

  closeAddEventModal();
  chargerEvenements();
}
