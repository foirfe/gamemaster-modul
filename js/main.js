//Main // test
import { initMap, clearSearchRadius , upsertSearchRadius , upsertTaskCircle, removeTaskCircle, centerMapOnLocation, upsertUserLocation } from './map-manager.js';
import { Scenario, Task, Option } from './models.js';
import {  saveScenarioToStorage,getScenariosFromStorage, deleteScenario } from './data-manager.js';
import { renderDashboard } from './ui-manager.js';


const radiusInput = document.getElementById("nearby-radius");
const radiusValue = document.getElementById("nearby-radius-value");
const btnNearby = document.getElementById("btn-filter-nearby");
const btnReset = document.getElementById("btn-filter-reset");
const radiusWrapper = document.getElementById("search-radius-wrapper");
let manualLocationOverride = false;
let manualLatLng = null;
let lastGpsLatLng = null; 
let hasCenteredOnce = false;
let nearbyFilterEnabled = false; // default OFF (vis alle opgaver)


if (radiusInput && radiusValue) {
    radiusValue.textContent = `${radiusInput.value} m`;

    radiusInput.addEventListener("input", () => {
        radiusValue.textContent = `${radiusInput.value} m`;
        currentRadiusMeters = Number(radiusInput.value);

        if (nearbyFilterEnabled && currentFilterLatLng) {
            upsertSearchRadius(currentFilterLatLng.lat, currentFilterLatLng.lng, currentRadiusMeters);
            applyNearbyFilter(currentFilterLatLng.lat, currentFilterLatLng.lng, currentRadiusMeters);
        }
    });
}

// Gør funktioner tilgængelige globalt så ui-manager kan kalde dem
window.editScenario = editScenario;
window.handleDeleteScenario = (id) => {
    if (confirm('Er du sikker på, at du vil slette dette scenarie?')) {
        const success = deleteScenario(id);
        if (success) {
            updateDashboardView();
        }
    }
};



function updateDashboardView() {
    const allScenarios = getScenariosFromStorage();
    const activeScenarios = allScenarios.filter(s => s.scenarioIsActive !== false);
    renderDashboard(activeScenarios);
}
// Kaldes når siden loader
updateDashboardView();
// Globale variabler til editoren
let currentScenario = new Scenario(); 
let selectedTasks = []; 
let allTasks = [];

//Navigation
const dashboardView = document.getElementById('view-dashboard');
const editorView = document.getElementById('view-editor');
function switchView(viewName) {
    if (viewName === 'editor') {
        dashboardView.classList.add('view-hidden');
        dashboardView.classList.remove('view-active');
        editorView.classList.remove('view-hidden');
        editorView.classList.add('view-active')
            ;
    } else {
        // Tilbage til dashboard
        editorView.classList.add('view-hidden');
        editorView.classList.remove('view-active');
        dashboardView.classList.remove('view-hidden');
        dashboardView.classList.add('view-active');
        updateDashboardView();
    }
}

window.addEventListener("userLocationMoved", (e) => {
    const { lat, lng } = e.detail;

    manualLocationOverride = true;
    manualLatLng = { lat, lng };
    currentFilterLatLng = { lat, lng };

    // ✅ kun filtrér live hvis filter er slået til
    if (nearbyFilterEnabled) {
        upsertSearchRadius(lat, lng, currentRadiusMeters);
        applyNearbyFilter(lat, lng, currentRadiusMeters);
    }
});

document.getElementById('btn-back').addEventListener('click', () => {
    switchView('dashboard');
});

if (btnReset) {
    btnReset.addEventListener("click", () => {
        // Slå filter fra
        nearbyFilterEnabled = false;
        filteredTasks = null;

        // Reset "Vis opgaver i nærheden"-knappen
        if (btnNearby) {
            btnNearby.classList.remove("is-active");
            btnNearby.textContent = "VIS OPGAVER I NÆRHEDEN";
        }

        // SKJUL radius-slideren
        if (radiusWrapper) {
            radiusWrapper.classList.add("hidden");
        }

        // Fjern radius-cirkel på kortet
        clearSearchRadius();

        // Vis alle opgaver igen
        renderTaskList();
    });
}



