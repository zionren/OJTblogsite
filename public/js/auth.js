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
            // Initialize admin dashboard after authentication is confirmed
            this.initializeAdminDashboard();
        } else {
            loginContainer.style.display = 'flex';
            adminDashboard.style.display = 'none';
            this.token = null;
            localStorage.removeItem('admin_token');
        }
    }

    initializeAdminDashboard() {
        // Only initialize the admin dashboard if it hasn't been initialized yet
        if (!window.adminDashboard) {
            window.adminDashboard = new AdminDashboard();
        }
        
        // Make debug method available globally
        window.debugAdminDashboard = () => {
            if (window.adminDashboard) {
                window.adminDashboard.debugState();
            } else {
                console.log('Admin dashboard not initialized');
            }
        };
    }

    setupEventListeners() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // Password toggle functionality
        const passwordToggle = document.getElementById('password-toggle');
        if (passwordToggle) {
            passwordToggle.addEventListener('click', (e) => {
                e.preventDefault();
                this.togglePassword();
            });
        }
    }

    togglePassword() {
        const passwordInput = document.getElementById('password');
        const passwordToggleIcon = document.getElementById('password-toggle-icon');
        
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

    // Custom validation functions
    validateLoginForm() {
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value.trim();
        
        if (!email) {
            this.showValidationError('Email is required');
            return false;
        }
        
        if (!password) {
            this.showValidationError('Password is required');
            return false;
        }
        
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showValidationError('Please enter a valid email address');
            return false;
        }
        
        return true;
    }
    
    showValidationError(message) {
        // Use admin dashboard's notification modal if available
        if (window.adminDashboard && window.adminDashboard.showNotificationModal) {
            window.adminDashboard.showNotificationModal(message, 'error');
        } else {
            // Fallback for auth page - show simple error
            const errorElement = document.getElementById('login-error');
            if (errorElement) {
                errorElement.textContent = message;
                errorElement.style.display = 'block';
            }
        }
    }

    async handleLogin() {
        // Validate form first
        if (!this.validateLoginForm()) {
            return;
        }
        
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
