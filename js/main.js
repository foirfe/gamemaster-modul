//Main // test
import { initMap, clearSearchRadius, upsertSearchRadius, centerMapOnLocation, upsertUserLocation } from './map-manager.js';
import { Scenario } from './models.js';
import { readJSONFile, saveScenarioToStorage, getScenariosFromStorage, deleteScenario } from './data-manager.js';
import { updateDashboardView, renderTaskList, updateTaskSelectionUIAndMap, mapTasksToScenario, confirmModal, showInfoBox } from './ui-manager.js';


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

    fileInputImport.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        let importedData;

        try {
            importedData = await readJSONFile(file);
        } catch (err) {
            await confirmModal({
                title: "Kunne ikke læse fil",
                lines: [
                    err.message,
                    "Er det en gyldig JSON-fil?"
                ],
                confirmText: "OK",
                cancelText: "Luk"
            });
            fileInputImport.value = '';
            return;
        }


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

            await confirmModal({
                title: "Scenarier importeret",
                lines: msg.split("\n").filter(Boolean),
                confirmText: "OK",
                cancelText: "Luk"
            });

            fileInputImport.value = '';
    });
}
// IMPORT AF OPGAVER
if (btnImportTasks && fileInputTasks) {
    btnImportTasks.addEventListener('click', () => {
        fileInputTasks.click();
    });
    fileInputTasks.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        let importedData;
        try {
            importedData = await readJSONFile(file); // ✅ kun én gang, Promise-style
        } catch (err) {
            await confirmModal({
                title: "Kunne ikke læse fil",
                lines: [err.message, "Er det en gyldig JSON-fil?"],
                confirmText: "OK",
                cancelText: "Luk"
            });
            fileInputTasks.value = '';
            return;
        }

        const newTasks = Array.isArray(importedData) ? importedData : [importedData];
        let addedCount = 0;
        let updatedCount = 0;
        let invalidCount = 0;

        newTasks.forEach(newTask => {
            if (newTask.ID === undefined || !newTask.Titel) {
                invalidCount++;
                return;
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

        let msg = `Opgaver import færdig!\n`;
        if (addedCount > 0) msg += `- Nye tilføjet: ${addedCount}\n`;
        if (updatedCount > 0) msg += `- Opdateret: ${updatedCount}\n`;
        if (invalidCount > 0) msg += `- Ugyldige data: ${invalidCount}\n(Du har nok valgt en forkert fil)`;

        await confirmModal({
            title: "Opgaver importeret",
            lines: msg.split("\n").filter(Boolean),
            confirmText: "OK",
            cancelText: "Luk"
        });

        fileInputTasks.value = '';
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
window.handleDeleteScenario = async (id) => {
    const scenarios = getScenariosFromStorage();
    const scenario = scenarios.find(s => s.scenarioId === id);

    const ok = await confirmModal({
        title: "Slet scenarie?",
        lines: [
            `Titel: ${scenario?.scenarioTitle ?? "Ukendt scenarie"}`,
            "Scenariet bliver arkiveret og kan ikke gendannes."
        ],
        confirmText: "Ja, slet",
        cancelText: "Annuller"
    });

    if (!ok) return;

    const success = deleteScenario(id);
    if (success) {
        updateDashboardView();
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

    manualLocationOverride = false;
    manualLatLng = null;
    hasCenteredOnce = false;

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

function hasUnsavedEditorContent() {
    const name = document.getElementById('scenario-name')?.value.trim();
    const desc = document.getElementById('scenario-desc')?.value.trim();

    return (
        name.length > 0 ||
        desc.length > 0 ||
        selectedTasks.length > 0
    );
}

document.getElementById('btn-back').addEventListener('click', async () => {
    if (hasUnsavedEditorContent()) {
        const ok = await confirmModal({
            title: "Forlad scenarie?",
            lines: [
                "Du har indhold i scenariet, som ikke er gemt.",
                "Hvis du forlader siden nu, vil det gå tabt."
            ],
            confirmText: "Forlad uden at gemme",
            cancelText: "Bliv her"
        });

        if (!ok) return;
    }

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

        const response = await fetch('data/dummy.json');  // Dummy filen i /data
       // const response = await fetch('http://localhost:3000/data') //Server data
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

    startGpsWatch();


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
        await confirmModal({
            title: "Der skete en fejl",
            lines: ["Modal fejlede – tjek console (F12)."],
            confirmText: "OK",
            cancelText: "Luk"
        });
        return;
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
    startGpsWatch();

    switchView('editor');
    initMap('map-container');

    manualLocationOverride = false;
    manualLatLng = null;
    hasCenteredOnce = false;

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



/* function onPositionUpdate(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = position.coords.accuracy;

    lastGpsLatLng = { lat, lng };

    if (manualLocationOverride && !manualLatLng) {
        manualLocationOverride = false;
    }

    const active = manualLocationOverride && manualLatLng
        ? manualLatLng
        : { lat, lng };

    upsertUserLocation(active.lat, active.lng, null, true);

    currentFilterLatLng = { lat: active.lat, lng: active.lng };

    if (!hasCenteredOnce) {
        centerMapOnLocation(active.lat, active.lng, 15);
        hasCenteredOnce = true;
    }


    if (nearbyFilterEnabled) {
        upsertSearchRadius(active.lat, active.lng, currentRadiusMeters);
        runTaskFilters();
    }
} */


function onPositionUpdate(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    const rawAcc = Number(position.coords.accuracy);
    const safeAcc =
        Number.isFinite(rawAcc) && rawAcc > 0 && rawAcc <= 5000
            ? rawAcc
            : null; // hvis for upræcist/ugyldigt, så drop cirklen

    lastGpsLatLng = { lat, lng };

    if (manualLocationOverride && !manualLatLng) {
        manualLocationOverride = false;
    }

    const active = manualLocationOverride && manualLatLng
        ? manualLatLng
        : { lat, lng };

    // brug safeAcc i stedet for altid null
    upsertUserLocation(active.lat, active.lng, safeAcc, true);

    currentFilterLatLng = { lat: active.lat, lng: active.lng };

    if (!hasCenteredOnce) {
        centerMapOnLocation(active.lat, active.lng, 15);
        hasCenteredOnce = true;
    }

    if (nearbyFilterEnabled) {
        upsertSearchRadius(active.lat, active.lng, currentRadiusMeters);
        runTaskFilters();
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
    btnLocationReset.addEventListener("click", async () => {
        manualLocationOverride = false;
        manualLatLng = null;

        if (!lastGpsLatLng) {
            await confirmModal({
                title: "GPS ikke klar",
                lines: ["GPS er ikke klar endnu – prøv igen om et øjeblik."],
                confirmText: "OK",
                cancelText: "Luk"
            });
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
    // Gem ved Enter
    manualRadiusInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            finishManualEdit();
        }
    });
    // Stopper bogstaver FØR de rammer feltet
    manualRadiusInput.addEventListener('keydown', function (e) {
        // Vi tillader: backspace, delete, tab, escape, enter
        const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
        if (allowedKeys.includes(e.key) || (e.ctrlKey === true) || (e.metaKey === true)) {
            return; // Lad handlingen ske
        }
        // Tjek om tasten er et tal (0-9)
        // Hvis IKKE det er et tal, så stop handlingen
        if (!/^[0-9]$/.test(e.key)) {
            e.preventDefault();
        }
    });
    // Ekstra sikkerhed: 'paste' event
    manualRadiusInput.addEventListener('paste', function (e) {
        // Vent et øjeblik til teksten er sat ind, og rens den så
        setTimeout(() => {
            this.value = this.value.replace(/[^0-9]/g, '');
        }, 1);
    });
}

// Færdiggør redigering
function finishManualEdit() {
    let val = Number(manualRadiusInput.value);
    if (!val || val <= 0) val = 100; // Minimum sikkerhed
    const MAX_RADIUS = 500000;
    if (val > MAX_RADIUS) {
        val = MAX_RADIUS;
        // Valgfrit: Giv brugeren besked, eller lad bare feltet rette sig selv
        confirmModal({
            title: "Radius justeret",
            lines: [
                `Maksimal tilladt radius er ${MAX_RADIUS} meter.`,
                "Vi har rettet din indtastning til grænsen."
            ],
            confirmText: "Forstået",
            cancelText: "Luk"
        });
    }
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

    startGpsWatch(); // ✅ kun denne

    await loadTasks();
    refreshTaskListUI();
});

if (btnNearby) {
    btnNearby.addEventListener("click", async () => {
        nearbyFilterEnabled = !nearbyFilterEnabled;

        btnNearby.classList.toggle("is-active", nearbyFilterEnabled);
        btnNearby.textContent = nearbyFilterEnabled
            ? "VIS OPGAVER I NÆRHEDEN ✓"
            : "VIS OPGAVER I NÆRHEDEN";

        // vis/skjul slider UI
        if (radiusWrapper) {
            radiusWrapper.classList.toggle("hidden", !nearbyFilterEnabled);
        }

        if (!currentFilterLatLng) {
            if (manualLatLng) currentFilterLatLng = { ...manualLatLng };
            else if (lastGpsLatLng) currentFilterLatLng = { ...lastGpsLatLng };
        }

        if (nearbyFilterEnabled && !currentFilterLatLng) {
            await confirmModal({
                title: "Kan ikke filtrere endnu",
                lines: ["Flyt lokationsmarkøren eller vent på GPS, før du filtrerer."],
                confirmText: "OK",
                cancelText: "Luk"
            });
            nearbyFilterEnabled = false;
            btnNearby.classList.remove("is-active");
            btnNearby.textContent = "VIS OPGAVER I NÆRHEDEN";
            radiusWrapper?.classList.add("hidden");
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

//start gps en gang
let geoWatchId = null;

function startGpsWatch() {
    if (geoWatchId !== null) return; // kører allerede

    geoWatchId = navigator.geolocation.watchPosition(
        onPositionUpdate,
        (err) => console.error("GPS fejl:", err),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
}

/* //Midlertidig placering af click til infoboks
document.querySelectorAll(".task-order-badge").forEach(el => {
    el.addEventListener("click", (e) => {
        console.log("Badge clicked!", e.pageX, e.pageY);
        showInfoBox({ titel: "Opgave A", text: "Beskrivelse af opgaven" }, e.pageX, e.pageY);
    });
});

document.getElementById("div-task-list").addEventListener("click", (e) => {
    if (e.target.classList.contains("task-order-badge")) {
        const taskId = e.target.dataset.taskId;
        console.log("Badge clicked via delegation! Task ID:", taskId);
        showInfoBox({ titel: `Opgave ${taskId}`, text: "Beskrivelse af opgaven" }, e.pageX, e.pageY);
    }
});*/
