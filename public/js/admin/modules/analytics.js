import { api } from '../services/api.js';
import { ui } from '../utils/ui.js';

export class AnalyticsManager {
    constructor() {
        this.charts = {};
        this.init();
    }

    init() {
        const filterBtn = document.getElementById('apply-filters');
        if (filterBtn) {
            filterBtn.addEventListener('click', () => this.loadAnalytics());
        }

        // Resize observer or window resize for charts
        window.addEventListener('resize', () => {
            this.resizeCharts();
        });
    }

    async loadAnalytics() {
        try {
            const startDate = document.getElementById('start-date')?.value;
            const endDate = document.getElementById('end-date')?.value;

            const params = {};
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;

            const data = await api.get('/analytics/dashboard', params);
            if (data) {
                this.renderAnalytics(data);
            }
        } catch (error) {
            ui.showError('Failed to load analytics');
        }
    }

    renderAnalytics(data) {
        // Update cards
        this.updateElement('total-visits', data.totalVisits?.toLocaleString() || 0);
        this.updateElement('avg-time', `${data.avgTimeSpent || 0}s`);
        this.updateElement('total-posts', data.mostViewed?.length || 0);

        // Render Charts
        this.renderDailyVisitsChart(data.dailyAnalytics);
        this.renderPostsVsVideosChart(data.mostViewed, data.mostWatched);
    }

    updateElement(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    renderDailyVisitsChart(dailyData) {
        const ctx = document.getElementById('daily-visits-chart')?.getContext('2d');
        if (!ctx) return;

        if (this.charts.dailyVisits) {
            this.charts.dailyVisits.destroy();
        }

        // Data processing...
        const labels = (dailyData || []).map(d => new Date(d.date).toLocaleDateString());
        const values = (dailyData || []).map(d => d.visits);

        // Check if Chart.js is loaded
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not loaded');
            return;
        }

        this.charts.dailyVisits = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Daily Visits',
                    data: values,
                    borderColor: '#2ecc71',
                    tension: 0.1
                }]
            },
            options: { responsiveness: true, maintainAspectRatio: false }
        });
    }

    renderPostsVsVideosChart(mostViewed, mostWatched) {
        const ctx = document.getElementById('posts-vs-videos-chart')?.getContext('2d');
        if (!ctx) return;

        if (this.charts.postsVsVideos) {
            this.charts.postsVsVideos.destroy();
        }

        // Simplified processing
        const labels = (mostViewed || []).slice(0, 5).map(p => p.title.substring(0, 15) + '...');
        const views = (mostViewed || []).slice(0, 5).map(p => p.views);

        if (typeof Chart === 'undefined') return;

        this.charts.postsVsVideos = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Views',
                    data: views,
                    backgroundColor: '#3498db'
                }]
            },
            options: { responsiveness: true, maintainAspectRatio: false }
        });
    }

    resizeCharts() {
        Object.values(this.charts).forEach(chart => chart.resize && chart.resize());
    }
}
