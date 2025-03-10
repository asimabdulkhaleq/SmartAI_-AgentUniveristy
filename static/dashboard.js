let faqTable = null;
let ticketTable = null;
let historyTable = null;
let usersTable = null;
let faqUsageChart = null;
let ticketStatusChart = null;
let chatUsageChart = null;
let adminWs = null;
let currentRoomId = null;

function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    const tabElement = document.getElementById(tabName + 'Tab');
    if (tabElement) {
        tabElement.classList.remove('hidden');
        console.log(`Switched to tab: ${tabName}`);
    } else {
        console.error(`Tab element not found: ${tabName}Tab`);
    }
    document.querySelectorAll('.tab-link').forEach(el => el.classList.remove('active'));
    const tabButton = document.querySelector(`button[onclick="showTab('${tabName}')"]`);
    if (tabButton) tabButton.classList.add('active');
    setTimeout(() => {
        if (faqTable) faqTable.api().columns.adjust().draw();
        if (ticketTable) ticketTable.api().columns.adjust().draw();
        if (historyTable) historyTable.api().columns.adjust().draw();
        if (usersTable) usersTable.api().columns.adjust().draw();
    }, 100);
}

function updateDashboardLanguage() {
    const lang = window.currentLanguage || 'ar';
    const translations = {
        'ar': {
            dashboardTitle: 'لوحة التحكم',
            faqTab: 'الأسئلة الشائعة',
            ticketsTab: 'التذاكر',
            historyTab: 'سجل المحادثات',
            usersTab: 'المستخدمون',
            agentTab: 'الموظف',
            analyticsTab: 'التحليلات',
            addFaqButton: 'إضافة سؤال جديد',
            exportFaqButton: 'تصدير إلى Excel',
            exportTicketsButton: 'تصدير إلى Excel',
            deleteAllHistoryButton: 'حذف الكل',
            exportHistoryButton: 'تصدير إلى Excel',
            addUserButton: 'إضافة مستخدم جديد',
            exportUsersButton: 'تصدير إلى Excel',
            backupDbButton: 'نسخ احتياطي لقاعدة البيانات',
            resetPasswordButton: 'إعادة تعيين كلمة المرور',
            id: 'المعرف',
            questionEn: 'السؤال (إنجليزي)',
            answerEn: 'الإجابة (إنجليزي)',
            questionAr: 'السؤال (عربي)',
            answerAr: 'الإجابة (عربي)',
            actions: 'الإجراءات',
            userId: 'معرف المستخدم',
            name: 'الاسم',
            email: 'البريد الإلكتروني',
            description: 'الوصف',
            status: 'الحالة',
            question: 'السؤال',
            answer: 'الإجابة',
            timestamp: 'الطابع الزمني',
            username: 'اسم المستخدم',
            editUserPermission: 'إذن تعديل المستخدم'
        },
        'en': {
            dashboardTitle: 'Admin Dashboard',
            faqTab: 'FAQs',
            ticketsTab: 'Tickets',
            historyTab: 'Chat History',
            usersTab: 'Users',
            agentTab: 'Agent',
            analyticsTab: 'Analytics',
            addFaqButton: 'Add New FAQ',
            exportFaqButton: 'Export to Excel',
            exportTicketsButton: 'Export to Excel',
            deleteAllHistoryButton: 'Delete All',
            exportHistoryButton: 'Export to Excel',
            addUserButton: 'Add New User',
            exportUsersButton: 'Export to Excel',
            backupDbButton: 'Backup Database',
            resetPasswordButton: 'Reset Password',
            id: 'ID',
            questionEn: 'Question (EN)',
            answerEn: 'Answer (EN)',
            questionAr: 'Question (AR)',
            answerAr: 'Answer (AR)',
            actions: 'Actions',
            userId: 'User ID',
            name: 'Name',
            email: 'Email',
            description: 'Description',
            status: 'Status',
            question: 'Question',
            answer: 'Answer',
            timestamp: 'Timestamp',
            username: 'Username',
            editUserPermission: 'Edit User Permission'
        }
    };

    const t = translations[lang];
    document.getElementById('dashboardTitle').textContent = t.dashboardTitle;
    document.getElementById('faqTabBtn').textContent = t.faqTab;
    document.getElementById('ticketsTabBtn').textContent = t.ticketsTab;
    document.getElementById('historyTabBtn').textContent = t.historyTab;
    document.getElementById('usersTabBtn').textContent = t.usersTab;
    document.getElementById('agentTabBtn').textContent = t.agentTab;
    document.getElementById('analyticsTabBtn').textContent = t.analyticsTab;

    document.getElementById('addFaqButton').textContent = t.addFaqButton;
    document.querySelector('#faqsTab button[onclick="exportTable(\'faqs\')"]').textContent = t.exportFaqButton;
    document.querySelector('#ticketsTab button[onclick="exportTable(\'support_tickets\')"]').textContent = t.exportTicketsButton;
    document.getElementById('deleteAllHistoryButton').textContent = t.deleteAllHistoryButton;
    document.querySelector('#historyTab button[onclick="exportTable(\'chatHistory\')"]').textContent = t.exportHistoryButton;
    const addUserButton = document.getElementById('addUserButton');
    if (addUserButton) addUserButton.textContent = t.addUserButton;
    document.querySelector('#usersTab button[onclick="exportTable(\'admins\')"]').textContent = t.exportUsersButton;
    document.getElementById('backupDbButton').textContent = t.backupDbButton;
    document.getElementById('resetPasswordButton').textContent = t.resetPasswordButton;

    const tables = [
        { table: faqTable, id: 'faqsTable', columns: ['id', 'questionEn', 'answerEn', 'questionAr', 'answerAr', 'actions'] },
        { table: ticketTable, id: 'ticketsTable', columns: ['id', 'userId', 'name', 'email', 'description', 'status', 'actions'] },
        { table: historyTable, id: 'historyTable', columns: ['id', 'userId', 'question', 'answer', 'timestamp', 'actions'] },
        { table: usersTable, id: 'usersTable', columns: ['id', 'username', 'editUserPermission', 'actions'] }
    ];
    tables.forEach(({ table, id, columns }) => {
        if (table && $.fn.DataTable.isDataTable(`#${id}`)) {
            const dt = table.api();
            columns.forEach((col, index) => {
                dt.column(index).header().textContent = t[col];
            });
            dt.draw(false);
        }
    });
}

