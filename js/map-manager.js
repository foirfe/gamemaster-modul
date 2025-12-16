// MAP MANAGER
let map = null;
let userMarker = null;
let userAccuracyCircle = null;
let searchRadiusCircle = null;



// Gemmer cirkler/markører pr task-ID
const taskLayers = new Map();
const SEARCH_RADIUS_CLASS = "search-radius-circle";


export function initMap(elementId) {
    if (map !== null) {
        setTimeout(() => { map.invalidateSize(); }, 100);
        return map;
    }

    // Startkort centreret på Danmark eller sidste kendte lokation
    let startLat = 56.2639;
    let startLng = 9.5018;
    let startZoom = 7;

    if (typeof window.getLastLocation === 'function') { 
        const lastLocation = window.getLastLocation(); 
        if (lastLocation && lastLocation.lat && lastLocation.lng) { 
            startLat = lastLocation.lat;
            startLng = lastLocation.lng;
            startZoom = 12; // zoom tættere ind
        }
    }

    map = L.map(elementId, { zoomControl: false }).setView([startLat, startLng], startZoom);

    // tidligere hardcodet visning af Danmark
    // map = L.map(elementId, { zoomControl: false }).setView([56.2639, 9.5018], 7);

    L.control.zoom({
        position: 'bottomright'
    }).addTo(map);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    return map;
}

// ------------------------------------------

// Centrer kortet på geo-lokation
export function centerMapOnLocation(lat, lng, zoomLevel = 15) {
    if (!map) return;

    map.setView([lat, lng], zoomLevel);
}

// ------------------------------------------
// Viser "du er her" på kortet (marker + accuracy cirkel)
// Kaldes igen -> opdaterer eksisterende i stedet for at lave ny
export function upsertUserLocation(lat, lng, accuracyMeters = null, draggable = true) {
    if (!map) return;

    const pos = [lat, lng];

    // Opret marker første gang
    if (!userMarker) {
        const icon = L.divIcon({
            className: "leaflet-user-icon",
            html: `<div class="user-dot"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        userMarker = L.marker(pos, { icon, draggable }).addTo(map);

        // Drag events (bind kun én gang)
        if (draggable) {
            userMarker.on("drag", (e) => {
                const p = e.target.getLatLng();
                if (userAccuracyCircle) userAccuracyCircle.setLatLng(p);
            });

            userMarker.on("dragend", (e) => {
                const p = e.target.getLatLng();
                window.dispatchEvent(new CustomEvent("userLocationMoved", {
                    detail: { lat: p.lat, lng: p.lng }
                }));
            });
        }
    } else {
        // Opdater eksisterende marker (vigtigt!)
        userMarker.setLatLng(pos);
    }

    // Accuracy circle: opret eller opdatér
    if (accuracyMeters && Number(accuracyMeters) > 0) {
        if (!userAccuracyCircle) {
            userAccuracyCircle = L.circle(pos, { radius: Number(accuracyMeters) }).addTo(map);
        } else {
            userAccuracyCircle.setLatLng(pos);
            userAccuracyCircle.setRadius(Number(accuracyMeters));
        }
    } else {
        if (userAccuracyCircle) {
            map.removeLayer(userAccuracyCircle);
            userAccuracyCircle = null;
        }
    }
}
// ------------------------------------------

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

export function upsertSearchRadius(lat, lng, radiusMeters) {
    if (!map) return;

    // Fjern ALT med vores class (robust hvis map-manager er loadet 2 gange)
    clearSearchRadius();

    if (!radiusMeters || Number(radiusMeters) <= 0) return;

    searchRadiusCircle = L.circle([lat, lng], {
        radius: Number(radiusMeters),
        className: SEARCH_RADIUS_CLASS
    }).addTo(map);
}

export function clearSearchRadius() {
    if (!map) return;

    // Fjern den vi selv holder styr på
    if (searchRadiusCircle) {
        map.removeLayer(searchRadiusCircle);
        searchRadiusCircle = null;
    }

    // Fjern også evt. andre search-radius cirkler (hvis der findes en “ekstra” instans)
    map.eachLayer((layer) => {
        if (layer?.options?.className === SEARCH_RADIUS_CLASS) {
            map.removeLayer(layer);
        }
    });
}

export function clearAllTaskLayers() {
    if (!map) return;

    for (const layer of taskLayers.values()) {
        map.removeLayer(layer);
    }
    taskLayers.clear();
}