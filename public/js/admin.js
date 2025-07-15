// Admin dashboard functionality
class AdminDashboard {
    constructor() {
        this.token = localStorage.getItem('admin_token');
        this.currentTab = 'analytics';
        this.editingPostId = null;
        this.charts = {};
        
        // Cache for data
        this.cachedAnalytics = null;
        this.cachedPosts = null;
        this.cachedComments = null;
        this.deletingCommentId = null;
        
        // Current post stats for PDF export
        this.currentPostStats = null;
        this.currentPostTitle = null;
        
        // Activity logs pagination
        this.currentLogsPage = 1;
        this.totalLogsPages = 1;
        
        console.log('AdminDashboard constructor - token:', this.token ? 'present' : 'missing');
        console.log('AdminDashboard constructor - initial cache state:', {
            analytics: this.cachedAnalytics,
            posts: this.cachedPosts
        });
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        
        // Only load data if we have a token
        if (this.token) {
            // Add a small delay to ensure the page is fully loaded
            // Only load the current tab's data initially
            setTimeout(() => {
                if (this.currentTab === 'analytics') {
                    this.loadAnalytics();
                } else if (this.currentTab === 'posts') {
                    this.loadPosts();
                }
                // Don't preload all data - let user switch tabs to load them
            }, 100);
        } else {
            console.warn('No admin token found, skipping data load');
        }
    }

