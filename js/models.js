export class Scenario {
    constructor() {
        this.scenarioId = "";
        this.scenarioTitle = "";
        this.scenarioDescription = "";
        this.scenarioEnvironment = "";   // "land" eller "sø"
        this.scenarioCreatedBy = "";
        this.scenarioCreatedTime = new Date();
        this.scenarioIsActive = true;

        // Et scenarie indeholder flere tasks
        this.tasks = [];
    }
}

export class Task {
    constructor() {
        this.idT = 0;                     // Internt ID
        this.taskId = "";                 // ID fra Team 1
        this.taskTitle = "";
        this.taskDescription = "";
        this.orderNumber = 0;
        this.mapType = "";                // "zone" eller "punkt"
        this.mapRadiusInMeters = 0;
        this.mapLabel = "";
        this.mapLat = 0.0;
        this.mapLng = 0.0;
        this.isActive = false;

        // En task har flere valgmuligheder
        this.options = [];
    }
}

export class Option {
    constructor() {
        this.optionId = "";               // f.eks. "A"
        this.optionText = "";
        this.isCorrect = false;
    }
}
