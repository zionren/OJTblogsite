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
                } else {
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

        // Window resize handler for charts responsiveness
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.resizeCharts();
            }, 250);
        });
    }

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
                if (tabName === 'analytics') {
                    if (this.cachedAnalytics) {
                        console.log('Using cached analytics data', this.cachedAnalytics);
                        this.renderAnalytics(this.cachedAnalytics);
                    } else {
                        console.log('Loading analytics for the first time - no cache found');
                        this.loadAnalytics();
                    }
                } else if (tabName === 'posts') {
                    if (this.cachedPosts) {
                        console.log('Using cached posts data', this.cachedPosts);
                        this.renderPosts(this.cachedPosts);
                    } else {
                        console.log('Loading posts for the first time - no cache found');
                        this.loadPosts();
                    }
                } else {
                    console.log(`No data loading needed for ${tabName} tab`);
                }
            } else {
                console.log('No token or invalid token, skipping data load');
            }
        } catch (error) {
            console.error('Error in switchTab:', error);
            // Don't let errors break the entire dashboard
        }
    }

    async loadAnalytics() {
        if (!this.token) {
            console.warn('No token available for analytics');
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
            const startDate = document.getElementById('start-date')?.value || '';
            const endDate = document.getElementById('end-date')?.value || '';
            
            let url = '/api/analytics/dashboard';
            if (startDate && endDate) {
                url += `?startDate=${startDate}&endDate=${endDate}`;
            }

            console.log('Loading analytics from:', url);

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Analytics response status:', response.status);

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    console.error('Authentication failed, redirecting to login');
                    localStorage.removeItem('admin_token');
                    window.location.reload();
                    return;
                }
                const errorData = await response.text();
                console.error('Analytics API error:', response.status, errorData);
                throw new Error(`Failed to load analytics: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Analytics data received:', data);
            
            // Cache the data
            this.cachedAnalytics = data;
            console.log('Analytics data cached:', this.cachedAnalytics);
            
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
            const response = await fetch('/api/posts?published=false', {
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

    hideNotificationModal() {
        document.getElementById('notification-modal-overlay').classList.remove('active');
        document.body.style.overflow = '';
    }

    hideDeleteModal() {
        document.getElementById('delete-modal-overlay').classList.remove('active');
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

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        // Show error notification modal
        console.error(message);
        this.showNotificationModal(message, 'error');
    }

    showSuccess(message) {
        // Show success notification modal
        console.log(message);
        this.showNotificationModal(message, 'success');
    }

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

    resizeCharts() {
        // Resize all existing charts
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.resize === 'function') {
                chart.resize();
                
                // Update options for better mobile display
                const isMobile = window.innerWidth <= 768;
                const isSmallMobile = window.innerWidth <= 480;
                
                try {
                    if (chart.options && chart.options.plugins && chart.options.plugins.legend) {
                        chart.options.plugins.legend.display = !isSmallMobile;
                        chart.options.plugins.legend.labels.font.size = isMobile ? 10 : 12;
                    }
                }
                catch (error) {
                    console.error("Failed to update the chart:", error);
                    // do not let the errors break the dashboard itself
                    this.showNotificationModal('Failed to update chart options. Please try refreshing the page.', 'error');
                }
                
                if (chart.options && chart.options.scales) {
                    // Update tick limits based on screen size
                    if (chart.options.scales.y && chart.options.scales.y.ticks) {
                        chart.options.scales.y.ticks.maxTicksLimit = isMobile ? 4 : 6;
                        chart.options.scales.y.ticks.font.size = isMobile ? 9 : 11;
                    }
                    if (chart.options.scales.x && chart.options.scales.x.ticks) {
                        chart.options.scales.x.ticks.maxTicksLimit = isMobile ? 6 : 10;
                        chart.options.scales.x.ticks.font.size = isMobile ? 9 : 11;
                    }
                }
                
                chart.update('resize');
            }
        });
    }

    isTokenValid() {
        if (!this.token) return false;
        
        try {
            const payload = JSON.parse(atob(this.token.split('.')[1]));
            const now = Date.now() / 1000;
            return payload.exp > now;
        } 
        catch (error) {
            console.error("Failed to validate post token:", error);
            // If we can't parse the token, treat it as invalid
            return false;
        }
    }

    // Debugging in browser console in case of possible errors in the situation
    debugState() {
        console.log('=== ADMIN DASHBOARD DEBUG STATE ===');
        console.log('Token:', this.token ? 'present' : 'missing');
        console.log('Current tab:', this.currentTab);
        console.log('Cache state:', {
            analytics: this.cachedAnalytics ? 'CACHED' : 'NOT CACHED',
            posts: this.cachedPosts ? 'CACHED' : 'NOT CACHED'
        });
        console.log('Charts:', Object.keys(this.charts));
        console.log('===============================');
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
