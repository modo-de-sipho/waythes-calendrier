// Configuration - À modifier avec vos vraies valeurs
const CONFIG = {
    DISCORD_CLIENT_ID: '1378637692169879632',
    REDIRECT_URI: window.location.origin + window.location.pathname,
    BACKEND_URL: 'http://fnode1.astrast.host:9506'
};

// État de l'application
let currentUser = null;
let currentDate = new Date();
let events = [];
let pendingEvents = [];

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    renderCalendar();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('loginBtn').addEventListener('click', loginWithDiscord);
    document.getElementById('logoutBtn').addEventListener('click', logout);
}

// Authentification Discord
function loginWithDiscord() {
    const params = new URLSearchParams({
        client_id: CONFIG.DISCORD_CLIENT_ID,
        redirect_uri: CONFIG.REDIRECT_URI,
        response_type: 'code',
        scope: 'identify'
    });
    
    window.location.href = `https://discord.com/api/oauth2/authorize?${params}`;
}

function checkAuth() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
        exchangeCodeForToken(code);
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
    }
    
    // Vérifier le token local
    const token = localStorage.getItem('discord_token');
    const userData = localStorage.getItem('user_data');
    
    if (token && userData) {
        currentUser = JSON.parse(userData);
        updateUI();
        loadEvents();
    }
}

async function exchangeCodeForToken(code) {
    try {
        const response = await fetch(`${CONFIG.BACKEND_URL}/auth/discord`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code })
        });
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('discord_token', data.token);
            localStorage.setItem('user_data', JSON.stringify(data.user));
            currentUser = data.user;
            updateUI();
            loadEvents();
            sendUserInfoToDiscord(data.user);
        } else {
            console.error('Erreur d\'authentification:', data.error);
            alert('Erreur lors de la connexion');
        }
    } catch (error) {
        console.error('Erreur lors de l\'authentification:', error);
        alert('Erreur de connexion au serveur');
    }
}

async function sendUserInfoToDiscord(user) {
    try {
        await fetch(`${CONFIG.BACKEND_URL}/webhook/user-login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: user.id,
                username: user.username,
                discriminator: user.discriminator,
                avatar: user.avatar,
                permission: user.permission
            })
        });
    } catch (error) {
        console.error('Erreur lors de l\'envoi du webhook:', error);
    }
}

function logout() {
    localStorage.removeItem('discord_token');
    localStorage.removeItem('user_data');
    currentUser = null;
    events = [];
    pendingEvents = [];
    updateUI();
    renderCalendar();
}

function updateUI() {
    const loginBtn = document.getElementById('loginBtn');
    const userInfo = document.getElementById('userInfo');
    const eventForm = document.getElementById('eventForm');
    const pendingSection = document.getElementById('pendingEventsSection');
    
    if (currentUser) {
        loginBtn.classList.add('hidden');
        userInfo.classList.remove('hidden');
        
        const avatarUrl = currentUser.avatar 
            ? `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png`
            : `https://cdn.discordapp.com/embed/avatars/${currentUser.discriminator % 5}.png`;
            
        document.getElementById('userAvatar').src = avatarUrl;
        document.getElementById('username').textContent = 
            `${currentUser.username}#${currentUser.discriminator}`;
        
        const badge = document.getElementById('permissionBadge');
        badge.className = `permission-badge permission-${currentUser.permission}`;
        badge.textContent = getPermissionText(currentUser.permission);
        
        // Afficher le formulaire pour les contributeurs et modérateurs
        if (currentUser.permission >= 2) {
            eventForm.classList.remove('hidden');
        }
        
        // Afficher les événements en attente pour les modérateurs
        if (currentUser.permission >= 3) {
            pendingSection.classList.remove('hidden');
        }
    } else {
        loginBtn.classList.remove('hidden');
        userInfo.classList.add('hidden');
        eventForm.classList.add('hidden');
        pendingSection.classList.add('hidden');
    }
}

function getPermissionText(level) {
    switch(level) {
        case 1: return 'Visiteur';
        case 2: return 'Contributeur';
        case 3: return 'Modérateur';
        default: return 'Inconnu';
    }
}

// Gestion du calendrier
function renderCalendar() {
    const calendar = document.getElementById('calendar');
    const monthYear = document.getElementById('currentMonth');
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    monthYear.textContent = new Intl.DateTimeFormat('fr-FR', {
        month: 'long',
        year: 'numeric'
    }).format(currentDate);
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    
    // Ajuster au lundi précédent
    const dayOfWeek = (firstDay.getDay() + 6) % 7;
    startDate.setDate(startDate.getDate() - dayOfWeek);
    
    calendar.innerHTML = '';
    
    // Générer 42 jours (6 semaines)
    for (let i = 0; i < 42; i++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + i);
        
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        
        if (cellDate.getMonth() !== month) {
            dayElement.classList.add('other-month');
        }
        
        if (isToday(cellDate)) {
            dayElement.classList.add('today');
        }
        
        dayElement.innerHTML = `<div class="day-number">${cellDate.getDate()}</div>`;
        
        // Ajouter les événements
        const dayEvents = getEventsForDate(cellDate);
        dayEvents.forEach(event => {
            const eventElement = document.createElement('div');
            eventElement.className = `event ${event.status === 'pending' ? 'pending' : ''}`;
            eventElement.textContent = event.title;
            eventElement.title = `${event.title}\n${event.description || ''}`;
            dayElement.appendChild(eventElement);
        });
        
        // Ajouter l'événement de clic
        dayElement.addEventListener('click', () => selectDate(cellDate));
        
        calendar.appendChild(dayElement);
    }
}

function isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

function getEventsForDate(date) {
    return events.filter(event => {
        const eventDate = new Date(event.date);
        return eventDate.toDateString() === date.toDateString();
    });
}

function selectDate(date) {
    if (currentUser && currentUser.permission >= 2) {
        document.getElementById('eventDate').value = date.toISOString().split('T')[0];
        document.getElementById('eventForm').scrollIntoView({ behavior: 'smooth' });
    }
}

function previousMonth() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
}

function nextMonth() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
}

// Gestion des événements
async function submitEvent() {
    if (!currentUser || currentUser.permission < 2) {
        alert('Permission insuffisante');
        return;
    }
    
    const title = document.getElementById('eventTitle').value.trim();
    const date = document.getElementById('eventDate').value;
    const time = document.getElementById('eventTime').value;
    const description = document.getElementById('eventDescription').value.trim();
    
    if (!title || !date || !time) {
        alert('Veuillez remplir tous les champs obligatoires');
        return;
    }
    
    const eventData = {
        title,
        date: `${date}T${time}`,
        description,
        createdBy: currentUser.id,
        status: currentUser.permission >= 3 ? 'approved' : 'pending'
    };
    
    try {
        const response = await fetch(`${CONFIG.BACKEND_URL}/events`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('discord_token')}`
            },
            body: JSON.stringify(eventData)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            alert('Événement soumis avec succès!');
            clearEventForm();
            loadEvents();
        } else {
            alert('Erreur lors de la soumission: ' + (result.error || 'Erreur inconnue'));
        }
    } catch (error) {
        console.error('Erreur lors de la soumission:', error);
        alert('Erreur de connexion au serveur');
    }
}

function clearEventForm() {
    document.getElementById('eventTitle').value = '';
    document.getElementById('eventDate').value = '';
    document.getElementById('eventTime').value = '';
    document.getElementById('eventDescription').value = '';
}

function hideEventForm() {
    document.getElementById('eventForm').classList.add('hidden');
}

async function loadEvents() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`${CONFIG.BACKEND_URL}/events`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('discord_token')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            events = data.approved || [];
            pendingEvents = data.pending || [];
            
            renderCalendar();
            renderPendingEvents();
        } else {
            console.error('Erreur lors du chargement des événements');
        }
    } catch (error) {
        console.error('Erreur lors du chargement des événements:', error);
    }
}

function renderPendingEvents() {
    if (!currentUser || currentUser.permission < 3) return;
    
    const container = document.getElementById('pendingEventsList');
    container.innerHTML = '';
    
    if (pendingEvents.length === 0) {
        container.innerHTML = '<p>Aucun événement en attente</p>';
        return;
    }
    
    pendingEvents.forEach(event => {
        const eventElement = document.createElement('div');
        eventElement.className = 'pending-event';
        
        const eventDate = new Date(event.date);
        const formattedDate = eventDate.toLocaleString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        eventElement.innerHTML = `
            <h4>${event.title}</h4>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Description:</strong> ${event.description || 'Aucune description'}</p>
            <p><strong>Proposé par:</strong> ${event.createdBy}</p>
            <div class="event-actions">
                <button class="btn btn-approve" onclick="approveEvent('${event.id}')">Approuver</button>
                <button class="btn btn-reject" onclick="rejectEvent('${event.id}')">Rejeter</button>
            </div>
        `;
        
        container.appendChild(eventElement);
    });
}

async function approveEvent(eventId) {
    if (!currentUser || currentUser.permission < 3) return;
    
    try {
        const response = await fetch(`${CONFIG.BACKEND_URL}/events/${eventId}/approve`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('discord_token')}`
            }
        });
        
        if (response.ok) {
            loadEvents();
        } else {
            alert('Erreur lors de l\'approbation');
        }
    } catch (error) {
        console.error('Erreur lors de l\'approbation:', error);
        alert('Erreur de connexion au serveur');
    }
}

async function rejectEvent(eventId) {
    if (!currentUser || currentUser.permission < 3) return;
    
    if (!confirm('Êtes-vous sûr de vouloir rejeter cet événement ?')) {
        return;
    }
    
    try {
        const response = await fetch(`${CONFIG.BACKEND_URL}/events/${eventId}/reject`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('discord_token')}`
            }
        });
        
        if (response.ok) {
            loadEvents();
        } else {
            alert('Erreur lors du rejet');
        }
    } catch (error) {
        console.error('Erreur lors du rejet:', error);
        alert('Erreur de connexion au serveur');
    }
}
