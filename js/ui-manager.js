//UI MANAGER
import { downloadJSON, getScenariosFromStorage } from './data-manager.js';
import { clearAllTaskLayers, upsertTaskCircle } from './map-manager.js'; 
import { Task } from './models.js';
// Renderer listen af scenarier på dashboardet.
function renderDashboard(scenarios) {
    const listContainer = document.getElementById('scenario-list');
    
    // Ryd listen sikkert
    listContainer.textContent = ''; 

    //  Tjekker om der er scenarier
    if (!scenarios || scenarios.length === 0) {
        const p = document.createElement('p');
        p.classList.add('no-scenarios');
        p.textContent = 'Der er ingen gemte scenarier. Opret et nyt for at komme i gang.';
        listContainer.appendChild(p);
        return; 
    }

    // GRID CONTAINER TIL ALLE SCENARIER
    const ul = document.createElement('ul');
    ul.className = 'scenario-list'; 
    // LÆSER SCENARIOS OG BYGGER DEM OM
    scenarios.forEach(scenario => {
        const li = document.createElement('li');
        li.className = 'scenario-item'; 

        const dateStr = new Date(scenario.scenarioCreatedTime).toLocaleString('da-DK', {
             day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit'
        });

        // DOM OPBYGGELSE
        const titleDiv = document.createElement('div');
        titleDiv.className = 'scenario-item-title';
        titleDiv.textContent = scenario.scenarioTitle;
        const descDiv = document.createElement('div');
        descDiv.className = 'scenario-item-desc'
        descDiv.textContent = scenario.scenarioDescription;
        const infoDiv = document.createElement('div');
        infoDiv.className = 'scenario-item-info';
        infoDiv.textContent = `Miljø: ${scenario.scenarioEnvironment || 'Ikke angivet'} | Oprettet: ${dateStr} | Opgaver: ${scenario.tasks ? scenario.tasks.length : 0}`;
        const btnsContainer = document.createElement('div');
        btnsContainer.className = 'btns-container';
        //ENKELT SCENARIO DOWNLOAD
        const downloadSingleBtn = document.createElement('button');
        downloadSingleBtn.className = 'btn-scenario';
        downloadSingleBtn.title = `Download ${scenario.scenarioTitle}.json`; 
        downloadSingleBtn.setAttribute('aria-label', `Download: ${scenario.scenarioTitle}`);
        const downloadSingleIcon = document.createElement('span');
        downloadSingleIcon.className = 'material-symbols-outlined';
        downloadSingleIcon.textContent = 'download';
        downloadSingleBtn.appendChild(downloadSingleIcon);
        downloadSingleBtn.onclick = () => {
            // Konverter data for dette scenario
            const singleScenarioData = JSON.stringify(scenario, null, 2);
            // Brug titlen som filnavn + .json
            const fileName = `${scenario.scenarioTitle || 'scenarie'}.json`;
            downloadJSON(fileName, singleScenarioData);
        };
        // REDIGER
        const editBtn = document.createElement('button');
        editBtn.className = 'btn-scenario';
        const editTextNode = document.createTextNode('Redigere ');
        const editIconSpan = document.createElement('span');
        editIconSpan.className = 'material-symbols-outlined';
        editIconSpan.textContent = 'edit_document';
        editBtn.setAttribute('aria-label', `Rediger scenariet: ${scenario.scenarioTitle}`);
        editBtn.appendChild(editTextNode);
        editBtn.appendChild(editIconSpan);
        editBtn.onclick = (e) => {
            if (typeof window.editScenario === 'function') window.editScenario(scenario.scenarioId);
        };
        // SLET
        const deleteScenarioBtn = document.createElement('button');
        deleteScenarioBtn.className = 'btn-scenario';
        const deleteScenarioTextNode = document.createTextNode('Slet ');
        const deleteScenarioIconSpan = document.createElement('span');
        deleteScenarioIconSpan.className = 'material-symbols-outlined';
        deleteScenarioIconSpan.textContent = 'delete';
        deleteScenarioBtn.appendChild(deleteScenarioTextNode);
        deleteScenarioBtn.appendChild(deleteScenarioIconSpan);
        deleteScenarioBtn.setAttribute('aria-label', `Slet scenariet: ${scenario.scenarioTitle}`);
        deleteScenarioBtn.onclick = (e) => {
            if (typeof window.handleDeleteScenario === 'function') window.handleDeleteScenario(scenario.scenarioId);
        };
        btnsContainer.appendChild(downloadSingleBtn);
        btnsContainer.appendChild(editBtn);
        btnsContainer.appendChild(deleteScenarioBtn);
        li.appendChild(titleDiv);
        li.appendChild(descDiv);
        li.appendChild(infoDiv);
        li.appendChild(btnsContainer);
        ul.appendChild(li);
    });
    // Opretter "Download JSON" knap som det sidste element
    const downloadLi = document.createElement('li');
    downloadLi.className = 'scenario-item download-card';
    const downloadBtn = document.createElement('button');
    downloadBtn.className = `btn-download`;
    const downloadTextNode = document.createTextNode('Download Alle Scenarier');
    const downloadIconSpan = document.createElement('span');
    downloadIconSpan.className = 'material-symbols-outlined';
    downloadIconSpan.textContent = 'download'; // Ikonnavnet
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    downloadBtn.onclick = () => {
        const rawData = localStorage.getItem('gamemaster_scenarios');
        if (rawData) {
            // Vi laver teksten om til rigtige objekter og stringifyer det
            const parsedData = JSON.parse(rawData);
            const prettyData = JSON.stringify(parsedData, null, 2);
            downloadJSON(`Scenarios-${day}-${month}-${year}.json`, prettyData);
        }
    };
    downloadBtn.appendChild(downloadTextNode);
    downloadBtn.appendChild(downloadIconSpan);
    downloadLi.appendChild(downloadBtn);
    ul.appendChild(downloadLi);
    listContainer.appendChild(ul);
}