function initDataTables() {
    if (!window.authToken) {
        console.error("No auth token available. Please log in.");
        return;
    }
    console.log("Starting DataTables initialization with token:", window.authToken);

    const lang = window.currentLanguage || 'ar';
    const t = {
        'ar': {
            noData: 'لا توجد بيانات متاحة',
            id: 'المعرف',
            questionEn: 'السؤال (إنجليزي)',
            answerEn: 'الإجابة (إنجليزي)',
            questionAr: 'السؤال (عربي)',
            answerAr: 'الإجابة (عربي)',
            actions: 'الإجراءات',
            edit: 'تعديل',
            delete: 'حذف',
            userId: 'معرف المستخدم',
            name: 'الاسم',
            email: 'البريد الإلكتروني',
            description: 'الوصف',
            status: 'الحالة',
            open: 'مفتوح',
            pending: 'معلق',
            closed: 'مغلق',
            question: 'السؤال',
            answer: 'الإجابة',
            timestamp: 'الطابع الزمني',
            username: 'اسم المستخدم',
            editUserPermission: 'إذن تعديل المستخدم'
        },
        'en': {
            noData: 'No data available',
            id: 'ID',
            questionEn: 'Question (EN)',
            answerEn: 'Answer (EN)',
            questionAr: 'Question (AR)',
            answerAr: 'Answer (AR)',
            actions: 'Actions',
            edit: 'Edit',
            delete: 'Delete',
            userId: 'User ID',
            name: 'Name',
            email: 'Email',
            description: 'Description',
            status: 'Status',
            open: 'Open',
            pending: 'Pending',
            closed: 'Closed',
            question: 'Question',
            answer: 'Answer',
            timestamp: 'Timestamp',
            username: 'Username',
            editUserPermission: 'Edit User Permission'
        }
    }[lang];

    const commonOptions = {
        responsive: true,
        width: '100%',
        autoWidth: false,
        scrollX: true,
        scrollY: 'calc(100vh - 180px)',
        scrollCollapse: true,
        paging: true,
        language: { emptyTable: t.noData },
        ajax: {
            headers: { 'Authorization': `Bearer ${window.authToken}` },
            error: function(xhr, error, thrown) {
                console.error(`DataTables AJAX error: ${xhr.status} - ${error}`, thrown);
            }
        }
    };

    try {
        if ($('#faqsTable').length && !$.fn.DataTable.isDataTable('#faqsTable')) {
            console.log("Initializing FAQs table...");
            faqTable = $('#faqsTable').dataTable({
                ...commonOptions,
                ajax: { ...commonOptions.ajax, url: 'https://asimabdulkhaleq-unismartagentapi.hf.space/api/admin/faqs',headers: { 'Authorization': `Bearer ${window.authToken}` },  dataSrc: '' },
                columns: [
                    { data: 'id', title: t.id },
                    { data: 'question_en', title: t.questionEn },
                    { data: 'answer_en', title: t.answerEn },
                    { data: 'question_ar', title: t.questionAr },
                    { data: 'answer_ar', title: t.answerAr },
                    { 
                        data: null, 
                        title: t.actions, 
                        render: data => `<button onclick="editFaq(${data.id})" class="px-2 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200">${t.edit}</button> <button onclick="deleteFaq(${data.id})" class="px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-300">${t.delete}</button>` 
                    }
                ],
                initComplete: function(settings, json) {
                    console.log("FAQs table initialized with data:", json);
                }
            });
        }

        if ($('#ticketsTable').length && !$.fn.DataTable.isDataTable('#ticketsTable')) {
            console.log("Initializing Tickets table...");
            ticketTable = $('#ticketsTable').dataTable({
                ...commonOptions,
                ajax: { ...commonOptions.ajax, url: 'https://asimabdulkhaleq-unismartagentapi.hf.space/api/admin/tickets', headers: { 'Authorization': `Bearer ${window.authToken}` }, dataSrc: '' },
                columns: [
                    { data: 'id', title: t.id },
                    { data: 'user_id', title: t.userId },
                    { data: 'user_name', title: t.name },
                    { data: 'email', title: t.email },
                    { data: 'issue_description', title: t.description },
                    { data: 'status', title: t.status },
                    { 
                        data: null, 
                        title: t.actions, 
                        render: data => `<select onchange="updateTicketStatus(${data.id}, this.value)"><option value="open" ${data.status === 'open' ? 'selected' : ''}>${t.open}</option><option value="pending" ${data.status === 'pending' ? 'selected' : ''}>${t.pending}</option><option value="closed" ${data.status === 'closed' ? 'selected' : ''}>${t.closed}</option></select> <button onclick="editTicket(${data.id})" class="px-2 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200">${t.edit}</button> <button onclick="deleteTicket(${data.id})" class="px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-300">${t.delete}</button>` 
                    }
                ],
                initComplete: function(settings, json) {
                    console.log("Tickets table initialized with data:", json);
                }
            });
        }

        if ($('#historyTable').length && !$.fn.DataTable.isDataTable('#historyTable')) {
            console.log("Initializing Chat History table...");
            historyTable = $('#historyTable').dataTable({
                ...commonOptions,
                ajax: { ...commonOptions.ajax, url: 'https://asimabdulkhaleq-unismartagentapi.hf.space/api/admin/chat_history', headers: { 'Authorization': `Bearer ${window.authToken}` },dataSrc: '' },
                columns: [
                    { data: 'id', title: t.id },
                    { data: 'user_id', title: t.userId },
                    { data: 'question', title: t.question },
                    { data: 'answer', title: t.answer },
                    { data: 'timestamp', title: t.timestamp },
                    { 
                        data: null, 
                        title: t.actions, 
                        render: data => `<button onclick="deleteChatHistory(${data.id})" class="px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-300">${t.delete}</button>` 
                    }
                ],
                initComplete: function(settings, json) {
                    console.log("Chat History table initialized with data:", json);
                }
            });
        }

        if ($('#usersTable').length && !$.fn.DataTable.isDataTable('#usersTable')) {
            console.log("Checking Users tab permissions...");
            fetch('https://asimabdulkhaleq-unismartagentapi.hf.space/api/admin/users', { headers: { 'Authorization': `Bearer ${window.authToken}` } })
                .then(response => {
                    if (response.ok) {
                        document.getElementById('usersTabBtn').style.display = 'block';
                        usersTable = $('#usersTable').dataTable({
                            ...commonOptions,
                            ajax: { ...commonOptions.ajax, url: 'https://asimabdulkhaleq-unismartagentapi.hf.space/api/admin/users', headers: { 'Authorization': `Bearer ${window.authToken}` }, dataSrc: '' },
                            columns: [
                                { data: 'id', title: t.id, width: '10%' },
                                { data: 'username', title: t.username, width: '30%' },
                                { 
                                    data: 'editUser', 
                                    title: t.editUserPermission, 
                                    width: '20%', 
                                    render: data => data ? (lang === 'ar' ? 'نعم' : 'Yes') : (lang === 'ar' ? 'لا' : 'No') 
                                },
                                { 
                                    data: null, 
                                    title: t.actions, 
                                    width: '40%', 
                                    render: data => `<button onclick="editUser(${data.id})" class="px-2 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200">${t.edit}</button> <button onclick="deleteUser(${data.id})" class="px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-300">${t.delete}</button>` 
                                }
                            ],
                            initComplete: function(settings, json) {
                                console.log("Users table initialized with data:", json);
                            }
                        });
                    } else {
                        console.log("Users tab hidden - permission denied or no data.");
                        document.getElementById('usersTabBtn').style.display = 'none';
                    }
                })
                .catch(error => {
                    console.error('Error fetching users:', error);
                    document.getElementById('usersTabBtn').style.display = 'none';
                });
        }
    } catch (error) {
        console.error("Error in initDataTables:", error);
        alert(lang === 'ar' ? 'فشل في تهيئة الجداول: ' + error.message : 'Failed to initialize tables: ' + error.message);
    }
}

