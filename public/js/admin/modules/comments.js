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
        const container = document.getElementById('comments-table-body');

        if (!container) {
            console.error('Comments container not found');
            return;
        }

        if (this.comments.length === 0) {
            container.innerHTML = '<tr><td colspan="5" class="text-center">No comments found</td></tr>';
            return;
        }

        container.innerHTML = this.comments.map(comment => `
            <tr>
                <td>
                    <div class="comment-author">${ui.escapeHtml(comment.author_name)}</div>
                </td>
                <td>
                    <div class="comment-content" title="${ui.escapeHtml(comment.content)}">
                        ${ui.escapeHtml(comment.content).substring(0, 100)}${comment.content.length > 100 ? '...' : ''}
                    </div>
                </td>
                <td>
                    <a href="/post/${ui.escapeHtml(comment.post_slug)}" target="_blank">
                        ${ui.escapeHtml(comment.post_title || 'Unknown Post')}
                    </a>
                </td>
                <td>${ui.formatDate(comment.created_at)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-danger btn-sm delete-btn" data-id="${comment.id}" title="Delete Comment">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteComment(btn.dataset.id);
            });
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
