// Post page functionality
class PostPage {
    constructor() {
        this.postSlug = this.getPostSlugFromUrl();
        this.sessionId = this.generateSessionId();
        this.post = null;
        this.viewStartTime = Date.now();
        this.init();
    }

    init() {
        this.loadPost();
        this.setupEventListeners();
    }

    getPostSlugFromUrl() {
        const path = window.location.pathname;
        const segments = path.split('/');
        return segments[segments.length - 1];
    }

    generateSessionId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    setupEventListeners() {
        // Like button
        document.getElementById('like-btn').addEventListener('click', () => {
            this.toggleLike();
        });

        // Comment form
        document.getElementById('comment-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitComment();
        });

        // Track when user leaves page
        window.addEventListener('beforeunload', () => {
            this.trackViewTime();
        });

        // Track video play events
        document.addEventListener('play', (e) => {
            if (e.target.tagName === 'IFRAME') {
                this.trackEvent('video_play', this.post.id);
            }
        }, true);

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

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('notification-modal-overlay').classList.contains('active')) {
                this.hideNotificationModal();
            }
        });
    }

    async loadPost() {
        const loading = document.getElementById('loading');
        const errorMessage = document.getElementById('error-message');
        const postArticle = document.getElementById('post-article');
        const commentsSection = document.getElementById('comments-section');

        try {
            loading.style.display = 'block';
            errorMessage.style.display = 'none';

            const response = await fetch(`/api/posts/${this.postSlug}`, {
                headers: {
                    'X-Session-ID': this.sessionId
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Post not found');
                }
                throw new Error('Failed to load post');
            }

            this.post = await response.json();
            
            loading.style.display = 'none';
            postArticle.style.display = 'block';
            commentsSection.style.display = 'block';

            this.renderPost();
            this.loadComments();

        } catch (error) {
            console.error('Error loading post:', error);
            loading.style.display = 'none';
            errorMessage.style.display = 'block';
            document.getElementById('error-text').textContent = error.message;
        }
    }

    renderPost() {
        // Update page title
        document.title = `${this.post.title} - Blog Site`;
        
        // Render post content
        document.getElementById('post-title').textContent = this.post.title;
        document.getElementById('post-date').textContent = this.formatDate(this.post.created_at);
        document.getElementById('post-views').innerHTML = `<i class="fas fa-eye"></i> ${this.post.views} views`;
        document.getElementById('post-body').innerHTML = this.formatContent(this.post.content);

        // Render video if exists
        if (this.post.youtube_url) {
            const videoContainer = document.getElementById('post-video');
            const iframe = document.getElementById('youtube-iframe');
            
            videoContainer.style.display = 'block';
            
            // Show thumbnail first, load video on click
            this.setupVideoThumbnail(this.post.youtube_url, videoContainer, iframe);
            
            // Track video load
            this.trackEvent('video_load', this.post.id);
        }

        // Initialize like state
        this.initializeLikeState();
    }

    async loadComments() {
        try {
            const response = await fetch(`/api/posts/${this.post.id}/comments`);
            
            if (!response.ok) {
                throw new Error('Failed to load comments');
            }

            const comments = await response.json();
            this.renderComments(comments);

        } catch (error) {
            console.error('Error loading comments:', error);
        }
    }

    renderComments(comments) {
        const commentsList = document.getElementById('comments-list');
        
        if (comments.length === 0) {
            commentsList.innerHTML = '<p class="no-comments">No comments yet. Be the first to comment!</p>';
            return;
        }

        commentsList.innerHTML = comments.map(comment => `
            <div class="comment">
                <div class="comment-header">
                    <span class="comment-author">${this.escapeHtml(comment.author_name)}</span>
                    <span class="comment-date">${this.formatDate(comment.created_at)}</span>
                </div>
                <div class="comment-content">${this.escapeHtml(comment.content)}</div>
            </div>
        `).join('');
    }

    // Custom validation functions
    validateCommentForm() {
        const name = document.getElementById('comment-name').value.trim();
        const content = document.getElementById('comment-content').value.trim();
        
        if (!name) {
            this.showNotificationModal('Name is required', 'error');
            return false;
        }
        
        if (!content) {
            this.showNotificationModal('Comment content is required', 'error');
            return false;
        }
        
        return true;
    }

    async submitComment() {
        // Validate form first
        if (!this.validateCommentForm()) {
            return;
        }
        
        const form = document.getElementById('comment-form');
        const formData = new FormData(form);
        
        const commentData = {
            author_name: formData.get('name'),
            content: formData.get('content')
        };

        try {
            const response = await fetch(`/api/posts/${this.post.id}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(commentData)
            });

            if (!response.ok) {
                throw new Error('Failed to submit comment');
            }

            form.reset();
            this.loadComments();
            this.trackEvent('comment_submit', this.post.id);

        } catch (error) {
            console.error('Error submitting comment:', error);
            this.showNotificationModal('Failed to submit comment. Please try again.', 'error');
        }
    }

    initializeLikeState() {
        const likeBtn = document.getElementById('like-btn');
        const likeCount = document.getElementById('like-count');
        
        // Check if user has liked this post
        const likedPosts = JSON.parse(localStorage.getItem('likedPosts') || '[]');
        const isLiked = likedPosts.includes(this.post.id);
        
        if (isLiked) {
            likeBtn.classList.add('liked');
            likeBtn.innerHTML = '<i class="fas fa-heart"></i> Liked';
        }
        
        // Get like count from localStorage (simplified approach)
        const likeCounts = JSON.parse(localStorage.getItem('likeCounts') || '{}');
        const currentLikes = likeCounts[this.post.id] || 0;
        likeCount.textContent = currentLikes;
    }

    toggleLike() {
        const likeBtn = document.getElementById('like-btn');
        const likeCount = document.getElementById('like-count');
        
        const likedPosts = JSON.parse(localStorage.getItem('likedPosts') || '[]');
        const likeCounts = JSON.parse(localStorage.getItem('likeCounts') || '{}');
        
        const isLiked = likedPosts.includes(this.post.id);
        
        if (isLiked) {
            // Unlike
            const index = likedPosts.indexOf(this.post.id);
            likedPosts.splice(index, 1);
            likeCounts[this.post.id] = Math.max(0, (likeCounts[this.post.id] || 0) - 1);
            
            likeBtn.classList.remove('liked');
            likeBtn.innerHTML = '<i class="far fa-heart"></i> Like';
            
            this.trackEvent('post_unlike', this.post.id);
        } else {
            // Like
            likedPosts.push(this.post.id);
            likeCounts[this.post.id] = (likeCounts[this.post.id] || 0) + 1;
            
            likeBtn.classList.add('liked');
            likeBtn.innerHTML = '<i class="fas fa-heart"></i> Liked';
            
            this.trackEvent('post_like', this.post.id);
        }
        
        localStorage.setItem('likedPosts', JSON.stringify(likedPosts));
        localStorage.setItem('likeCounts', JSON.stringify(likeCounts));
        likeCount.textContent = likeCounts[this.post.id];
    }

    setupVideoThumbnail(youtubeUrl, videoContainer, iframe) {
        const videoId = this.extractYouTubeId(youtubeUrl);
        if (!videoId) return;
        
        // Create thumbnail overlay
        const thumbnailOverlay = document.createElement('div');
        thumbnailOverlay.style.cssText = `
            position: relative;
            width: 100%;
            height: 400px;
            background-image: url('https://img.youtube.com/vi/${videoId}/maxresdefault.jpg');
            background-size: cover;
            background-position: center;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            overflow: hidden;
        `;
        
        // Create play button
        const playButton = document.createElement('div');
        playButton.innerHTML = `
            <div style="
                width: 80px;
                height: 80px;
                background: rgba(0, 0, 0, 0.8);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
            ">
                <i class="fas fa-play" style="
                    color: white;
                    font-size: 30px;
                    margin-left: 5px;
                "></i>
            </div>
        `;
        
        thumbnailOverlay.appendChild(playButton);
        
        // Add hover effect
        thumbnailOverlay.addEventListener('mouseenter', () => {
            playButton.firstElementChild.style.transform = 'scale(1.1)';
            playButton.firstElementChild.style.background = 'rgba(0, 0, 0, 0.9)';
        });
        
        thumbnailOverlay.addEventListener('mouseleave', () => {
            playButton.firstElementChild.style.transform = 'scale(1)';
            playButton.firstElementChild.style.background = 'rgba(0, 0, 0, 0.8)';
        });
        
        // Load video when clicked
        thumbnailOverlay.addEventListener('click', () => {
            iframe.src = this.getYouTubeEmbedUrl(youtubeUrl);
            iframe.style.display = 'block';
            thumbnailOverlay.style.display = 'none';
            
            // Track video play
            this.trackEvent('video_play', this.post.id);
        });
        
        // Hide iframe initially and show thumbnail
        iframe.style.display = 'none';
        videoContainer.insertBefore(thumbnailOverlay, iframe);
    }

    getYouTubeEmbedUrl(url) {
        const videoId = this.extractYouTubeId(url);
        if (!videoId) return '';
        
        // Explicitly disable autoplay, let user control when to play
        return `https://www.youtube.com/embed/${videoId}?autoplay=0&controls=1&showinfo=0&rel=0`;
    }

    extractYouTubeId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    formatContent(content) {
        // Basic content formatting
        return content
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>');
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    trackViewTime() {
        const timeSpent = Math.round((Date.now() - this.viewStartTime) / 1000);
        this.trackEvent('view_time', this.post.id, { timeSpent });
    }

    trackEvent(eventType, postId, additionalData = {}) {
        fetch('/api/analytics/track', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                eventType,
                postId,
                sessionId: this.sessionId,
                additionalData
            })
        }).catch(error => {
            console.error('Analytics tracking error:', error);
        });
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

    hideNotificationModal() {
        document.getElementById('notification-modal-overlay').classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Initialize the post page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.postPage = new PostPage();
});
