//Main // test
import { initMap, clearAllTaskLayers, clearSearchRadius , upsertSearchRadius , upsertTaskCircle, removeTaskCircle, centerMapOnLocation, upsertUserLocation } from './map-manager.js';
import { Scenario, Task } from './models.js';
import {  readJSONFile, saveScenarioToStorage,getScenariosFromStorage, deleteScenario } from './data-manager.js';
import { updateDashboardView } from './ui-manager.js';


const btnImportDashboard = document.getElementById('btn-import-scenarios');
const fileInputImport = document.getElementById('import-file-input');
const btnImportTasks = document.getElementById('btn-import');
const fileInputTasks = document.getElementById('task-file-input');
const radiusInput = document.getElementById("nearby-radius");
const radiusValue = document.getElementById("nearby-radius-value");
const btnNearby = document.getElementById("btn-filter-nearby");

const radiusWrapper = document.getElementById("search-radius-wrapper");
let manualLocationOverride = false;
let manualLatLng = null;
let lastGpsLatLng = null; 
let hasCenteredOnce = false;
let nearbyFilterEnabled = false; // default OFF (vis alle opgaver)

// --- IMPORT AF SCENARIER (Dashboard) ---
if (btnImportDashboard && fileInputImport) {
    btnImportDashboard.addEventListener('click', () => {
        fileInputImport.click();
    });

    fileInputImport.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        readJSONFile(file, (importedData) => {
            const newScenarios = Array.isArray(importedData) ? importedData : [importedData];
            let addedCount = 0;
            let updatedCount = 0;
            let invalidCount = 0;
            // Hent nuværende scenarier for at kunne tjekke om de findes
            const currentScenarios = getScenariosFromStorage();
            newScenarios.forEach(scenario => {
                // 1. VALIDERING: Er det overhovedet et scenarie?
                // Vi tjekker om de vigtigste felter findes.
                if (!scenario.scenarioId || !scenario.scenarioTitle) {
                    invalidCount++;
                    return; // Spring over denne
                }
                // TJEK: Findes det allerede?
                const exists = currentScenarios.some(s => s.scenarioId === scenario.scenarioId);
                if (exists) {
                    updatedCount++;
                } else {
                    addedCount++;
                }
                // GEM
                saveScenarioToStorage(scenario);
            });
            updateDashboardView();
            // FEEDBACK BESKED
            let msg = `Import færdig!\n`;
            if (addedCount > 0) msg += `- Oprettet: ${addedCount}\n`;
            if (updatedCount > 0) msg += `- Opdateret: ${updatedCount}\n`;
            if (invalidCount > 0) msg += `- Fejlede/Ugyldige: ${invalidCount}\n(Forkert format?)`;
            if (addedCount === 0 && updatedCount === 0) {
                 msg = "Ingen gyldige scenarier fundet i filen.";
            }
            alert(msg);
            fileInputImport.value = ''; 
        });
    });
}
// IMPORT AF OPGAVER
if (btnImportTasks && fileInputTasks) {
    btnImportTasks.addEventListener('click', () => {
        fileInputTasks.click();
    });
    fileInputTasks.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        readJSONFile(file, (importedData) => {
            const newTasks = Array.isArray(importedData) ? importedData : [importedData];
            let addedCount = 0;
            let updatedCount = 0;
            let invalidCount = 0;
            newTasks.forEach(newTask => {
                // VALIDERING: Er det faktisk en opgave?
                if (newTask.ID === undefined || !newTask.Titel) {
                    invalidCount++;
                    return; // Spring over
                }
                const existingIndex = allTasks.findIndex(t => t.ID === newTask.ID);
                if (existingIndex !== -1) {
                    allTasks[existingIndex] = newTask;
                    updatedCount++;
                } else {
                    allTasks.push(newTask);
                    addedCount++;
                }
            });
            filteredTasks = null;
            document.getElementById('scenario-type').value = "alle";
            renderTaskList();
            // FEEDBACK BESKED
            let msg = `Opgave import færdig!\n`;
            if (addedCount > 0) msg += `- Nye tilføjet: ${addedCount}\n`;
            if (updatedCount > 0) msg += `- Opdateret: ${updatedCount}\n`;
            if (invalidCount > 0) msg += `- Ugyldige data: ${invalidCount}\n(Du har nok valgt en forkert fil)`;
            alert(msg);
            fileInputTasks.value = '';
        });
    });
}

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

const typeSelect = document.getElementById('scenario-type');
if (typeSelect) {
    typeSelect.addEventListener('change', () => {
        // Kald vores nye samlede filter-funktion
        runTaskFilters();
    });
}

