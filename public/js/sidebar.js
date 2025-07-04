// Sidebar Navigation Functionality
class SidebarManager {
    constructor() {
        this.sidebar = document.getElementById('sidebar');
        this.sidebarOverlay = document.getElementById('sidebar-overlay');
        this.sidebarToggle = document.getElementById('sidebar-toggle');
        this.sidebarClose = document.getElementById('sidebar-close');
        
        // Admin sidebar elements
        this.adminSidebar = document.getElementById('admin-sidebar');
        this.adminSidebarOverlay = document.getElementById('admin-sidebar-overlay');
        this.adminSidebarToggle = document.getElementById('admin-sidebar-toggle');
        this.adminSidebarClose = document.getElementById('admin-sidebar-close');
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setActiveLink();
    }
    
    setupEventListeners() {
        // Regular sidebar events
        if (this.sidebarToggle) {
            this.sidebarToggle.addEventListener('click', () => this.toggleSidebar());
        }
        
        if (this.sidebarClose) {
            this.sidebarClose.addEventListener('click', () => this.closeSidebar());
        }
        
        if (this.sidebarOverlay) {
            this.sidebarOverlay.addEventListener('click', () => this.closeSidebar());
        }
        
        // Admin sidebar events
        if (this.adminSidebarToggle) {
            this.adminSidebarToggle.addEventListener('click', () => this.toggleAdminSidebar());
        }
        
        if (this.adminSidebarClose) {
            this.adminSidebarClose.addEventListener('click', () => this.closeAdminSidebar());
        }
        
        if (this.adminSidebarOverlay) {
            this.adminSidebarOverlay.addEventListener('click', () => this.closeAdminSidebar());
        }
        
        // Close sidebar on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeSidebar();
                this.closeAdminSidebar();
            }
        });
        
        // Close sidebar on window resize to desktop
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                this.closeSidebar();
                this.closeAdminSidebar();
            }
        });
    }
    
    toggleSidebar() {
        if (this.sidebar && this.sidebarOverlay) {
            this.sidebar.classList.toggle('active');
            this.sidebarOverlay.classList.toggle('active');
            document.body.style.overflow = this.sidebar.classList.contains('active') ? 'hidden' : '';
        }
    }
    
    closeSidebar() {
        if (this.sidebar && this.sidebarOverlay) {
            this.sidebar.classList.remove('active');
            this.sidebarOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
    
    toggleAdminSidebar() {
        if (this.adminSidebar && this.adminSidebarOverlay) {
            this.adminSidebar.classList.toggle('active');
            this.adminSidebarOverlay.classList.toggle('active');
            document.body.style.overflow = this.adminSidebar.classList.contains('active') ? 'hidden' : '';
        }
    }
    
    closeAdminSidebar() {
        if (this.adminSidebar && this.adminSidebarOverlay) {
            this.adminSidebar.classList.remove('active');
            this.adminSidebarOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
    
    setActiveLink() {
        const currentPath = window.location.pathname;
        const sidebarLinks = document.querySelectorAll('.sidebar-link');
        
        sidebarLinks.forEach(link => {
            const href = link.getAttribute('href');
            link.classList.remove('active');
            
            if ((currentPath === '/' && href === '/') ||
                (currentPath !== '/' && href && currentPath.startsWith(href))) {
                link.classList.add('active');
            }
        });
    }
}

// Initialize sidebar when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SidebarManager();
});
