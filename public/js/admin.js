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

        // Activity logs event listeners
        this.setupActivityLogsEventListeners();

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
                } else {
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
                            color: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
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
                            color: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
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
        this.showLoading();
        try {
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: '50',
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
            this.renderActivityLogs(data.logs);
            this.updateLogsPagination(data.pagination);
            
            // Also load stats when loading logs
            await this.loadActivityStats();
        } catch (error) {
            console.error('Error loading activity logs:', error);
            this.showError('Failed to load activity logs');
        } finally {
            this.hideLoading();
        }
    }

    async loadActivityStats() {
        try {
            const response = await fetch('/api/admin/activity-stats', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const stats = await response.json();
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

    showSuccess(message) {
        this.showNotificationModal(message, 'success');
    }

    showError(message) {
        this.showNotificationModal(message, 'error');
    }

    hideNotificationModal() {
        document.getElementById('notification-modal-overlay').classList.remove('active');
        document.body.style.overflow = '';
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
