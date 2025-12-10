//UI MANAGER
//Fanger task-sidebar
const sidebar = document.getElementById("task-sidebar");

//Inputfelt til scenarienavn
const input = document.createElement("input");
input.type = "text";
input.id = "scenario-name";
input.placeholder = "Skriv scenarienavn";
sidebar.appendChild(input);