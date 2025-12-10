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
