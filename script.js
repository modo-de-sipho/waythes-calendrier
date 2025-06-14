
const CONFIG = {
    DISCORD_CLIENT_ID: '1378637692169879632',
    REDIRECT_URI: 'https://modo-de-sipho.github.io/waythes-calendrier/',
    BACKEND_URL: 'http://fnode1.astrast.host:9506'
};


class CalendarApp {
    constructor() {
        this.currentUser = null;
        this.currentDate = new Date();
        this.events = [];
        this.selectedDate = null;
        this.isLoading = false;
        
        this.init();
    }

    async init() {
        try {
            this.showLoading(true);
            await this.checkAuth();
            this.renderCalendar();
            this.setupEventListeners();
            await this.loadEvents();
        } catch (error) {
            console.error('Erreur d\'initialisation:', error);
            this.showError('Erreur lors de l\'initialisation de l\'application');
        } finally {
            this.showLoading(false);
        }
    }

    setupEventListeners() {
        this.getElement('loginBtn')?.addEventListener('click', () => this.loginWithDiscord());
        this.getElement('logoutBtn')?.addEventListener('click', () => this.logout());
        
        window.previousMonth = () => this.previousMonth();
        window.nextMonth = () => this.nextMonth();

        window.submitEvent = () => this.submitEvent();
        window.hideEventForm = () => this.hideEventForm();
        
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
        
        window.addEventListener('resize', () => this.debounce(() => this.renderCalendar(), 250));
    }

    getElement(id) {
        return document.getElementById(id);
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    showLoading(show) {
        this.isLoading = show;
        const body = document.body;
        if (show) {
            body.style.cursor = 'wait';
            if (!document.querySelector('.loading-overlay')) {
                const overlay = document.createElement('div');
                overlay.className = 'loading-overlay';
                overlay.innerHTML = '<div class="spinner"></div>';
                body.appendChild(overlay);
            }
        } else {
            body.style.cursor = '';
            const overlay = document.querySelector('.loading-overlay');
            if (overlay) overlay.remove();
        }
    }

    showError(message) {
        const existingError = document.querySelector('.error-message');
        if (existingError) existingError.remove();

        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <div class="error-content">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="error-close">×</button>
            </div>
        `;
        document.body.insertAdjacentElement('afterbegin', errorDiv);

        setTimeout(() => errorDiv.remove(), 5000);
    }

    showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.innerHTML = `
            <div class="success-content">
                <i class="fas fa-check-circle"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="success-close">×</button>
            </div>
        `;
        document.body.insertAdjacentElement('afterbegin', successDiv);

        setTimeout(() => successDiv.remove(), 3000);
    }

    loginWithDiscord() {
        const params = new URLSearchParams({
            client_id: CONFIG.DISCORD_CLIENT_ID,
            redirect_uri: CONFIG.REDIRECT_URI,
            response_type: 'code',
            scope: 'identify'
        });
        
        window.location.href = `https://discord.com/api/oauth2/authorize?${params}`;
    }

    async checkAuth() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        if (code) {
            await this.exchangeCodeForUser(code);
            
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }
        
        
        const userId = localStorage.getItem('user_id');
        if (userId) {
            await this.verifyUser(userId);
        }
    }

