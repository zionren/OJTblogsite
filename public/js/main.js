// Main application logic
class BlogApp {
    constructor() {
        this.currentPage = 1;
        this.postsPerPage = 10;
        this.sessionId = this.generateSessionId();
        this.init();
    }

    init() {
        this.loadPosts();
        this.setupEventListeners();
        
        // Track page visit
        this.trackEvent('page_visit', null, { page: 'home' });
    }

    generateSessionId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    setupEventListeners() {
        // No additional event listeners needed for main page
    }

    async loadPosts() {
        const loading = document.getElementById('loading');
        const errorMessage = document.getElementById('error-message');
        const postsGrid = document.getElementById('posts-grid');
        const pagination = document.getElementById('pagination');

        try {
            loading.style.display = 'block';
            errorMessage.style.display = 'none';

            const response = await fetch(`/api/posts?page=${this.currentPage}&limit=${this.postsPerPage}`);
            if (!response.ok) {
                throw new Error('Failed to load posts');
            }

            const data = await response.json();
            
            loading.style.display = 'none';
            
            if (data.posts.length === 0) {
                postsGrid.innerHTML = '<div class="no-posts">No posts found.</div>';
                return;
            }

            this.renderPosts(data.posts);
            this.renderPagination(data.page, data.totalPages);

        } catch (error) {
            console.error('Error loading posts:', error);
            loading.style.display = 'none';
            errorMessage.style.display = 'block';
            document.getElementById('error-text').textContent = 'Failed to load posts. Please try again later.';
        }
    }

    renderPosts(posts) {
        const postsGrid = document.getElementById('posts-grid');
        
        postsGrid.innerHTML = posts.map(post => `
            <article class="post-card">
                <header class="post-card-header">
                    <h2 class="post-card-title">
                        <a href="/post/${post.slug}">${this.escapeHtml(post.title)}</a>
                    </h2>
                    <div class="post-card-meta">
                        <span class="post-date">${this.formatDate(post.created_at)}</span>
                        <div class="post-stats">
                            <span><i class="fas fa-eye"></i> ${post.views}</span>
                            <span><i class="fas fa-comments"></i> ${post.comment_count || 0}</span>
                        </div>
                    </div>
                </header>
                
                ${post.youtube_url ? `
                    <div class="post-card-video" id="video-container-${post.id}">
                        <div class="video-thumbnail" onclick="window.blogApp.loadVideo('${post.youtube_url}', ${post.id})"
                             style="position: relative; width: 100%; height: 200px; background-image: url('https://img.youtube.com/vi/${this.extractYouTubeId(post.youtube_url)}/hqdefault.jpg'); background-size: cover; background-position: center; background-color: #1a1a1a; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 8px; overflow: hidden;">
                            <div style="width: 60px; height: 60px; background: rgba(0, 0, 0, 0.8); border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease;">
                                <i class="fas fa-play" style="color: white; font-size: 20px; margin-left: 3px;"></i>
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                <div class="post-card-content">
                    <p class="post-card-excerpt">${this.createExcerpt(post.content)}</p>
                    <div class="post-card-actions">
                        <a href="/post/${post.slug}" class="read-more">Read More</a>
                    </div>
                </div>
            </article>
        `).join('');
    }

    renderPagination(currentPage, totalPages) {
        const pagination = document.getElementById('pagination');
        
        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }

        let paginationHTML = '';
        
        // Previous button
        if (currentPage > 1) {
            paginationHTML += `
                <button onclick="blogApp.changePage(${currentPage - 1})" class="prev-btn">
                    <i class="fas fa-chevron-left"></i> Previous
                </button>
            `;
        }

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            if (i === currentPage) {
                paginationHTML += `<button class="active" disabled>${i}</button>`;
            } else {
                paginationHTML += `<button onclick="blogApp.changePage(${i})">${i}</button>`;
            }
        }

        // Next button
        if (currentPage < totalPages) {
            paginationHTML += `
                <button onclick="blogApp.changePage(${currentPage + 1})" class="next-btn">
                    Next <i class="fas fa-chevron-right"></i>
                </button>
            `;
        }

        pagination.innerHTML = paginationHTML;
    }

    changePage(page) {
        this.currentPage = page;
        this.loadPosts();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    loadVideo(youtubeUrl, postId) {
        const videoContainer = document.getElementById(`video-container-${postId}`);
        const videoId = this.extractYouTubeId(youtubeUrl);
        
        if (!videoId || !videoContainer) return;
        
        // Replace thumbnail with iframe
        videoContainer.innerHTML = `
            <iframe src="${this.getYouTubeEmbedUrl(youtubeUrl)}" 
                    width="100%" height="200" frameborder="0" allowfullscreen>
            </iframe>
        `;
        
        // Track video play event
        this.trackEvent('video_play', postId);
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

    createExcerpt(content, maxLength = 150) {
        const textContent = content.replace(/<[^>]*>/g, '');
        if (textContent.length <= maxLength) return textContent;
        return textContent.substring(0, maxLength) + '...';
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

    trackEvent(eventType, postId) {
        fetch('/api/analytics/track', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                eventType,
                postId,
                sessionId: this.generateSessionId(),
                additionalData: {}
            })
        }).catch(error => {
            console.error('Analytics tracking error:', error);
        });
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.blogApp = new BlogApp();
});