async function deleteAllChatHistory() {
    const lang = window.currentLanguage || 'ar';
    if (confirm(lang === 'ar' ? 'هل أنت متأكد من حذف كل سجل المحادثات؟' : 'Are you sure you want to delete all chat history?')) {
        try {
            const response = await fetch('https://asimabdulkhaleq-unismartagentapi.hf.space/api/admin/chat_history/all', {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${window.authToken}` }
            });
            if (!response.ok) throw new Error('Failed to delete all chat history');
            historyTable.api().ajax.reload();
            loadCharts();
            alert(lang === 'ar' ? 'تم حذف سجل المحادثات بنجاح' : 'Chat history deleted successfully');
        } catch (error) {
            console.error('Error deleting all chat history:', error);
            alert(lang === 'ar' ? 'فشل في حذف سجل المحادثات' : 'Failed to delete all chat history');
        }
    }
}

async function deleteTicket(ticketId) {
    const lang = window.currentLanguage || 'ar';
    if (confirm(lang === 'ar' ? 'هل أنت متأكد من الحذف؟' : 'Are you sure?')) {
        try {
            const response = await fetch(`https://asimabdulkhaleq-unismartagentapi.hf.space/api/admin/tickets/${ticketId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${window.authToken}` }
            });
            if (!response.ok) throw new Error('Failed to delete ticket');
            ticketTable.api().ajax.reload();
            loadCharts();
            alert(lang === 'ar' ? 'تم حذف التذكرة بنجاح' : 'Ticket deleted successfully');
        } catch (error) {
            console.error('Error deleting ticket:', error);
            alert(lang === 'ar' ? 'فشل في حذف التذكرة' : 'Failed to delete ticket');
        }
    }
}

async function editTicket(ticketId) {
    try {
        const response = await fetch('https://asimabdulkhaleq-unismartagentapi.hf.space/api/admin/tickets', {
            headers: { 'Authorization': `Bearer ${window.authToken}` }
        });
        if (!response.ok) throw new Error('Failed to fetch tickets');
        const tickets = await response.json();
        const ticket = tickets.find(t => t.id === ticketId);
        if (ticket) {
            showTicketModal(ticket);
        }
    } catch (error) {
        console.error('Error fetching ticket for edit:', error);
        alert(window.currentLanguage === 'ar' ? 'فشل في جلب التذكرة' : 'Failed to fetch ticket');
    }
}

function showTicketModal(ticket = null) {
    const lang = window.currentLanguage || 'ar';
    const t = {
        'ar': { title: 'تعديل التذكرة', userId: 'معرف المستخدم', name: 'الاسم', email: 'البريد الإلكتروني', description: 'الوصف', status: 'الحالة', save: 'حفظ', cancel: 'إلغاء' },
        'en': { title: 'Edit Ticket', userId: 'User ID', name: 'Name', email: 'Email', description: 'Description', status: 'Status', save: 'Save', cancel: 'Cancel' }
    }[lang];
    
    let modal = document.getElementById('ticketModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'ticketModal';
        modal.className = 'hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center';
        modal.innerHTML = `
            <div class="bg-white rounded-lg p-6 w-full max-w-2xl">
                <h3 class="text-xl font-bold mb-4">${t.title}</h3>
                <input type="hidden" id="ticketId">
                <div class="grid grid-cols-1 gap-4">
                    <div>
                        <label>${t.userId}</label>
                        <input id="ticketUserId" class="w-full p-2 border rounded" disabled>
                    </div>
                    <div>
                        <label>${t.name}</label>
                        <input id="ticketUserName" class="w-full p-2 border rounded">
                    </div>
                    <div>
                        <label>${t.email}</label>
                        <input id="ticketEmail" class="w-full p-2 border rounded">
                    </div>
                    <div>
                        <label>${t.description}</label>
                        <textarea id="ticketDescription" class="w-full p-2 border rounded"></textarea>
                    </div>
                    <div>
                        <label>${t.status}</label>
                        <select id="ticketStatus" class="w-full p-2 border rounded">
                            <option value="open">${lang === 'ar' ? 'مفتوح' : 'Open'}</option>
                            <option value="pending">${lang === 'ar' ? 'معلق' : 'Pending'}</option>
                            <option value="closed">${lang === 'ar' ? 'مغلق' : 'Closed'}</option>
                        </select>
                    </div>
                </div>
                <div class="mt-4 flex justify-end gap-2">
                    <button onclick="saveTicket()" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">${t.save}</button>
                    <button onclick="closeTicketModal()" class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">${t.cancel}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    modal.classList.remove('hidden');
    if (ticket) {
        document.getElementById('ticketId').value = ticket.id;
        document.getElementById('ticketUserId').value = ticket.user_id;
        document.getElementById('ticketUserName').value = ticket.user_name;
        document.getElementById('ticketEmail').value = ticket.email;
        document.getElementById('ticketDescription').value = ticket.issue_description;
        document.getElementById('ticketStatus').value = ticket.status;
    }
}

function closeTicketModal() {
    document.getElementById('ticketModal').classList.add('hidden');
}

async function saveTicket() {
    const lang = window.currentLanguage || 'ar';
    const ticket = {
        ticket_id: parseInt(document.getElementById('ticketId').value),
        user_name: document.getElementById('ticketUserName').value,
        email: document.getElementById('ticketEmail').value,
        issue_description: document.getElementById('ticketDescription').value,
        status: document.getElementById('ticketStatus').value
    };
    try {
        const response = await fetch('https://asimabdulkhaleq-unismartagentapi.hf.space/api/admin/tickets/update', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${window.authToken}` 
            },
            body: JSON.stringify(ticket)
        });
        if (!response.ok) throw new Error(`Failed to save ticket: ${response.status}`);
        ticketTable.api().ajax.reload();
        loadCharts();
        closeTicketModal();
        alert(lang === 'ar' ? 'تم حفظ التذكرة بنجاح' : 'Ticket saved successfully');
    } catch (error) {
        console.error('Error saving ticket:', error);
        alert(lang === 'ar' ? 'فشل في حفظ التذكرة: ' + error.message : 'Failed to save ticket: ' + error.message);
    }
}

