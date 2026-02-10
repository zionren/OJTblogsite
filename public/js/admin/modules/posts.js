import { api } from '../services/api.js';
import { ui } from '../utils/ui.js';

export class PostManager {
    constructor() {
        this.posts = [];
        this.editingPostId = null;
        this.currentPostStats = null;
        this.currentPostTitle = null;
        this.dailyViewsChart = null;
        this.hourlyViewsChart = null;
        this.browserStatsChart = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupStatsModal();
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
    }

    setupStatsModal() {
        // Close button
        document.getElementById('post-stats-close')?.addEventListener('click', () => {
            this.hidePostStatsModal();
        });

        // Click outside modal to close
        document.getElementById('post-stats-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'post-stats-modal') {
                this.hidePostStatsModal();
            }
        });

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            const modal = document.getElementById('post-stats-modal');
            if (e.key === 'Escape' && modal?.classList.contains('active')) {
                this.hidePostStatsModal();
            }
        });

        // Export PDF button
        document.getElementById('export-post-pdf')?.addEventListener('click', () => {
            this.exportPostStatsToPDF();
        });
    }

    async loadPosts(forceRefresh = false) {
        if (!forceRefresh && this.posts.length > 0) {
            this.renderPosts();
            return;
        }

        try {
            const data = await api.get('/posts', { published: 'false', limit: 1000 });
            if (data?.posts) {
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
        for (const btn of tableBody.querySelectorAll('.action-btn')) {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const action = btn.dataset.action;
                if (action === 'edit') this.editPost(id);
                if (action === 'delete') this.confirmDelete(id);
                if (action === 'stats') this.showStats(id);
            });
        }
    }

    async editPost(id) {
        try {
            const post = await api.get(`/posts/id/${id}`);
            if (!post) return;

            this.editingPostId = id;

            document.getElementById('post-title').value = post.title;
            document.getElementById('post-content').value = post.content;
            const youtubeInput = document.getElementById('post-youtube-url');
            if (youtubeInput) youtubeInput.value = post.youtube_url || '';
            document.getElementById('post-published').checked = post.published;

            document.getElementById('post-form-title').textContent = 'Edit Post';
            document.getElementById('submit-post').textContent = 'Update Post';
            document.getElementById('cancel-edit').style.display = 'inline-block';

            window.dispatchEvent(new CustomEvent('switch-tab', { detail: { tab: 'create-post' } }));
        } catch (error) {
            ui.showError('Failed to load post details');
        }
    }

    cancelEdit() {
        this.editingPostId = null;
        document.getElementById('post-form').reset();
        document.getElementById('post-form-title').textContent = 'Create New Post';
        document.getElementById('submit-post').textContent = 'Create Post';
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
            this.loadPosts(true);
        } catch (error) {
            ui.showError(error.message || 'Failed to save post');
        }
    }

    confirmDelete(id) {
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

    // ── Post Statistics Modal ──────────────────────────────────

    showStats(id) {
        const post = this.posts.find(p => String(p.id) === String(id));
        const title = post ? post.title : 'Unknown Post';
        this.showPostStats(id, title);
    }

    async showPostStats(postId, postTitle) {
        const modal = document.getElementById('post-stats-modal');
        const loading = document.getElementById('stats-loading');
        const container = document.getElementById('post-stats-container');
        const titleElement = document.getElementById('post-stats-title');

        if (!modal || !loading || !container || !titleElement) return;

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        loading.style.display = 'block';
        container.style.display = 'none';
        titleElement.textContent = `Statistics: ${postTitle}`;

        try {
            const data = await api.get(`/analytics/post/${postId}`);

            this.currentPostStats = data;
            this.currentPostTitle = postTitle;

            this.renderPostStats(data);

            loading.style.display = 'none';
            container.style.display = 'block';
        } catch (error) {
            ui.showError('Failed to load post statistics');
            this.hidePostStatsModal();
        }
    }

    renderPostStats(data) {
        const totalViewsEl = document.getElementById('total-views');
        const videoPlaysEl = document.getElementById('video-plays');
        const commentsCountEl = document.getElementById('comments-count');
        const postAgeEl = document.getElementById('post-age');

        if (totalViewsEl) totalViewsEl.textContent = data.totalViews ?? 0;
        if (videoPlaysEl) videoPlaysEl.textContent = data.videoPlays ?? 0;
        if (commentsCountEl) commentsCountEl.textContent = data.commentsCount ?? 0;

        if (postAgeEl && data.post?.created_at) {
            const postAge = Math.floor((new Date() - new Date(data.post.created_at)) / (1000 * 60 * 60 * 24));
            postAgeEl.textContent = postAge;
        }

        this.renderDailyViewsChart(data.dailyViews || []);
        this.renderHourlyViewsChart(data.hourlyViews || []);
        this.renderBrowserStatsChart(data.browserStats || []);
        this.renderRecentActivity(data.recentActivity || []);
    }

    hidePostStatsModal() {
        const modal = document.getElementById('post-stats-modal');
        if (modal) modal.classList.remove('active');
        document.body.style.overflow = '';

        if (this.dailyViewsChart) {
            this.dailyViewsChart.destroy();
            this.dailyViewsChart = null;
        }
        if (this.hourlyViewsChart) {
            this.hourlyViewsChart.destroy();
            this.hourlyViewsChart = null;
        }
        if (this.browserStatsChart) {
            this.browserStatsChart.destroy();
            this.browserStatsChart = null;
        }
    }

    // ── Chart Rendering ────────────────────────────────────────

    renderDailyViewsChart(dailyViews) {
        const ctx = document.getElementById('daily-views-chart')?.getContext('2d');
        if (!ctx || typeof Chart === 'undefined') return;

        if (this.dailyViewsChart) this.dailyViewsChart.destroy();

        const labels = dailyViews.map(d => new Date(d.date).toLocaleDateString());
        const views = dailyViews.map(d => Number.parseInt(d.views, 10));

        const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDarkMode ? '#ecf0f1' : '#2c3e50';
        const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

        this.dailyViewsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Views',
                    data: views,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor } },
                    x: { grid: { color: gridColor }, ticks: { color: textColor } }
                }
            }
        });
    }

    renderHourlyViewsChart(hourlyViews) {
        const ctx = document.getElementById('hourly-views-chart')?.getContext('2d');
        if (!ctx || typeof Chart === 'undefined') return;

        if (this.hourlyViewsChart) this.hourlyViewsChart.destroy();

        const hourData = new Array(24).fill(0);
        for (const item of hourlyViews) {
            hourData[Number.parseInt(item.hour, 10)] = Number.parseInt(item.views, 10);
        }

        const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);

        const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDarkMode ? '#ecf0f1' : '#2c3e50';
        const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

        this.hourlyViewsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Views',
                    data: hourData,
                    backgroundColor: 'rgba(46, 204, 113, 0.7)',
                    borderColor: '#2ecc71',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor } },
                    x: { grid: { color: gridColor }, ticks: { color: textColor } }
                }
            }
        });
    }

    renderBrowserStatsChart(browserStats) {
        const ctx = document.getElementById('browser-stats-chart')?.getContext('2d');
        if (!ctx || typeof Chart === 'undefined') return;

        if (this.browserStatsChart) this.browserStatsChart.destroy();

        if (browserStats.length === 0) {
            const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
            ctx.font = '16px Arial';
            ctx.fillStyle = isDarkMode ? '#ecf0f1' : '#666';
            ctx.textAlign = 'center';
            ctx.fillText('No browser data available', ctx.canvas.width / 2, ctx.canvas.height / 2);
            return;
        }

        const labels = browserStats.map(item => item.browser);
        const data = browserStats.map(item => Number.parseInt(item.count, 10));
        const colors = ['#e74c3c', '#3498db', '#f39c12', '#2ecc71', '#9b59b6'];

        const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDarkMode ? '#ecf0f1' : '#2c3e50';

        this.browserStatsChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderColor: isDarkMode ? '#2c3e50' : '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { padding: 20, usePointStyle: true, color: textColor }
                    }
                }
            }
        });
    }

    // ── Recent Activity ────────────────────────────────────────

    renderRecentActivity(recentActivity) {
        const container = document.getElementById('recent-activity');
        if (!container) return;

        if (recentActivity.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666; padding: 1rem;">No recent activity</p>';
            return;
        }

        container.innerHTML = recentActivity.map(activity => {
            const date = new Date(activity.timestamp);
            const timeAgo = this.getTimeAgo(date);
            const icon = activity.event_type === 'post_view' ? 'eye' : 'play';
            const actionText = activity.event_type === 'post_view' ? 'Viewed' : 'Video played';

            return `
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="fas fa-${icon}"></i>
                    </div>
                    <div class="activity-details">
                        <div class="activity-type">${actionText}</div>
                        <div class="activity-time">${timeAgo}</div>
                        <div class="activity-meta">
                            ${this.getBrowserName(activity.user_agent)} • ${this.maskIP(activity.ip_address)}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ── Helper Utilities ───────────────────────────────────────

    getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        const intervals = [
            { label: 'year', seconds: 31536000 },
            { label: 'month', seconds: 2592000 },
            { label: 'day', seconds: 86400 },
            { label: 'hour', seconds: 3600 },
            { label: 'minute', seconds: 60 }
        ];

        for (const interval of intervals) {
            const count = Math.floor(seconds / interval.seconds);
            if (count >= 1) {
                return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
            }
        }
        return 'Just now';
    }

    getBrowserName(userAgent) {
        if (!userAgent) return 'Unknown';
        if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) return 'Chrome';
        if (userAgent.includes('Firefox')) return 'Firefox';
        if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
        if (userAgent.includes('Edg')) return 'Edge';
        if (userAgent.includes('Opera') || userAgent.includes('OPR')) return 'Opera';
        return 'Other';
    }

    maskIP(ip) {
        if (!ip) return 'Unknown';
        const parts = ip.split('.');
        if (parts.length === 4) return `${parts[0]}.${parts[1]}.***. ***`;
        return ip.substring(0, ip.length / 2) + '***';
    }

    // ── PDF Export ─────────────────────────────────────────────

    async exportPostStatsToPDF() {
        if (!this.currentPostStats || !this.currentPostTitle) {
            ui.showError('No post statistics data available for export');
            return;
        }

        const exportBtn = document.getElementById('export-post-pdf');
        if (exportBtn) {
            exportBtn.disabled = true;
            exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        }

        try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF();

            pdf.setFontSize(20);
            pdf.setTextColor(44, 62, 80);
            pdf.text('Post Statistics Report', 20, 30);

            pdf.setFontSize(16);
            pdf.setTextColor(52, 152, 219);
            pdf.text(`Post: ${this.currentPostTitle}`, 20, 50);

            pdf.setFontSize(12);
            pdf.setTextColor(44, 62, 80);

            let yPosition = 70;

            pdf.setFontSize(14);
            pdf.text('Statistics Overview:', 20, yPosition);
            yPosition += 15;

            pdf.setFontSize(11);
            const post = this.currentPostStats.post || {};
            const postAge = post.created_at
                ? Math.floor((new Date() - new Date(post.created_at)) / (1000 * 60 * 60 * 24))
                : 0;

            const stats = [
                `Total Views: ${this.currentPostStats.totalViews ?? 0}`,
                `Video Plays: ${this.currentPostStats.videoPlays ?? 0}`,
                `Comments: ${this.currentPostStats.commentsCount ?? 0}`,
                `Post Age: ${postAge} days`,
                `Created: ${post.created_at ? new Date(post.created_at).toLocaleDateString() : 'N/A'}`,
                `Last Updated: ${post.updated_at ? new Date(post.updated_at).toLocaleDateString() : 'N/A'}`
            ];

            for (const stat of stats) {
                pdf.text(`• ${stat}`, 25, yPosition);
                yPosition += 8;
            }

            yPosition += 10;

            // Recent activity
            if (this.currentPostStats.recentActivity?.length > 0) {
                pdf.setFontSize(14);
                pdf.setTextColor(44, 62, 80);
                pdf.text('Recent Activity:', 20, yPosition);
                yPosition += 15;

                pdf.setFontSize(10);
                const activities = this.currentPostStats.recentActivity.slice(0, 10);

                for (const activity of activities) {
                    const activityText = `• ${activity.type ?? activity.event_type} - ${new Date(activity.timestamp).toLocaleString()}`;
                    pdf.text(activityText, 25, yPosition);
                    yPosition += 8;

                    if (yPosition > 260) {
                        pdf.addPage();
                        yPosition = 30;
                    }
                }
            }

            // Footer
            const pageCount = pdf.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                pdf.setPage(i);
                pdf.setFontSize(8);
                pdf.setTextColor(128, 128, 128);
                pdf.text(`Generated on ${new Date().toLocaleString()}`, 20, 285);
                pdf.text(`Page ${i} of ${pageCount}`, 170, 285);
            }

            const slug = this.currentPostTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const dateStr = new Date().toISOString().split('T')[0];
            pdf.save(`post-stats-${slug}-${dateStr}.pdf`);

            ui.showSuccess('PDF report generated successfully!');
        } catch (error) {
            ui.showError('Failed to generate PDF report');
        } finally {
            if (exportBtn) {
                exportBtn.disabled = false;
                exportBtn.innerHTML = '<i class="fas fa-file-pdf"></i> Export PDF';
            }
        }
    }
}

