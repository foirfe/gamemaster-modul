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

// NYT: tegn / opdatér task som "badge-marker" (samme design som i listen)
// + valgfri radius-cirkel (hvis radiusMeters > 0)
export function upsertTaskCircle(taskId, lat, lng, radiusMeters, orderNumber) {
    if (!map) return;

    // Fjern gammel, hvis der findes en
    const existing = taskLayers.get(taskId);
    if (existing) {
        map.removeLayer(existing);
    }

    // Marker som badge med samme CSS-klasse som i sidebar
    const icon = L.divIcon({
        className: 'leaflet-task-icon',
        html: `<div class="task-order-badge">${orderNumber}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });

    const marker = L.marker([lat, lng], { icon });

    // Lav en layerGroup så vi kan have både marker + radius-cirkel (hvis ønsket)
    const layers = [marker];

    // Hvis det er en zone (radius > 0), tegner vi cirklen også
    if (radiusMeters && Number(radiusMeters) > 0) {
        const zoneCircle = L.circle([lat, lng], { radius: Number(radiusMeters) });
        layers.push(zoneCircle);
    }

    const group = L.layerGroup(layers).addTo(map);
    taskLayers.set(taskId, group);
}

// NYT: fjern marker + evt. radius-cirkel når task fravælges
export function removeTaskCircle(taskId) {
    if (!map) return;

    const layer = taskLayers.get(taskId);
    if (layer) {
        map.removeLayer(layer);
        taskLayers.delete(taskId);
    }
}