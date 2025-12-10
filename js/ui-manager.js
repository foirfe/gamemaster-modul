//UI MANAGER
//Fanger task-sidebar
const sidebar = document.getElementById("task-sidebar");

//Inputfelt til scenarienavn
const input = document.createElement("input");
input.type = "text";
input.id = "scenarie-name";
input.placeholder = "Skriv scenarienavn";
sidebar.appendChild(input);

//Dropdown til lands/vands
const select = document.createElement("select");
select.id = "scenarie-type";

const optionLand = document.createElement("option");
optionLand = "land";
optionLand.textContent = "Land";
select.appendChild(optionLand);

const optionWater = document.createElement("option");
optionWater = "water";
optionWater.textContent = "vand";
select.appendChild("optionWater");

sidebar.appendChild(select);

//Importér-knap
const importBtn = document.createElement("button");
importBtn.id = "import-task";
importBtn.textContent = "Importer opgaver";
sidebar.appendChild(importBtn);

//Liste til opgave
const taskList = document.createElement("div");
taskList.id = "task-list";
taskList.classList.add("scrollable-list");
sidebar.appendChild(taskList);

//Gem-knap
const saveBtn = document.createElement("button");
saveBtn.id = "save-scenario";
saveBtn.textContent = "Gem scenarie";
sidebar.appendChild(saveBtn);
