import { api } from './services/api.js';
import { ui } from './utils/ui.js';
import { AuthManager } from './modules/auth.js';
import { AnalyticsManager } from './modules/analytics.js';
import { PostManager } from './modules/posts.js';
import { CommentManager } from './modules/comments.js';

class AdminDashboard {
    constructor() {
        this.analyticsManager = null;
        this.postManager = null;
        this.commentManager = null;
        this.currentTab = 'analytics';

        // Initialize AuthManager, which will call initDashboard when auth is confirmed
        this.authManager = new AuthManager((user) => this.initDashboard(user));
    }

    initDashboard(user) {
        // Initialize managers only after auth
        this.analyticsManager = new AnalyticsManager();
        this.postManager = new PostManager();
        this.commentManager = new CommentManager();

        this.setupNavigation();
        this.setupLogout();

        // Load default tab
        this.loadTab(this.currentTab);

        // Listen for internal switches
        window.addEventListener('switch-tab', (e) => {
            if (e.detail && e.detail.tab) {
                this.switchTab(e.detail.tab);
            }
        });

        console.log('Admin Dashboard initialized for user:', user.email);
    }

    setupNavigation() {
        const tabButtons = document.querySelectorAll('.tab-btn[data-tab]');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = btn.dataset.tab;
                if (tab) this.switchTab(tab);
            });
        });
    }

    setupLogout() {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                // Use modal if exists
                const modal = document.getElementById('logout-modal-overlay');
                if (modal) {
                    modal.classList.add('active');

                    document.getElementById('logout-confirm')?.addEventListener('click', async () => {
                        await this.performLogout();
                    }, { once: true });

                    document.getElementById('logout-cancel')?.addEventListener('click', () => {
                        modal.classList.remove('active');
                    }, { once: true });
                } else if (confirm('Are you sure you want to logout?')) {
                    await this.performLogout();
                }
            });
        }
    }

    async performLogout() {
        try {
            await api.post('/auth/logout');
            window.location.reload(); // Reloads page, AuthManager will show login form
        } catch (error) {
            ui.showError('Logout failed');
        }
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
        const content = document.getElementById(`${tabName}-tab`);

        if (btn) btn.classList.add('active');
        if (content) content.classList.add('active');

        this.currentTab = tabName;
        this.loadTab(tabName);
    }

    loadTab(tabName) {
        switch (tabName) {
            case 'analytics':
                this.analyticsManager?.loadAnalytics();
                break;
            case 'posts':
                this.postManager?.loadPosts();
                break;
            case 'comments':
                this.commentManager?.loadComments();
                break;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.adminDashboard = new AdminDashboard();
});
