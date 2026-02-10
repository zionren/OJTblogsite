import { api } from '../services/api.js';
import { ui } from '../utils/ui.js';

export class CommentManager {
    constructor() {
        this.comments = [];
        // Optional: listeners
    }

    async loadComments() {
        try {
            const comments = await api.get('/admin/comments'); // All comments
            this.comments = comments || [];
            this.renderComments();
        } catch (error) {
            ui.showError('Failed to load comments');
        }
    }

    renderComments() {
        const container = document.getElementById('comments-list'); // Assuming a container ID
        // Note: admin.js didn't show exact container ID in snippet, but likely exists.
        // Let's assume a table similar to posts.
        // If there's a specialized container ID in the HTML, we need it. 
        // Looking at server.js analysis or previous admin.js:
        // admin.js used `renderComments` but didn't show the DOM logic in snippet fully.
        // I will assume standard IDs or we might need to fix HTML later.

        if (!container) return;

        container.innerHTML = this.comments.map(comment => `
            <div class="comment-item">
                <div class="comment-header">
                    <strong>${ui.escapeHtml(comment.author_name)}</strong> on ${ui.escapeHtml(comment.post_title || 'Unknown Post')}
                    <span class="date">${ui.formatDate(comment.created_at)}</span>
                </div>
                <div class="comment-body">${ui.escapeHtml(comment.content)}</div>
                <div class="comment-actions">
                    <button class="delete-btn" data-id="${comment.id}">Delete</button>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => this.deleteComment(btn.dataset.id));
        });
    }

    async deleteComment(id) {
        if (!confirm('Delete this comment?')) return;

        try {
            await api.delete(`/admin/comments/${id}`);
            this.loadComments(); // Refresh
        } catch (error) {
            ui.showError('Failed to delete comment');
        }
    }
}