// Tegn listen i sidebar
function renderTaskList() {
    const listEl = document.getElementById('task-list');
    if (!listEl) return;
   listEl.replaceChildren();

    // Brug filteredTasks hvis vi har filter aktivt, ellers allTasks
    const tasksToShow = filteredTasks ?? allTasks;

    tasksToShow.forEach(teamTask => {
        // 1. Opret hovedelementet (LI)
        const li = document.createElement('li');
        li.classList.add('task-item');
        li.dataset.taskId = teamTask.ID;

        // 2. Opret containeren til indholdet
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('task-item-content');

        // 3. Opret tekst-gruppen (venstre side)
        const textGroupDiv = document.createElement('div');

        // --- TITEL LINJE ---
        const titleDiv = document.createElement('div');
        titleDiv.classList.add('task-item-title');

        // Ikon logik:
        const iconSpan = document.createElement('span');
        iconSpan.classList.add('material-symbols-outlined');
        iconSpan.style.verticalAlign = 'middle'; 
        iconSpan.style.marginRight = '5px';
        iconSpan.style.fontSize = '18px';
        if (teamTask.Type === 'Land') {
            iconSpan.style.color = `var(--military-green)`
            iconSpan.textContent = 'forest';
        } else {
            iconSpan.style.color = `var(--navy-blue)`
            iconSpan.textContent = 'sailing'; 
        }
        // Selve teksten til titlen
        // Vi bruger createTextNode for at kunne lægge den ved siden af ikonet
        const titleText = document.createTextNode(
            `${teamTask.ID} - ${teamTask.Titel} ${teamTask.taskTypeLabel || ''}`
        );
        // Saml titlen (Ikon + Tekst)
        titleDiv.appendChild(titleText);
        titleDiv.appendChild(iconSpan);

        // --- BESKRIVELSE ---
        const descDiv = document.createElement('div');
        descDiv.classList.add('task-item-desc');
        descDiv.textContent = teamTask.Beskrivelse; // Sikker indsættelse af tekst

        // Saml venstre side
        textGroupDiv.appendChild(titleDiv);
        textGroupDiv.appendChild(descDiv);
        // 4. Opret Badge (højre side)
        const badgeDiv = document.createElement('div');
        badgeDiv.classList.add('task-order-badge');
        // 5. Saml hele "content" div'en
        contentDiv.appendChild(textGroupDiv);
        contentDiv.appendChild(badgeDiv);
        li.appendChild(contentDiv);
        // 6. Håndter selection logic (uændret logik, men på det nye element)
        const isSelected = selectedTasks.some(t => t.ID === teamTask.ID);
        if (isSelected) li.classList.add('task-item-selected');
        const index = selectedTasks.findIndex(t => t.ID === teamTask.ID);
        if (index !== -1) {
        badgeDiv.textContent = index + 1; // Sætter tallet (f.eks. "1" eller "2")
        }
        li.addEventListener('click', () => {
            const existingIndex = selectedTasks.findIndex(t => t.ID === teamTask.ID);
            if (existingIndex === -1) {
                // Ikke valgt endnu → tilføj
                selectedTasks.push(teamTask);
            } else {
                // Allerede valgt → fjern
                selectedTasks.splice(existingIndex, 1);
                // Fjern cirkel fra kortet for den task
                if (typeof removeTaskCircle === 'function') {
                    removeTaskCircle(teamTask.ID);
                }
            }
            // Efter vi har opdateret selectedTasks, opdaterer vi UI
            updateTaskSelectionUIAndMap();
        });

        // Tilføj til listen i DOM'en
        listEl.appendChild(li);
    });
}

