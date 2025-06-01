// script.js
const api = 'http://fnode1.astrast.host:9467';

window.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch(`${api}/api/user`, { credentials: 'include' });
        if (!res.ok) throw new Error();

        const user = await res.json();
        afficherCalendrier(user);
        chargerEvenements();
    } catch (err) {
        document.getElementById('loginPage').style.display = 'flex';
    }
});

function afficherCalendrier(user) {
    document.getElementById('calendarPage').style.display = 'block';
    document.getElementById('userName').textContent = `${user.username}#${user.discriminator}`;
    document.getElementById('userEmail').textContent = user.email || '';
    document.getElementById('userAvatar').src = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
    document.getElementById('userPermissionBadge').textContent = 'Utilisateur';
    document.getElementById('userPermissionBadge').classList.add('permission-badge', 'visitor');
}

function logout() {
    window.location.href = `${api}/logout`;
}

async function chargerEvenements() {
    const res = await fetch(`${api}/api/events`, { credentials: 'include' });
    const events = await res.json();
    const daysContainer = document.getElementById('calendarDays');
    daysContainer.innerHTML = '';

    // Pour l'exemple on affiche juste les jours du mois avec events
    for (let i = 1; i <= 30; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'day-cell';
        dayDiv.innerHTML = `<div class="day-number">${i}</div>`;
        const jour = `2025-06-${String(i).padStart(2, '0')}`;

        const eventsToday = events.filter(e => e.date === jour);
        eventsToday.forEach(evt => {
            const evtDiv = document.createElement('div');
            evtDiv.className = `event ${evt.category}`;
            evtDiv.textContent = evt.title;
            dayDiv.appendChild(evtDiv);
        });

        daysContainer.appendChild(dayDiv);
    }
}

function openAddEventModal() {
    document.getElementById('addEventModal').style.display = 'flex';
}

function closeAddEventModal() {
    document.getElementById('addEventModal').style.display = 'none';
}

async function addEvent() {
    const event = {
        title: document.getElementById('eventTitle').value,
        date: document.getElementById('eventDate').value,
        time: document.getElementById('eventTime').value,
        category: document.getElementById('eventCategory').value,
        description: document.getElementById('eventDescription').value
    };

    const res = await fetch(`${api}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(event)
    });

    if (res.ok) {
        closeAddEventModal();
        chargerEvenements();
    } else {
        alert("Erreur lors de l'ajout de l'événement !");
    }
}