    setupEventListeners() {
        // Tab switching - only for elements with data-tab attribute
        const tabButtons = document.querySelectorAll('.tab-btn[data-tab]');
        console.log('Setting up event listeners for', tabButtons.length, 'tab buttons');
        
        tabButtons.forEach(btn => {
            console.log('Adding event listener to button with data-tab:', btn.dataset.tab);
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = e.target.dataset.tab;
                console.log(`Tab clicked: ${tabName}`);
                if (tabName) {
                    this.switchTab(tabName);
                } 
                else {
                    console.warn('No tabName found on clicked element');
                }
            });
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.showLogoutModal();
        });

        // Logout modal events
        document.getElementById('logout-cancel').addEventListener('click', () => {
            this.hideLogoutModal();
        });

        document.getElementById('logout-confirm').addEventListener('click', () => {
            this.logout();
        });

        // Close modal when clicking overlay
        document.getElementById('logout-modal-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'logout-modal-overlay') {
                this.hideLogoutModal();
            }
        });

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('logout-modal-overlay').classList.contains('active')) {
                this.hideLogoutModal();
            }
            if (e.key === 'Escape' && document.getElementById('notification-modal-overlay').classList.contains('active')) {
                this.hideNotificationModal();
            }
            if (e.key === 'Escape' && document.getElementById('delete-modal-overlay').classList.contains('active')) {
                this.hideDeleteModal();
            }
            if (e.key === 'Escape' && document.getElementById('post-stats-modal').classList.contains('active')) {
                this.hidePostStatsModal();
            }
        });

        // Delete modal events
        document.getElementById('delete-cancel').addEventListener('click', () => {
            this.hideDeleteModal();
        });

        document.getElementById('delete-confirm').addEventListener('click', () => {
            this.confirmDelete();
        });

        // Close delete modal when clicking overlay
        document.getElementById('delete-modal-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'delete-modal-overlay') {
                this.hideDeleteModal();
            }
        });

        // Notification modal events
        document.getElementById('notification-close').addEventListener('click', () => {
            this.hideNotificationModal();
        });

        // Close notification modal when clicking overlay
        document.getElementById('notification-modal-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'notification-modal-overlay') {
                this.hideNotificationModal();
            }
        });

        // Analytics filters
        document.getElementById('apply-filters').addEventListener('click', () => {
            this.refreshAnalytics();
        });

        // Post form
        document.getElementById('post-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.savePost();
        });

        // Cancel edit
        document.getElementById('cancel-edit').addEventListener('click', () => {
            this.cancelEdit();
        });

        // Refresh posts
        document.getElementById('refresh-posts').addEventListener('click', () => {
            this.refreshPosts();
        });

        // Comment moderation event listeners
        document.getElementById('refresh-comments')?.addEventListener('click', () => {
            this.refreshComments();
        });

        document.getElementById('apply-comment-filters')?.addEventListener('click', () => {
            this.applyCommentFilters();
        });

        document.getElementById('comment-delete-cancel')?.addEventListener('click', () => {
            this.hideCommentDeleteModal();
        });

        document.getElementById('comment-delete-confirm')?.addEventListener('click', () => {
            this.confirmCommentDelete();
        });

        // Close comment delete modal when clicking overlay
        document.getElementById('comment-delete-modal-overlay')?.addEventListener('click', (e) => {
            if (e.target.id === 'comment-delete-modal-overlay') {
                this.hideCommentDeleteModal();
            }
        });

        // Post stats modal event listeners
        document.getElementById('post-stats-close')?.addEventListener('click', () => {
            this.hidePostStatsModal();
        });

        document.getElementById('post-stats-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'post-stats-modal') {
                this.hidePostStatsModal();
            }
        });

        // Activity logs event listeners
        this.setupActivityLogsEventListeners();

        // Post statistics modal events
        document.getElementById('post-stats-close').addEventListener('click', () => {
            this.hidePostStatsModal();
        });

        // Close post stats modal when clicking outside
        document.getElementById('post-stats-modal').addEventListener('click', (e) => {
            if (e.target.id === 'post-stats-modal') {
                this.hidePostStatsModal();
            }
        });

        // Export PDF button event listener
        document.getElementById('export-post-pdf')?.addEventListener('click', () => {
            this.exportPostStatsToPDF();
        });

        // Window resize handler for charts responsiveness
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.resizeCharts();
            }, 250);
        });
    }

    // this is the site of the errors, please fix this!
    switchTab(tabName) {
        try {
            // Check if tabName is valid
            if (!tabName) {
                console.warn('switchTab called with invalid tabName:', tabName);
                return;
            }

            console.log(`=== SWITCHING TO TAB: ${tabName} ===`);
            console.log('Current cache state:', {
                analytics: this.cachedAnalytics ? 'CACHED' : 'NOT CACHED',
                posts: this.cachedPosts ? 'CACHED' : 'NOT CACHED'
            });

            // Update active tab button
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            const targetTab = document.querySelector(`[data-tab="${tabName}"]`);
            if (targetTab) {
                targetTab.classList.add('active');
            } else {
                console.warn('No element found with data-tab:', tabName);
                return;
            }

            // Update active tab content
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            const targetContent = document.getElementById(`${tabName}-tab`);
            if (targetContent) {
                targetContent.classList.add('active');
            } else {
                console.error('No content element found with id:', `${tabName}-tab`);
                return;
            }

            this.currentTab = tabName;
            console.log('Current tab set to:', this.currentTab);

            // Load tab-specific data only if we have a valid token
            if (this.token && this.isTokenValid()) {
                if (tabName == 'analytics') {
                    if (this.cachedAnalytics) {
                        console.log('Using cached analytics data', this.cachedAnalytics);
                        this.renderAnalytics(this.cachedAnalytics);
                    } 
                    else {
                        console.log('Loading analytics for the first time - no cache found');
                        this.loadAnalytics();
                    }
                }
                else if (tabName == 'posts') {
                    if (this.cachedPosts) {
                        console.log('Using cached posts data', this.cachedPosts);
                        this.renderPosts(this.cachedPosts);
                    } 
                    else {
                        console.log('Loading posts for the first time - no cache found');
                        this.loadPosts();
                    }
                } 
                else if (tabName == 'comments') {
                    if (this.cachedComments) {
                        console.log('Using cached comments data', this.cachedComments);
                        this.renderComments(this.cachedComments);
                    } 
                    else {
                        console.log('Loading comments for the first time - no cache found');
                        this.showCommentsLoading();
                        this.loadComments();
                    }
                } 
                else if (tabName == 'activity-logs') {
                    console.log('Loading activity logs tab');
                    this.loadActivityLogs(1);
                } 
                else {
                    console.log(`No data loading needed for ${tabName} tab`);
                }
            } 
            else {
                console.log('No token or invalid token, skipping data load');
            }
        } catch (error) {
            console.error('Error in switchTab:', error);
            // Don't let errors break the entire dashboard
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Token validation method
    isTokenValid() {
        if (!this.token) return false;
        
        try {
            const payload = JSON.parse(atob(this.token.split('.')[1]));
            const now = Math.floor(Date.now() / 1000);
            return payload.exp > now;
        } catch (error) {
            console.error('Token validation error:', error);
            return false;
        }
    }

    // Chart resize method
    resizeCharts() {
        try {
            Object.values(this.charts).forEach(chart => {
                if (chart && typeof chart.resize === 'function') {
                    chart.resize();
                }
            });
        } catch (error) {
            console.error('Error resizing charts:', error);
        }
    }

    // Analytics loading method
    async loadAnalytics() {
        if (!this.token) {
            console.warn('No token available for analytics');
            return;
        }

        if (!this.isTokenValid()) {
            console.warn('Token is invalid, redirecting to login');
            localStorage.removeItem('admin_token');
            window.location.reload();
            return;
        }

        try {
            const startDate = document.getElementById('start-date')?.value || '';
            const endDate = document.getElementById('end-date')?.value || '';
            
            let url = '/api/analytics/dashboard';
            if (startDate && endDate) {
                url += `?startDate=${startDate}&endDate=${endDate}`;
            }

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch analytics');
            }

            const data = await response.json();
            console.log('Analytics loaded:', data);
            
            this.cachedAnalytics = data;
            this.renderAnalytics(data);

        } catch (error) {
            console.error('Error loading analytics:', error);
            this.showError('Failed to load analytics data. Please try refreshing the page.');
        }
    }

    renderAnalytics(data) {
        // Update stat cards
        document.getElementById('total-visits').textContent = data.totalVisits.toLocaleString();
        document.getElementById('avg-time').textContent = `${data.avgTimeSpent}s`;
        document.getElementById('total-posts').textContent = data.mostViewed.length;
        document.getElementById('total-comments').textContent = '0'; // We'll calculate this separately

        // Render charts
        this.renderPostsVsVideosChart(data.mostViewed, data.mostWatched);
        this.renderDailyVisitsChart(data.dailyAnalytics);
    }

    renderPostsVsVideosChart(mostViewed, mostWatched) {
        const ctx = document.getElementById('posts-vs-videos-chart').getContext('2d');
        
        // Destroy existing chart if it exists
        if (this.charts.postsVsVideos) {
            this.charts.postsVsVideos.destroy();
        }

        const postLabels = mostViewed.slice(0, 5).map(post => post.title.substring(0, 20) + '...');
        const postViews = mostViewed.slice(0, 5).map(post => post.views);
        const videoLabels = mostWatched.slice(0, 5).map(video => video.title.substring(0, 20) + '...');
        const videoPlays = mostWatched.slice(0, 5).map(video => video.play_count);

        this.charts.postsVsVideos = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [...postLabels, ...videoLabels],
                datasets: [{
                    label: 'Post Views',
                    data: [...postViews, ...Array(videoLabels.length).fill(0)],
                    backgroundColor: 'rgba(52, 152, 219, 0.8)',
                    borderColor: 'rgba(52, 152, 219, 1)',
                    borderWidth: 1
                }, {
                    label: 'Video Plays',
                    data: [...Array(postLabels.length).fill(0), ...videoPlays],
                    backgroundColor: 'rgba(231, 76, 60, 0.8)',
                    borderColor: 'rgba(231, 76, 60, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 10,
                        right: 10,
                        bottom: 10,
                        left: 10
                    }
                },
                plugins: {
                    legend: {
                        display: window.innerWidth > 480,
                        position: window.innerWidth > 768 ? 'top' : 'bottom',
                        labels: {
                            color: '#e74c3c', // Force red text for better visibility
                            font: {
                                size: window.innerWidth > 768 ? 12 : 10
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#e74c3c', // Force red text for better visibility
                            maxTicksLimit: window.innerWidth > 768 ? 8 : 5,
                            font: {
                                size: window.innerWidth > 768 ? 11 : 9
                            }
                        },
                        grid: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
                        }
                    },
                    x: {
                        beginAtZero: true,
                        ticks: {
                            color: '#e74c3c', // Force red text for better visibility
                            font: {
                                size: window.innerWidth > 768 ? 11 : 9
                            }
                        },
                        grid: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
                        }
                    }
                }
            }
        });
    }

    renderDailyVisitsChart(dailyAnalytics) {
        const ctx = document.getElementById('daily-visits-chart').getContext('2d');
        
        // Destroy existing chart if it exists
        if (this.charts.dailyVisits) {
            this.charts.dailyVisits.destroy();
        }

        console.log('Daily analytics data:', dailyAnalytics);
        
        // Better date formatting and ensure we have data
        const labels = dailyAnalytics.map(item => {
            const date = new Date(item.date);
            return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
            });
        });
        const visits = dailyAnalytics.map(item => parseInt(item.visits) || 0);
        
        console.log('Chart labels:', labels);
        console.log('Chart visits:', visits);
        
        // If no data, show at least a week with some placeholder data
        if (visits.length === 0 || visits.every(v => v === 0)) {
            const today = new Date();
            try {
                for (let i = 6; i >= 0; i--) {
                    const date = new Date(today);
                    date.setDate(date.getDate() - i);
                    labels.push(date.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                    }));
                    visits.push(i === 0 ? 1 : 0); // At least one visit today for demo
                }
            } 
            catch (error) {
                console.error('Error generating placeholder daily visits data:', error);
            }
        }

        // Check if dark mode is active
        const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDarkMode ? '#ecf0f1' : '#2c3e50';
        const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

        this.charts.dailyVisits = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Daily Visits',
                    data: visits,
                    borderColor: 'rgba(46, 204, 113, 1)',
                    backgroundColor: 'rgba(46, 204, 113, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 10,
                        right: 10,
                        bottom: 10,
                        left: 10
                    }
                },
                plugins: {
                    legend: {
                        display: window.innerWidth > 480,
                        position: 'top',
                        labels: {
                            color: '#e74c3c', // Force red text for better visibility
                            font: {
                                size: window.innerWidth > 768 ? 12 : 10
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        suggestedMax: Math.max(...visits) > 0 ? Math.max(...visits) + 2 : 10,
                        ticks: {
                            color: '#e74c3c', // Force red text for better visibility
                            maxTicksLimit: window.innerWidth > 768 ? 6 : 4,
                            stepSize: 1,
                            font: {
                                size: window.innerWidth > 768 ? 11 : 9
                            }
                        },
                        grid: {
                            color: gridColor
                        }
                    },
                    x: {
                        ticks: {
                            color: '#e74c3c', // Force red text for better visibility
                            maxTicksLimit: window.innerWidth > 768 ? 10 : 6,
                            maxRotation: 45,
                            font: {
                                size: window.innerWidth > 768 ? 11 : 9
                            }
                        },
                        grid: {
                            color: gridColor
                        }
                    }
                }
            }
        });
    }

    async loadPosts() {
        if (!this.token) {
            console.warn('No token available for posts');
            return;
        }

        // Double-check token validity before making API calls
        if (!this.isTokenValid()) {
            console.warn('Token is invalid, redirecting to login');
            localStorage.removeItem('admin_token');
            window.location.reload();
            return;
        }

        try {
            const response = await fetch('/api/posts?published=false&limit=1000', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    console.error('Authentication failed, redirecting to login');
                    localStorage.removeItem('admin_token');
                    window.location.reload();
                    return;
                }
                throw new Error('Failed to load posts');
            }

            const data = await response.json();
            
            // Cache the data
            this.cachedPosts = data.posts;
            console.log('Posts data cached:', this.cachedPosts);
            
            this.renderPosts(data.posts);

        } 
        catch (error) {
            console.error('Error loading posts:', error);
            this.showError('Failed to load posts');
        }
    }

    // Methods to force refresh data
    refreshAnalytics() {
        console.log('Refreshing analytics - clearing cache');
        this.cachedAnalytics = null;
        this.loadAnalytics();
    }

    refreshPosts() {
        console.log('Refreshing posts - clearing cache');
        this.cachedPosts = null;
        this.loadPosts();
    }

    renderPosts(posts) {
        const tableBody = document.getElementById('posts-table-body');
        
        if (posts.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No posts found</td></tr>';
            return;
        }

        tableBody.innerHTML = posts.map(post => `
            <tr>
                <td>${this.escapeHtml(post.title)}</td>
                <td>${post.views}</td>
                <td>
                    <span class="status-badge ${post.published ? 'status-published' : 'status-draft'}">
                        ${post.published ? 'Published' : 'Draft'}
                    </span>
                </td>
                <td>${this.formatDate(post.created_at)}</td>
                <td class="post-actions">
                    <button class="info-btn" onclick="adminDashboard.showPostStats(${post.id}, '${this.escapeHtml(post.title)}')">
                        <i class="fas fa-chart-line"></i> Stats
                    </button>
                    <button class="edit-btn" onclick="adminDashboard.editPost(${post.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="delete-btn" onclick="adminDashboard.deletePost(${post.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // Custom validation functions
    validatePostForm() {
        const title = document.getElementById('post-title').value.trim();
        const content = document.getElementById('post-content').value.trim();
        
        try {
            if (!title) {
            throw new Error('Post title is required');
            }
        } 
        catch (error) {
            this.showNotificationModal(error.message, 'error');
            return false;
        }

        try {
            if (!content) {
            throw new Error('Post content is required');
            }
        } 
        catch (error) {
            this.showNotificationModal(error.message, 'error');
            return false;
        }

        try {
            const youtubeUrl = document.getElementById('post-youtube-url').value.trim();
            if (youtubeUrl && !this.isValidYouTubeUrl(youtubeUrl)) {
            throw new Error('Please enter a valid YouTube URL');
            }
        } 
        catch (error) {
            this.showNotificationModal(error.message, 'error');
            return false;
        }
        // else clause to ensure we don't return false if everything is valid
        console.log('Post form validation passed'); // debugging purposes only
        return true;
    }
    
    isValidYouTubeUrl(url) {
        try {
            const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
            return youtubeRegex.test(url);
        }
        catch (error) {
            console.error ("Didn't catch the url:", url, error);
            return false;
        }
    }

    async savePost() {
        // Validate form first
        if (!this.validatePostForm()) {
            return;
        }
        
        try {
            const formData = new FormData(document.getElementById('post-form'));
            const postData = {
                title: formData.get('title'),
                content: formData.get('content'),
                youtube_url: formData.get('youtube_url') || null,
                published: formData.get('published') === 'on'
            };

            const url = this.editingPostId ? `/api/posts/${this.editingPostId}` : '/api/posts';
            const method = this.editingPostId ? 'PUT' : 'POST';
            const isEditing = !!this.editingPostId;

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(postData)
            });

            if (!response.ok) {
                throw new Error('Failed to save post');
            }

            this.showSuccess(isEditing ? 'Post updated successfully' : 'Post created successfully');
            this.resetPostForm();
            
            // Clear cache since data has changed
            console.log('Clearing cache after post save');
            this.cachedPosts = null;
            this.cachedAnalytics = null; // Analytics might also be affected
            
            this.loadPosts();

            // If we were editing a post, switch back to the posts tab
            if (isEditing) {
                this.switchTab('posts');
            }

        } 
        catch (error) {
            console.error('Error saving post:', error);
            this.showError('Failed to save post');
        }
    }

    async editPost(postId) {
        try {
            const response = await fetch(`/api/posts/id/${postId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load post');
            }

            const post = await response.json();
            
            // Switch to create post tab
            this.switchTab('create-post');
            
            // Fill form with post data
            document.getElementById('post-title').value = post.title;
            document.getElementById('post-content').value = post.content;
            document.getElementById('post-youtube-url').value = post.youtube_url || '';
            document.getElementById('post-published').checked = post.published;
            
            // Update form state
            this.editingPostId = postId;
            document.getElementById('post-form-title').textContent = 'Edit Post';
            document.getElementById('submit-post').textContent = 'Update Post';
            document.getElementById('cancel-edit').style.display = 'block';

        } 
        catch (error) {
            console.error('Error loading post for edit:', error);
            this.showError('Failed to load post for editing');
        }
    }

    async deletePost(postId) {
        try {
            // Store the post ID for the confirmation
            this.postToDelete = postId;
            this.showDeleteModal();
        }
        catch (error) {
            console.error("Cannot delete post:", error);
            this.showError('Failed to prepare post for deletion');
        }
    }

    showDeleteModal() {
        document.getElementById('delete-modal-overlay').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    hideDeleteModal() {
        document.getElementById('delete-modal-overlay').classList.remove('active');
        document.body.style.overflow = '';
        this.postToDelete = null;
    }

    async confirmDelete() {
        if (!this.postToDelete) {
            return;
        }

        try {
            const response = await fetch(`/api/posts/${this.postToDelete}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete post');
            }

            this.hideDeleteModal();
            this.showSuccess('Post deleted successfully');
            
            // Clear cache since data has changed
            console.log('Clearing cache after post delete');
            this.cachedPosts = null;
            this.cachedAnalytics = null; // Analytics might also be affected
            
            this.loadPosts();

        } 
        catch (error) {
            console.error('Error deleting post:', error);
            this.hideDeleteModal();
            this.showError('Failed to delete post');
        }
    }

    cancelEdit() {
        this.resetPostForm();
        this.switchTab('posts');
    }

    resetPostForm() {
        document.getElementById('post-form').reset();
        this.editingPostId = null;
        document.getElementById('post-form-title').textContent = 'Create New Post';
        document.getElementById('submit-post').textContent = 'Create Post';
        document.getElementById('cancel-edit').style.display = 'none';
        document.getElementById('post-published').checked = true;
    }

    logout() {
        localStorage.removeItem('admin_token');
        window.location.reload();
    }

    showLogoutModal() {
        document.getElementById('logout-modal-overlay').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    hideLogoutModal() {
        document.getElementById('logout-modal-overlay').classList.remove('active');
        document.body.style.overflow = '';
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    // Comment Moderation Methods
    async loadComments() {
        if (!this.token || !this.isTokenValid()) {
            console.warn('No valid token for comments');
            return;
        }

        try {
            const postFilter = document.getElementById('comment-post-filter')?.value || '';
            let url = '/api/admin/comments';
            if (postFilter) {
                url += `?postId=${postFilter}`;
            }

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch comments');
            }

            const comments = await response.json();
            console.log('Comments loaded:', comments);
            
            this.cachedComments = comments;
            this.renderComments(comments);
            await this.loadPostsForFilter();

        } catch (error) {
            console.error('Error loading comments:', error);
            this.showError('Failed to load comments');
        }
    }

    async loadPostsForFilter() {
        try {
            const response = await fetch('/api/posts?published=false&limit=1000', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                const posts = data.posts || []; // Extract posts array from response
                const filterSelect = document.getElementById('comment-post-filter');
                if (filterSelect) {
                    filterSelect.innerHTML = '<option value="">All Posts</option>';
                    posts.forEach(post => {
                        const option = document.createElement('option');
                        option.value = post.id;
                        option.textContent = post.title;
                        filterSelect.appendChild(option);
                    });
                }
            }
        } catch (error) {
            console.error('Error loading posts for filter:', error);
        }
    }

    renderComments(comments) {
        const tbody = document.getElementById('comments-table-body');
        const tableContainer = document.querySelector('.comments-table-container');
        const commentsContainer = document.querySelector('.comments-container');
        
        if (!tbody || !tableContainer || !commentsContainer) return;

        // Remove any existing empty state
        const existingEmptyState = commentsContainer.querySelector('.comments-empty-state');
        if (existingEmptyState) {
            existingEmptyState.remove();
        }

        if (comments.length === 0) {
            // Hide the table and show empty state
            tableContainer.style.display = 'none';
            
            const emptyState = document.createElement('div');
            emptyState.className = 'comments-empty-state';
            emptyState.innerHTML = `
                <i class="fas fa-comments"></i>
                <h3>No Comments Yet</h3>
                <p>When users post comments, they'll appear here for moderation.</p>
            `;
            commentsContainer.appendChild(emptyState);
            return;
        }

        // Show table and hide empty state
        tableContainer.style.display = 'block';

        tbody.innerHTML = comments.map(comment => `
            <tr>
                <td>${this.escapeHtml(comment.author_name)}</td>
                <td class="comment-content">
                    <div class="comment-text">${this.escapeHtml(comment.content.substring(0, 100))}${comment.content.length > 100 ? '...' : ''}</div>
                </td>
                <td>
                    <a href="/post/${comment.post_slug}" target="_blank" class="post-link">
                        ${this.escapeHtml(comment.post_title)}
                    </a>
                </td>
                <td>${new Date(comment.created_at).toLocaleDateString()}</td>
                <td>
                    <button class="delete-btn" onclick="adminDashboard.deleteComment(${comment.id}, '${this.escapeHtml(comment.author_name).replace(/'/g, "\\'")}', '${this.escapeHtml(comment.content.substring(0, 50)).replace(/'/g, "\\'")}...')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `).join('');
    }

    deleteComment(commentId, authorName, contentPreview) {
        this.deletingCommentId = commentId;
        
        const commentPreviewDiv = document.getElementById('comment-preview');
        if (commentPreviewDiv) {
            commentPreviewDiv.innerHTML = `
                <div class="comment-preview-content">
                    <strong>Author:</strong> ${this.escapeHtml(authorName)}<br>
                    <strong>Comment:</strong> ${this.escapeHtml(contentPreview)}
                </div>
            `;
        }
        
        this.showCommentDeleteModal();
    }

    showCommentDeleteModal() {
        const modal = document.getElementById('comment-delete-modal-overlay');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    hideCommentDeleteModal() {
        const modal = document.getElementById('comment-delete-modal-overlay');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
        this.deletingCommentId = null;
    }

    async confirmCommentDelete() {
        if (!this.deletingCommentId) return;

        try {
            const response = await fetch(`/api/admin/comments/${this.deletingCommentId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete comment');
            }

            this.hideCommentDeleteModal();
            this.showSuccess('Comment deleted successfully');
            
            this.cachedComments = null;
            this.loadComments();

        } catch (error) {
            console.error('Error deleting comment:', error);
            this.hideCommentDeleteModal();
            this.showError('Failed to delete comment');
        }
    }

    refreshComments() {
        this.cachedComments = null;
        this.showCommentsLoading();
        this.loadComments();
    }

    applyCommentFilters() {
        this.cachedComments = null;
        this.showCommentsLoading();
        this.loadComments();
    }

    showCommentsLoading() {
        const tbody = document.getElementById('comments-table-body');
        const tableContainer = document.querySelector('.comments-table-container');
        const commentsContainer = document.querySelector('.comments-container');
        
        if (!tbody || !tableContainer || !commentsContainer) return;

        // Remove any existing empty state
        const existingEmptyState = commentsContainer.querySelector('.comments-empty-state');
        if (existingEmptyState) {
            existingEmptyState.remove();
        }

        // Show table and add loading state
        tableContainer.style.display = 'block';
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="comments-loading">
                    <i class="fas fa-spinner"></i>
                    Loading comments...
                </td>
            </tr>
        `;
    }

    // Activity Logs functionality
    async loadActivityLogs(page = 1, filters = {}) {
        console.log('Loading activity logs, page:', page, 'filters:', filters);
        
        try {
            this.showLoading();
            
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: '50',
                ...filters
            });

            console.log('Fetching activity logs with params:', queryParams.toString());

            const response = await fetch(`/api/admin/activity-logs?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            console.log('Activity logs response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Activity logs API error:', response.status, errorText);
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            const data = await response.json();
            console.log('Activity logs data received:', data);
            
            this.renderActivityLogs(data.logs);
            this.updateLogsPagination(data.pagination);
            
            // Also load stats when loading logs
            await this.loadActivityStats();
        } catch (error) {
            console.error('Error loading activity logs:', error);
            this.showError('Failed to load activity logs: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async loadActivityStats() {
        console.log('Loading activity stats...');
        
        try {
            const response = await fetch('/api/admin/activity-stats', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            console.log('Activity stats response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Activity stats API error:', response.status, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const stats = await response.json();
            console.log('Activity stats data received:', stats);
            this.renderActivityStats(stats);
        } catch (error) {
            console.error('Error loading activity stats:', error);
        }
    }

    renderActivityLogs(logs) {
        const tbody = document.getElementById('logs-table-body');
        
        if (!logs || logs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="logs-empty-state">
                        <i class="fas fa-history"></i>
                        <h3>No Activity Logs Found</h3>
                        <p>No activities match your current filters.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = logs.map(log => {
            const timestamp = new Date(log.timestamp).toLocaleString();
            const details = log.details ? JSON.stringify(log.details, null, 2) : '';
            const userAgent = log.user_agent || 'Unknown';
            const ipAddress = log.ip_address || 'Unknown';
            
            return `
                <tr>
                    <td class="log-timestamp">${timestamp}</td>
                    <td class="log-user">${log.user_email || 'System'}</td>
                    <td><span class="log-action ${log.action}">${log.action}</span></td>
                    <td><span class="log-entity-type">${log.entity_type}</span></td>
                    <td class="log-entity-id">${log.entity_id || '-'}</td>
                    <td class="log-details">
                        ${details ? `<pre>${details}</pre>` : '-'}
                    </td>
                    <td class="log-ip-agent">
                        <span class="log-ip">${ipAddress}</span>
                        <span class="log-agent" title="${userAgent}">${userAgent}</span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    renderActivityStats(stats) {
        document.getElementById('total-logs-count').textContent = stats.totalLogs;
        
        // Find specific action counts
        const createActions = stats.actionStats.find(s => s.action === 'CREATE');
        const updateActions = stats.actionStats.find(s => s.action === 'UPDATE');
        const deleteActions = stats.actionStats.find(s => s.action === 'DELETE');
        
        document.getElementById('create-actions-count').textContent = createActions ? createActions.count : 0;
        document.getElementById('update-actions-count').textContent = updateActions ? updateActions.count : 0;
        document.getElementById('delete-actions-count').textContent = deleteActions ? deleteActions.count : 0;
    }

    updateLogsPagination(pagination) {
        const prevBtn = document.getElementById('logs-prev-page');
        const nextBtn = document.getElementById('logs-next-page');
        const info = document.getElementById('logs-pagination-info');
        
        prevBtn.disabled = pagination.currentPage <= 1;
        nextBtn.disabled = pagination.currentPage >= pagination.totalPages;
        
        info.textContent = `Page ${pagination.currentPage} of ${pagination.totalPages} (${pagination.totalLogs} total)`;
        
        // Store current pagination state
        this.currentLogsPage = pagination.currentPage;
        this.totalLogsPages = pagination.totalPages;
    }

    setupActivityLogsEventListeners() {
        // Refresh logs button
        document.getElementById('refresh-logs')?.addEventListener('click', () => {
            this.loadActivityLogs(1);
        });

        // Apply filters button
        document.getElementById('apply-log-filters')?.addEventListener('click', () => {
            const filters = this.getLogFilters();
            this.loadActivityLogs(1, filters);
        });

        // Clear filters button
        document.getElementById('clear-log-filters')?.addEventListener('click', () => {
            this.clearLogFilters();
            this.loadActivityLogs(1);
        });

        // Pagination buttons
        document.getElementById('logs-prev-page')?.addEventListener('click', () => {
            if (this.currentLogsPage > 1) {
                const filters = this.getLogFilters();
                this.loadActivityLogs(this.currentLogsPage - 1, filters);
            }
        });

        document.getElementById('logs-next-page')?.addEventListener('click', () => {
            if (this.currentLogsPage < this.totalLogsPages) {
                const filters = this.getLogFilters();
                this.loadActivityLogs(this.currentLogsPage + 1, filters);
            }
        });

        // Export logs button
        document.getElementById('export-logs')?.addEventListener('click', () => {
            this.exportActivityLogs();
        });
    }

    getLogFilters() {
        const actionFilter = document.getElementById('log-action-filter')?.value || '';
        const entityFilter = document.getElementById('log-entity-filter')?.value || '';
        const userFilter = document.getElementById('log-user-filter')?.value || '';
        
        const filters = {};
        if (actionFilter) filters.action = actionFilter;
        if (entityFilter) filters.entity_type = entityFilter;
        if (userFilter) filters.user_email = userFilter;
        
        return filters;
    }

    clearLogFilters() {
        document.getElementById('log-action-filter').value = '';
        document.getElementById('log-entity-filter').value = '';
        document.getElementById('log-user-filter').value = '';
    }

    async exportActivityLogs() {
        try {
            const filters = this.getLogFilters();
            const queryParams = new URLSearchParams({
                limit: '10000', // Large limit for export
                ...filters
            });

            const response = await fetch(`/api/admin/activity-logs?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.downloadLogsAsCSV(data.logs);
        } catch (error) {
            console.error('Error exporting activity logs:', error);
            this.showError('Failed to export activity logs');
        }
    }

    downloadLogsAsCSV(logs) {
        const headers = ['Timestamp', 'User Email', 'Action', 'Entity Type', 'Entity ID', 'Details', 'IP Address', 'User Agent'];
        
        const csvContent = [
            headers.join(','),
            ...logs.map(log => [
                new Date(log.timestamp).toISOString(),
                log.user_email || '',
                log.action,
                log.entity_type,
                log.entity_id || '',
                JSON.stringify(log.details || {}),
                log.ip_address || '',
                `"${(log.user_agent || '').replace(/"/g, '""')}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `activity-logs-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Notification and error handling methods
    showNotificationModal(message, type = 'info') {
        const modal = document.getElementById('notification-modal-overlay');
        const modalContent = modal.querySelector('.modal-content');
        const title = document.getElementById('notification-title');
        const messageElement = document.getElementById('notification-message');
        
        // Set the icon and title based on type
        if (type === 'success') {
            title.innerHTML = '<i class="fas fa-check-circle"></i> Success';
            modalContent.className = 'modal-content notification-modal success';
        } else if (type === 'error') {
            title.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
            modalContent.className = 'modal-content notification-modal error';
        } else {
            title.innerHTML = '<i class="fas fa-info-circle"></i> Notification';
            modalContent.className = 'modal-content notification-modal';
        }
        
        // Set the message
        messageElement.textContent = message;
        
        // Show the modal
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Focus the OK button for accessibility
        setTimeout(() => {
            document.getElementById('notification-close').focus();
        }, 100);
    }

    showLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('active');
        }
    }

    hideLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.remove('active');
        }
    }

    showSuccess(message) {
        this.showNotificationModal(message, 'success');
    }

    showError(message) {
        this.showNotificationModal(message, 'error');
    }

    // Post Statistics Methods
    async showPostStats(postId, postTitle) {
        const modal = document.getElementById('post-stats-modal');
        const loading = document.getElementById('stats-loading');
        const container = document.getElementById('post-stats-container');
        const titleElement = document.getElementById('post-stats-title');
        
        // Show modal and loading
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        loading.style.display = 'block';
        container.style.display = 'none';
        titleElement.textContent = `Statistics: ${postTitle}`;
        
        try {
            const response = await fetch(`/api/analytics/post/${postId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch post statistics');
            }

            const data = await response.json();
            
            // Store current post stats for PDF export
            this.currentPostStats = data;
            this.currentPostTitle = postTitle;
            
            this.renderPostStats(data);
            
            loading.style.display = 'none';
            container.style.display = 'block';
            
        } catch (error) {
            console.error('Error loading post statistics:', error);
            this.showError('Failed to load post statistics');
            this.hidePostStatsModal();
        }
    }

    renderPostStats(data) {
        // Update overview stats
        document.getElementById('total-views').textContent = data.totalViews;
        document.getElementById('video-plays').textContent = data.videoPlays;
        document.getElementById('comments-count').textContent = data.commentsCount;
        
        // Calculate post age
        const postAge = Math.floor((new Date() - new Date(data.post.created_at)) / (1000 * 60 * 60 * 24));
        document.getElementById('post-age').textContent = postAge;

        // Render charts
        this.renderDailyViewsChart(data.dailyViews);
        this.renderHourlyViewsChart(data.hourlyViews);
        this.renderBrowserStatsChart(data.browserStats);
        
        // Render recent activity
        this.renderRecentActivity(data.recentActivity);
    }

    renderDailyViewsChart(dailyViews) {
        const ctx = document.getElementById('daily-views-chart').getContext('2d');
        
        // Destroy existing chart if it exists
        if (this.dailyViewsChart) {
            this.dailyViewsChart.destroy();
        }

        const labels = dailyViews.map(item => new Date(item.date).toLocaleDateString());
        const views = dailyViews.map(item => parseInt(item.views));

        // Check if dark mode is active
        const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDarkMode ? '#ecf0f1' : '#2c3e50';
        const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

        this.dailyViewsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
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
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: gridColor
                        },
                        ticks: {
                            color: textColor
                        }
                    },
                    x: {
                        grid: {
                            color: gridColor
                        },
                        ticks: {
                            color: textColor
                        }
                    }
                }
            }
        });
    }

    renderHourlyViewsChart(hourlyViews) {
        const ctx = document.getElementById('hourly-views-chart').getContext('2d');
        
        // Destroy existing chart if it exists
        if (this.hourlyViewsChart) {
            this.hourlyViewsChart.destroy();
        }

        // Create 24-hour data array with zeros for missing hours
        const hourData = new Array(24).fill(0);
        hourlyViews.forEach(item => {
            hourData[parseInt(item.hour)] = parseInt(item.views);
        });

        const labels = Array.from({length: 24}, (_, i) => `${i}:00`);

        // Check if dark mode is active
        const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDarkMode ? '#ecf0f1' : '#2c3e50';
        const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

        this.hourlyViewsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
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
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: gridColor
                        },
                        ticks: {
                            color: textColor
                        }
                    },
                    x: {
                        grid: {
                            color: gridColor
                        },
                        ticks: {
                            color: textColor
                        }
                    }
                }
            }
        });
    }

    renderBrowserStatsChart(browserStats) {
        const ctx = document.getElementById('browser-stats-chart').getContext('2d');
        
        // Destroy existing chart if it exists
        if (this.browserStatsChart) {
            this.browserStatsChart.destroy();
        }

        if (browserStats.length === 0) {
            // Check if dark mode is active for no data message
            const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
            const textColor = isDarkMode ? '#ecf0f1' : '#666';
            
            ctx.font = '16px Arial';
            ctx.fillStyle = textColor;
            ctx.textAlign = 'center';
            ctx.fillText('No browser data available', ctx.canvas.width / 2, ctx.canvas.height / 2);
            return;
        }

        const labels = browserStats.map(item => item.browser);
        const data = browserStats.map(item => parseInt(item.count));
        const colors = ['#e74c3c', '#3498db', '#f39c12', '#2ecc71', '#9b59b6'];

        // Check if dark mode is active
        const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDarkMode ? '#ecf0f1' : '#2c3e50';

        this.browserStatsChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
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
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            color: textColor
                        }
                    }
                }
            }
        });
    }

    renderRecentActivity(recentActivity) {
        const container = document.getElementById('recent-activity');
        
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

    getBrowserName(userAgent) {
        if (!userAgent) return 'Unknown';
        if (userAgent.includes('Chrome')) return 'Chrome';
        if (userAgent.includes('Firefox')) return 'Firefox';
        if (userAgent.includes('Safari')) return 'Safari';
        if (userAgent.includes('Edge')) return 'Edge';
        return 'Other';
    }

    maskIP(ip) {
        if (!ip) return 'Unknown';
        const parts = ip.split('.');
        if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.xxx.xxx`;
        }
        return 'Unknown';
    }

    getTimeAgo(date) {
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    }

    hidePostStatsModal() {
        const modal = document.getElementById('post-stats-modal');
        modal.classList.remove('active');
        document.body.style.overflow = '';
        
        // Destroy charts to prevent memory leaks
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

    hideNotificationModal() {
        document.getElementById('notification-modal-overlay').classList.remove('active');
        document.body.style.overflow = '';
    }

    // PDF Export Methods
    async exportPostStatsToPDF() {
        if (!this.currentPostStats || !this.currentPostTitle) {
            this.showError('No post statistics data available for export');
            return;
        }

        const exportBtn = document.getElementById('export-post-pdf');
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';

        try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF();
            
            // Set up PDF document
            pdf.setFontSize(20);
            pdf.setTextColor(44, 62, 80);
            pdf.text('Post Statistics Report', 20, 30);
            
            // Post title
            pdf.setFontSize(16);
            pdf.setTextColor(52, 152, 219);
            pdf.text(`Post: ${this.currentPostTitle}`, 20, 50);
            
            // Post details
            pdf.setFontSize(12);
            pdf.setTextColor(44, 62, 80);
            const post = this.currentPostStats.post;
            
            // Post content summary
            let yPosition = 70;
            pdf.text('Post Content:', 20, yPosition);
            yPosition += 10;
            
            // Clean and truncate post content
            const contentLines = this.wrapText(pdf, this.stripHtml(post.content), 170, 20);
            const maxContentLines = 15; // Limit content to prevent overflow
            const displayLines = contentLines.slice(0, maxContentLines);
            
            displayLines.forEach(line => {
                pdf.text(line, 20, yPosition);
                yPosition += 7;
            });
            
            if (contentLines.length > maxContentLines) {
                pdf.text('... (content truncated)', 20, yPosition);
                yPosition += 7;
            }
            
            yPosition += 10;
            
            // YouTube video link
            if (post.video_url) {
                pdf.setTextColor(231, 76, 60);
                pdf.text('YouTube Video Link:', 20, yPosition);
                yPosition += 10;
                pdf.setTextColor(52, 152, 219);
                pdf.text(post.video_url, 20, yPosition);
                yPosition += 15;
            }
            
            // Statistics overview
            pdf.setFontSize(14);
            pdf.setTextColor(44, 62, 80);
            pdf.text('Statistics Overview:', 20, yPosition);
            yPosition += 15;
            
            pdf.setFontSize(11);
            const stats = [
                `Total Views: ${this.currentPostStats.totalViews}`,
                `Video Plays: ${this.currentPostStats.videoPlays}`,
                `Comments: ${this.currentPostStats.commentsCount}`,
                `Post Age: ${Math.floor((new Date() - new Date(post.created_at)) / (1000 * 60 * 60 * 24))} days`,
                `Created: ${new Date(post.created_at).toLocaleDateString()}`,
                `Last Updated: ${new Date(post.updated_at).toLocaleDateString()}`
            ];
            
            stats.forEach(stat => {
                pdf.text(`• ${stat}`, 25, yPosition);
                yPosition += 8;
            });
            
            yPosition += 10;
            
            // Recent activity
            if (this.currentPostStats.recentActivity && this.currentPostStats.recentActivity.length > 0) {
                pdf.setFontSize(14);
                pdf.setTextColor(44, 62, 80);
                pdf.text('Recent Activity:', 20, yPosition);
                yPosition += 15;
                
                pdf.setFontSize(10);
                const maxActivities = 10;
                const activities = this.currentPostStats.recentActivity.slice(0, maxActivities);
                
                activities.forEach(activity => {
                    const activityText = `• ${activity.type} - ${new Date(activity.timestamp).toLocaleString()}`;
                    if (activity.metadata) {
                        const metadata = typeof activity.metadata === 'string' ? activity.metadata : JSON.stringify(activity.metadata);
                        pdf.text(activityText, 25, yPosition);
                        yPosition += 6;
                        pdf.setTextColor(128, 128, 128);
                        pdf.text(`  ${metadata.substring(0, 80)}`, 25, yPosition);
                        pdf.setTextColor(44, 62, 80);
                        yPosition += 8;
                    } else {
                        pdf.text(activityText, 25, yPosition);
                        yPosition += 8;
                    }
                    
                    // Start new page if needed
                    if (yPosition > 260) {
                        pdf.addPage();
                        yPosition = 30;
                    }
                });
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
            
            // Save the PDF
            const fileName = `post-stats-${this.slugify(this.currentPostTitle)}-${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(fileName);
            
            this.showSuccess('PDF report generated successfully!');
            
        } catch (error) {
            console.error('Error generating PDF:', error);
            this.showError('Failed to generate PDF report');
        } finally {
            exportBtn.disabled = false;
            exportBtn.innerHTML = '<i class="fas fa-file-pdf"></i> Export PDF';
        }
    }
    
    // Helper method to strip HTML tags
    stripHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }
    
    // Helper method to wrap text for PDF
    wrapText(pdf, text, maxWidth, x) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        words.forEach(word => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const testWidth = pdf.getTextWidth(testLine);
            
            if (testWidth > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        return lines;
    }
    
    // Helper method to create URL-friendly slugs
    slugify(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
}

// Make AdminDashboard available globally
window.AdminDashboard = AdminDashboard;

// Initialize admin dashboard when DOM is loaded - but only after authentication
// This will be called by the AuthManager when authentication is confirmed
document.addEventListener('DOMContentLoaded', () => {
    // Don't initialize here - let auth.js handle initialization after login
    
    // Add global error handler to catch any issues
    window.addEventListener('error', (event) => {
        console.error('Global error caught:', event.error);
        console.error('Error occurred in:', event.filename, 'at line', event.lineno);
    });
    
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
    });
});