// Hent tasks fra JSON-filen
async function loadTasks() {
    try {
        console.log('loadTasks() kaldt');

        const response = await fetch('data/dummy.json');  // filen i /data
        console.log('HTTP status for dummy.json:', response.status);

        if (!response.ok) {
            throw new Error('Kunne ikke hente dummy.json, status: ' + response.status);
        }

        allTasks = await response.json(); // gemmer arrayet
        console.log('Tasks indl�st:', allTasks);
    } catch (err) {
        console.error('Fejl i loadTasks():', err);
    }
}

// Tegn listen i sidebar
function renderTaskList() {
    const listEl = document.getElementById('task-list');
    if (!listEl) return;

    listEl.innerHTML = '';

    // Brug filteredTasks hvis vi har filter aktivt, ellers allTasks
    const tasksToShow = filteredTasks ?? allTasks;

    tasksToShow.forEach(teamTask => {
        const li = document.createElement('li');
        li.classList.add('task-item');

        li.innerHTML = `
    <div class="task-item-content">
        <div>
            <div class="task-item-title">${teamTask.ID} - ${teamTask.Titel}</div>
            <div class="task-item-desc">${teamTask.Beskrivelse}</div>
        </div>
        <div class="task-order-badge"></div>
    </div>
`;

        // gem ID på elementet
        li.dataset.taskId = teamTask.ID;


        const isSelected = selectedTasks.some(t => t.ID === teamTask.ID);
        if (isSelected) li.classList.add('task-item-selected');

        li.addEventListener('click', () => {
            const existingIndex = selectedTasks.findIndex(t => t.ID === teamTask.ID);

            if (existingIndex === -1) {
                // Ikke valgt endnu → tilføj
                selectedTasks.push(teamTask);
            } else {
                // Allerede valgt → fjern
                selectedTasks.splice(existingIndex, 1);
                // Fjern cirkel fra kortet for den task
                removeTaskCircle(teamTask.ID);
            }

            // Efter vi har opdateret selectedTasks, opdaterer vi både badges og cirkler
            updateTaskSelectionUIAndMap();
        });

        listEl.appendChild(li);

    });
}

        function updateTaskSelectionUIAndMap() {
            // 1) Nulstil alle badges + selected-styles
            const listEl = document.getElementById('task-list');
            const allLis = listEl.querySelectorAll('.task-item');

            allLis.forEach(li => {
                li.classList.remove('task-item-selected');
                const badge = li.querySelector('.task-order-badge');
                if (badge) badge.textContent = "";
            });

            // 2) Gå de valgte tasks igennem i rækkefølge og giv dem nummer + cirkel
            selectedTasks.forEach((t, index) => {
                const orderNumber = index + 1;

                // Find det li-element, der matcher tasken
                const li = listEl.querySelector(`li[data-task-id="${t.ID}"]`);
                if (li) {
                    li.classList.add('task-item-selected');
                    const badge = li.querySelector('.task-order-badge');
                    if (badge) badge.textContent = orderNumber;
                }

                // Tegn/Opdatér cirkel på kortet
                if (Array.isArray(t.Lokation) && t.Lokation.length >= 2) {
                    const lat = Number(t.Lokation[0]);
                    const lng = Number(t.Lokation[1]);
                    const radius = Number(t.Radius ?? 0);

                    upsertTaskCircle(t.ID, lat, lng, radius, orderNumber);
                }
            });
        }





//render tasknames
function mapTasksToScenario(teamTask, index) {
    const task = new Task();

    task.idT = index + 1;
    task.orderNumber = index + 1;

    task.taskId = `T${teamTask.ID}`;
    task.taskTitle = teamTask.Titel ?? "";
    task.taskDescription = teamTask.Beskrivelse ?? "";

    // Aktiveringsbetingelse: "Zone" -> zone, "Lokalitet" -> punkt
    const act = (teamTask.Aktiveringsbetingelse ?? "").toLowerCase();
    task.mapType = act === "zone" ? "zone" : "punkt";

    task.mapRadiusInMeters = Number(teamTask.Radius ?? 0);

    // Lokation: [lat, lng]
    if (Array.isArray(teamTask.Lokation) && teamTask.Lokation.length >= 2) {
        task.mapLat = Number(teamTask.Lokation[0]);
        task.mapLng = Number(teamTask.Lokation[1]);
    }

    task.mapLabel = `OP${index + 1}`;
    task.isActive = false;

    return task;
}