async function loadCharts() {
    const lang = window.currentLanguage || 'ar';
    const t = {
        'ar': {
            faqUsage: 'تكرار استخدام الأسئلة الشائعة',
            ticketStatus: 'توزيع حالة التذاكر',
            chatUsage: 'استخدام المحادثة حسب اليوم',
            usageCount: 'عدد الاستخدامات',
            chatsPerDay: 'المحادثات يوميًا'
        },
        'en': {
            faqUsage: 'FAQ Usage Frequency',
            ticketStatus: 'Ticket Status Distribution',
            chatUsage: 'Chat Usage by Day',
            usageCount: 'Usage Count',
            chatsPerDay: 'Chats per Day'
        }
    }[lang];

    try {
        const response = await fetch('https://asimabdulkhaleq-unismartagentapi.hf.space/api/admin/dashboard', {
            headers: { 'Authorization': `Bearer ${window.authToken}` }
        });
        if (!response.ok) throw new Error(`Failed to fetch dashboard data: ${response.status}`);
        const data = await response.json();

        if (faqUsageChart) faqUsageChart.destroy();
        const ctx1 = document.getElementById('faqUsageChart').getContext('2d');
        faqUsageChart = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: data.most_frequent_questions.map(q => q.question.substring(0, 30)),
                datasets: [{
                    label: t.usageCount,
                    data: data.most_frequent_questions.map(q => q.count),
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: lang === 'ar' ? 'العدد' : 'Count' } },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            autoSkip: false,
                            font: { size: 12 }
                        }
                    }
                },
                plugins: { legend: { display: true, position: 'top' } }
            }
        });

        if (ticketStatusChart) ticketStatusChart.destroy();
        const ctx2 = document.getElementById('ticketStatusChart').getContext('2d');
        const totalTickets = data.open_tickets + data.closed_tickets + data.pending_tickets;
        ticketStatusChart = new Chart(ctx2, {
            type: 'pie',
            data: {
                labels: [lang === 'ar' ? 'مفتوح' : 'Open', lang === 'ar' ? 'مغلق' : 'Closed', lang === 'ar' ? 'معلق' : 'Pending'],
                datasets: [{
                    data: [data.open_tickets, data.closed_tickets, data.pending_tickets],
                    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                const percentage = totalTickets > 0 ? ((value / totalTickets) * 100).toFixed(1) : 0;
                                return `${context.label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });

        const usageResponse = await fetch('https://asimabdulkhaleq-unismartagentapi.hf.space/api/admin/chat_usage', { 
            headers: { 'Authorization': `Bearer ${window.authToken}` } 
        });
        if (!usageResponse.ok) throw new Error(`Failed to fetch chat usage data: ${usageResponse.status}`);
        const usageData = await usageResponse.json();

        if (chatUsageChart) chatUsageChart.destroy();
        const ctx3 = document.getElementById('chatUsageChart').getContext('2d');
        chatUsageChart = new Chart(ctx3, {
            type: 'line',
            data: {
                labels: usageData.map(d => d.day),
                datasets: [{
                    label: t.chatsPerDay,
                    data: usageData.map(d => d.count),
                    borderColor: '#4CAF50',
                    fill: false,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: lang === 'ar' ? 'عدد المحادثات' : 'Number of Chats' } },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            autoSkip: false,
                            font: { size: 12 }
                        }
                    }
                },
                plugins: { legend: { display: true, position: 'top' } }
            }
        });
    } catch (error) {
        console.error('Error loading charts:', error);
        alert(lang === 'ar' ? 'فشل في تحميل الرسوم البيانية: ' + error.message : 'Failed to load charts: ' + error.message);
    }
}

async function editFaq(faqId) {
    const lang = window.currentLanguage || 'ar';
    try {
        const response = await fetch('https://asimabdulkhaleq-unismartagentapi.hf.space/api/admin/faqs', {
            headers: { 'Authorization': `Bearer ${window.authToken}` }
        });
        if (!response.ok) throw new Error('Failed to fetch FAQs');
        const faqs = await response.json();
        const faq = faqs.find(f => f.id === faqId);
        if (faq) {
            showFaqModal(faq);
        }
    } catch (error) {
        console.error('Error fetching FAQ for edit:', error);
        alert(lang === 'ar' ? 'فشل في جلب السؤال الشائع' : 'Failed to fetch FAQ');
    }
}

async function deleteFaq(faqId) {
    const lang = window.currentLanguage || 'ar';
    if (confirm(lang === 'ar' ? 'هل أنت متأكد من الحذف؟' : 'Are you sure?')) {
        try {
            const response = await fetch(`https://asimabdulkhaleq-unismartagentapi.hf.space/api/admin/faqs/${faqId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${window.authToken}` }
            });
            if (!response.ok) throw new Error('Failed to delete FAQ');
            faqTable.api().ajax.reload();
            alert(lang === 'ar' ? 'تم حذف السؤال الشائع بنجاح' : 'FAQ deleted successfully');
        } catch (error) {
            console.error('Error deleting FAQ:', error);
            alert(lang === 'ar' ? 'فشل في حذف السؤال الشائع' : 'Failed to delete FAQ');
        }
    }
}

