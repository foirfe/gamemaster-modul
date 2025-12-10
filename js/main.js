//Main // test
import { initMap } from './map-manager.js';

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