// "Gem" knap logic
document.getElementById('btn-save').addEventListener('click', () => {
    const nameInput = document.getElementById('scenario-name');
    const typeSelect = document.getElementById('scenario-type');
    const scenarioDesc = document.getElementById('scenario-desc')
    // Opdater objektet med værdier fra UI
    currentScenario.scenarioTitle = nameInput.value || "Uden navn";
    currentScenario.scenarioEnvironment = typeSelect.value === "choose" ? "" : typeSelect.value;
    currentScenario.scenarioDescription = scenarioDesc.value || "Ingen beskrivelse";
    currentScenario.scenarioCreatedTime = new Date(); // Opdater tidspunktet for redigering
    currentScenario.scenarioIsActive = true;
    // Konverter selectedTasks til det rigtige format
    currentScenario.tasks = selectedTasks.map((t, index) => mapTasksToScenario(t, index));

    // Gem (data-manager håndterer nu om det er update eller create)
    saveScenarioToStorage(currentScenario);
    
    // Gå tilbage
    switchView('dashboard');
    updateDashboardView();
});

// Funktion til at klargøre editor til et NYT scenarie
function resetEditor() {
    currentScenario = new Scenario();
    currentScenario.scenarioId = "S" + Date.now(); 
    currentScenario.scenarioCreatedBy = "Gamemaster"; // Her kunne der være en dynamisk bruger med auth.
    selectedTasks = [];
    filteredTasks = null;
    // Nulstil UI felter
    document.getElementById('scenario-name').value = "";
    document.getElementById('scenario-type').value = "choose";
    document.getElementById('scenario-desc').value = "";
    updateTaskSelectionUIAndMap();
}

// Funktion til at indlæse et EKSISTERENDE scenarie (kaldes fra ui-manager)
export async function editScenario(id) {
    const scenarios = getScenariosFromStorage();
    const foundScenario = scenarios.find(s => s.scenarioId === id);
    
    if (!foundScenario) {
        console.error("Scenarie ikke fundet:", id);
        return;
    }
    filteredTasks = null;
    // Sæt currentScenario til det fundne
    currentScenario = foundScenario;

    // Sæt UI felter
    document.getElementById('scenario-name').value = currentScenario.scenarioTitle;
    document.getElementById('scenario-desc').value = currentScenario.scenarioDescription;
    document.getElementById('scenario-type').value = currentScenario.scenarioEnvironment || "choose";

    // Vi skal sikre at map og tasks er klar
    switchView('editor');
    initMap('map-container');
    if (allTasks.length === 0) await loadTasks();

    // Genopret selectedTasks baseret på scenariets gemte tasks
    // Vi skal matche dem med 'allTasks' for at få de originale data (som lokation osv.)
    selectedTasks = [];
    
    currentScenario.tasks.forEach(savedTask => {
        // Vi antager at 'taskId' i savedTask svarer til 'T' + ID i allTasks (f.eks. T15 -> ID 15)
        // Eller vi matcher på ID hvis du har gemt det rå ID.
        const originalId = parseInt(savedTask.taskId.replace('T', ''));
        const originalTask = allTasks.find(t => t.ID === originalId);
        
        if (originalTask) {
            selectedTasks.push(originalTask);
        }
    });

    renderTaskList();
    updateTaskSelectionUIAndMap(); // Tegner cirklerne på kortet igen
}


// eksempel: når position opdateres



function onPositionUpdate(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = position.coords.accuracy;

    lastGpsLatLng = { lat, lng };

    if (!manualLocationOverride) {
        upsertUserLocation(lat, lng, null);

        // Centrer kun første gang, så kortet ikke "snapper tilbage"
        if (!hasCenteredOnce) {
            centerMapOnLocation(lat, lng, 15);
            hasCenteredOnce = true;
        }

        currentFilterLatLng = { lat, lng };
    } else {
        if (manualLatLng) {
            upsertUserLocation(manualLatLng.lat, manualLatLng.lng, accuracy);
        }
    }
}

