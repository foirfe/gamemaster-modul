//Main // test
import { initMap, upsertTaskCircle, removeTaskCircle } from './map-manager.js';
import { Scenario, Task, Option } from './models.js';
import { downloadJSON, saveScenarioToStorage,getScenariosFromStorage, deleteScenario } from './data-manager.js';
import { renderDashboard } from './ui-manager.js';
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
        editorView.classList.add('view-active');
    } else {
        // Tilbage til dashboard
        editorView.classList.add('view-hidden');
        editorView.classList.remove('view-active');
        dashboardView.classList.remove('view-hidden');
        dashboardView.classList.add('view-active');
        updateDashboardView();
    }
}
// 2. Event Listeners
document.getElementById('btn-create-new').addEventListener('click', async () => {
    switchView('editor');
    initMap('map-container');
    resetEditor();
    // hent tasks og tegn liste
    await loadTasks();
    renderTaskList();
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

// Tegn listen i sidebar
function renderTaskList() {
    const listEl = document.getElementById('task-list');
    if (!listEl) return;

    listEl.innerHTML = '';

    allTasks.forEach(team1Task => {
        const li = document.createElement('li');
        li.classList.add('task-item');

        li.innerHTML = `
    <div class="task-item-content">
        <div>
            <div class="task-item-title">${team1Task.ID} - ${team1Task.Titel}</div>
            <div class="task-item-desc">${team1Task.Beskrivelse}</div>
        </div>
        <div class="task-order-badge"></div>
    </div>
`;

        // gem ID på elementet
        li.dataset.taskId = team1Task.ID;


        const isSelected = selectedTasks.some(t => t.ID === team1Task.ID);
        if (isSelected) li.classList.add('task-item-selected');

        li.addEventListener('click', () => {
            const existingIndex = selectedTasks.findIndex(t => t.ID === team1Task.ID);

            if (existingIndex === -1) {
                // Ikke valgt endnu → tilføj
                selectedTasks.push(team1Task);
            } else {
                // Allerede valgt → fjern
                selectedTasks.splice(existingIndex, 1);
                // Fjern cirkel fra kortet for den task
                removeTaskCircle(team1Task.ID);
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



 document.getElementById('download-btn').addEventListener('click', () => {
    downloadJSON("Scenarios.json", localStorage.getItem('gamemaster_scenarios'));
 })

//render tasknames
function mapTasksToScenario(team1Task, index) {
    const task = new Task();

    task.idT = index + 1;
    task.orderNumber = index + 1;

    task.taskId = `T${team1Task.ID}`;
    task.taskTitle = team1Task.Titel ?? "";
    task.taskDescription = team1Task.Beskrivelse ?? "";

    // Aktiveringsbetingelse: "Zone" -> zone, "Lokalitet" -> punkt
    const act = (team1Task.Aktiveringsbetingelse ?? "").toLowerCase();
    task.mapType = act === "zone" ? "zone" : "punkt";

    task.mapRadiusInMeters = Number(team1Task.Radius ?? 0);

    // Lokation: [lat, lng]
    if (Array.isArray(team1Task.Lokation) && team1Task.Lokation.length >= 2) {
        task.mapLat = Number(team1Task.Lokation[0]);
        task.mapLng = Number(team1Task.Lokation[1]);
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

    // Sæt currentScenario til det fundne
    currentScenario = foundScenario;

    // Sæt UI felter
    document.getElementById('scenario-name').value = currentScenario.scenarioTitle;
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
        // Baseret på din mapTeam1TaskToOurTask, gemmer du taskId som "T" + ID.
        const originalId = parseInt(savedTask.taskId.replace('T', ''));
        const originalTask = allTasks.find(t => t.ID === originalId);
        
        if (originalTask) {
            selectedTasks.push(originalTask);
        }
    });

    renderTaskList();
    updateTaskSelectionUIAndMap(); // Tegner cirklerne på kortet igen
}