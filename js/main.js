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
document.getElementById('btn-create-new').addEventListener('click', () => {
    switchView('editor');
    initMap('map-container')
});

document.getElementById('btn-back').addEventListener('click', () => {
    switchView('dashboard');
});


//Opret et scenario
const scenario = new Scenario();
scenario.scenarioId = "S1";
scenario.scenarioTitle = "Finderup Natøvelse";
scenario.scenarioEnvironment = "land";
scenario.scenarioCreatedBy = "Bo";

//Opret en task
const task = new Task();
task.idT = 101;
task.taskId = "T15";
task.taskTitle = "Patrulje i nat";
task.mapType = "zone";

//Tilføj til scenario
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

//Tilføj til task
task.options.push(optionA, optionB);


//JSON fil
// JSON.stringify(value, replacer, space)
const jsonString = JSON.stringify(scenario, null, 2);
console.log(jsonString);
