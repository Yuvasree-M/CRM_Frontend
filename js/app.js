// ======== AUTH CHECK ========
async function checkLogin() {
    const token = localStorage.getItem('token');
    if (!token) window.location.href = 'index.html';
    try {
        const res = await fetch('https://crmbackend-production-da5f.up.railway.app/api/auth/check', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Unauthorized');
    } catch {
        localStorage.removeItem('token');
        window.location.href = 'index.html';
    }
}
checkLogin();

// ======== GLOBAL VARIABLES ========
let partners = [];
let clients = [];
let selectedPartner = null;
let divisions = [];
let statuses = [];

// Pagination state
let clientCurrentPage = 1;
const clientRowsPerPage = 5;
let partnerCurrentPage = 1;
const partnerRowsPerPage = 5;

// ======== DOM ELEMENTS ========
const partnerSelect = document.getElementById('partnerSelect');
const tableBody = document.querySelector('#clientsTable tbody');
const filterName = document.getElementById('filterName');
const filterSpoc = document.getElementById('filterSpoc');
const filterDivision = document.getElementById('filterDivision');
const filterStatus = document.getElementById('filterStatus');
const divisionInput = document.getElementById('division');
const statusInput = document.getElementById('status');
const clientForm = document.getElementById('clientForm');
const clientModalInstance = new bootstrap.Modal(document.getElementById('clientModal'));
const clientModalTitle = document.querySelector('#clientModal .modal-title');
const clientIdInput = document.getElementById('clientId');

const managePartnersBtn = document.getElementById('managePartnersBtn');
const partnerModalInstance = new bootstrap.Modal(document.getElementById('partnerModal'));
const partnersTableBody = document.querySelector('#partnersTable tbody');
const partnerForm = document.getElementById('partnerForm');
const partnerFormModal = new bootstrap.Modal(document.getElementById('partnerFormModal'));
const partnerFormTitle = document.querySelector('#partnerFormModal .modal-title');
const partnerIdInput = document.getElementById('partnerId');
const partnerNameInput = document.getElementById('partnerName');

const globalSearch = document.getElementById('globalSearch');
const clearFiltersBtn = document.getElementById('clearFilters');

// Pagination containers
let clientPaginationContainer = null;
let partnerPaginationContainer = null;

// ======== AUTH FETCH ========
async function authFetch(url, options = {}) {
    const token = localStorage.getItem('token');
    options.headers = {
        ...(options.headers || {}),
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
    const res = await fetch(url, options);
    if ([401, 403].includes(res.status)) {
        localStorage.removeItem('token');
        window.location.href = 'index.html';
        throw new Error('Unauthorized');
    }
    return res;
}

// ======== LOAD DIVISIONS & STATUSES ========
async function loadDropdowns() {
    try {
        const [divRes, statusRes] = await Promise.all([
            authFetch('https://crmbackend-production-da5f.up.railway.app/api/clients/divisions'),
            authFetch('https://crmbackend-production-da5f.up.railway.app/api/clients/statuses')
        ]);
        divisions = await divRes.json();
        statuses = await statusRes.json();
        divisionInput.innerHTML = `<option value="">Select Division</option>` + divisions.map(d => `<option value="${d}">${d}</option>`).join('');
        statusInput.innerHTML = `<option value="">Select Status</option>` + statuses.map(s => `<option value="${s}">${s}</option>`).join('');
        filterDivision.innerHTML = `<option value="">All Divisions</option>` + divisions.map(d => `<option value="${d}">${d}</option>`).join('');
        filterStatus.innerHTML = `<option value="">All Status</option>` + statuses.map(s => `<option value="${s}">${s}</option>`).join('');
    } catch (e) { console.error(e); }
}

// ======== LOAD PARTNERS ========
async function loadPartners() {
    try {
        const res = await authFetch('https://crmbackend-production-da5f.up.railway.app/api/partners');
        partners = await res.json();
        if (partners.length) {
            partnerSelect.innerHTML = partners.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
            selectedPartner = selectedPartner || partners[0].id;
            partnerSelect.value = selectedPartner;
            fetchClientsByPartner();
        } else {
            partnerSelect.innerHTML = `<option value="">No partner available</option>`;
            selectedPartner = null;
            tableBody.innerHTML = `<tr><td colspan="8" class="text-center">No clients available</td></tr>`;
        }
        renderPartnerTable();
    } catch (e) { console.error(e); }
}

// ======== RENDER PARTNERS TABLE WITH PAGINATION ========
function renderPartnerTable() {
    // Pagination logic
    const totalPages = Math.ceil(partners.length / partnerRowsPerPage);
    const start = (partnerCurrentPage - 1) * partnerRowsPerPage;
    const end = start + partnerRowsPerPage;
    const currentPartners = partners.slice(start, end);

    partnersTableBody.innerHTML = currentPartners.length ? currentPartners.map(p => `
        <tr>
            <td>${p.name}</td>
            <td>
                <button class="btn btn-sm btn-primary edit-partner-btn" data-id="${p.id}">Edit</button>
                <button class="btn btn-sm btn-danger delete-partner-btn" data-id="${p.id}">Delete</button>
            </td>
        </tr>
    `).join('') : `<tr><td colspan="2" class="text-center">No partners available</td></tr>`;

    // Render pagination
    if (!partnerPaginationContainer) {
        partnerPaginationContainer = document.createElement('ul');
        partnerPaginationContainer.classList.add('pagination', 'justify-content-center', 'mt-2');
        document.querySelector('#partnersTable').insertAdjacentElement('afterend', partnerPaginationContainer);
    }
    renderPagination(partnerPaginationContainer, totalPages, partnerCurrentPage, (page) => {
        partnerCurrentPage = page;
        renderPartnerTable();
    });
}

// ======== FETCH CLIENTS BY PARTNER ========
async function fetchClientsByPartner() {
    if (!selectedPartner) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center">No clients available</td></tr>`;
        return;
    }
    try {
        const res = await authFetch(`https://crmbackend-production-da5f.up.railway.app/api/clients/partner/${selectedPartner}`);
        const data = await res.json();
        clients = data.content || [];
        clientCurrentPage = 1;
        renderClientsTable();
    } catch (e) { console.error(e); }
}

// ======== RENDER CLIENTS TABLE WITH PAGINATION & FILTER ========
function renderClientsTable() {
    let filtered = clients.filter(c => {
        const name = filterName.value.toLowerCase();
        const spoc = filterSpoc.value.toLowerCase();
        const division = filterDivision.value;
        const status = filterStatus.value;
        if (name && !c.clientName?.toLowerCase().includes(name)) return false;
        if (spoc && !c.spocName?.toLowerCase().includes(spoc)) return false;
        if (division && c.division !== division) return false;
        if (status && c.status !== status) return false;
        return true;
    });

    // Pagination
    const totalPages = Math.ceil(filtered.length / clientRowsPerPage);
    const start = (clientCurrentPage - 1) * clientRowsPerPage;
    const end = start + clientRowsPerPage;
    const pageClients = filtered.slice(start, end);

    tableBody.innerHTML = pageClients.length ? pageClients.map(c => `
        <tr>
            <td>${c.clientName||''}</td>
            <td>${c.spocName||''}</td>
            <td>${c.division||''}</td>
            <td>${c.location||''}</td>
            <td>${c.requirement||''}</td>
            <td>${c.status||''}</td>
            <td>${c.nextSteps||''}</td>
            <td>
                <button class="btn btn-sm btn-primary edit-btn" data-id="${c.id}">Edit</button>
                <button class="btn btn-sm btn-danger delete-btn" data-id="${c.id}">Delete</button>
            </td>
        </tr>
    `).join('') : `<tr><td colspan="8" class="text-center">No clients available</td></tr>`;

    // Render pagination
    if (!clientPaginationContainer) {
        clientPaginationContainer = document.createElement('ul');
        clientPaginationContainer.classList.add('pagination', 'justify-content-center', 'mt-2');
        document.querySelector('#clientsTable').insertAdjacentElement('afterend', clientPaginationContainer);
    }
    renderPagination(clientPaginationContainer, totalPages, clientCurrentPage, (page) => {
        clientCurrentPage = page;
        renderClientsTable();
    });
}

// ======== PAGINATION RENDER HELPER ========
function renderPagination(container, totalPages, currentPage, onPageClick) {
    container.innerHTML = '';
    if (totalPages <= 1) return;

    // Previous button
    const prev = document.createElement('li');
    prev.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    prev.innerHTML = `<a class="page-link" href="#">Previous</a>`;
    prev.addEventListener('click', e => {
        e.preventDefault();
        if (currentPage > 1) onPageClick(currentPage - 1);
    });
    container.appendChild(prev);

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === currentPage ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
        li.addEventListener('click', e => {
            e.preventDefault();
            onPageClick(i);
        });
        container.appendChild(li);
    }

    // Next button
    const next = document.createElement('li');
    next.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    next.innerHTML = `<a class="page-link" href="#">Next</a>`;
    next.addEventListener('click', e => {
        e.preventDefault();
        if (currentPage < totalPages) onPageClick(currentPage + 1);
    });
    container.appendChild(next);
}

