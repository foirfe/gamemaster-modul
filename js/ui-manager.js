//UI MANAGER
import { downloadJSON } from './data-manager.js';
// Renderer listen af scenarier på dashboardet.
export function renderDashboard(scenarios) {
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
        // REDIGER
        const editBtn = document.createElement('button');
        editBtn.textContent = `Rediger`;
        editBtn.setAttribute('aria-label', `Rediger scenariet: ${scenario.scenarioTitle}`);
        editBtn.onclick = (e) => {
            if (typeof window.editScenario === 'function') window.editScenario(scenario.scenarioId);
        };
        // SLET
        const deleteScenarioBtn = document.createElement('button');
        deleteScenarioBtn.textContent = `Slet`;
        deleteScenarioBtn.setAttribute('aria-label', `Slet scenariet: ${scenario.scenarioTitle}`);
        deleteScenarioBtn.onclick = (e) => {
            if (typeof window.handleDeleteScenario === 'function') window.handleDeleteScenario(scenario.scenarioId);
        };
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
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    downloadBtn.textContent = 'Download JSON';
    downloadBtn.onclick = () => {
        const rawData = localStorage.getItem('gamemaster_scenarios');
        if (rawData) {
            // Vi laver teksten om til rigtige objekter og stringifyer det
            const parsedData = JSON.parse(rawData);
            const prettyData = JSON.stringify(parsedData, null, 2);
            downloadJSON(`Scenarios-${day}-${month}-${year}.json`, prettyData);
        }
    };
    downloadLi.appendChild(downloadBtn);
    ul.appendChild(downloadLi);
    listContainer.appendChild(ul);
}