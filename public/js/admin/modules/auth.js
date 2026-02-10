import { api } from '../services/api.js';
import { ui } from '../utils/ui.js';

export class AuthManager {
    constructor(onAuthenticated) {
        this.user = null;
        this.onAuthenticated = onAuthenticated; // Callback to init dashboard
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
    }

    async checkAuthStatus() {
        const loginContainer = document.getElementById('login-container');
        const adminDashboard = document.getElementById('admin-dashboard');

        try {
            const data = await api.get('/auth/check');
            if (data && data.user) {
                this.user = data.user;

                if (loginContainer) loginContainer.style.display = 'none';
                if (adminDashboard) adminDashboard.style.display = 'block';

                // Trigger dashboard initialization
                if (this.onAuthenticated) this.onAuthenticated(this.user);
            } else {
                throw new Error('Not authenticated');
            }
        } catch (error) {
            if (loginContainer) loginContainer.style.display = 'flex';
            if (adminDashboard) adminDashboard.style.display = 'none';
            this.user = null;
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

        const passwordToggle = document.getElementById('password-toggle');
        if (passwordToggle) {
            passwordToggle.addEventListener('click', (e) => {
                e.preventDefault();
                this.togglePassword();
            });
        }

        // Logout is handled in main.js usually, but we can expose a logout method used by main.js
    }

    togglePassword() {
        const passwordInput = document.getElementById('password');
        const passwordToggleIcon = document.getElementById('password-toggle-icon');

        if (passwordInput && passwordToggleIcon) {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                passwordToggleIcon.classList.remove('fa-eye');
                passwordToggleIcon.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                passwordToggleIcon.classList.remove('fa-eye-slash');
                passwordToggleIcon.classList.add('fa-eye');
            }
        }
    }

    async handleLogin() {
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const errorElement = document.getElementById('login-error');

        const email = emailInput?.value.trim();
        const password = passwordInput?.value.trim();

        if (!email || !password) {
            if (errorElement) {
                errorElement.textContent = 'Email and password are required';
                errorElement.style.display = 'block';
            }
            return;
        }

        try {
            if (errorElement) errorElement.style.display = 'none';

            const response = await api.post('/auth/login', { email, password });

            if (response && response.success) {
                this.checkAuthStatus(); // Takes care of UI switch
            }
        } catch (error) {
            console.error('Login error:', error);
            if (errorElement) {
                errorElement.textContent = error.message || 'Login failed';
                errorElement.style.display = 'block';
            }
        }
    }
}