// ======== EXPORT PDF ========
async function exportClientsPDF(filtered = true, allPartners = false) {
    let content = [];
    if (allPartners) {
        // Fetch all clients for all partners
        const res = await authFetch('https://crmbackend-production-da5f.up.railway.app/api/clients/all');
        const allClients = await res.json();

        partners.forEach(p => {
            let partnerClients = allClients.filter(c => c.partnerId == p.id);
            if (!partnerClients.length) return;
            content.push({ text: p.name, style: 'header', margin: [0, 5, 0, 5] });
            let body = [['Client Name','SPOC','Division','Location','Requirement','Status','Next Steps']];
            partnerClients.forEach(c => body.push([c.clientName||'', c.spocName||'', c.division||'', c.location||'', c.requirement||'', c.status||'', c.nextSteps||'']));
            content.push({ table: { headerRows:1, widths:Array(body[0].length).fill('*'), body } });
        });
    } else {
        // Filtered or all clients of selected partner
        let dataSource = clients;
        if (filtered) {
            dataSource = clients.filter(c => {
                const name = filterName.value.toLowerCase();
                const spoc = filterSpoc.value.toLowerCase();
                const division = filterDivision.value;
                const status = filterStatus.value;
                if (name && !c.clientName?.toLowerCase().includes(name)) return false;
                if (spoc && !c.spocName?.toLowerCase().includes(spoc)) return false;
                if (division && c.division !== division) return false;
                if (status && c.status !== status) return false;
                return true;
            });
        }
        let title = selectedPartner ? `Clients of ${partners.find(p=>p.id==selectedPartner)?.name}` : 'All Clients';
        content.push({ text: title, style:'header', margin:[0,0,0,10] });
        let body = [['Client Name','SPOC','Division','Location','Requirement','Status','Next Steps']];
        dataSource.forEach(c => body.push([c.clientName||'', c.spocName||'', c.division||'', c.location||'', c.requirement||'', c.status||'', c.nextSteps||'']));
        content.push({ table:{ headerRows:1, widths:Array(body[0].length).fill('*'), body } });
    }
    pdfMake.createPdf({ content, styles:{ header:{ fontSize:16, bold:true } } }).download('Clients.pdf');
}

