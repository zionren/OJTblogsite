export const ui = {
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    formatDate(dateString) {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    showError(message) {
        // Assuming there's a notification container or similar method
        // For now, implementing a simple alert or console, 
        // but ideally we should replicate the modal logic if we can access it.
        // Let's try to assume the notification modal structure exists in DOM.
        this.showNotification(message, 'error');
    },

    showSuccess(message) {
        this.showNotification(message, 'success');
    },

    showNotification(message, type = 'info') {
        const modal = document.getElementById('notification-modal');
        const overlay = document.getElementById('notification-modal-overlay');
        const titleFn = document.getElementById('notification-title');
        const messageFn = document.getElementById('notification-message');
        const iconFn = document.getElementById('notification-icon');

        if (modal && overlay && titleFn && messageFn) {
            titleFn.textContent = type === 'error' ? 'Error' : 'Success';
            messageFn.textContent = message;

            // Set icon/color based on type if needed
            if (type === 'error') {
                // Add error util classes if they exist
            }

            modal.classList.add('active');
            overlay.classList.add('active');
        } else {
            // Fallback
            alert(`${type.toUpperCase()}: ${message}`);
        }
    },

    hideNotification() {
        const modal = document.getElementById('notification-modal');
        const overlay = document.getElementById('notification-modal-overlay');
        if (modal) modal.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
    }
};
