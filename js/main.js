//Main // test
import { initMap, clearSearchRadius, upsertSearchRadius, centerMapOnLocation, upsertUserLocation } from './map-manager.js';
import { Scenario } from './models.js';
import {  readJSONFile, saveScenarioToStorage,getScenariosFromStorage, deleteScenario } from './data-manager.js';
import { updateDashboardView, renderTaskList, updateTaskSelectionUIAndMap, mapTasksToScenario, confirmModal } from './ui-manager.js';


const btnImportDashboard = document.getElementById('btn-import-scenarios');
const fileInputImport = document.getElementById('import-file-input');
const btnImportTasks = document.getElementById('btn-import');
const fileInputTasks = document.getElementById('task-file-input');
const radiusInput = document.getElementById("nearby-radius");
const radiusValue = document.getElementById("nearby-radius-value");
const btnNearby = document.getElementById("btn-filter-nearby");
const radiusWrapper = document.getElementById("search-radius-wrapper");
const btnEditRadius = document.getElementById('btn-edit-radius');
const radiusDisplayMode = document.getElementById('radius-display-mode');
const radiusEditMode = document.getElementById('radius-edit-mode');
const manualRadiusInput = document.getElementById('manual-radius-input');
const btnConfirmRadius = document.getElementById('btn-confirm-radius');
let manualLocationOverride = false;
let manualLatLng = null;
let lastGpsLatLng = null; 
let hasCenteredOnce = false;
let nearbyFilterEnabled = false; // default OFF (vis alle opgaver)
let currentScenario = new Scenario(); 
let selectedTasks = []; 
let allTasks = [];


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
            refreshTaskListUI();
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

    if (nearbyFilterEnabled) {
        upsertSearchRadius(lat, lng, currentRadiusMeters);
        applyNearbyFilter(lat, lng, currentRadiusMeters);
    } else {
        clearSearchRadius();
    }
});


function resetEditorUI() {
    // ryd inputfelter
    document.getElementById('scenario-name').value = "";
    document.getElementById('scenario-desc').value = "";
    document.getElementById('scenario-type').value = "alle";

    // ryd validering UI
    document.querySelectorAll(".field-error").forEach(el => el.classList.remove("field-error"));
    document.querySelectorAll(".field-error-msg").forEach(el => el.classList.remove("is-visible"));

    // ryd task state
    selectedTasks = [];
    filteredTasks = null;

    // ryd kort/UI for tasks (tegner ingenting)
    updateTaskSelectionUIAndMap(selectedTasks);
    refreshTaskListUI();

    // ryd nærhedsfilter UI/state
    nearbyFilterEnabled = false;
    clearSearchRadius();
    if (radiusWrapper) radiusWrapper.classList.add("hidden");
    if (btnNearby) {
        btnNearby.classList.remove("is-active");
        btnNearby.textContent = "VIS OPGAVER I NÆRHEDEN";
    }

    // nulstil scenario objekt (så du ikke gemmer på “gammelt”)
    currentScenario = new Scenario();
    currentScenario.scenarioId = "S" + Date.now();
    currentScenario.scenarioCreatedBy = "Gamemaster";
}

document.getElementById('btn-back').addEventListener('click', () => {
    resetEditorUI();
    switchView('dashboard');
});

function handleTaskToggle(taskClicked) {
    const existingIndex = selectedTasks.findIndex(t => t.ID === taskClicked.ID);
    if (existingIndex === -1) {
        // Tilføj
        selectedTasks.push(taskClicked);
    } else {
        // Fjern
        selectedTasks.splice(existingIndex, 1);
        // Vi behøver ikke kalde removeTaskCircle manuelt her, 
        // da updateTaskSelectionUIAndMap rydder og gentegner alt.
    }

    if (selectedTasks.length > 0) {
        document.getElementById("error-tasks")?.classList.remove("is-visible");
    }
    // Kald UI opdatering (i ui-manager) med den nye state
    updateTaskSelectionUIAndMap(selectedTasks);


}