    async exchangeCodeForUser(code) {
        try {
            const response = await this.fetchAPI('/auth/discord', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });

            if (response.success) {
                localStorage.setItem('user_id', response.user.id);
                localStorage.setItem('discord_user', JSON.stringify(response.user));
                this.currentUser = response.user;
                this.updateUI();
                await this.loadEvents();
            } else {
                throw new Error(response.error || 'Erreur d\'authentification');
            }
        } catch (error) {
            console.error('Erreur lors de l\'authentification:', error);
            this.showError('Erreur lors de la connexion Discord');
        }
    }

    async verifyUser(userId) {
        try {
            const response = await this.fetchAPI('/auth/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId })
            });
            
            if (response.success) {
                const discordUser = JSON.parse(localStorage.getItem('discord_user') || '{}');
                
                this.currentUser = {
                    ...response.user,
                    username: discordUser.username || 'Utilisateur',
                    discriminator: discordUser.discriminator || '0000',
                    avatar: discordUser.avatar
                };
                
                this.updateUI();
                await this.loadEvents();
            } else {
                console.error('Erreur de vérification utilisateur:', response.error);
                this.logout();
            }
        } catch (error) {
            console.error('Erreur lors de la vérification:', error);
            this.logout();
        }
    }

    logout() {
        localStorage.removeItem('user_id');
        localStorage.removeItem('discord_user');
        this.currentUser = null;
        this.events = [];
        this.updateUI();
        this.renderCalendar();
        this.showSuccess('Déconnexion réussie');
    }

    updateUI() {
        const loginBtn = this.getElement('loginBtn');
        const userInfo = this.getElement('userInfo');
        const eventForm = this.getElement('eventForm');
        
        if (this.currentUser) {
            loginBtn?.classList.add('hidden');
            userInfo?.classList.remove('hidden');
            
            const avatarUrl = this.currentUser.avatar 
                ? `https://cdn.discordapp.com/avatars/${this.currentUser.id}/${this.currentUser.avatar}.png`
                : `https://cdn.discordapp.com/embed/avatars/${(parseInt(this.currentUser.discriminator) || 0) % 5}.png`;
                
            const userAvatar = this.getElement('userAvatar');
            const username = this.getElement('username');
            const permissionBadge = this.getElement('permissionBadge');
            
            if (userAvatar) userAvatar.src = avatarUrl;
            if (username) username.textContent = `${this.currentUser.username}#${this.currentUser.discriminator}`;
            
            if (permissionBadge) {
                permissionBadge.className = `permission-badge permission-${this.currentUser.permission}`;
                permissionBadge.textContent = this.currentUser.permission_name;
            }
            
            
            if (this.currentUser.permission >= 2) {
                eventForm?.classList.remove('hidden');
            }
        } else {
            loginBtn?.classList.remove('hidden');
            userInfo?.classList.add('hidden');
            eventForm?.classList.add('hidden');
        }
    }

    
    renderCalendar() {
        const calendar = this.getElement('calendar');
        const monthYear = this.getElement('currentMonth');
        
        if (!calendar || !monthYear) return;
        
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        monthYear.textContent = new Intl.DateTimeFormat('fr-FR', {
            month: 'long',
            year: 'numeric'
        }).format(this.currentDate);
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        
        const dayOfWeek = (firstDay.getDay() + 6) % 7;
        startDate.setDate(startDate.getDate() - dayOfWeek);
        
        calendar.innerHTML = '';
        
        for (let i = 0; i < 42; i++) {
            const cellDate = new Date(startDate);
            cellDate.setDate(startDate.getDate() + i);
            
            const dayElement = this.createDayElement(cellDate, month);
            calendar.appendChild(dayElement);
        }
    }

    createDayElement(cellDate, currentMonth) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        
        if (cellDate.getMonth() !== currentMonth) {
            dayElement.classList.add('other-month');
        }
        
        if (this.isToday(cellDate)) {
            dayElement.classList.add('today');
        }
        
        if (this.selectedDate && cellDate.toDateString() === this.selectedDate.toDateString()) {
            dayElement.classList.add('selected');
        }
        
        dayElement.innerHTML = `<div class="day-number">${cellDate.getDate()}</div>`;
        
        const dayEvents = this.getEventsForDate(cellDate);
        dayEvents.forEach(event => {
            const eventElement = document.createElement('div');
            eventElement.className = 'event';
            eventElement.textContent = event.title;
            eventElement.title = `${event.title}\n${event.time}\n${event.description || ''}`;
            eventElement.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showEventDetails(event);
            });
            dayElement.appendChild(eventElement);
        });
        
        dayElement.addEventListener('click', () => this.selectDate(cellDate));
        
        return dayElement;
    }

    isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    getEventsForDate(date) {
        return this.events.filter(event => {
            const eventDate = new Date(event.date);
            return eventDate.toDateString() === date.toDateString();
        });
    }

    selectDate(date) {
        this.selectedDate = date;
        this.renderCalendar();
        
        if (this.currentUser && this.currentUser.permission >= 2) {
            const eventDateInput = this.getElement('eventDate');
            if (eventDateInput) {
                eventDateInput.value = date.toISOString().split('T')[0];
                this.getElement('eventForm')?.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }

    showEventDetails(event) {
        const eventDate = new Date(event.date);
        const formattedDate = eventDate.toLocaleDateString('fr-FR');
        
        const modal = document.createElement('div');
        modal.className = 'event-modal';
        modal.innerHTML = `
            <div class="event-modal-content">
                <div class="event-modal-header">
                    <h3>${event.title}</h3>
                    <button class="modal-close" onclick="this.closest('.event-modal').remove()">×</button>
                </div>
                <div class="event-modal-body">
                    <p><strong>📆 Date:</strong> ${formattedDate}</p>
                    <p><strong>🕐 Heure:</strong> ${event.time}</p>
                    ${event.description ? `<p><strong>📝 Description:</strong> ${event.description}</p>` : ''}
                    <p><strong>👤 Créé par:</strong> ${event.createdBy}</p>
                </div>
                <div class="event-modal-actions">
                    ${this.canEditEvent(event) ? `
                        <button class="btn btn-primary" onclick="app.editEvent('${event.id}')">Modifier</button>
                        <button class="btn btn-danger" onclick="app.deleteEvent('${event.id}')">Supprimer</button>
                    ` : ''}
                    <button class="btn btn-secondary" onclick="this.closest('.event-modal').remove()">Fermer</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    
        const closeModal = (e) => {
            if (e.key === 'Escape' || e.target === modal) {
                modal.remove();
                document.removeEventListener('keydown', closeModal);
            }
        };
        document.addEventListener('keydown', closeModal);
        modal.addEventListener('click', closeModal);
    }

    canEditEvent(event) {
        if (!this.currentUser) return false;
        return this.currentUser.permission >= 3 || event.createdBy === this.currentUser.id;
    }

    previousMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.renderCalendar();
    }

    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.renderCalendar();
    }

    async loadEvents() {
        if (!this.currentUser) return;
        
        try {
            const response = await this.fetchAPI('/events', {
                method: 'GET',
                headers: { 'X-User-ID': this.currentUser.id }
            });
            
            if (response.success) {
                this.events = response.events || [];
                this.renderCalendar();
            } else {
                throw new Error(response.error || 'Erreur lors du chargement des événements');
            }
        } catch (error) {
            console.error('Erreur lors du chargement des événements:', error);
            this.showError('Erreur lors du chargement des événements');
        }
    }

    async submitEvent() {
        if (!this.currentUser || this.currentUser.permission < 2) {
            this.showError('Permissions insuffisantes');
            return;
        }

        const titleInput = this.getElement('eventTitle');
        const dateInput = this.getElement('eventDate');
        const timeInput = this.getElement('eventTime');
        const descriptionInput = this.getElement('eventDescription');

        if (!titleInput?.value || !dateInput?.value || !timeInput?.value) {
            this.showError('Veuillez remplir tous les champs obligatoires');
            return;
        }

        const eventData = {
            title: titleInput.value.trim(),
            date: dateInput.value,
            time: timeInput.value,
            description: descriptionInput?.value?.trim() || '',
            permission: 1 
        };

        try {
            this.showLoading(true);
            const response = await this.fetchAPI('/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': this.currentUser.id
                },
                body: JSON.stringify(eventData)
            });

            if (response.success) {
                this.events.push(response.event);
                this.renderCalendar();
                this.clearEventForm();
                this.hideEventForm();
                this.showSuccess('Événement créé avec succès !');
            } else {
                throw new Error(response.error || 'Erreur lors de la création de l\'événement');
            }
        } catch (error) {
            console.error('Erreur lors de la création de l\'événement:', error);
            this.showError('Erreur lors de la création de l\'événement');
        } finally {
            this.showLoading(false);
        }
    }

    async editEvent(eventId) {
        
        console.log('Édition d\'événement:', eventId);
    }

    async deleteEvent(eventId) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cet événement ?')) return;

        try {
            this.showLoading(true);
            const response = await this.fetchAPI(`/events/${eventId}`, {
                method: 'DELETE',
                headers: { 'X-User-ID': this.currentUser.id }
            });

            if (response.success) {
                this.events = this.events.filter(event => event.id !== eventId);
                this.renderCalendar();
                this.showSuccess('Événement supprimé avec succès !');
            
                document.querySelector('.event-modal')?.remove();
            } else {
                throw new Error(response.error || 'Erreur lors de la suppression');
            }
        } catch (error) {
            console.error('Erreur lors de la suppression:', error);
            this.showError('Erreur lors de la suppression de l\'événement');
        } finally {
            this.showLoading(false);
        }
    }

    clearEventForm() {
        const fields = ['eventTitle', 'eventDate', 'eventTime', 'eventDescription'];
        fields.forEach(fieldId => {
            const field = this.getElement(fieldId);
            if (field) field.value = '';
        });
    }

    hideEventForm() {
        const eventForm = this.getElement('eventForm');
        if (eventForm) {
            eventForm.style.display = 'none';
            setTimeout(() => {
                eventForm.style.display = '';
            }, 300);
        }
    }

    handleKeydown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                this.previousMonth();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.nextMonth();
                break;
            case 'Escape':
                document.querySelector('.event-modal')?.remove();
                break;
        }
    }

    async fetchAPI(endpoint, options = {}) {
        const url = `${CONFIG.BACKEND_URL}${endpoint}`;
        
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Erreur API ${endpoint}:`, error);
            throw error;
        }
    }
}

let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new CalendarApp();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CalendarApp;
}
