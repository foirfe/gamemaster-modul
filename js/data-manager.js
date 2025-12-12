// DATA MANAGER
const STORAGE_KEY = 'gamemaster_scenarios';
//Gemmer et scenarie i localStorage.
export function saveScenarioToStorage(scenario) {
    const scenarios = getScenariosFromStorage();
    // Tjek evt. om scenariet allerede findes og opdater det, ellers push (her simpelt push)
    scenarios.push(scenario);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
}
//Henter alle scenarier fra localStorage. Returnerer et array af scenarie-objekter.
export function getScenariosFromStorage() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
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