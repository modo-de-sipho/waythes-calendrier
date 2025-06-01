const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get("id");
const backendUrl = "http://fnode1.astrast.host:9467";

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
      ${event.status === 'pending' && event.canValidate ? `<button class="btn btn-validate" onclick="validateEvent(${event.id})">Valider</button>` : ''}
      ${event.canDelete ? `<button class="btn btn-delete" onclick="deleteEvent(${event.id})">Supprimer</button>` : ''}
    `;
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

fetchEvents();
