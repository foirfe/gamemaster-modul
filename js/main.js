//Main // test
import { initMap, upsertTaskCircle, removeTaskCircle } from './map-manager.js';
import { Scenario, Task, Option } from './models.js';
import { downloadJSON, saveScenarioToStorage,getScenariosFromStorage } from './data-manager.js';
import { renderDashboard } from './ui-manager.js';




function updateDashboardView() {
    const scenarios = getScenariosFromStorage();
    renderDashboard(scenarios);
}
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
    // hent tasks og tegn liste
    await loadTasks();
    renderTaskList();
});

document.getElementById('btn-back').addEventListener('click', () => {
    switchView('dashboard');
});


//Opret et scenario
const scenario = new Scenario();
scenario.scenarioId = "S1";
scenario.scenarioTitle = "Finderup Nat�velse";
scenario.scenarioEnvironment = "land";
scenario.scenarioCreatedBy = "Bo";

//Opret en task
const task = new Task();
task.idT = 101;
task.taskId = "T15";
task.taskTitle = "Patrulje i nat";
task.mapType = "zone";

//Tilf�j til scenario
scenario.tasks.push(task);

//Opret options
const optionA = new Option();
optionA.optionId = "A";
optionA.optionText = "Vil du blive her";
optionA.isCorrect = true;

const optionB = new Option();
optionB.optionId = "B";
optionB.optionText = "Vil du ud og se";
optionB.isCorrect = false;

//Tilf�j til task
task.options.push(optionA, optionB);


//JSON fil
// JSON.stringify(value, replacer, space)
const jsonString = JSON.stringify(scenario, null, 2);
console.log('Scenario JSON:', jsonString);


//Json indlæsning fra Team 1
let allTasks = []; // her gemmer vi tasks fra JSON
let selectedTasks = [];   // opgaver som gamemaster har markeret

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

const scenariosData = localStorage.getItem('gamemaster_scenarios');


console.log(scenariosData);
 document.getElementById('download-btn').addEventListener('click', () => {
    downloadJSON("Scenarios.json", localStorage.getItem('gamemaster_scenarios'));
 })

//render tasknames
function mapTeam1TaskToOurTask(team1Task, index) {
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


//Ny json fil
document.getElementById('btn-save').addEventListener('click', () => {
    // 1) Opdatér scenarie-info fra felterne i UI
    const nameInput = document.getElementById('scenario-name');
    const typeSelect = document.getElementById('scenario-type');

    scenario.scenarioTitle = nameInput.value || "Uden navn";
    scenario.scenarioEnvironment = typeSelect.value === "choose" ? "" : typeSelect.value;
    scenario.scenarioCreatedTime = new Date();
    scenario.scenarioIsActive = true;

    // 2) Byg tasks-listen ud fra selectedTasks
    scenario.tasks = selectedTasks.map((t, index) => mapTeam1TaskToOurTask(t, index));


    // 3) Lav et “rent” objekt i den struktur du ønsker
    const exportScenario = {
        scenarioId: scenario.scenarioId,
        scenarioTitle: scenario.scenarioTitle,
        scenarioDescription: scenario.scenarioDescription || "",
        scenarioEnvironment: scenario.scenarioEnvironment,
        scenarioCreatedBy: scenario.scenarioCreatedBy,
        scenarioCreatedTime: scenario.scenarioCreatedTime.toISOString(),
        scenarioIsActive: scenario.scenarioIsActive,
        tasks: scenario.tasks.map(t => ({
            idT: t.idT,
            taskId: t.taskId,
            taskTitle: t.taskTitle,
            taskDescription: t.taskDescription,
            orderNumber: t.orderNumber,
            mapType: t.mapType,
            mapRadiusInMeters: t.mapRadiusInMeters,
            mapLabel: t.mapLabel,
            mapLat: t.mapLat,
            mapLng: t.mapLng,
            isActive: t.isActive
        }))
    };
    switchView('dashboard');
    saveScenarioToStorage(exportScenario);
    updateDashboardView();
    const jsonString = JSON.stringify(exportScenario, null, 2);
    console.log("Eksporteret scenarie JSON:", jsonString);
    
   /*
    // 4) Download som .json-fil
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = (scenario.scenarioId || "scenario") + ".json"; // fx S1.json
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
   */
});