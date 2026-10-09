let allCachedTickets = [];
let timerInterval = null;

function switchTab(tab) {
    const landingView = document.getElementById('view-landing');
    const custView = document.getElementById('view-customer');
    const execView = document.getElementById('view-executive');
    const adminView = document.getElementById('view-admin');

    const btnLanding = document.getElementById('btn-landing');
    const btnCust = document.getElementById('btn-customer');
    const btnExec = document.getElementById('btn-executive');
    const btnAdmin = document.getElementById('btn-admin');

    landingView.classList.add('hidden');
    custView.classList.add('hidden');
    execView.classList.add('hidden');
    adminView.classList.add('hidden');

    const defaultBtnClass = "px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 transition";
    if (btnLanding) btnLanding.className = defaultBtnClass;
    if (btnCust) btnCust.className = defaultBtnClass;
    if (btnExec) btnExec.className = defaultBtnClass;
    if (btnAdmin) btnAdmin.className = defaultBtnClass;

    const activeBtnClass = "px-4 py-2 rounded-xl text-xs font-semibold bg-white text-indigo-700 shadow-sm transition";

    if (tab === 'landing') {
        landingView.classList.remove('hidden');
        if (btnLanding) btnLanding.className = activeBtnClass;
    } else if (tab === 'customer') {
        custView.classList.remove('hidden');
        if (btnCust) btnCust.className = activeBtnClass;
    } else if (tab === 'executive') {
        execView.classList.remove('hidden');
        if (btnExec) btnExec.className = activeBtnClass;
        loadComplaints();
    } else {
        adminView.classList.remove('hidden');
        if (btnAdmin) btnAdmin.className = activeBtnClass;
        loadComplaints();
    }
}

// Modal controls
function openAdminModal() {
    const modal = document.getElementById('adminModal');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('admin_id').value = '';
        document.getElementById('admin_pwd').value = '';
        document.getElementById('loginError').classList.add('hidden');
    }
}

function closeAdminModal() {
    const modal = document.getElementById('adminModal');
    if (modal) modal.classList.add('hidden');
}

function handleAdminLogin(e) {
    e.preventDefault();
    const id = document.getElementById('admin_id').value.trim();
    const pwd = document.getElementById('admin_pwd').value.trim();

    if (id === "TharunAthithya" && pwd === "HarshuChellam") {
        closeAdminModal();
        switchTab('admin');
    } else {
        document.getElementById('loginError').classList.remove('hidden');
    }
}

function openExecutiveModal() {
    const modal = document.getElementById('execModal');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('exec_id').value = '';
        document.getElementById('exec_pwd').value = '';
        document.getElementById('execLoginError').classList.add('hidden');
    }
}

function closeExecutiveModal() {
    const modal = document.getElementById('execModal');
    if (modal) modal.classList.add('hidden');
}

function handleExecutiveLogin(e) {
    e.preventDefault();
    const id = document.getElementById('exec_id').value.trim();
    const pwd = document.getElementById('exec_pwd').value.trim();

    if (id === "agent_rahul" && pwd === "agent123") {
        closeExecutiveModal();
        switchTab('executive');
    } else {
        document.getElementById('execLoginError').classList.remove('hidden');
    }
}

