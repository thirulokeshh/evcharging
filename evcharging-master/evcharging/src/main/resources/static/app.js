/**
 * EV Charging Station Dashboard - Core Application Logic
 */

// Application State
let stations = [];
let map = null;
let markers = {};
let stompClient = null;
let reconnectTimer = null;
let currentFilter = 'all'; // 'all', 'AVAILABLE', 'BUSY'
let searchQuery = '';

// Base API and WebSocket URLs (Relative to the current host)
const API_BASE = '/api/stations';
const WS_ENDPOINT = '/ws';
const TOPIC_STATUS = '/topic/station-status';

// DOM Elements
const connIndicator = document.getElementById('conn-indicator');
const connText = document.getElementById('conn-text');
const reconnectBtn = document.getElementById('reconnect-btn');
const statTotal = document.getElementById('stat-total');
const statAvailable = document.getElementById('stat-available');
const statBusy = document.getElementById('stat-busy');
const searchInput = document.getElementById('search-input');
const filterBtns = document.querySelectorAll('.btn-filter');
const openAddModalBtn = document.getElementById('open-add-modal-btn');
const emptyAddBtn = document.getElementById('empty-add-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelModalBtn = document.getElementById('cancel-modal-btn');
const addModal = document.getElementById('add-modal');
const addStationForm = document.getElementById('add-station-form');
const activityLog = document.getElementById('activity-log');
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const stationsGrid = document.getElementById('stations-grid');
const resultCount = document.getElementById('result-count');
const toastContainer = document.getElementById('toast-container');

// Initialize App on DOM Load
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initEventListeners();
    fetchStations();
    connectWebSocket();
    
    // Initialize initial Lucide icons
    lucide.createIcons();
});

// 1. Map Initialization (Leaflet.js)
function initMap() {
    // Center map around Chennai coordinates (default viewport)
    map = L.map('map', {
        zoomControl: true,
        scrollWheelZoom: true
    }).setView([13.0827, 80.2707], 12);

    // Dark-themed tile layer (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // Map click handler (Interactive Coordinates Picker)
    map.on('click', (e) => {
        const lat = e.latlng.lat.toFixed(6);
        const lng = e.latlng.lng.toFixed(6);
        
        document.getElementById('station-lat').value = lat;
        document.getElementById('station-lng').value = lng;
        
        showToast(`Selected coordinates: ${lat}, ${lng}`, 'success');
        openModal();
    });
}

// Create custom colored Leaflet Marker
function createMarkerIcon(status) {
    const statusClass = status.toLowerCase();
    return L.divIcon({
        className: 'custom-map-marker-container',
        html: `
            <div class="custom-map-pin">
                <div class="pin-pulse ${statusClass}"></div>
                <div class="pin-marker ${statusClass}"></div>
            </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });
}

// 2. REST API Operations
async function fetchStations() {
    showLoading(true);
    try {
        const response = await fetch(API_BASE);
        if (!response.ok) throw new Error('Failed to retrieve stations');
        
        stations = await response.json();
        renderDashboard();
    } catch (error) {
        console.error('Error fetching stations:', error);
        showToast('Error loading stations from server', 'error');
        showLoading(false);
        checkEmptyState();
    }
}

async function createStation(area, latitude, longitude) {
    try {
        const response = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ area, latitude, longitude })
        });

        if (!response.ok) throw new Error('Failed to save charging station');
        
        const newStation = await response.json();
        stations.push(newStation);
        
        showToast(`Successfully added station: ${area}`, 'success');
        closeModal();
        
        // Render updated view
        renderDashboard();
        
        // Pan map to new station
        map.setView([latitude, longitude], 14);
        
    } catch (error) {
        console.error('Error creating station:', error);
        showToast('Failed to add station. Check input coordinates.', 'error');
    }
}

async function updateStationStatus(id, newStatus) {
    try {
        // Body is a raw JSON string of the status
        const response = await fetch(`${API_BASE}/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newStatus)
        });

        if (!response.ok) throw new Error('Status update failed');
        
        // Note: The UI updates will be driven automatically by the WebSocket subscription!
        // This confirms the live sync mechanism.
    } catch (error) {
        console.error('Error updating status:', error);
        showToast('Failed to update station status', 'error');
    }
}

