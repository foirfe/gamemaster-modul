//MAP MANAGER
// Variabel til at gemme kortet, så vi ikke opretter det to gange
let map = null; 
export function initMap(elementId) {
    // Hvis kortet allerede findes, så returner det bare (forhindrer fejl)
    if (map !== null) {
        // Dette lille trick sikrer, at kortet tegnes rigtigt, hvis det har været skjult
        setTimeout(() => { map.invalidateSize(); }, 100);
        return map;
    }
    // 1. Opret kortet og sæt start-koordinater (Her centreret over Danmark)
    // [Latitude, Longitude], Zoom-level (1-19)
    map = L.map(elementId).setView([56.2639, 9.5018], 7); 
    // 2. Tilføj selve kort-laget (Det visuelle "tapet" fra OpenStreetMap)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    return map;
}
// Tilføj en markør (når en opgave trækkes ind)
export function addMarkerToMap(lat, lng, title) {
    if (!map) return;

    L.marker([lat, lng])
        .addTo(map)
        .bindPopup(title) // Viser titlen, når man klikker på markøren
        .openPopup();
}