//raidus på task

function distanceMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000; // meter
    const toRad = (x) => (x * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

//filter ud fra placering og radius
let currentFilterLatLng = null;   // {lat,lng}
let currentRadiusMeters = 5000;
let filteredTasks = null;         // null = vis alle

function applyNearbyFilter(lat, lng, radiusMeters) {
    currentFilterLatLng = { lat, lng };
    currentRadiusMeters = Number(radiusMeters) || 0;

    // Filtrer kun tasks der har lokation
    filteredTasks = allTasks.filter(t => {
        if (!Array.isArray(t.Lokation) || t.Lokation.length < 2) return false;

        const tLat = Number(t.Lokation[0]);
        const tLng = Number(t.Lokation[1]);
        const d = distanceMeters(lat, lng, tLat, tLng);

        return d <= currentRadiusMeters;
    });

    renderTaskList(); // bruger filteredTasks hvis den findes
}

const btnLocationReset = document.getElementById("btn-location-reset");

if (btnLocationReset) {
    btnLocationReset.addEventListener("click", () => {
        manualLocationOverride = false;
        manualLatLng = null;

        if (!lastGpsLatLng) {
            alert("GPS er ikke klar endnu – prøv igen om et øjeblik.");
            return;
        }

        currentFilterLatLng = { ...lastGpsLatLng };

        // Flyt markør + kort til GPS igen
        upsertUserLocation(currentFilterLatLng.lat, currentFilterLatLng.lng, null);
        centerMapOnLocation(currentFilterLatLng.lat, currentFilterLatLng.lng, 15);

        // ✅ Kun hvis filter er slået til
        if (nearbyFilterEnabled) {
            upsertSearchRadius(currentFilterLatLng.lat, currentFilterLatLng.lng, currentRadiusMeters);
            applyNearbyFilter(currentFilterLatLng.lat, currentFilterLatLng.lng, currentRadiusMeters);
        } else {
            // Filter er slået fra => vis alle + ingen radiuscirkel
            filteredTasks = null;
            renderTaskList();
            clearSearchRadius();
        }
    });
}


document.getElementById('btn-create-new').addEventListener('click', async () => {
    hasCenteredOnce = false;
    manualLocationOverride = false;
    manualLatLng = null;

    switchView('editor');
    initMap('map-container');
    resetEditor();

    navigator.geolocation.watchPosition(onPositionUpdate, console.error, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000
    });

    await loadTasks();
    renderTaskList();
});

if (btnNearby) {
    btnNearby.addEventListener("click", () => {
        nearbyFilterEnabled = !nearbyFilterEnabled;

        btnNearby.classList.toggle("is-active", nearbyFilterEnabled);
        btnNearby.textContent = nearbyFilterEnabled
            ? "VIS OPGAVER I NÆRHEDEN ✓"
            : "VIS OPGAVER I NÆRHEDEN";

        // ✅ vis/skjul slider UI
        if (radiusWrapper) {
            radiusWrapper.classList.toggle("hidden", !nearbyFilterEnabled);
        }

        if (nearbyFilterEnabled && !currentFilterLatLng) {
            alert("Flyt lokationsmarkøren eller vent på GPS, før du filtrerer.");
            nearbyFilterEnabled = false;

            btnNearby.classList.remove("is-active");
            btnNearby.textContent = "VIS OPGAVER I NÆRHEDEN";
            if (radiusWrapper) radiusWrapper.classList.add("hidden");
            return;
        }

        if (nearbyFilterEnabled) {
            upsertSearchRadius(currentFilterLatLng.lat, currentFilterLatLng.lng, currentRadiusMeters);
            applyNearbyFilter(currentFilterLatLng.lat, currentFilterLatLng.lng, currentRadiusMeters);
        } else {
            filteredTasks = null;
            renderTaskList();
            clearSearchRadius();
        }
    });
}