// 3. WebSocket Connection (SockJS + STOMP)
function connectWebSocket() {
    updateConnectionUI('connecting', 'Connecting to real-time stream...');
    
    // Create SockJS socket and Stomp client wrapper
    const socket = new SockJS(WS_ENDPOINT);
    stompClient = Stomp.over(socket);
    
    // Disable console logging from Stomp to keep browser log clean (optional)
    stompClient.debug = null;
    
    stompClient.connect({}, 
        // Connection Success Callback
        (frame) => {
            updateConnectionUI('connected', 'Live Link Active');
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
            
            // Subscribe to status changes topic
            stompClient.subscribe(TOPIC_STATUS, (message) => {
                try {
                    const updatedStation = JSON.parse(message.body);
                    handleIncomingStatusUpdate(updatedStation);
                } catch (e) {
                    console.error('Failed to parse status update:', e);
                }
            });
        },
        // Connection Error Callback
        (error) => {
            console.warn('WebSocket connection lost:', error);
            updateConnectionUI('disconnected', 'Live Link Offline (Updates Stopped)');
            
            // Auto-reconnect flow
            scheduleReconnect();
        }
    );
}

function scheduleReconnect() {
    if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connectWebSocket();
        }, 5000); // Attempt reconnection every 5 seconds
    }
}

function handleIncomingStatusUpdate(updatedStation) {
    // 1. Find and update the local state array
    const index = stations.findIndex(s => s.id === updatedStation.id);
    let isNew = false;
    let oldStatus = '';
    
    if (index !== -1) {
        oldStatus = stations[index].status;
        stations[index] = updatedStation;
    } else {
        stations.push(updatedStation);
        isNew = true;
    }

    // 2. Add entry to live event stream
    logActivity(updatedStation, isNew, oldStatus);

    // 3. Perform soft updates on the specific card in DOM if visible to avoid full list re-render
    const cardEl = document.querySelector(`.station-card[data-id="${updatedStation.id}"]`);
    if (cardEl) {
        // Flash animation
        cardEl.classList.remove('updating');
        void cardEl.offsetWidth; // Trigger reflow to restart CSS animation
        cardEl.classList.add('updating');

        // Update status badge
        const badge = cardEl.querySelector('.badge-status');
        badge.className = `badge-status ${updatedStation.status.toLowerCase()}`;
        badge.innerHTML = `<span class="badge-status-dot"></span>${updatedStation.status}`;

        // Update action button
        const actionBtn = cardEl.querySelector('.btn-toggle');
        if (updatedStation.status === 'AVAILABLE') {
            actionBtn.className = 'btn btn-secondary btn-sm btn-toggle text-busy';
            actionBtn.innerHTML = '<i data-lucide="power"></i> Mark Busy';
        } else {
            actionBtn.className = 'btn btn-secondary btn-sm btn-toggle text-available';
            actionBtn.innerHTML = '<i data-lucide="check"></i> Mark Available';
        }
        
        lucide.createIcons({ node: cardEl });
    }

    // 4. Update the Leaflet map marker
    updateMapMarker(updatedStation);

    // 5. Update stats and counts
    updateAnalytics();
    
    // If filter matches, we may need to hide/show the card.
    // To be safe and clean, let's update list counts and check filters.
    filterAndSearchStations();
    
    showToast(`Station "${updatedStation.area}" is now ${updatedStation.status}`, 'success');
}

