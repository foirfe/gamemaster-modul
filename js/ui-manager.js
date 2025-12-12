//UI MANAGER
// Renderer listen af scenarier på dashboardet.
export function renderDashboard(scenarios) {
    const listContainer = document.getElementById('scenario-list');
    const downloadBtn = document.getElementById('download-btn');
    // 1. Ryd listen sikkert
    listContainer.textContent = ''; 
    // 2. Tjek om der er scenarier
    if (!scenarios || scenarios.length === 0) {
        // Ingen scenarier: Vis besked og skjul download-knap
        const p = document.createElement('p');
        p.classList.add('no-scenarios');
        p.textContent = 'Der er ingen gemte scenarier. Opret et nyt for at komme i gang.';
        listContainer.appendChild(p);
        if (downloadBtn) {
            downloadBtn.style.display = 'none';
        }
        return; 
    }
    // Hvis der er scenarier: Vis download-knap
    if (downloadBtn) {
        downloadBtn.style.display = 'inline-block';
    }

    //Byg listen med DOM metoder
    const ul = document.createElement('ul');
    ul.className = 'scenario-list'; 
    scenarios.forEach(scenario => {
        const li = document.createElement('li');
        li.className = 'scenario-item'; // Genbruger din eksisterende CSS klasse
        // Pæn formatering af dato
        const dateStr = new Date(scenario.scenarioCreatedTime).toLocaleString('da-DK', {
             day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit'
        });
        // 1. Titel sektion
        const titleDiv = document.createElement('div');
        titleDiv.className = 'scenario-item-title';
        titleDiv.textContent = scenario.scenarioTitle;
        // 2. Beskrivelse sektion
        const descDiv = document.createElement('div');
        descDiv.className = 'scenario-item-desc';
        descDiv.textContent = `Miljø: ${scenario.scenarioEnvironment || 'Ikke angivet'} | Oprettet: ${dateStr} | Opgaver: ${scenario.tasks ? scenario.tasks.length : 0}`;
        const editBtn = document.createElement('button');
        editBtn.textContent = `Redigere`;
        const deleteScenarioBtn = document.createElement('button');
        deleteScenarioBtn.textContent = `Slet`;
        li.appendChild(titleDiv);
        li.appendChild(descDiv);
        li.appendChild(editBtn);
        li.appendChild(deleteScenarioBtn);
        li.addEventListener('click', () => {
            console.log("Klikket på scenarie:", scenario.scenarioTitle);
        });
        ul.appendChild(li);
    });
    listContainer.appendChild(ul);
}