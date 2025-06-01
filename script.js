const backendUrl = "http://fnode1.astrast.host:9467";
let userId = null;
let userPerm = 0;

function loginWithDiscord() {
  const clientId = "TON_CLIENT_ID_DISCORD";
  const redirectUri = encodeURIComponent(window.location.href);
  const scope = "identify guilds";
  window.location.href = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}`;
}

async function fetchUserData(token) {
  const res = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${token}` }
  });
  return await res.json();
}

async function init() {
  const hash = new URLSearchParams(window.location.hash.substring(1));
  const accessToken = hash.get("access_token");
  if (!accessToken) return;

  document.getElementById("login-container").style.display = "none";
  document.getElementById("main-content").style.display = "block";

  const userData = await fetchUserData(accessToken);
  userId = userData.id;

  // Récupérer la permission depuis le backend
  const permRes = await fetch(`${backendUrl}/api/permissions?id=${userId}`);
  const permData = await permRes.json();
  userPerm = permData.level || 1;

  if (userPerm >= 2) document.getElementById("form-container").style.display = "block";

  fetchEvents();
}

async function fetchEvents() {
  const res = await fetch(`${backendUrl}/api/events?id=${userId}`);
  const data = await res.json();
  const container = document.getElementById("events");
  container.innerHTML = "";
  data.forEach(event => {
    const div = document.createElement("div");
    div.className = `event ${event.status === 'pending' ? 'pending' : 'validated'}`;
    div.innerHTML = `
      <h3>${event.title}</h3>
      <p><strong>Date:</strong> ${event.date}</p>
      <p>${event.description}</p>
      <p><em>Status:</em> ${event.status}</p>
    `;

    if (event.status === 'pending' && userPerm >= 3) {
      div.innerHTML += `<button class="btn btn-validate" onclick="validateEvent(${event.id})">Valider</button>`;
    }

    if (userPerm >= 3 || (userPerm >= 2 && event.author === userId)) {
      div.innerHTML += `<button class="btn btn-delete" onclick="deleteEvent(${event.id})">Supprimer</button>`;
    }

    container.appendChild(div);
  });
}

async function createEvent() {
  const title = document.getElementById("title").value;
  const date = document.getElementById("date").value;
  const description = document.getElementById("description").value;
  const res = await fetch(`${backendUrl}/api/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, date, description, user: userId })
  });
  const result = await res.json();
  alert(result.message || result.error);
  fetchEvents();
}

async function validateEvent(id) {
  await fetch(`${backendUrl}/api/events/${id}/validate`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user: userId })
  });
  fetchEvents();
}

async function deleteEvent(id) {
  await fetch(`${backendUrl}/api/events/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user: userId })
  });
  fetchEvents();
}

window.onload = init;