// 4. Activity Event Logger
function logActivity(station, isNew, oldStatus) {
    const timestamp = new Date().toLocaleTimeString();
    const item = document.createElement('div');
    const statusClass = station.status.toLowerCase();
    
    item.className = `activity-item ${statusClass}`;
    
    let message = '';
    if (isNew) {
        message = `Added new station <strong>${station.area}</strong> (${station.status})`;
    } else if (oldStatus !== station.status) {
        message = `<strong>${station.area}</strong> changed to <span class="text-${statusClass}">${station.status}</span>`;
    } else {
        message = `<strong>${station.area}</strong> details updated`;
    }
    
    item.innerHTML = `
        <span class="activity-time">${timestamp}</span>
        <span>${message}</span>
    `;
    
    // Remove empty state message
    const emptyLog = activityLog.querySelector('.activity-empty');
    if (emptyLog) emptyLog.remove();
    
    activityLog.insertBefore(item, activityLog.firstChild);
    
    // Cap log items to 30 to prevent memory growth
    if (activityLog.children.length > 30) {
        activityLog.removeChild(activityLog.lastChild);
    }
}

// 5. UI Rendering Engine
function renderDashboard() {
    showLoading(false);
    
    // Render Map Markers
    clearAllMapMarkers();
    stations.forEach(station => {
        addMapMarker(station);
    });
    
    // Fit map bounds to show all markers if stations exist
    if (stations.length > 0) {
        const group = new L.featureGroup(Object.values(markers));
        map.fitBounds(group.getBounds().pad(0.15));
    }
    
    // Render Filtered Station Grid
    filterAndSearchStations();
    
    // Update Stats Card
    updateAnalytics();
}

function filterAndSearchStations() {
    const query = searchQuery.toLowerCase().trim();
    
    const filtered = stations.filter(station => {
        const matchesSearch = station.area.toLowerCase().includes(query);
        const matchesFilter = currentFilter === 'all' || station.status === currentFilter;
        return matchesSearch && matchesFilter;
    });

    resultCount.textContent = `Showing ${filtered.length} of ${stations.length} stations`;
    
    // Sync map marker visibilities based on filters
    stations.forEach(station => {
        const marker = markers[station.id];
        if (!marker) return;
        
        const matchesSearch = station.area.toLowerCase().includes(query);
        const matchesFilter = currentFilter === 'all' || station.status === currentFilter;
        
        if (matchesSearch && matchesFilter) {
            marker.addTo(map);
            // reset opacity
            marker.getElement()?.classList.remove('hidden');
        } else {
            // Hide from map
            marker.remove();
        }
    });

    checkEmptyState(filtered.length === 0);
    
    if (filtered.length > 0) {
        stationsGrid.classList.remove('hidden');
        stationsGrid.innerHTML = filtered.map(station => createStationCardHTML(station)).join('');
        
        // Rebind events on the dynamically generated buttons
        bindCardActionButtons();
        
        // Reinitialize Lucide Icons for new cards
        lucide.createIcons({ node: stationsGrid });
    } else {
        stationsGrid.classList.add('hidden');
    }
}

function createStationCardHTML(station) {
    const statusClass = station.status.toLowerCase();
    const isAvailable = station.status === 'AVAILABLE';
    
    const actionBtnHTML = isAvailable 
        ? `<button class="btn btn-secondary btn-sm btn-toggle text-busy" data-id="${station.id}" data-action="BUSY">
            <i data-lucide="power"></i> Mark Busy
           </button>`
        : `<button class="btn btn-secondary btn-sm btn-toggle text-available" data-id="${station.id}" data-action="AVAILABLE">
            <i data-lucide="check"></i> Mark Available
           </button>`;

    return `
        <div class="station-card" data-id="${station.id}">
            <div class="card-header">
                <div class="station-info">
                    <h3>${station.area}</h3>
                    <span class="station-id">ID: STN-${station.id.toString().padStart(4, '0')}</span>
                </div>
                <div class="badge-status ${statusClass}">
                    <span class="badge-status-dot"></span>
                    ${station.status}
                </div>
            </div>
            
            <div class="station-coords">
                <i data-lucide="navigation"></i>
                <span class="coord-link" onclick="focusOnMarker(${station.id})">
                    ${station.latitude.toFixed(5)}, ${station.longitude.toFixed(5)}
                </span>
            </div>
            
            <div class="station-actions">
                ${actionBtnHTML}
            </div>
        </div>
    `;
}