function updateTaskSelectionUIAndMap() {
    const listEl = document.getElementById('task-list');
    if (!listEl) return;

    // Ryd ALLE task-lag på kortet først (så gamle prikker ikke bliver hængende)
    clearAllTaskLayers();

    // Nulstil alle badges + selected-styles i listen
    const allLis = listEl.querySelectorAll('.task-item');

    allLis.forEach(li => {
        li.classList.remove('task-item-selected');

        const badge = li.querySelector('.task-order-badge');
        if (badge) badge.textContent = "";
    });

    // Gå valgte tasks igennem (i rækkefølge) og opdatér både liste + kort
    selectedTasks.forEach((t, index) => {
        const orderNumber = index + 1;

        // --- LISTE: marker + nummer badge ---
        const li = listEl.querySelector(`li[data-task-id="${t.ID}"]`);
        if (li) {
            li.classList.add('task-item-selected');

            const badge = li.querySelector('.task-order-badge');
            if (badge) badge.textContent = orderNumber;
        }

        // --- KORT: tegn marker + evt. radius ---
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
    task.taskTypeLabel = `` ?? "Ingen ikon"
    task.taskType = teamTask.Type ?? "";

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
    const hasLand = selectedTasks.some(t => t.Type === 'Land');
    const hasWater = selectedTasks.some(t => t.Type === 'Vand');
    if (hasLand && hasWater) {
        currentScenario.scenarioEnvironment = "Kombineret";
    } else if (hasLand) {
        currentScenario.scenarioEnvironment = "Land";
    } else if (hasWater) {
        currentScenario.scenarioEnvironment = "Vand";
    } else {
        // Fallback hvis ingen tasks er valgt, eller tasks uden type
        currentScenario.scenarioEnvironment = "Kombineret"; 
    }
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
    // Nulstil UI felter
    document.getElementById('scenario-name').value = "";
    document.getElementById('scenario-type').value = "alle";
    document.getElementById('scenario-desc').value = "";
    filteredTasks = null;
    updateTaskSelectionUIAndMap();
}

// Funktion til at indlæse et EKSISTERENDE scenarie 
export async function editScenario(id) {
    const scenarios = getScenariosFromStorage();
    const foundScenario = scenarios.find(s => s.scenarioId === id);
    
    if (!foundScenario) {
        console.error("Scenarie ikke fundet:", id);
        return;
    }
    // Sæt currentScenario til det fundne
    currentScenario = foundScenario;

    // Sæt UI felter
    document.getElementById('scenario-name').value = currentScenario.scenarioTitle;
    document.getElementById('scenario-desc').value = currentScenario.scenarioDescription;
    document.getElementById('scenario-type').value = "alle";

    // Vi skal sikre at map og tasks er klar
    switchView('editor');
    initMap('map-container');
    if (allTasks.length === 0) await loadTasks();
    // Genopret selectedTasks baseret på scenariets gemte tasks
    // Vi skal matche dem med 'allTasks' for at få de originale data (som lokation osv.)
    selectedTasks = [];
    currentScenario.tasks.forEach(savedTask => {
        const originalId = parseInt(savedTask.taskId.replace('T', ''));
        // 1. Prøv at finde opgaven i de nuværende tasks
        let originalTask = allTasks.find(t => t.ID === originalId);
        // 2. HVIS opgaven IKKE findes (fordi den var en import, der er forsvundet ved refresh),
        // så genskaber vi den "rå" opgave ud fra scenarie-dataen.
        if (!originalTask) {
            console.log(`Genskaber manglende opgave med ID: ${originalId}`);
            originalTask = {
                ID: originalId,
                Titel: savedTask.taskTitle || "Genskabt opgave",
                Beskrivelse: savedTask.taskDescription || "",
                Type: savedTask.taskType || "Land", // Fallback hvis type mangler
                Lokation: [savedTask.mapLat, savedTask.mapLng], // Genskab koordinater
                Radius: savedTask.mapRadiusInMeters,
                Aktiveringsbetingelse: savedTask.mapType === 'zone' ? 'Zone' : 'Lokalitet', 
                // Bemærk: Valgmuligheder gemmes pt. ikke i Scenario-modellen, så de vil være tomme
                Valgmuligheder: [] 
            };

            // Tilføj den til allTasks, så den også vises i listen til venstre
            allTasks.push(originalTask);
        }

        // Tilføj til de valgte tasks
        selectedTasks.push(originalTask);
    });

   filteredTasks = null; 
    renderTaskList();
    updateTaskSelectionUIAndMap();
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

function runTaskFilters() {
    // 1. Start med alle tasks
    let tempTasks = allTasks;

    // 2. Filtrer på Type (hvis andet end "alle" er valgt)
    const typeSelect = document.getElementById('scenario-type');
    if (typeSelect && typeSelect.value !== 'alle') {
        const selectedType = typeSelect.value;
        tempTasks = tempTasks.filter(t => t.Type === selectedType);
    }

    // 3. Filtrer på Nærhed (hvis slået til)
    if (nearbyFilterEnabled && currentFilterLatLng) {
        tempTasks = tempTasks.filter(t => {
            if (!Array.isArray(t.Lokation) || t.Lokation.length < 2) return false;

            const tLat = Number(t.Lokation[0]);
            const tLng = Number(t.Lokation[1]);
            const d = distanceMeters(currentFilterLatLng.lat, currentFilterLatLng.lng, tLat, tLng);

            return d <= currentRadiusMeters;
        });
    }

    // Opdater den globale filteredTasks og tegn listen
    // Hvis vi viser "Alle" uden radius filter, er filteredTasks egentlig bare allTasks,
    // men for at renderTaskList ved hvad den skal bruge, sætter vi den her.
    filteredTasks = tempTasks;
    renderTaskList();
}

// Opdateret applyNearbyFilter (bruges af GPS/Radius logik)
function applyNearbyFilter(lat, lng, radiusMeters) {
    currentFilterLatLng = { lat, lng };
    currentRadiusMeters = Number(radiusMeters) || 0;
    
    // I stedet for at filtrere her, kalder vi hoved-filteret
    runTaskFilters();
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