
import { api } from '../services/api.js';
import { ui } from '../utils/ui.js';

export class ActivityLogManager {
    constructor() {
        this.currentLogsPage = 1;
        this.totalLogsPages = 1;
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
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

    async loadActivityLogs(page = 1, filters = {}) {
        try {
            // ui.showLoading(); // Assuming UI has this or we skip

            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: '50',
                ...filters
            });

            const response = await api.get('/analytics/activity-logs', Object.fromEntries(queryParams));

            // API service handles errors and calls response.json()
            if (response) {
                this.renderActivityLogs(response.logs);
                this.updateLogsPagination({
                    currentPage: response.page,
                    totalPages: response.totalPages,
                    totalLogs: response.total
                });
                this.loadActivityStats(); // Load stats as well
            }
        } catch (error) {
            ui.showError('Failed to load activity logs');
        } finally {
            // ui.hideLoading();
        }
    }

    async loadActivityStats() {
        try {
            const stats = await api.get('/analytics/activity-stats');
            if (stats) {
                this.renderActivityStats(stats);
            }
        } catch (error) {
            console.error('Error loading activity stats:', error);
        }
    }

    renderActivityLogs(logs) {
        const tbody = document.getElementById('logs-table-body');
        if (!tbody) return;

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
        const totalLogsEl = document.getElementById('total-logs-count');
        if (totalLogsEl) totalLogsEl.textContent = stats.totalLogs;

        const createActions = stats.actionStats.find(s => s.action === 'CREATE');
        const updateActions = stats.actionStats.find(s => s.action === 'UPDATE');
        const deleteActions = stats.actionStats.find(s => s.action === 'DELETE');

        const createEl = document.getElementById('create-actions-count');
        const updateEl = document.getElementById('update-actions-count');
        const deleteEl = document.getElementById('delete-actions-count');

        if (createEl) createEl.textContent = createActions ? createActions.count : 0;
        if (updateEl) updateEl.textContent = updateActions ? updateActions.count : 0;
        if (deleteEl) deleteEl.textContent = deleteActions ? deleteActions.count : 0;
    }

    updateLogsPagination(pagination) {
        const prevBtn = document.getElementById('logs-prev-page');
        const nextBtn = document.getElementById('logs-next-page');
        const info = document.getElementById('logs-pagination-info');

        if (prevBtn) prevBtn.disabled = pagination.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = pagination.currentPage >= pagination.totalPages;
        if (info) info.textContent = `Page ${pagination.currentPage} of ${pagination.totalPages} (${pagination.totalLogs} total)`;

        this.currentLogsPage = pagination.currentPage;
        this.totalLogsPages = pagination.totalPages;
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
        const actionEl = document.getElementById('log-action-filter');
        const entityEl = document.getElementById('log-entity-filter');
        const userEl = document.getElementById('log-user-filter');

        if (actionEl) actionEl.value = '';
        if (entityEl) entityEl.value = '';
        if (userEl) userEl.value = '';
    }

    async exportActivityLogs() {
        try {
            const filters = this.getLogFilters();
            const queryParams = new URLSearchParams({
                limit: '10000',
                ...filters
            });

            const data = await api.get('/analytics/activity-logs', Object.fromEntries(queryParams));
            if (data) {
                this.downloadLogsAsCSV(data.logs);
            }
        } catch (error) {
            ui.showError('Failed to export activity logs');
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
                JSON.stringify(log.details || {}).replace(/"/g, '""'), // Simple handling
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
}