// ======== EVENT LISTENERS ========

// Partner selection
partnerSelect.addEventListener('change', () => {
    selectedPartner = partnerSelect.value;
    fetchClientsByPartner();
});

// search/filter events
[filterName, filterSpoc, filterDivision, filterStatus].forEach(el => {
    el.addEventListener('input', () => {
        clientCurrentPage = 1;
        renderClientsTable();
    });
});
clearFiltersBtn.addEventListener('click', () => {
    filterName.value = '';
    filterSpoc.value = '';
    filterDivision.value = '';
    filterStatus.value = '';
    clientCurrentPage = 1;
    renderClientsTable();
});

// Manage partners modal
managePartnersBtn.addEventListener('click', ()=>partnerModalInstance.show());

// Add partner
document.getElementById('addPartnerBtn').addEventListener('click', () => {
    partnerFormTitle.textContent='Add Partner';
    partnerForm.reset();
    partnerIdInput.value='';
    partnerFormModal.show();
});

// Edit/Delete partners
partnersTableBody.addEventListener('click', async e => {
    const id = e.target.dataset.id;
    if(!id) return;
    const partner = partners.find(p=>p.id==id);
    if(e.target.classList.contains('edit-partner-btn')){
        if(!partner) return;
        partnerFormTitle.textContent='Edit Partner';
        partnerIdInput.value = partner.id;
        partnerNameInput.value = partner.name;
        partnerFormModal.show();
    }
    if(e.target.classList.contains('delete-partner-btn')){
        Swal.fire({
            title:'Are you sure?',
            text:'This will delete the partner and its clients!',
            icon:'warning',
            showCancelButton:true,
            confirmButtonText:'Yes',
            cancelButtonText:'Cancel'
        }).then(async result=>{
            if(result.isConfirmed){
                try{
                    await authFetch(`https://crmbackend-production-da5f.up.railway.app/api/partners/${id}`,{method:'DELETE'});
                    partners = partners.filter(p=>p.id!=id);
                    if(selectedPartner==id) selectedPartner = partners[0]?.id || null;
                    renderPartnerTable();
                    fetchClientsByPartner();
                    Swal.fire('Deleted!','Partner deleted','success');
                }catch(err){console.error(err); Swal.fire('Error','Failed','error');}
            }
        });
    }
});