function showFaqModal(faq = null) {
    const lang = window.currentLanguage || 'ar';
    const t = {
        'ar': { title: 'تعديل السؤال الشائع', enQuestion: 'السؤال الإنجليزي', arQuestion: 'السؤال العربي', enAnswer: 'الإجابة الإنجليزية', arAnswer: 'الإجابة العربية', save: 'حفظ', cancel: 'إلغاء' },
        'en': { title: 'Edit FAQ', enQuestion: 'English Question', arQuestion: 'Arabic Question', enAnswer: 'English Answer', arAnswer: 'Arabic Answer', save: 'Save', cancel: 'Cancel' }
    }[lang];
    
    const modal = document.getElementById('faqModal');
    modal.classList.remove('hidden');
    modal.querySelector('h3').textContent = t.title;
    modal.querySelectorAll('label')[0].textContent = t.enQuestion;
    modal.querySelectorAll('label')[1].textContent = t.arQuestion;
    modal.querySelectorAll('label')[2].textContent = t.enAnswer;
    modal.querySelectorAll('label')[3].textContent = t.arAnswer;
    modal.querySelector('button[onclick="saveFAQ()"]').textContent = t.save;
    modal.querySelector('button[onclick="closeFaqModal()"]').textContent = t.cancel;
    
    if (faq) {
        document.getElementById('faqId').value = faq.id;
        document.getElementById('faqQuestionEn').value = faq.question_en;
        document.getElementById('faqAnswerEn').value = faq.answer_en;
        document.getElementById('faqQuestionAr').value = faq.question_ar;
        document.getElementById('faqAnswerAr').value = faq.answer_ar;
    } else {
        document.getElementById('faqId').value = '';
        document.getElementById('faqQuestionEn').value = '';
        document.getElementById('faqAnswerEn').value = '';
        document.getElementById('faqQuestionAr').value = '';
        document.getElementById('faqAnswerAr').value = '';
    }
}

function closeFaqModal() {
    document.getElementById('faqModal').classList.add('hidden');
}

async function saveFAQ() {
    const lang = window.currentLanguage || 'ar';
    const faq = {
        id: document.getElementById('faqId').value || null,
        question_en: document.getElementById('faqQuestionEn').value,
        answer_en: document.getElementById('faqAnswerEn').value,
        question_ar: document.getElementById('faqQuestionAr').value,
        answer_ar: document.getElementById('faqAnswerAr').value
    };
    try {
        const response = await fetch('https://asimabdulkhaleq-unismartagentapi.hf.space/api/admin/faqs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.authToken}` },
            body: JSON.stringify(faq)
        });
        if (!response.ok) throw new Error('Failed to save FAQ');
        faqTable.api().ajax.reload();
        closeFaqModal();
        alert(lang === 'ar' ? 'تم حفظ السؤال الشائع بنجاح' : 'FAQ saved successfully');
    } catch (error) {
        console.error('Error saving FAQ:', error);
        alert(lang === 'ar' ? 'فشل في حفظ السؤال الشائع' : 'Failed to save FAQ');
    }
}

async function updateTicketStatus(ticketId, status) {
    const lang = window.currentLanguage || 'ar';
    try {
        await fetch('https://asimabdulkhaleq-unismartagentapi.hf.space/api/admin/tickets/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.authToken}` },
            body: JSON.stringify({ ticket_id: ticketId, status })
        });
        ticketTable.api().ajax.reload();
        loadCharts();
    } catch (error) {
        console.error('Error updating ticket status:', error);
        alert(lang === 'ar' ? 'فشل في تحديث حالة التذكرة' : 'Failed to update ticket status');
    }
}

async function editUser(userId) {
    const lang = window.currentLanguage || 'ar';
    try {
        const response = await fetch('https://asimabdulkhaleq-unismartagentapi.hf.space/api/admin/users', { 
            headers: { 'Authorization': `Bearer ${window.authToken}` } 
        });
        if (!response.ok) throw new Error('Failed to fetch users');
        const users = await response.json();
        const user = users.find(u => u.id === userId);
        if (user) {
            showUserModal(user);
        }
    } catch (error) {
        console.error('Error fetching user for edit:', error);
        alert(lang === 'ar' ? 'فشل في جلب المستخدم' : 'Failed to fetch user');
    }
}

function showUserModal(user = null) {
    const lang = window.currentLanguage || 'ar';
    const t = {
        'ar': { title: 'تعديل المستخدم', username: 'اسم المستخدم', editUser: 'إذن تعديل المستخدم', save: 'حفظ', cancel: 'إلغاء' },
        'en': { title: 'Edit User', username: 'Username', editUser: 'Edit User Permission', save: 'Save', cancel: 'Cancel' }
    }[lang];
    
    let modal = document.getElementById('userModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'userModal';
        modal.className = 'hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center';
        modal.innerHTML = `
            <div class="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 class="text-xl font-bold mb-4">${t.title}</h3>
                <input type="hidden" id="userId">
                <div class="grid grid-cols-1 gap-4">
                    <div>
                        <label>${t.username}</label>
                        <input id="userUsername" class="w-full p-2 border rounded">
                    </div>
                    <div>
                        <label>${t.editUser}</label>
                        <select id="userEditUser" class="w-full p-2 border rounded">
                            <option value="0">${lang === 'ar' ? 'لا' : 'No'}</option>
                            <option value="1">${lang === 'ar' ? 'نعم' : 'Yes'}</option>
                        </select>
                    </div>
                </div>
                <div class="mt-4 flex justify-end gap-2">
                    <button onclick="saveUser()" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">${t.save}</button>
                    <button onclick="closeUserModal()" class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">${t.cancel}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    modal.classList.remove('hidden');
    if (user) {
        document.getElementById('userId').value = user.id;
        document.getElementById('userUsername').value = user.username;
        document.getElementById('userEditUser').value = user.editUser ? '1' : '0';
    }
}

function closeUserModal() {
    document.getElementById('userModal').classList.add('hidden');
}

async function saveUser() {
    const lang = window.currentLanguage || 'ar';
    const user = {
        id: parseInt(document.getElementById('userId').value),
        username: document.getElementById('userUsername').value,
        editUser: document.getElementById('userEditUser').value === '1'
    };
    try {
        const response = await fetch('https://asimabdulkhaleq-unismartagentapi.hf.space/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.authToken}` },
            body: JSON.stringify(user)
        });
        if (!response.ok) throw new Error('Failed to save user');
        usersTable.api().ajax.reload();
        closeUserModal();
        alert(lang === 'ar' ? 'تم حفظ المستخدم بنجاح' : 'User saved successfully');
    } catch (error) {
        console.error('Error saving user:', error);
        alert(lang === 'ar' ? 'فشل في حفظ المستخدم' : 'Failed to save user');
    }
}