// Handle Customer Grievance Form Submission
document.getElementById('grievanceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> AI Priority Triage Running...`;
    btn.disabled = true;

    const formData = new FormData();
    formData.append('customer_name', document.getElementById('customer_name').value);
    formData.append('customer_id', 'CUST-' + Math.floor(Math.random() * 900 + 100));
    formData.append('order_id', document.getElementById('order_id').value);
    formData.append('description', document.getElementById('description').value);
    
    const fileInput = document.getElementById('proof_image').files[0];
    if (fileInput) formData.append('proof_image', fileInput);

    try {
        const res = await fetch('/api/complaints', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
            document.getElementById('resultCard').classList.remove('hidden');
            document.getElementById('resTicketId').innerText = data.ticket.ticket_id;
            document.getElementById('resCategory').innerText = data.ticket.category;
            document.getElementById('resDesc').innerText = data.ticket.description;
            document.getElementById('resDept').innerText = data.ticket.department;
            document.getElementById('resSeverity').innerText = 'Level ' + data.ticket.severity + ' / 5';
            
            // Format Priority with IPI mathematical score if available
            const priorityLabel = data.ipi_score 
                ? `${data.ticket.priority} (${data.ipi_score}/100)` 
                : (data.ticket.priority || 'Medium');
            const resPriorityEl = document.getElementById('resPriority');
            if (resPriorityEl) resPriorityEl.innerText = priorityLabel;

            document.getElementById('resSla').innerText = data.ticket.sla_duration_hours + ' Hours';
            btn.innerHTML = `<span>Submitted & Triaged Successfully</span> <i class="fa-solid fa-check"></i>`;
        } else {
            alert('Error: ' + data.error);
            btn.innerHTML = `<span>Submit Grievance to AI Engine</span> <i class="fa-solid fa-arrow-right"></i>`;
            btn.disabled = false;
        }
    } catch (err) {
        alert('Server communication error.');
        btn.innerHTML = `<span>Submit Grievance to AI Engine</span> <i class="fa-solid fa-arrow-right"></i>`;
        btn.disabled = false;
    }
});