// Partner form submit
partnerForm.addEventListener('submit', async e => {
    e.preventDefault();
    const id = partnerIdInput.value;
    const name = partnerNameInput.value.trim();
    if(!name) return;
    try{
        let res;
        if(id) res=await authFetch(`https://crmbackend-production-da5f.up.railway.app/api/partners/${id}`,{method:'PUT',body:JSON.stringify({name})});
        else res=await authFetch(`https://crmbackend-production-da5f.up.railway.app/api/partners`,{method:'POST',body:JSON.stringify({name})});
        const saved = await res.json();
        partnerFormModal.hide();
        selectedPartner = saved.id;
        await loadPartners();
        Swal.fire('Success','Partner saved','success');
    }catch(err){console.error(err); Swal.fire('Error','Failed','error');}
});

// Add/Edit/Delete clients
document.getElementById('addClientBtn').addEventListener('click', async ()=> {
    if(!selectedPartner){ Swal.fire('No partner available'); return; }
    clientModalTitle.textContent='Add Client';
    clientForm.reset();
    clientIdInput.value='';
    await loadDropdowns();
    clientModalInstance.show();
});

tableBody.addEventListener('click', async e => {
    const id = e.target.dataset.id;
    if(!id) return;
    if(e.target.classList.contains('edit-btn')){
        const client = clients.find(c=>c.id==id);
        if(!client) return;
        clientModalTitle.textContent='Edit Client';
        clientIdInput.value=client.id;
        await loadDropdowns();
        document.getElementById('clientName').value=client.clientName||'';
        document.getElementById('spocName').value=client.spocName||'';
        document.getElementById('location').value=client.location||'';
        document.getElementById('requirement').value=client.requirement||'';
        document.getElementById('nextSteps').value=client.nextSteps||'';
        divisionInput.value=client.division||'';
        statusInput.value=client.status||'';
        clientModalInstance.show();
    }
    if(e.target.classList.contains('delete-btn')){
        Swal.fire({
            title:'Are you sure?',
            text:'This will delete the client!',
            icon:'warning',
            showCancelButton:true,
            confirmButtonText:'Yes',
            cancelButtonText:'Cancel'
        }).then(async result=>{
            if(result.isConfirmed){
                try{
                    await authFetch(`https://crmbackend-production-da5f.up.railway.app/api/clients/${id}`,{method:'DELETE'});
                    clients = clients.filter(c=>c.id!=id);
                    renderClientsTable();
                    Swal.fire('Deleted!','Client deleted','success');
                }catch(err){console.error(err); Swal.fire('Error','Failed','error');}
            }
        });
    }
});

// Client form submit
clientForm.addEventListener('submit', async e=>{
    e.preventDefault();
    const id = clientIdInput.value;
    const clientData = {
        clientName: document.getElementById('clientName').value,
        spocName: document.getElementById('spocName').value,
        division: divisionInput.value,
        location: document.getElementById('location').value,
        requirement: document.getElementById('requirement').value,
        status: statusInput.value,
        nextSteps: document.getElementById('nextSteps').value,
        partnerId: selectedPartner
    };
    try{
        let res;
        if(id) res = await authFetch(`https://crmbackend-production-da5f.up.railway.app/api/clients/${id}`,{method:'PUT',body:JSON.stringify(clientData)});
        else res = await authFetch(`https://crmbackend-production-da5f.up.railway.app/api/clients/partner/${selectedPartner}`,{method:'POST',body:JSON.stringify(clientData)});
        const saved = await res.json();
        if(id) clients = clients.map(c=>c.id==saved.id?saved:c);
        else clients.unshift(saved);
        clientCurrentPage = 1;
        renderClientsTable();
        clientModalInstance.hide();
        Swal.fire('Success','Client saved','success');
    }catch(err){console.error(err); Swal.fire('Error','Failed','error');}
});



// ======== INITIAL LOAD ========
loadDropdowns();
loadPartners();