export function updateDashboardView() {
    const allScenarios = getScenariosFromStorage();
    const activeScenarios = allScenarios.filter(s => s.scenarioIsActive !== false);
    renderDashboard(activeScenarios);
}

export function mapTasksToScenario(teamTask, index) {
    const task = new Task();
    task.idT = index + 1;
    task.orderNumber = index + 1;
    task.taskId = `T${teamTask.ID}`;
    task.taskTitle = teamTask.Titel ?? "";
    task.taskDescription = teamTask.Beskrivelse ?? "";
    task.taskTypeLabel = `` ?? "Ingen ikon";
    task.taskType = teamTask.Type ?? "";
    const act = (teamTask.Aktiveringsbetingelse ?? "").toLowerCase();
    task.mapType = act === "zone" ? "zone" : "punkt";
    task.mapRadiusInMeters = Number(teamTask.Radius ?? 0);
    if (Array.isArray(teamTask.Lokation) && teamTask.Lokation.length >= 2) {
        task.mapLat = Number(teamTask.Lokation[0]);
        task.mapLng = Number(teamTask.Lokation[1]);
    }
    task.mapLabel = `OP${index + 1}`;
    task.isActive = false;
    task.options = teamTask.Valgmuligheder ?? [];
    return task;
}


export function updateTaskSelectionUIAndMap(selectedTasks) {
    const listEl = document.getElementById('task-list');
    if (!listEl) return;
    // Ryd ALLE task-lag på kortet først
    clearAllTaskLayers();
    // Nulstil alle badges + selected-styles i listen
    const allLis = listEl.querySelectorAll('.task-item');
    allLis.forEach(li => {
        li.classList.remove('task-item-selected');
        const badge = li.querySelector('.task-order-badge');
        if (badge) badge.textContent = "";
    });
    // Gå valgte tasks igennem og opdatér liste + kort
    selectedTasks.forEach((t, index) => {
        const orderNumber = index + 1;
        // --- LISTE ---
        const li = listEl.querySelector(`li[data-task-id="${t.ID}"]`);
        if (li) {
            li.classList.add('task-item-selected');
            const badge = li.querySelector('.task-order-badge');
            if (badge) badge.textContent = orderNumber;
        }
        // --- KORT ---
       let lat, lng, radius;
        if (Array.isArray(t.Lokation)) { 
            lat = Number(t.Lokation[0]); lng = Number(t.Lokation[1]); radius = Number(t.Radius ?? 0);
        } else { 
            lat = t.mapLat; lng = t.mapLng; radius = t.mapRadiusInMeters;
        }

        const id = t.ID || t.taskId;

        if (lat && lng) {
            // Callback funktionen sendes med her:
            upsertTaskCircle(id, lat, lng, radius, index + 1, (e) => {
                showInfoBox(t, e.originalEvent.pageX, e.originalEvent.pageY);
            });
        }
    });
}


export function renderTaskList(tasksToShow, selectedTasks, onTaskToggleCallback) {
    const listEl = document.getElementById('task-list');
    if (!listEl) return;
    listEl.replaceChildren();

    tasksToShow.forEach(teamTask => {
        const li = document.createElement('li');
        li.classList.add('task-item');
        li.dataset.taskId = teamTask.ID;

        const contentDiv = document.createElement('div');
        contentDiv.classList.add('task-item-content');

        const textGroupDiv = document.createElement('div');
        const titleDiv = document.createElement('div');
        titleDiv.classList.add('task-item-title');

        const iconSpan = document.createElement('span');
        iconSpan.classList.add('material-symbols-outlined');
        iconSpan.style.verticalAlign = 'middle'; 
        iconSpan.style.marginRight = '5px';
        iconSpan.style.fontSize = '18px';
        
        if (teamTask.Type === 'Land') {
            iconSpan.style.color = `var(--military-green)`;
            iconSpan.textContent = 'forest';
        } else {
            iconSpan.style.color = `var(--navy-blue)`;
            iconSpan.textContent = 'sailing'; 
        }

        const titleText = document.createTextNode(
            `${teamTask.ID} - ${teamTask.Titel} ${teamTask.taskTypeLabel || ''}`
        );
        titleDiv.appendChild(titleText);
        titleDiv.appendChild(iconSpan);

        const descDiv = document.createElement('div');
        descDiv.classList.add('task-item-desc');
        descDiv.textContent = teamTask.Beskrivelse;

        textGroupDiv.appendChild(titleDiv);
        textGroupDiv.appendChild(descDiv);

        const badgeDiv = document.createElement('div');
        badgeDiv.classList.add('task-order-badge');

        contentDiv.appendChild(textGroupDiv);
        contentDiv.appendChild(badgeDiv);
        li.appendChild(contentDiv);

        // Selection logik (Visuals only initial load)
        const isSelected = selectedTasks.some(t => t.ID === teamTask.ID);
        if (isSelected) {
            li.classList.add('task-item-selected');
            const index = selectedTasks.findIndex(t => t.ID === teamTask.ID);
            badgeDiv.textContent = index + 1;
        }

        // Event Listener:
        li.addEventListener('click', () => {
            onTaskToggleCallback(teamTask);
        });

        listEl.appendChild(li);
    });
}