function bindCardActionButtons() {
    stationsGrid.querySelectorAll('.btn-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.getAttribute('data-id'));
            const action = e.currentTarget.getAttribute('data-action');
            updateStationStatus(id, action);
        });
    });
}

// Helper to center and pop open a map marker
window.focusOnMarker = function(id) {
    const marker = markers[id];
    if (marker) {
        const station = stations.find(s => s.id === id);
        map.setView(marker.getLatLng(), 15);
        marker.openPopup();
    }
};

// 6. Map Markers Sync
function addMapMarker(station) {
    if (markers[station.id]) return; // Marker already exists

    const marker = L.marker([station.latitude, station.longitude], {
        icon: createMarkerIcon(station.status)
    });
    
    // Popup creation
    const popupContent = document.createElement('div');
    popupContent.className = 'popup-content';
    updateMarkerPopupHTML(popupContent, station);
    
    marker.bindPopup(popupContent);
    marker.addTo(map);
    markers[station.id] = marker;
}

function updateMapMarker(station) {
    const marker = markers[station.id];
    if (!marker) {
        // Add new marker if it was created during session
        addMapMarker(station);
        return;
    }

    // Update coordinates in case they shifted
    marker.setLatLng([station.latitude, station.longitude]);
    
    // Swap icon color
    marker.setIcon(createMarkerIcon(station.status));
    
    // Update popup content dynamically without closing it if open
    const popup = marker.getPopup();
    if (popup) {
        const contentNode = popup.getContent();
        if (contentNode instanceof HTMLElement) {
            updateMarkerPopupHTML(contentNode, station);
        }
    }
}

function updateMarkerPopupHTML(container, station) {
    const statusClass = station.status.toLowerCase();
    const nextStatus = station.status === 'AVAILABLE' ? 'BUSY' : 'AVAILABLE';
    const btnText = station.status === 'AVAILABLE' ? 'Mark Busy' : 'Mark Available';
    const btnColorClass = station.status === 'AVAILABLE' ? 'text-busy' : 'text-available';
    const iconName = station.status === 'AVAILABLE' ? 'power' : 'check';
    
    container.innerHTML = `
        <h4>${station.area}</h4>
        <div class="popup-status ${statusClass}">
            <span class="badge-status-dot"></span>${station.status}
        </div>
        <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 0.5rem;">
            Coords: ${station.latitude.toFixed(5)}, ${station.longitude.toFixed(5)}
        </div>
        <button class="btn btn-secondary btn-sm popup-btn ${btnColorClass}" onclick="updateStationStatus(${station.id}, '${nextStatus}')">
            <i data-lucide="${iconName}"></i> ${btnText}
        </button>
    `;
    
    // Trigger Lucide updates on popup contents
    setTimeout(() => lucide.createIcons({ node: container }), 20);
}

// Expose status update function to window for inline onclick on map popups
window.updateStationStatus = updateStationStatus;

function clearAllMapMarkers() {
    Object.values(markers).forEach(m => m.remove());
    markers = {};
}

// 7. Live Stats & Analytics Updater
function updateAnalytics() {
    const total = stations.length;
    const available = stations.filter(s => s.status === 'AVAILABLE').length;
    const busy = stations.filter(s => s.status === 'BUSY').length;
    
    statTotal.textContent = total;
    statAvailable.textContent = available;
    statBusy.textContent = busy;
}

