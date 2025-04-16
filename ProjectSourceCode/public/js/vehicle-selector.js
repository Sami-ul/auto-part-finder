let vehicleData = null;

// parsing CSV data
async function loadVehicleData() {
    const response = await fetch('/vehicle-data');
    const data = await response.json();
    vehicleData = data;
    
    //populate initial make dropdown
    const makeSelect = document.getElementById('make');
    const uniqueMakes = [...new Set(data.map(row => row[0]))].sort();
    
    makeSelect.innerHTML = '<option value="">Select Make</option>';
    uniqueMakes.forEach(make => {
        makeSelect.innerHTML += `<option value="${make}">${make}</option>`;
    });
}

//Update years based on make choice
function updateYearDropdown(selectedMake) {
    const yearSelect = document.getElementById('year');
    yearSelect.innerHTML = '<option value="">Select Year</option>';
    
    if (!selectedMake) {
        yearSelect.disabled = true;
        return;
    }
    
    const years = [...new Set(vehicleData
        .filter(row => row[0] === selectedMake)
        .map(row => row[1]))
    ].sort((a, b) => b - a); // sort years descending
    
    years.forEach(year => {
        yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
    });
    yearSelect.disabled = false;
}

//Populate models based on make, year
function updateModelDropdown(selectedMake, selectedYear) {
    const modelSelect = document.getElementById('model');
    modelSelect.innerHTML = '<option value="">Select Model</option>';
    
    if (!selectedMake || !selectedYear) {
        modelSelect.disabled = true;
        return;
    }
    
    const models = [...new Set(vehicleData
        .filter(row => row[0] === selectedMake && row[1] === parseInt(selectedYear))
        .map(row => row[2]))
    ].sort();
    
    models.forEach(model => {
        modelSelect.innerHTML += `<option value="${model}">${model}</option>`;
    });
    modelSelect.disabled = false;
}

//Populate engines based on make, year, model
function updateEngineDropdown(selectedMake, selectedYear, selectedModel) {
    const engineSelect = document.getElementById('engine');
    engineSelect.innerHTML = '<option value="">Select Engine</option>';
    
    if (!selectedMake || !selectedYear || !selectedModel) {
        engineSelect.disabled = true;
        return;
    }
    
    const engines = [...new Set(vehicleData
        .filter(row => 
            row[0] === selectedMake && 
            row[1] === parseInt(selectedYear) && 
            row[2] === selectedModel
        )
        .map(row => row[3]))
    ].sort();
    
    engines.forEach(engine => {
        engineSelect.innerHTML += `<option value="${engine}">${engine}</option>`;
    });
    engineSelect.disabled = false;
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    loadVehicleData();
    
    const makeSelect = document.getElementById('make');
    const yearSelect = document.getElementById('year');
    const modelSelect = document.getElementById('model');
    
    makeSelect.addEventListener('change', (e) => {
        updateYearDropdown(e.target.value);
        updateModelDropdown('', '');
        updateEngineDropdown('', '', '');
    });
    
    yearSelect.addEventListener('change', (e) => {
        updateModelDropdown(makeSelect.value, e.target.value);
        updateEngineDropdown('', '', '');
    });
    
    modelSelect.addEventListener('change', (e) => {
        updateEngineDropdown(makeSelect.value, yearSelect.value, e.target.value);
    });
});