export function confirmModal({
    title = "Bekræft",
    lines = [],
    confirmText = "OK",
    cancelText = "Annuller",
    danger = false
} = {}) {
    return new Promise((resolve) => {
        // overlay
        const overlay = document.createElement("div");
        overlay.classList.add("gm-modal-overlay");

        // modal
        const modal = document.createElement("div");
        modal.classList.add("gm-modal");
        if (danger) modal.classList.add("is-danger");
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");

        // title
        const h = document.createElement("h3");
        h.classList.add("gm-modal-title");
        h.textContent = title;

        // body
        const body = document.createElement("div");
        body.classList.add("gm-modal-body");

        lines.forEach((line) => {
            const p = document.createElement("p");
            p.classList.add("gm-modal-line");
            p.textContent = line;
            body.appendChild(p);
        });

        // actions
        const actions = document.createElement("div");
        actions.classList.add("gm-modal-actions");

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.classList.add("gm-modal-btn", "gm-modal-cancel");
        cancelBtn.textContent = cancelText;

        const okBtn = document.createElement("button");
        okBtn.type = "button";
        okBtn.classList.add("gm-modal-btn", "gm-modal-confirm");
        okBtn.textContent = confirmText;

        actions.appendChild(cancelBtn);
        actions.appendChild(okBtn);

        modal.appendChild(h);
        modal.appendChild(body);
        modal.appendChild(actions);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const close = (val) => {
            overlay.remove();
            resolve(val);
        };

        cancelBtn.addEventListener("click", () => close(false));
        okBtn.addEventListener("click", () => close(true));

        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) close(false);
        });

        const onKey = (e) => {
            if (e.key === "Escape") close(false);
        };
        document.addEventListener("keydown", onKey, { once: true });

        okBtn.focus();
    });
}


//HER FORSØGER LIV AT KODE INFOBOKS
export function showInfoBox(task, x, y) {
    //Fjern åben infoboks hvis du klikker på et nyt punkt
    const existingBox = document.querySelector(".infoboks");
    if (existingBox) existingBox.remove();

    const infoTitleText = task.Titel || task.taskTitle || "Uden titel"
    const infoDescText = task.Beskrivelse || task.taskDescription || "Ingen beskrivelse";
    const infoOptions = task.Valgmuligheder || task.options || [];

//Infoboks
const infoBox = document.createElement("div");
infoBox.classList.add("infoboks");
infoBox.style.top = `${y+10}px`;
infoBox.style.left = `${x+10}px`;

//HEADER
const infoHeader = document.createElement("div");
infoHeader.className = "infoboks-header";

//Titel
const infoTitel = document.createElement("h3");
infoTitel.textContent = infoTitleText;

//Luk-knap
const infoCloseBtn = document.createElement("button");
infoCloseBtn.className = "infoboks-close";
infoCloseBtn.textContent = "x";
infoCloseBtn.setAttribute("aria-label", "Luk");
infoCloseBtn.style.marginTop = "10px";
infoCloseBtn.addEventListener("click", (e) =>{
    e.stopPropagation();
    infoBox.remove();
})

infoHeader.appendChild(infoTitel);
infoHeader.appendChild(infoCloseBtn);
infoBox.appendChild(infoHeader);

const infoBody = document.createElement("div");
infoBody.className = "infoboks-body";

//Tekst
const infoText = document.createElement("p");
infoText.textContent = infoDescText;
infoBody.appendChild(infoText);

if(infoOptions.length > 0){
    const optionsHeader = document.createElement("h5");
    optionsHeader.textContent = "Valgmuligheder:";
    infoBody.appendChild(optionsHeader);

    const optionsUl = document.createElement("ul");
    infoOptions.forEach(option => {
        const optionLi = document.createElement("li");
        optionLi.textContent = typeof option === "string" ? option : (option.optionText || option);
        optionsUl.appendChild(optionLi);
    });
    infoBody.appendChild(optionsUl);
}
infoBox.appendChild(infoBody);
document.body.appendChild(infoBox);
}