// ======== EXPORT PDF ========
async function exportClientsPDF(filtered = true, allPartners = false) {
    try {
        let content = [];

        const ownerName = "Tholons CRM"; // Add owner/company name in header
        const headerStyle = { fontSize: 14, bold: true, color: '#003366', margin: [0, 0, 0, 5] };
        const tableHeaderStyle = { fillColor: '#003366', color: '#fff', bold: true, alignment: 'center' };
        const cellStyle = { margin: [2, 2, 2, 2] };

        if (allPartners) {
            const res = await authFetch('https://crmbackend-production-da5f.up.railway.app/api/clients/all');
            const allClients = await res.json();
        
            const sortedPartners = [...partners].sort((a, b) => a.name.localeCompare(b.name));
        
            sortedPartners.forEach(p => {
                let partnerClients = allClients
                    .filter(c => c.partner && c.partner.id == p.id)
                    .sort((a,b) => (a.clientName||'').localeCompare(b.clientName||''));
        
                if (!partnerClients.length) return;
        
                content.push({ text: `${p.name} Clients`, style: 'partnerHeader', margin:[0,5,0,5] });
        
                let body = [['Client Name','SPOC','Division','Location','Requirement','Status','Next Steps']];
                partnerClients.forEach(c => body.push([
                    c.clientName||'', c.spocName||'', c.division||'', c.location||'',
                    c.requirement||'', c.status||'', c.nextSteps||''
                ]));
        
                content.push({
                    style: 'clientTable',
                    table: { headerRows: 1, widths: Array(body[0].length).fill('*'), body },
                    layout: {
                        fillColor: function (rowIndex) {
                            return rowIndex === 0 ? '#7E57C2' : (rowIndex % 2 === 0 ? '#EDE7F6' : null);
                        },
                        hLineColor: () => '#7E57C2',
                        vLineColor: () => '#7E57C2',
                        paddingLeft: () => 4,
                        paddingRight: () => 4,
                        paddingTop: () => 2,
                        paddingBottom: () => 2
                    }
                });
        
                content.push({ text: '', pageBreak: 'after' });
            });
        }
        else {
            let dataSource = clients;
            let filterHeading = [];

            if (filtered) {
                dataSource = clients.filter(c => {
                    const name = filterName.value.toLowerCase();
                    const spoc = filterSpoc.value.toLowerCase();
                    const division = filterDivision.value;
                    const status = filterStatus.value;
                    if (name && !c.clientName?.toLowerCase().includes(name)) return false;
                    if (spoc && !c.spocName?.toLowerCase().includes(spoc)) return false;
                    if (division && c.division !== division) return false;
                    if (status && c.status !== status) return false;
                    return true;
                });

                if (filterName.value) filterHeading.push(`Client Name: ${filterName.value}`);
                if (filterSpoc.value) filterHeading.push(`SPOC: ${filterSpoc.value}`);
                if (filterDivision.value) filterHeading.push(`Division: ${filterDivision.value}`);
                if (filterStatus.value) filterHeading.push(`Status: ${filterStatus.value}`);
            }

            let title = selectedPartner ? `Clients of ${partners.find(p=>p.id==selectedPartner)?.name}` : 'All Clients';
            content.push({ text: `${ownerName} - ${title}`, style:'header', margin:[0,0,0,5] });

            if (filterHeading.length) {
                content.push({ text: `Filtered by: ${filterHeading.join(', ')}`, italics: true, margin:[0,0,0,5] });
            }

            let body = [['Client Name','SPOC','Division','Location','Requirement','Status','Next Steps']];
            dataSource.forEach(c => body.push([
                c.clientName||'', c.spocName||'', c.division||'', c.location||'',
                c.requirement||'', c.status||'', c.nextSteps||''
            ]));

            content.push({
                style: 'clientTable',
                table: { headerRows: 1, widths: Array(body[0].length).fill('*'), body },
                layout: {
                    fillColor: function(rowIndex){ return rowIndex===0?'#c4a3e1': (rowIndex%2===0?'#d8c4ff':null); },
                    hLineColor: () => '#5e106a',
                    vLineColor: () => '#5e106a',
                    paddingLeft: () => 4,
                    paddingRight: () => 4,
                    paddingTop: () => 2,
                    paddingBottom: () => 2
                }
            });
        } 

        pdfMake.createPdf({
            content,
            styles: {
                header: { fontSize: 16, bold: true, color: '#7e3493' },
                partnerHeader: { fontSize: 15, bold: true, color: '#5e106a' },
                clientTable: { margin: [0,0,0,10] }
            },
            defaultStyle: { fontSize: 10 }
        }).download('Clients.pdf');

    } catch (err) {
        console.error(err);
        Swal.fire('Error','Failed to generate PDF','error');
    }
}

// ======== EXPORT BUTTONS ========
document.getElementById('exportFilteredPDF').addEventListener('click', ()=>exportClientsPDF(true,false));
document.getElementById('exportAllPDF').addEventListener('click', ()=>exportClientsPDF(false,false));

// ======== LOGOUT ========
document.getElementById('logoutBtn').addEventListener('click',()=>{
    Swal.fire({
        title:'Are you sure?',
        text:'You will be logged out!',
        icon:'warning',
        showCancelButton:true,
        confirmButtonText:'Yes, logout',
        cancelButtonText:'Cancel'
    }).then(result=>{ if(result.isConfirmed){ localStorage.removeItem('token'); window.location.href='index.html'; } });
});
