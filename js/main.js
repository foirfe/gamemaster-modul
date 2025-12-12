//Main // test
import { initMap } from './map-manager.js';
import { Scenario, Task, Option } from './models.js';

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
    if (!listEl) {
        console.warn('Fandt ikke #task-list');
        return;
    }

    listEl.innerHTML = '';

    allTasks.forEach(task => {
        const li = document.createElement('li');
        li.classList.add('task-item');

        li.innerHTML = `
            <div class="task-item-title">${task.taskId} - ${task.taskTitle}</div>
            <div class="task-item-desc">${task.taskDescription}</div>
        `;

        // Er denne task allerede markeret?
        const isSelected = selectedTasks.some(t => t.taskId === task.taskId);
        if (isSelected) {
            li.classList.add('task-item-selected');
        }

        // Klik-håndtering: toggle markering + opdater selectedTasks
        li.addEventListener('click', () => {
            const index = selectedTasks.findIndex(t => t.taskId === task.taskId);

            if (index === -1) {
                // Ikke i listen endnu → tilføj
                selectedTasks.push(task);
                li.classList.add('task-item-selected');
            } else {
                // Allerede i listen → fjern
                selectedTasks.splice(index, 1);
                li.classList.remove('task-item-selected');
            }

            console.log('Valgte opgaver:', selectedTasks);
        });

        listEl.appendChild(li);
    });
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
    scenario.tasks = selectedTasks.map((t, index) => {
        const task = new Task();
        task.idT = index + 1;
        task.taskId = t.taskId;
        task.taskTitle = t.taskTitle;
        task.taskDescription = t.taskDescription;
        task.mapType = t.mapType;
        task.mapRadiusInMeters = t.mapRadiusInMeters;
        return task;
    });

    // 3) Lav et “rent” objekt i den struktur du ønsker
    const exportScenario = {
        scenarioId: scenario.scenarioId,
        scenarioTitle: scenario.scenarioTitle,
        scenarioCreatedBy: scenario.scenarioCreatedBy,
        scenarioCreatedTime: scenario.scenarioCreatedTime.toISOString(),
        scenarioIsActive: scenario.scenarioIsActive,
        tasks: scenario.tasks.map(t => ({
            idT: t.idT,
            taskId: t.taskId,
            taskTitle: t.taskTitle,
            taskDescription: t.taskDescription,
            mapType: t.mapType,
            mapRadiusInMeters: t.mapRadiusInMeters
        }))
    };

    const jsonString = JSON.stringify(exportScenario, null, 2);
    console.log("Eksporteret scenarie JSON:", jsonString);

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
});