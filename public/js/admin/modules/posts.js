import { api } from '../services/api.js';
import { ui } from '../utils/ui.js';

export class PostManager {
    constructor() {
        this.posts = [];
        this.editingPostId = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const form = document.getElementById('post-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.savePost();
            });
        }

        const cancelBtn = document.getElementById('cancel-edit');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.cancelEdit());
        }

        const refreshBtn = document.getElementById('refresh-posts');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadPosts(true));
        }

        // Search/Filter listeners could go here
    }

    async loadPosts(forceRefresh = false) {
        if (!forceRefresh && this.posts.length > 0) {
            this.renderPosts();
            return;
        }

        try {
            const data = await api.get('/posts', { published: 'false', limit: 1000 }); // Get all for admin
            if (data && data.posts) {
                this.posts = data.posts;
                this.renderPosts();
            }
        } catch (error) {
            ui.showError('Failed to load posts');
        }
    }

    renderPosts() {
        const tableBody = document.getElementById('posts-table-body');
        if (!tableBody) return;

        if (this.posts.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No posts found</td></tr>';
            return;
        }

        tableBody.innerHTML = this.posts.map(post => `
            <tr>
                <td>${ui.escapeHtml(post.title)}</td>
                <td>${post.views || 0}</td>
                <td>
                    <span class="status-badge ${post.published ? 'status-published' : 'status-draft'}">
                        ${post.published ? 'Published' : 'Draft'}
                    </span>
                </td>
                <td>${ui.formatDate(post.created_at)}</td>
                <td class="post-actions">
                    <button class="action-btn info-btn" data-id="${post.id}" data-action="stats">
                        <i class="fas fa-chart-line"></i> Stats
                    </button>
                    <button class="action-btn edit-btn" data-id="${post.id}" data-action="edit">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="action-btn delete-btn" data-id="${post.id}" data-action="delete">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `).join('');

        // Re-attach event listeners to new buttons
        tableBody.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = btn.dataset.id;
                const action = btn.dataset.action;
                if (action === 'edit') this.editPost(id);
                if (action === 'delete') this.confirmDelete(id);
                if (action === 'stats') this.showStats(id);
            });
        });
    }

    async editPost(id) {
        try {
            const post = await api.get(`/posts/id/${id}`);
            if (!post) return;

            this.editingPostId = id;

            // Populate form
            document.getElementById('post-title').value = post.title;
            document.getElementById('post-content').value = post.content;
            const youtubeInput = document.getElementById('post-youtube-url');
            if (youtubeInput) youtubeInput.value = post.youtube_url || '';
            document.getElementById('post-published').checked = post.published;

            // Update UI state
            document.getElementById('form-title').textContent = 'Edit Post';
            document.getElementById('submit-post-btn').textContent = 'Update Post';
            document.getElementById('cancel-edit').style.display = 'inline-block';

            // Switch tab (assuming specific implementation in main.js or event)
            // Dispatch event to request tab switch
            window.dispatchEvent(new CustomEvent('switch-tab', { detail: { tab: 'create-post' } }));

        } catch (error) {
            ui.showError('Failed to load post details');
        }
    }

    cancelEdit() {
        this.editingPostId = null;
        document.getElementById('post-form').reset();
        document.getElementById('form-title').textContent = 'Create New Post';
        document.getElementById('submit-post-btn').textContent = 'Create Post';
        document.getElementById('cancel-edit').style.display = 'none';

        window.dispatchEvent(new CustomEvent('switch-tab', { detail: { tab: 'posts' } }));
    }

    async savePost() {
        const title = document.getElementById('post-title').value.trim();
        const content = document.getElementById('post-content').value.trim();
        const youtubeUrl = document.getElementById('post-youtube-url')?.value.trim();
        const published = document.getElementById('post-published').checked;

        if (!title || !content) {
            ui.showError('Title and content are required');
            return;
        }

        const postData = { title, content, youtubeUrl, published }; // Note: camelCase usage check?
        // Backend expects snake_case for youtube_url? 
        // Controller: const { title, content, youtube_url, published = true } = req.body;
        // So we need to match it.
        const payload = {
            title,
            content,
            youtube_url: youtubeUrl,
            published
        };

        try {
            if (this.editingPostId) {
                await api.put(`/posts/${this.editingPostId}`, payload);
                ui.showSuccess('Post updated successfully');
            } else {
                await api.post('/posts', payload);
                ui.showSuccess('Post created successfully');
            }

            this.cancelEdit();
            this.loadPosts(true); // Refresh list
        } catch (error) {
            ui.showError(error.message || 'Failed to save post');
        }
    }

    confirmDelete(id) {
        // Simple confirm for now, or use modal if available
        if (confirm('Are you sure you want to delete this post?')) {
            this.deletePost(id);
        }
    }

    async deletePost(id) {
        try {
            await api.delete(`/posts/${id}`);
            ui.showSuccess('Post deleted successfully');
            this.loadPosts(true);
        } catch (error) {
            ui.showError('Failed to delete post');
        }
    }

    showStats(id) {
        // Implement stats modal logic or just simple alert for now
        // Or dispatch event
        console.log('Show stats for', id);
    }
}
