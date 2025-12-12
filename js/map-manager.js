// MAP MANAGER
let map = null;

// Gemmer cirkler/markører pr task-ID
const taskLayers = new Map();

export function initMap(elementId) {
    if (map !== null) {
        setTimeout(() => { map.invalidateSize(); }, 100);
        return map;
    }

    map = L.map(elementId, { zoomControl: false }).setView([56.2639, 9.5018], 7);

    L.control.zoom({
        position: 'bottomright'
    }).addTo(map);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    return map;
}

// Bruges hvis du vil have en almindelig markør
export function addMarkerToMap(lat, lng, title) {
    if (!map) return;

    L.marker([lat, lng])
        .addTo(map)
        .bindPopup(title)
        .openPopup();
}

// NYT: tegn / opdatér cirkel med nummer
export function upsertTaskCircle(taskId, lat, lng, radiusMeters, orderNumber) {
    if (!map) return;

    // Fjern gammel, hvis der findes en
    const existing = taskLayers.get(taskId);
    if (existing) {
        map.removeLayer(existing);
    }

    const radius = radiusMeters > 0 ? radiusMeters : 50;

    const circle = L.circle([lat, lng], {
        radius: radius
    }).addTo(map);

    // Nummer i midten
    circle.bindTooltip(orderNumber.toString(), {
        permanent: true,
        direction: 'center',
        className: 'task-order-label'
    });

    taskLayers.set(taskId, circle);
}

// NYT: fjern cirkel når task fravælges
export function removeTaskCircle(taskId) {
    if (!map) return;

    const layer = taskLayers.get(taskId);
    if (layer) {
        map.removeLayer(layer);
        taskLayers.delete(taskId);
    }
}

