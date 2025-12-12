const btnImport = document.getElementById('btn-import');
const taskList = document.getElementById('task-list');

btnImport.addEventListener('click', () => {
    // Hent JSON-fil (dummy-fil)
    fetch('dummy-tasks.json') // navnet på din fil
        .then(response => response.json())
        .then(data => {
            // Ryd listen først
            taskList.innerHTML = '';

            // Tilføj opgaver til ul
            data.forEach(task => {
                const li = document.createElement('li');
                li.textContent = `${task.taskTitle} - ${task.taskDescription}`;
                taskList.appendChild(li);
            });
        })
        .catch(err => {
            console.error('Kunne ikke hente filen:', err);
        });
});
