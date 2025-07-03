// Authentication functionality
class AuthManager {
    constructor() {
        this.token = localStorage.getItem('admin_token');
        this.init();
    }

    init() {
        this.checkAuthStatus();
        this.setupEventListeners();
    }

    checkAuthStatus() {
        const loginContainer = document.getElementById('login-container');
        const adminDashboard = document.getElementById('admin-dashboard');

        if (this.token && this.isTokenValid()) {
            loginContainer.style.display = 'none';
            adminDashboard.style.display = 'block';
        } else {
            loginContainer.style.display = 'flex';
            adminDashboard.style.display = 'none';
            this.token = null;
            localStorage.removeItem('admin_token');
        }
    }

    setupEventListeners() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }
    }

    async handleLogin() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorElement = document.getElementById('login-error');

        try {
            errorElement.style.display = 'none';

            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Login failed');
            }

            const data = await response.json();
            this.token = data.token;
            localStorage.setItem('admin_token', this.token);
            
            // Redirect to dashboard
            this.checkAuthStatus();

        } catch (error) {
            console.error('Login error:', error);
            errorElement.textContent = error.message;
            errorElement.style.display = 'block';
        }
    }

    isTokenValid() {
        if (!this.token) return false;
        
        try {
            const payload = JSON.parse(atob(this.token.split('.')[1]));
            const now = Date.now() / 1000;
            return payload.exp > now;
        } catch (error) {
            return false;
        }
    }

    logout() {
        this.token = null;
        localStorage.removeItem('admin_token');
        this.checkAuthStatus();
    }

    getAuthHeader() {
        return this.token ? { 'Authorization': `Bearer ${this.token}` } : {};
    }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});