async function deleteUser(userId) {
    const lang = window.currentLanguage || 'ar';
    if (confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذا المستخدم؟' : 'Are you sure you want to delete this user?')) {
        try {
            const response = await fetch(`https://asimabdulkhaleq-unismartagentapi.hf.space/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${window.authToken}` }
            });
            if (!response.ok) throw new Error('Failed to delete user');
            usersTable.api().ajax.reload();
            alert(lang === 'ar' ? 'تم حذف المستخدم بنجاح' : 'User deleted successfully');
        } catch (error) {
            console.error('Error deleting user:', error);
            alert(lang === 'ar' ? 'فشل في حذف المستخدم' : 'Failed to delete user');
        }
    }
}

function setupResetPassword() {
    const lang = window.currentLanguage || 'ar';
    const resetButton = document.getElementById('resetPasswordButton');
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            document.getElementById('resetPasswordModal').classList.remove('hidden');
            document.getElementById('resetUsername').value = window.currentAdmin;
        });
    }
}

function closeResetPasswordModal() {
    document.getElementById('resetPasswordModal').classList.add('hidden');
}

async function handlePasswordReset(event) {
    const lang = window.currentLanguage || 'ar';
    event.preventDefault();
    const username = document.getElementById('resetUsername').value;
    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    try {
        const response = await fetch('https://asimabdulkhaleq-unismartagentapi.hf.space/api/reset_password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.authToken}` },
            body: JSON.stringify({ username, old_password: oldPassword, new_password: newPassword })
        });
        if (!response.ok) throw new Error('Failed to reset password');
        const data = await response.json();
        alert(data.message === 'Password reset successfully' && lang === 'ar' ? 'تم إعادة تعيين كلمة المرور بنجاح' : data.message);
        closeResetPasswordModal();
    } catch (error) {
        console.error('Reset Password Error:', error);
        alert(lang === 'ar' ? 'فشل في إعادة تعيين كلمة المرور: ' + error.message : 'Failed to reset password: ' + error.message);
    }
}

function setupAddUser() {
    const lang = window.currentLanguage || 'ar';
    const addUserButton = document.getElementById('addUserButton');
    if (addUserButton) {
        addUserButton.addEventListener('click', () => {
            document.getElementById('addUserModal').classList.remove('hidden');
        });
    }
}

function closeAddUserModal() {
    document.getElementById('addUserModal').classList.add('hidden');
}

async function handleAddUser(event) {
    const lang = window.currentLanguage || 'ar';
    event.preventDefault();
    const username = document.getElementById('newUsername').value;
    const password = document.getElementById('newUserPassword').value;
    const editUser = document.getElementById('newUserEditUser').value === '1';
    try {
        const response = await fetch('https://asimabdulkhaleq-unismartagentapi.hf.space/api/admin/users/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.authToken}` },
            body: JSON.stringify({ username, password, editUser })
        });
        if (!response.ok) throw new Error('Failed to add user');
        const data = await response.json();
        alert(data.message === 'User added successfully' && lang === 'ar' ? 'تم إضافة المستخدم بنجاح' : data.message);
        usersTable.api().ajax.reload();
        closeAddUserModal();
    } catch (error) {
        console.error('Add User Error:', error);
        alert(lang === 'ar' ? 'فشل في إضافة المستخدم: ' + error.message : 'Failed to add user: ' + error.message);
    }
}

function setupBackupDb() {
    const lang = window.currentLanguage || 'ar';
    const backupButton = document.getElementById('backupDbButton');
    if (backupButton) {
        backupButton.addEventListener('click', async () => {
            try {
                const response = await fetch('https://asimabdulkhaleq-unismartagentapi.hf.space/api/admin/backup_db', {
                    headers: { 'Authorization': `Bearer ${window.authToken}` }
                });
                if (!response.ok) throw new Error('Backup failed');
                const data = await response.json();
                alert(lang === 'ar' && data.message.includes('Database backed up') ? 'تم إجراء نسخ احتياطي لقاعدة البيانات إلى ' + data.message.split('to ')[1] : data.message);
            } catch (error) {
                console.error('Backup Error:', error);
                alert(lang === 'ar' ? 'فشل في النسخ الاحتياطي لقاعدة البيانات' : 'Failed to backup database');
            }
        });
    }
}

async function exportTable(tableName) {
    const lang = window.currentLanguage || 'ar';
    try {
        const response = await fetch(`https://asimabdulkhaleq-unismartagentapi.hf.space/api/admin/export/${tableName}`, {
            headers: { 'Authorization': `Bearer ${window.authToken}` }
        });
        if (!response.ok) throw new Error('Export failed');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tableName}_export.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        alert(lang === 'ar' ? `تم تصدير ${tableName} بنجاح` : `${tableName} exported successfully`);
    } catch (error) {
        console.error('Export Error:', error);
        alert(lang === 'ar' ? 'فشل في تصدير الجدول' : 'Failed to export table');
    }
}