// Format live ticking SLA countdown
function formatSlaTimer(deadlineIso) {
    const diff = new Date(deadlineIso).getTime() - Date.now();
    if (diff <= 0) {
        const passedMin = Math.abs(Math.floor(diff / (1000 * 60)));
        return `<span class="timer-breached">BREACHED (${passedMin}m ago)</span>`;
    }
    const mins = Math.floor(diff / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    const cls = mins < 60 ? 'timer-warning' : 'timer-safe';
    return `<span class="${cls}">${mins}m ${secs}s</span>`;
}

async function loadComplaints() {
    try {
        const res = await fetch('/api/complaints');
        const data = await res.json();

        if (data.success) {
            allCachedTickets = data.tickets;
            renderAdminTable(allCachedTickets);
            renderExecutiveTable(allCachedTickets);

            if (!timerInterval) {
                timerInterval = setInterval(() => {
                    document.querySelectorAll('[data-deadline]').forEach(el => {
                        el.innerHTML = formatSlaTimer(el.getAttribute('data-deadline'));
                    });
                }, 1000);
            }
        }
    } catch (err) {
        console.error('Failed to load tickets');
    }
}

// 1. Render Admin Command Center (Prioritizes Escalated & Breached tickets)
function renderAdminTable(tickets) {
    const tbody = document.getElementById('ticketTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const adminQueue = tickets.filter(t => t.status !== 'Resolved' && (t.is_escalated || t.is_breached || t.escalation_level > 1));

    if (adminQueue.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-slate-500 font-medium">No escalated tickets in Admin Queue. Operations desk running smoothly. 🎉</td></tr>`;
        return;
    }

    adminQueue.forEach((t, idx) => {
        const proofHtml = t.image_url 
            ? `<button onclick="openProofModal('${t.image_url}')" class="text-indigo-600 hover:text-indigo-800 font-bold text-xs flex items-center gap-1.5"><i class="fa-solid fa-arrow-up-right-from-square"></i> Proof</button>` 
            : '<span class="text-slate-400 text-xs">None</span>';
        
        let priorityColor = "bg-slate-100 text-slate-700 border-slate-200";
        if (t.priority === 'Critical' || t.priority === 'High') {
            priorityColor = "bg-rose-50 text-rose-700 border border-rose-200/80";
        } else if (t.priority === 'Medium') {
            priorityColor = "bg-amber-50 text-amber-700 border border-amber-200/80";
        }

        const isBreachedRow = t.is_breached 
            ? 'bg-rose-50/50 border-l-4 border-rose-500' 
            : 'hover:bg-slate-50/70';

        tbody.innerHTML += `
            <tr class="${isBreachedRow} transition">
                <td class="p-4 font-bold text-slate-400 font-mono text-xs">#${idx + 1}</td>
                <td class="p-4 font-mono text-indigo-600 font-bold text-xs">${t.ticket_id}</td>
                <td class="p-4 font-semibold text-slate-900 text-xs">${t.customer_name}</td>
                <td class="p-4"><span class="px-2.5 py-1 bg-slate-100 rounded-full font-bold text-xs text-slate-700 border border-slate-200">Level ${t.severity}</span></td>
                <td class="p-4"><span class="px-2.5 py-1 rounded-full text-xs font-bold border ${priorityColor}">${t.priority || 'Medium'}</span></td>
                <td class="p-4 text-xs font-medium text-slate-600">${t.department}</td>
                <td class="p-4 text-xs" data-deadline="${t.sla_deadline}">${formatSlaTimer(t.sla_deadline)}</td>
                <td class="p-4">${proofHtml}</td>
                <td class="p-4 text-right">
                    <button onclick="updateStatus('${t.ticket_id}', 'Resolved')" class="text-xs btn-apple text-white px-3.5 py-1.5 rounded-xl font-bold transition">Resolve</button>
                </td>
            </tr>
        `;
    });
}

// 2. Render Agent Workspace (Receives all incoming tickets first)
function renderExecutiveTable(tickets) {
    const tbody = document.getElementById('executiveTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const activeTickets = tickets.filter(t => t.status !== 'Resolved');

    if (activeTickets.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-slate-500 font-medium">No active complaints assigned to your desk! 🎉</td></tr>`;
        return;
    }

    activeTickets.forEach(t => {
        const proofHtml = t.image_url 
            ? `<button onclick="openProofModal('${t.image_url}')" class="text-indigo-600 hover:text-indigo-800 font-bold text-xs flex items-center gap-1.5"><i class="fa-solid fa-arrow-up-right-from-square"></i> Proof</button>` 
            : '<span class="text-slate-400 text-xs">None</span>';
        
        let priorityColor = "bg-slate-100 text-slate-700 border-slate-200";
        if (t.priority === 'Critical' || t.priority === 'High') {
            priorityColor = "bg-rose-50 text-rose-700 border border-rose-200/80";
        } else if (t.priority === 'Medium') {
            priorityColor = "bg-amber-50 text-amber-700 border border-amber-200/80";
        }

        const statusBadge = t.is_escalated 
            ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">ESCALATED</span>' 
            : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">OPEN</span>';

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50/70 transition">
                <td class="p-4 font-mono text-indigo-600 font-bold text-xs">${t.ticket_id}</td>
                <td class="p-4">
                    <div class="font-bold text-slate-900 text-xs">${t.customer_name}</div>
                    <div class="text-[11px] text-slate-400 font-mono">${t.customer_id}</div>
                </td>
                <td class="p-4 text-xs font-semibold text-slate-700">${t.category}</td>
                <td class="p-4"><span class="px-2.5 py-1 rounded-full text-xs font-bold border ${priorityColor}">${t.priority || 'Medium'}</span></td>
                <td class="p-4 text-xs font-medium text-slate-600">${t.department}</td>
                <td class="p-4">${statusBadge}</td>
                <td class="p-4 text-xs" data-deadline="${t.sla_deadline}">${formatSlaTimer(t.sla_deadline)}</td>
                <td class="p-4">${proofHtml}</td>
                <td class="p-4 text-right space-x-1.5 whitespace-nowrap">
                    <button onclick="openAiDraftModal('${t.ticket_id}', '${escape(t.customer_name)}', '${escape(t.description)}')" class="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-xl hover:bg-indigo-600 hover:text-white transition font-bold"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i> AI Response</button>
                    <button onclick="updateStatus('${t.ticket_id}', 'Resolved')" class="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl hover:bg-emerald-600 hover:text-white transition font-bold">Resolve</button>
                    ${!t.is_escalated ? `<button onclick="escalateTicket('${t.ticket_id}')" class="text-xs bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-xl hover:bg-rose-600 hover:text-white transition font-bold">Escalate</button>` : ''}
                </td>
            </tr>
        `;
    });
}

// Lightbox modal helpers
function openProofModal(url) {
    document.getElementById('proofModalImg').src = url;
    document.getElementById('proofModal').classList.remove('hidden');
}

function closeProofModal() {
    document.getElementById('proofModal').classList.add('hidden');
}

// AI Draft helper
let activeDraftTicketId = null;
function openAiDraftModal(ticketId, name, desc) {
    activeDraftTicketId = ticketId;
    const cleanName = unescape(name);
    const cleanDesc = unescape(desc);
    document.getElementById('aiDraftText').value = `Dear ${cleanName},\n\nWe have reviewed your grievance regarding "${cleanDesc}". Our operations team has processed the investigation and initiated the required corrective protocol under our SLA guarantee.\n\nThank you for your patience,\nPriorityAI Operations Support`;
    document.getElementById('aiDraftModal').classList.remove('hidden');
}

function closeAiDraftModal() {
    document.getElementById('aiDraftModal').classList.add('hidden');
}

function sendAiDraft() {
    if (activeDraftTicketId) {
        updateStatus(activeDraftTicketId, 'Resolved');
        closeAiDraftModal();
        alert('Resolution sent with cryptographic audit signature!');
    }
}

async function updateStatus(ticket_id, status) {
    try {
        const res = await fetch(`/api/complaints/${ticket_id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                status,
                agent_name: 'Agent Rahul',
                resolution_notes: 'Resolution verified via workspace console'
            })
        });
        const data = await res.json();
        if (data.success) {
            loadComplaints();
        } else {
            alert('Failed to update ticket status');
        }
    } catch (err) {
        alert('Error connecting to server');
    }
}

async function escalateTicket(ticket_id) {
    try {
        const res = await fetch(`/api/complaints/${ticket_id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ escalation_level: 2, is_escalated: true, status: 'Escalated' })
        });
        const data = await res.json();
        if (data.success) {
            alert(`Ticket ${ticket_id} escalated to Admin Command Radar!`);
            loadComplaints();
        }
    } catch (err) {
        alert('Failed to escalate ticket.');
    }
}

function resetForm() {
    document.getElementById('grievanceForm').reset();
    document.getElementById('resultCard').classList.add('hidden');
    const btn = document.getElementById('submitBtn');
    btn.innerHTML = `<span>Submit Grievance to AI Engine</span> <i class="fa-solid fa-arrow-right"></i>`;
    btn.disabled = false;
}

function toggleChatWindow() {
    const win = document.getElementById('chatWindow');
    win.classList.toggle('hidden');
}

async function sendChatQuery() {
    const input = document.getElementById('chatInput');
    const box = document.getElementById('chatBox');
    const query = input.value.trim();
    if (!query) return;

    box.innerHTML += `
        <div class="flex justify-end">
            <div class="btn-apple text-white p-3 rounded-2xl max-w-[85%] text-xs shadow-sm">
                ${query}
            </div>
        </div>`;
    input.value = '';
    box.scrollTop = box.scrollHeight;

    const loadingId = 'loading-' + Date.now();
    box.innerHTML += `
        <div id="${loadingId}" class="flex justify-start">
            <div class="bg-white text-slate-500 p-3 rounded-2xl text-xs border border-slate-200 shadow-sm animate-pulse">
                PriorityAI is thinking...
            </div>
        </div>`;
    box.scrollTop = box.scrollHeight;

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: query })
        });
        const data = await res.json();
        
        const loader = document.getElementById(loadingId);
        if (loader) loader.remove();

        box.innerHTML += `
            <div class="flex justify-start">
                <div class="bg-white text-slate-800 p-3.5 rounded-2xl max-w-[85%] text-xs border border-slate-200 shadow-sm leading-relaxed font-medium">
                    ${data.reply}
                </div>
            </div>`;
        box.scrollTop = box.scrollHeight;
    } catch (err) {
        const loader = document.getElementById(loadingId);
        if (loader) loader.remove();
        box.innerHTML += `
            <div class="flex justify-start">
                <div class="bg-rose-50 text-rose-700 p-3 rounded-2xl max-w-[85%] text-xs border border-rose-200 font-semibold">
                    Connection issue. Please submit your grievance directly through the intake portal!
                </div>
            </div>`;
    }
}