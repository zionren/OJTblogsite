class ThemeManager {

    constructor() {
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.init();
    }

    init() {
        this.applyTheme(this.currentTheme);
        this.setupEventListeners();
        this.loadCustomBackground();
    }

    setupEventListeners() {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }

        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                this.applyTheme(e.matches ? 'dark' : 'light');
            }
        });

        // Allow custom background upload (for admin users)
        this.setupBackgroundUpload();
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(this.currentTheme);
        localStorage.setItem('theme', this.currentTheme);
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.updateThemeToggleIcon(theme);
        this.currentTheme = theme;
    }

    updateThemeToggleIcon(theme) {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('i');
            if (icon) {
                icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
            }
        }
    }

    setupBackgroundUpload() {
        // This would be implemented for admin users to upload custom backgrounds
        // For now, we'll use a default background or allow URL-based backgrounds
        this.loadBackgroundFromStorage();
    }

    loadCustomBackground() {
        const customBg = localStorage.getItem('customBackground');
        if (customBg) {
            this.setCustomBackground(customBg);
        }
    }

    setCustomBackground(imageUrl) {
        // Validate URL and apply custom background
        if (this.isValidImageUrl(imageUrl)) {
            document.documentElement.style.setProperty('--bg-image', `url('${imageUrl}')`);
            localStorage.setItem('customBackground', imageUrl);
        }
    }

    removeCustomBackground() {
        document.documentElement.style.removeProperty('--bg-image');
        localStorage.removeItem('customBackground');
    }

    isValidImageUrl(url) {
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
        return imageExtensions.some(ext => url.toLowerCase().includes(ext)) || url.includes('data:image');
    }

    loadBackgroundFromStorage() {
        const savedBackground = localStorage.getItem('customBackground');
        if (savedBackground) {
            this.setCustomBackground(savedBackground);
        }
    }

    // Method to set theme colors programmatically
    setThemeColors(colors) {
        const root = document.documentElement;
        
        Object.entries(colors).forEach(([property, value]) => {
            root.style.setProperty(`--${property}`, value);
        });
        
        // Save custom colors
        localStorage.setItem('customColors', JSON.stringify(colors));
    }

    // Load custom colors from storage
    loadCustomColors() {
        const customColors = localStorage.getItem('customColors');
        if (customColors) {
            try {
                const colors = JSON.parse(customColors);
                this.setThemeColors(colors);
            } catch (error) {
                console.error('Error loading custom colors:', error);
            }
        }
    }

    // Reset to default theme
    resetToDefault() {
        localStorage.removeItem('theme');
        localStorage.removeItem('customBackground');
        localStorage.removeItem('customColors');
        
        // Apply system preference or default to light
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.applyTheme(systemPrefersDark ? 'dark' : 'light');
        
        // Remove custom styles
        document.documentElement.style.removeProperty('--bg-image');
        
        // Reload page to reset all custom CSS
        window.location.reload();
    }

    // Get current theme info
    getThemeInfo() {
        return {
            theme: this.currentTheme,
            customBackground: localStorage.getItem('customBackground'),
            customColors: localStorage.getItem('customColors')
        };
    }

    // Theme presets
    applyThemePreset(presetName) {
        const presets = {
            ocean: {
                'primary-color': '#2980b9',
                'secondary-color': '#3498db',
                'accent-color': '#16a085',
                'surface-color': '#ecf0f1',
                'bg-image': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            },
            forest: {
                'primary-color': '#27ae60',
                'secondary-color': '#2ecc71',
                'accent-color': '#f39c12',
                'surface-color': '#d5dbdb',
                'bg-image': 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)'
            },
            sunset: {
                'primary-color': '#e67e22',
                'secondary-color': '#f39c12',
                'accent-color': '#e74c3c',
                'surface-color': '#fdf2e9',
                'bg-image': 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%)'
            },
            minimal: {
                'primary-color': '#2c3e50',
                'secondary-color': '#34495e',
                'accent-color': '#95a5a6',
                'surface-color': '#ffffff',
                'bg-image': 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
            }
        };

        const preset = presets[presetName];
        if (preset) {
            this.setThemeColors(preset);
        }
    }
}

// Initialize theme manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
});

// Expose theme manager globally for console access
window.setTheme = (theme) => {
    if (window.themeManager) {
        window.themeManager.applyTheme(theme);
    }
};

window.setCustomBackground = (url) => {
    if (window.themeManager) {
        window.themeManager.setCustomBackground(url);
    }
};

window.applyThemePreset = (preset) => {
    if (window.themeManager) {
        window.themeManager.applyThemePreset(preset);
    }
};