function refreshTaskListUI() {
    // Bestem hvilke tasks der skal vises
    const tasksToShow = filteredTasks ?? allTasks;
    // Kald render funktionen fra ui-manager med DATA og CALLBACK
    renderTaskList(tasksToShow, selectedTasks, handleTaskToggle);
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

const typeSelect = document.getElementById('scenario-type');
if (typeSelect) {
    typeSelect.addEventListener('change', () => {
        // Kald vores nye samlede filter-funktion
        runTaskFilters();
    });
}


// ---------- VALIDATION (clean) ----------
function toggleError(inputEl, msgId, show) {
    const msgEl = document.getElementById(msgId);
    if (inputEl) inputEl.classList.toggle("field-error", show);
    msgEl?.classList.toggle("is-visible", show);
}

function validateScenario({ nameEl, descEl, selectedTasks }) {
    const nameOk = nameEl.value.trim().length > 0;
    const descOk = descEl.value.trim().length > 0;
    const tasksOk = selectedTasks.length > 0;

    toggleError(nameEl, "error-name", !nameOk);
    toggleError(descEl, "error-desc", !descOk);
    document.getElementById("error-tasks")?.classList.toggle("is-visible", !tasksOk);

    return nameOk && descOk && tasksOk;
}

function wireLiveValidation() {
    const nameEl = document.getElementById("scenario-name");
    const descEl = document.getElementById("scenario-desc");

    nameEl?.addEventListener("input", () => toggleError(nameEl, "error-name", false));
    descEl?.addEventListener("input", () => toggleError(descEl, "error-desc", false));
}

// Kør live-validering én gang
wireLiveValidation();

// "Gem" knap logic
document.getElementById('btn-save').addEventListener('click', async () => {
        const nameEl = document.getElementById('scenario-name');
        const descEl = document.getElementById('scenario-desc');
        const typeSelect = document.getElementById('scenario-type');

        // ✅ STOP hvis validering fejler (viser fejl under felter)
        if (!validateScenario({ nameEl, descEl, selectedTasks })) return;



    currentScenario.scenarioTitle = nameEl.value || "Uden navn";
    currentScenario.scenarioEnvironment = typeSelect.value === "choose" ? "" : typeSelect.value;
    currentScenario.scenarioDescription = descEl.value || "Ingen beskrivelse";
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

    const env = currentScenario.scenarioEnvironment || "Ikke angivet";
    let ok = false;
    try {
        ok = await confirmModal({
            title: "Vil du gemme scenariet?",
            lines: [
                `Titel: ${nameEl.value.trim()}`,
                `Type: ${env}`,
                `Antal opgaver: ${selectedTasks.length}`
            ],
            confirmText: "Ja, gem",
            cancelText: "Annuller"
        });
    } catch (e) {
        console.error("confirmModal fejlede:", e);
        alert("Modal fejlede – tjek console (F12).");
        return;
    }

    if (!ok) return;


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
    updateTaskSelectionUIAndMap(selectedTasks); 
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
                Valgmuligheder: savedTask.options
            };

            // Tilføj den til allTasks, så den også vises i listen til venstre
            allTasks.push(originalTask);
        }

        // Tilføj til de valgte tasks
        selectedTasks.push(originalTask);
    });

   filteredTasks = null; 
    renderTaskList(filteredTasks || allTasks, selectedTasks, handleTaskToggle);
    updateTaskSelectionUIAndMap(selectedTasks);
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
            upsertUserLocation(manualLatLng.lat, manualLatLng.lng, null);
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
    renderTaskList(filteredTasks, selectedTasks, handleTaskToggle);
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
           refreshTaskListUI();
            clearSearchRadius();
        }
    });
}

// 1. Klik på "Edit" -> Skift til input-mode
if (btnEditRadius) {
    btnEditRadius.addEventListener('click', () => {
        radiusDisplayMode.classList.add('hidden');
        radiusInput.classList.add('hidden');
        radiusEditMode.classList.remove('hidden');
        // Sæt nuværende værdi i input og fokuser
        manualRadiusInput.value = currentRadiusMeters;
        manualRadiusInput.focus();
    });
}

// 2. Klik på "Check" -> Gem og tilbage til tekst
if (btnConfirmRadius) {
    btnConfirmRadius.addEventListener('click', () => {
        finishManualEdit();
    });
}

// Tryk "Enter" i inputfeltet -> Gem
if (manualRadiusInput) {
    manualRadiusInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            finishManualEdit();
        }
    });
}

// Færdiggør redigering
function finishManualEdit() {
    let val = Number(manualRadiusInput.value);
    if (!val || val <= 0) val = 100; // Minimum sikkerhed
    // Opdater alt
    updateRadiusState(val, true);
    // Skift visning tilbage
    radiusEditMode.classList.add('hidden');
    radiusDisplayMode.classList.remove('hidden');
       radiusInput.classList.remove('hidden');
}

// Hjælpefunktion: Central opdatering af radius
function updateRadiusState(meters, updateSlider) {
    currentRadiusMeters = meters;
    // Opdater teksten
    if (radiusValue) radiusValue.textContent = `${meters} m`;

    // Opdater sliderens position
    if (updateSlider && radiusInput) {
        // Hvis værdien er større end sliderens max, udvider vi slideren dynamisk?
        // Eller vi lader den bare stå på max. Her sætter vi den bare.
        // Hvis du vil have slideren til at kunne følge med op til f.eks. 100km:
        if (meters > Number(radiusInput.max)) {
            radiusInput.max = meters; // Udvid slider range hvis nødvendigt
        }
        radiusInput.value = meters;
    }

    // Opdater kortet live
    if (nearbyFilterEnabled && currentFilterLatLng) {
        upsertSearchRadius(currentFilterLatLng.lat, currentFilterLatLng.lng, currentRadiusMeters);
        applyNearbyFilter(currentFilterLatLng.lat, currentFilterLatLng.lng, currentRadiusMeters);
    }
}


//OPRET NYT SCENARIE KNAP
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
    refreshTaskListUI();
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
            refreshTaskListUI();
            clearSearchRadius();
        }
    });
}

