// Schools and Departments Data
const schoolsData = {
    "School of Humanities and Social Science (SOHSS)": [
        "M.sc in applied economics",
        "M.sc in psychology",
        "BA in Political Science and International Relations",
        "BA(hons) economics",
        "B.sc(Hons)Psychology",
        "MSW"
    ],
    "School Of Management Sciences (SOMS)": [
        "B.com Honours",
        "BBA",
        "MBA"
    ],
    "School Of Mathematics and Natural Sciences (SOMNS)": [
        "M.sc Data Science",
        "B.sc(hons)Chemistry"
    ],
    "School Of Law Governance and Public Policy": [
        "MA in Public Policy",
        "BA LLB",
        "LLM",
        "BBA LLB"
    ],
    "School Of Biosciences": [
        "M.sc in Bioinformatics and Biotechnology",
        "B.sc in Biotechnology",
        "B.Tech in Biotechnology and Bioengineering"
    ],
    "School Of Engineering(SOE)": [
        "Computer Science Engineering",
        "BCA",
        "BCA Data Science",
        "MCA",
        "Computer Science and AI",
        "Electronics Engineering(VLSI and Embeded Systems)",
        "Electrical Engineering and Computer Science",
        "Mechinical and Aerospace Engineering",
        "Civil Engineering"
    ]
};

// Function to populate school dropdown
function populateSchoolDropdown(selectId, options = {}) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    let includeEmpty = true;
    let emptyText = 'Select School';

    if (typeof options === 'boolean') {
        includeEmpty = options;
    } else if (typeof options === 'object' && options !== null) {
        includeEmpty = options.includeEmpty !== undefined ? options.includeEmpty : true;
        emptyText = options.emptyText || emptyText;
    }

    // Clear existing options
    select.innerHTML = '';
    
    if (includeEmpty) {
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = emptyText;
        select.appendChild(emptyOption);
    }
    
    // Add schools
    Object.keys(schoolsData).forEach(school => {
        const option = document.createElement('option');
        option.value = school;
        option.textContent = school;
        select.appendChild(option);
    });
}

// Function to populate department dropdown based on selected school
function populateDepartmentDropdown(schoolSelectId, departmentSelectId, options = {}) {
    const schoolSelect = document.getElementById(schoolSelectId);
    const departmentSelect = document.getElementById(departmentSelectId);
    
    if (!schoolSelect || !departmentSelect) return;

    let includeEmpty = true;
    let emptyText = 'Select Department';

    if (typeof options === 'boolean') {
        includeEmpty = options;
    } else if (typeof options === 'object' && options !== null) {
        includeEmpty = options.includeEmpty !== undefined ? options.includeEmpty : true;
        emptyText = options.emptyText || emptyText;
    }
    
    // Clear existing options
    departmentSelect.innerHTML = '';
    
    if (includeEmpty) {
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = emptyText;
        departmentSelect.appendChild(emptyOption);
    }
    
    const selectedSchool = schoolSelect.value;
    if (selectedSchool && schoolsData[selectedSchool]) {
        schoolsData[selectedSchool].forEach(dept => {
            const option = document.createElement('option');
            option.value = dept;
            option.textContent = dept;
            departmentSelect.appendChild(option);
        });
    }
}

// Function to setup school/department dropdowns with change handlers
function setupSchoolDepartmentDropdowns(schoolSelectId, departmentSelectId, config = {}) {
    const schoolSelect = document.getElementById(schoolSelectId);
    const departmentSelect = document.getElementById(departmentSelectId);
    
    if (!schoolSelect || !departmentSelect) return;

    const cfg = {
        schoolIncludeEmpty: config.schoolIncludeEmpty !== undefined ? config.schoolIncludeEmpty : true,
        schoolEmptyText: config.schoolEmptyText || schoolSelect.dataset.emptyText || 'Select School',
        departmentIncludeEmpty: config.departmentIncludeEmpty !== undefined ? config.departmentIncludeEmpty : true,
        departmentEmptyText: config.departmentEmptyText || departmentSelect.dataset.emptyText || 'Select Department'
    };
    
    // Populate school dropdown
    populateSchoolDropdown(schoolSelectId, { includeEmpty: cfg.schoolIncludeEmpty, emptyText: cfg.schoolEmptyText });
    
    // Handle school change
    const updateDepartments = () => {
        populateDepartmentDropdown(schoolSelectId, departmentSelectId, {
            includeEmpty: cfg.departmentIncludeEmpty,
            emptyText: cfg.departmentEmptyText
        });
    };

    schoolSelect.addEventListener('change', updateDepartments);
    updateDepartments();
}