// 8. Connection UI States
function updateConnectionUI(state, message) {
    connIndicator.className = 'dot';
    connText.className = 'status-text';
    
    if (state === 'connected') {
        connIndicator.classList.add('dot-connected');
        connText.classList.add('text-available');
        reconnectBtn.classList.add('hidden');
        document.querySelector('.status-panel').className = 'card status-panel connected';
    } else if (state === 'connecting') {
        connIndicator.classList.add('dot-connecting');
        connText.classList.add('text-warning');
        reconnectBtn.classList.add('hidden');
        document.querySelector('.status-panel').className = 'card status-panel';
    } else if (state === 'disconnected') {
        connIndicator.classList.add('dot-disconnected');
        connText.classList.add('text-busy');
        reconnectBtn.classList.remove('hidden');
        document.querySelector('.status-panel').className = 'card status-panel disconnected';
    }
    
    connText.textContent = message;
}

// 9. Toast Notification System
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'check-circle' : 'alert-circle';
    
    toast.innerHTML = `
        <i data-lucide="${icon}"></i>
        <div class="toast-message">${message}</div>
        <button class="toast-close">&times;</button>
    `;
    
    toastContainer.appendChild(toast);
    lucide.createIcons({ node: toast });
    
    // Close button event
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.remove();
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 5000);
}

// 10. General UI Helper States
function showLoading(show) {
    if (show) {
        loadingState.classList.remove('hidden');
        emptyState.classList.add('hidden');
        stationsGrid.classList.add('hidden');
    } else {
        loadingState.classList.add('hidden');
    }
}

function checkEmptyState(isGridEmpty) {
    const isTotalEmpty = stations.length === 0;
    
    if (isTotalEmpty) {
        emptyState.classList.remove('hidden');
        stationsGrid.classList.add('hidden');
        resultCount.textContent = 'Showing 0 stations';
    } else if (isGridEmpty) {
        emptyState.classList.add('hidden');
        stationsGrid.classList.add('hidden');
        // If grid is empty due to search filter, show a light banner or custom text in emptyState
        emptyState.querySelector('h3').textContent = 'No matching stations';
        emptyState.querySelector('p').textContent = 'Try adjusting your search query or status filter.';
        emptyState.querySelector('#empty-add-btn').classList.add('hidden');
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
        // Reset original empty state content for future uses
        emptyState.querySelector('h3').textContent = 'No Charging Stations Found';
        emptyState.querySelector('p').textContent = 'Get started by adding your first EV charging station location.';
        emptyState.querySelector('#empty-add-btn').classList.remove('hidden');
    }
}

function openModal() {
    addModal.classList.remove('hidden');
    document.getElementById('station-area').focus();
}

function closeModal() {
    addModal.classList.add('hidden');
    addStationForm.reset();
}

// 11. Event Listeners Config
function initEventListeners() {
    // Modal controls
    openAddModalBtn.addEventListener('click', openModal);
    emptyAddBtn.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);
    cancelModalBtn.addEventListener('click', closeModal);
    
    // Close modal on click outside card
    addModal.addEventListener('click', (e) => {
        if (e.target === addModal) closeModal();
    });

    // Form Submission
    addStationForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const area = document.getElementById('station-area').value.trim();
        const lat = parseFloat(document.getElementById('station-lat').value);
        const lng = parseFloat(document.getElementById('station-lng').value);
        
        if (area && !isNaN(lat) && !isNaN(lng)) {
            createStation(area, lat, lng);
        } else {
            showToast('Please fill out all fields with valid numbers', 'error');
        }
    });

    // Search Box Listener
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        filterAndSearchStations();
    });

    // Filter Buttons Listener
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            currentFilter = e.currentTarget.getAttribute('data-filter');
            filterAndSearchStations();
        });
    });

    // Connection Reconnect Button Listener
    reconnectBtn.addEventListener('click', () => {
        connectWebSocket();
    });
}