function connectAdminWebSocket1(adminId) {
    if (adminWs && adminWs.readyState === WebSocket.OPEN) adminWs.close();
    adminWs = new WebSocket(`wss://asimabdulkhaleq-unismartagentapi.hf.space/ws/admin_${adminId}`);
    adminWs.onopen = () => console.log(`Admin WebSocket connected for: ${adminId}`);
    adminWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "agent_request") {
                console.log("Agent request received, showing popup...");
                showAgentPopup(data.room_id, data.session_id);
            } else if (data.room_id === currentRoomId) {
                const chatMessages = document.getElementById('agentChatMessages');
                if (chatMessages) {
                    const senderLabel = data.sender === "admin" 
                        ? (window.currentLanguage === "ar" ? "الموظف" : "Agent") 
                        : (window.currentLanguage === "ar" ? "المستخدم" : "User");
                    const timestamp = data.timestamp || new Date().toISOString().replace("T", " ").substr(0, 19);
                    const messageClass = data.sender === "admin" ? "agent-message" : "user-message";
                    chatMessages.innerHTML += `
                        <div class="${messageClass}">
                            <div class="message-content">${data.message}</div>
                            <div class="message-timestamp">${timestamp}</div>
                        </div>`;
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
           }
    };
    adminWs.onclose = function(event) {
        console.log(`Admin WebSocket closed for admin_${adminId}: code=${event.code}, reason=${event.reason}`);
        currentRoomId = null;
        const agentTab = document.getElementById('agentTab');
        if (agentTab) {
            agentTab.innerHTML = `
                <h3 class="text-xl font-semibold mb-4 px-4">Agent Chat</h3>
                <p class="px-4">تم قطع الاتصال | Connection closed (Code: ${event.code})</p>
            `;
        }
    };
    adminWs.onerror = function(error) {
        console.error("Admin WebSocket error:", error);
    };
}

function connectAdminWebSocket(adminId) {
    if (adminWs && adminWs.readyState === WebSocket.OPEN) {
        console.log(`Admin WebSocket already open for ${adminId}, closing and reconnecting`);
        adminWs.close();
    }
    adminWs = new WebSocket(`wss://asimabdulkhaleq-unismartagentapi.hf.space/ws/admin_${adminId}`);
    adminWs.onopen = function() {
        console.log(`Admin WebSocket connection established for admin_${adminId}`);
        setInterval(() => {
            if (adminWs.readyState === WebSocket.OPEN) {
                adminWs.send(JSON.stringify({ type: "ping" }));
                console.log("Sent ping to server");
            }
        }, 30000);
    };
    adminWs.onmessage = function(event) {
      console.log("Admin WebSocket received raw data:", event.data);
      try {
          const data = JSON.parse(event.data);
          console.log("Parsed WebSocket data:", data);
          if (data.type === "agent_request") {
              showAgentPopup(data.room_id, data.session_id);
          } else if (data.room_id === currentRoomId) {
              // Handle chat messages
              const chatMessages = document.getElementById('agentChatMessages');
              if (chatMessages) {
                  const senderLabel = data.sender === "admin" 
                      ? (window.currentLanguage === "ar" ? "الموظف" : "Agent") 
                      : (window.currentLanguage === "ar" ? "المستخدم" : "User");
                  const timestamp = data.timestamp || new Date().toISOString().replace("T", " ").substr(0, 19);
                  const messageClass = data.sender === "admin" ? "agent-message" : "user-message";
                  chatMessages.innerHTML += `
                      <div class="${messageClass}">
                          <div class="message-content">${data.message}</div>
                          <div class="message-timestamp">${timestamp}</div>
                      </div>`;
                  chatMessages.scrollTop = chatMessages.scrollHeight;
              }
          }
      } catch (e) {
          console.error("Error parsing WebSocket message:", e, "Raw data:", event.data);
          // Optionally ignore or log non-JSON messages
      }
  };
    adminWs.onclose = function(event) {
        console.log(`Admin WebSocket closed for admin_${adminId}: code=${event.code}, reason=${event.reason}`);
        currentRoomId = null;
        const agentTab = document.getElementById('agentTab');
        if (agentTab) {
            agentTab.innerHTML = `
                <h3 class="text-xl font-semibold mb-4 px-4">Agent Chat</h3>
                <p class="px-4">تم قطع الاتصال | Connection closed (Code: ${event.code})</p>
            `;
        }
    };
    adminWs.onerror = function(error) {
        console.error("Admin WebSocket error:", error);
    };
}

function showAgentPopup(roomId, sessionId) {
    console.log(`Showing agent popup for room ${roomId}, session ${sessionId}`);
    const dashboard = document.getElementById('dashboard');
    if (document.getElementById('agentPopup')) {
        console.log("Popup already exists, updating...");
        return;
    }
    const popup = document.createElement('div');
    popup.id = 'agentPopup';
    popup.className = 'fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 w-96 z-50';
    popup.innerHTML = `
        <h3 class="text-lg font-bold mb-2">${window.currentLanguage === 'ar' ? 'طلب تواصل من المستخدم' : 'User Connection Request'}</h3>
        <p>${window.currentLanguage === 'ar' ? 'جلسة:' : 'Session:'} ${sessionId}</p>
        <div class="flex gap-2 mt-4">
            <button onclick="acceptAgentRequest('${roomId}', '${sessionId}', '${window.currentAdmin}')" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">${window.currentLanguage === 'ar' ? 'قبول' : 'Accept'}</button>
            <button onclick="closeAgentPopup()" class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">${window.currentLanguage === 'ar' ? 'إغلاق' : 'Close'}</button>
        </div>
    `;
    dashboard.appendChild(popup);
    console.log("Agent popup appended to dashboard");
}

function closeAgentPopup() {
    const popup = document.getElementById('agentPopup');
    if (popup) {
        popup.remove();
        console.log("Agent popup closed");
    }
}

function acceptAgentRequest(roomId, sessionId, adminName) {
    console.log("Accepting agent request for room:", roomId, "session:", sessionId, "by:", adminName);
    const lang = window.currentLanguage || 'ar';
    const introMessage = lang === 'ar' 
        ? "مرحبا، مساعدك متصل. كيف يمكنني مساعدتك؟"
        : "Hello, your assistant is connected. How can I help you?";
    adminWs.send(JSON.stringify({ 
        type: "accept", 
        room_id: roomId, 
        message: introMessage,
        language: lang
    }));
    closeAgentPopup();
    startAgentChat(roomId, sessionId, adminName);
}

