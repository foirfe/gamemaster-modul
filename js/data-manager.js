// DATA MANAGER
const STORAGE_KEY = 'gamemaster_scenarios';
//Gemmer et scenarie i localStorage.
export function saveScenarioToStorage(scenario) {
    const scenarios = getScenariosFromStorage();
    // Find index på scenariet, hvis det findes
    const existingIndex = scenarios.findIndex(s => s.scenarioId === scenario.scenarioId);
    if (existingIndex >= 0) {
        scenarios[existingIndex] = scenario;
        console.log(`Opdaterede scenarie med ID: ${scenario.scenarioId}`);
    } else {
        // Tilføj nyt scenarie
        scenarios.push(scenario);
        console.log(`Oprettet nyt scenarie med ID: ${scenario.scenarioId}`);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
}
//Henter alle scenarier fra localStorage. Returnerer et array af scenarie-objekter.
export function getScenariosFromStorage() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}
//Arkiver (slet) scenarie
export function deleteScenario(id) {
    const scenarios = getScenariosFromStorage();
    const index = scenarios.findIndex(s => s.scenarioId === id);
    if (index !== -1) {
        // Vi sletter ikke, vi sætter den bare til inaktiv
        scenarios[index].scenarioIsActive = false;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
        console.log(`Scenarie ${id} er arkiveret.`);
        return true; 
    }
    return false;
}
//Downloader data som en JSON-fil.
export function downloadJSON(filename, data) {
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}