function startAgentChat(roomId, sessionId, adminName) {
    console.log("Starting agent chat for room:", roomId, "session:", sessionId, "admin:", adminName);
    currentRoomId = roomId;
    const lang = window.currentLanguage || 'ar';
    const agentTab = document.getElementById('agentTab');
    agentTab.classList.remove('hidden');
    agentTab.innerHTML = `
       <style>
            #agentChatContainer {
                display: flex;
                flex-direction: column;
                height: 500px; /* Fixed height to ensure input visibility */
                background-color: #ffffff; /* White background */
            }
            #agentChatMessages {
                flex: 1;
                overflow-y: auto;
                padding: 10px;
            }
            .agent-message {
                display: flex;
                justify-content: flex-start;
                margin-bottom: 10px;
            }
            .agent-message .message-content {
                background-color: #fefcbf; /* Light yellow */
                color: #111b21;
                padding: 10px 15px;
                border-radius: 8px;
                max-width: 70%;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                word-wrap: break-word;
                display: flex;
                align-items: center;
            }
            .agent-message .message-timestamp {
                font-size: 0.7rem;
                color: #667781;
                margin-top: 4px;
                text-align: left;
            }
            .user-message {
                display: flex;
                justify-content: flex-end;
                margin-bottom: 10px;
            }
            .user-message .message-content {
                background-color: #e7f3ff; /* Light blue */
                color: #111b21;
                padding: 10px 15px;
                border-radius: 8px;
                max-width: 70%;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                word-wrap: break-word;
                display: flex;
                align-items: center;
            }
            .user-message .message-timestamp {
                font-size: 0.7rem;
                color: #667781;
                margin-top: 4px;
                text-align: right;
            }
            #chatInputArea {
                display: flex;
                align-items: center;
                padding: 10px;
                background-color: #fff;
                border-top: 1px solid #e5e7eb;
                position: sticky;
                bottom: 0;
            }
            #agentChatInput {
                flex: 1;
                border: 1px solid #d1d5db;
                border-radius: 20px;
                padding: 8px 15px;
                margin-right: 10px;
                outline: none;
            }
            #agentChatInput:focus {
                border-color: #3b82f6;
            }
            #sendButton {
                background-color: #3b82f6;
                color: white;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            #sendButton:hover {
                background-color: #2563eb;
            }
        </style>
        <div id="agentChatContainer">
            <h3 class="text-xl font-semibold mb-4 px-4">${lang === 'ar' ? 'محادثة مع المستخدم' : 'Chat with User'} (${sessionId})</h3>
            <div id="agentChatMessages"></div>
            <div id="chatInputArea">
                <textarea id="agentChatInput" rows="1" placeholder="${lang === 'ar' ? 'اكتب رسالتك...' : 'Type your message...'}"></textarea>
                <button id="sendButton" onclick="sendAgentMessage('${roomId}')"><i class="fas fa-paper-plane"></i></button>
                <select id="chatStatus" class="p-2 border rounded ml-2">
                    <option value="open">${lang === 'ar' ? 'مفتوح' : 'Open'}</option>
                    <option value="pending">${lang === 'ar' ? 'معلق' : 'Pending'}</option>
                    <option value="closed">${lang === 'ar' ? 'مغلق' : 'Closed'}</option>
                </select>
                <button onclick="endAgentChat('${roomId}')" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 ml-2">${lang === 'ar' ? 'إنهاء' : 'End'}</button>
            </div>
        </div>
    `;
    showTab('agent');
    if (adminWs.readyState !== WebSocket.OPEN) {
        console.error("WebSocket closed unexpectedly, reconnecting...");
        connectAdminWebSocket(adminName);
    }
}

function sendAgentMessage(roomId) {
    const message = document.getElementById('agentChatInput').value.trim();
    if (message) {
        console.log("Sending agent message to room:", roomId, "message:", message);
        adminWs.send(JSON.stringify({ 
            room_id: roomId, 
            message: message, 
            language: window.currentLanguage 
        }));
        document.getElementById('agentChatInput').value = '';
    } else {
        console.warn("No message to send");
    }
}

function endAgentChat(roomId) {
    console.log("Ending chat for room:", roomId);
    const status = document.getElementById('chatStatus').value;
    adminWs.send(JSON.stringify({ 
        type: "end_chat", 
        room_id: roomId, 
        status: status 
    }));
    currentRoomId = null;
    const agentTab = document.getElementById('agentTab');
    if (agentTab) {
        agentTab.innerHTML = `
            <h3 class="text-xl font-semibold mb-4 px-4">Agent Chat</h3>
            <p class="px-4">في انتظار طلبات المستخدمين... | Waiting for user requests...</p>
        `;
        console.log("Agent chat ended, tab reset");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("dashboard.js loaded");
    if (window.currentAdmin && window.authToken) {
        connectAdminWebSocket(window.currentAdmin);
        initDataTables();
        loadCharts();
    } else {
        console.warn("No auth token found; DataTables and charts not initialized");
    }
    document.querySelectorAll('.tab-link').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('onclick').match(/'([^']+)'/)[1];
            console.log(`Tab switched to: ${tabName}`);
            showTab(tabName);
        });
    });
    
    const agentTab = document.getElementById('agentTab');
    if (!agentTab) {
        console.error("Agent tab not found in initial DOM setup");
    } else {
        agentTab.innerHTML = `
            <h3 class="text-xl font-semibold mb-4 px-4">Agent Chat</h3>
            <p class="px-4">في انتظار طلبات المستخدمين... | Waiting for user requests...</p>
        `;
        console.log("Agent tab initialized");
    }

    const addFaqButton = document.getElementById('addFaqButton');
    if (addFaqButton) {
        addFaqButton.addEventListener('click', () => {
            console.log("Add FAQ button clicked");
            showFaqModal();
        });
    }

    setupAddUser();
    setupResetPassword();
    setupBackupDb();

    const deleteAllHistoryButton = document.getElementById('deleteAllHistoryButton');
    if (deleteAllHistoryButton) {
        deleteAllHistoryButton.addEventListener('click', () => {
            console.log("Delete All Chat History button clicked");
            deleteAllChatHistory();
        });
    }

    document.querySelectorAll('button[onclick^="exportTable"]').forEach(btn => {
        const tableName = btn.getAttribute('onclick').match(/'([^']+)'/)[1];
        btn.addEventListener('click', () => {
            console.log(`Export table button clicked for ${tableName}`);
            exportTable(tableName);
        });
    });

    updateDashboardLanguage();
    console.log("DOMContentLoaded handler completed");
});