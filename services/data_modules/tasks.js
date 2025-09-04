// services/data_modules/tasks.js
const supabase = require('../../config/database');
const { calculateTasksSummary } = require('../../utils/summaryCalculators');
const { enhanceWithFarmName } = require('../../utils/farmUtils');

// 1. Define the module's identity
const name = 'Task Assignment Report';
const keywords = ['tasks', 'assignments', 'todo', 'overdue', 'pending', 'completed', 'due', 'work', 'assigned'];
const dataType = 'tasks';

// 2. The 'parse' function: Extracts query parameters from the user's message.
function parse(userMessage) {
    console.log(`📋 Tasks module parsing: "${userMessage}"`);
    
    // Convert to lowercase for case-insensitive matching
    const lowerMessage = userMessage.toLowerCase();
    
    const query = {
        searchTerms: [],
        statusFilter: null,
        assignmentFilter: null,
        timeFilter: null,
        priorityFilter: null,
        towerFilter: null
    };

    // Status filtering
    if (/pending|waiting|todo|to.*do/i.test(lowerMessage)) {
        query.statusFilter = 'pending';
        if (!query.searchTerms.includes('pending')) query.searchTerms.push('pending');
        console.log(`⏳ Found status filter: pending`);
    }
    if (/completed|done|finished/i.test(lowerMessage)) {
        query.statusFilter = 'completed';
        if (!query.searchTerms.includes('completed')) query.searchTerms.push('completed');
        console.log(`✅ Found status filter: completed`);
    }
    if (/overdue|late|past.*due/i.test(lowerMessage)) {
        query.statusFilter = 'overdue';
        if (!query.searchTerms.includes('overdue')) query.searchTerms.push('overdue');
        console.log(`🚨 Found status filter: overdue`);
    }

    // Assignment filtering
    if (/assigned.*to.*me|my.*tasks|mine/i.test(lowerMessage)) {
        query.assignmentFilter = 'assigned_to_me';
        if (!query.searchTerms.includes('my tasks')) query.searchTerms.push('my tasks');
        console.log(`👤 Found assignment filter: assigned to me`);
    }
    if (/unassigned|no.*one.*assigned|not.*assigned/i.test(lowerMessage)) {
        query.assignmentFilter = 'unassigned';
        if (!query.searchTerms.includes('unassigned')) query.searchTerms.push('unassigned');
        console.log(`❓ Found assignment filter: unassigned`);
    }

    // Time-based filtering
    if (/today|due.*today/i.test(lowerMessage)) {
        query.timeFilter = 'today';
        if (!query.searchTerms.includes('due today')) query.searchTerms.push('due today');
        console.log(`📅 Found time filter: today`);
    }
    if (/this.*week|week/i.test(lowerMessage)) {
        query.timeFilter = 'this_week';
        if (!query.searchTerms.includes('this week')) query.searchTerms.push('this week');
        console.log(`📅 Found time filter: this week`);
    }
    if (/urgent|priority|high.*priority/i.test(lowerMessage)) {
        query.priorityFilter = 'urgent';
        if (!query.searchTerms.includes('urgent')) query.searchTerms.push('urgent');
        console.log(`🚨 Found priority filter: urgent`);
    }

    // Tower-specific tasks
    if (/tower/i.test(lowerMessage)) {
        query.towerFilter = true;
        if (!query.searchTerms.includes('tower tasks')) query.searchTerms.push('tower tasks');
        console.log(`🏗️ Found tower filter`);
    }

    // Recurring tasks
    if (/recurring|repeat|regular/i.test(lowerMessage)) {
        query.recurringFilter = true;
        if (!query.searchTerms.includes('recurring')) query.searchTerms.push('recurring');
        console.log(`🔄 Found recurring filter`);
    }

    console.log(`📋 Final parsed query:`, JSON.stringify(query, null, 2));
    return query;
}

// 3. The 'query' function: Fetches data from Supabase based on parsed parameters.
async function query(farmId, queryParams) {
    console.log(`📋 Tasks module querying farmId: ${farmId}`);
    console.log(`📋 Query params:`, JSON.stringify(queryParams, null, 2));
    
    try {
        let supabaseQuery = supabase
            .from('task_assignment_view')
            .select('*')
            .eq('farm_id', farmId)
            .limit(100); // Reasonable limit for task lists

        console.log(`🏢 Base query: SELECT * FROM task_assignment_view WHERE farm_id = ${farmId}`);

        // Apply filters based on parsed query
        if (queryParams.statusFilter) {
            if (queryParams.statusFilter === 'overdue') {
                // Overdue: past due date and not completed
                const now = new Date().toISOString();
                supabaseQuery = supabaseQuery
                    .lt('due_date', now)
                    .neq('status', 'completed');
                console.log(`🚨 Filtering for overdue tasks`);
            } else {
                supabaseQuery = supabaseQuery.eq('status', queryParams.statusFilter);
                console.log(`📊 Filtering by status: ${queryParams.statusFilter}`);
            }
        }

        if (queryParams.timeFilter) {
            const now = new Date();
            let startDate, endDate;
            
            if (queryParams.timeFilter === 'today') {
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
            } else if (queryParams.timeFilter === 'this_week') {
                const dayOfWeek = now.getDay();
                startDate = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
                endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
            }
            
            if (startDate && endDate) {
                supabaseQuery = supabaseQuery
                    .gte('due_date', startDate.toISOString())
                    .lt('due_date', endDate.toISOString());
                console.log(`📅 Filtering for ${queryParams.timeFilter}: ${startDate.toDateString()} to ${endDate.toDateString()}`);
            }
        }

        if (queryParams.assignmentFilter === 'unassigned') {
            supabaseQuery = supabaseQuery.is('assigned_to', null);
            console.log(`❓ Filtering for unassigned tasks`);
        }

        if (queryParams.towerFilter) {
            supabaseQuery = supabaseQuery.not('tower_id', 'is', null);
            console.log(`🏗️ Filtering for tower-related tasks`);
        }

        if (queryParams.recurringFilter) {
            supabaseQuery = supabaseQuery.eq('is_recurring', true);
            console.log(`🔄 Filtering for recurring tasks`);
        }

        // The view already has built-in ordering (overdue first, then pending, then completed)
        // But we can add secondary ordering if needed
        if (!queryParams.statusFilter) {
            supabaseQuery = supabaseQuery.order('due_date', { ascending: true });
        }
        
        const result = await supabaseQuery;
        
        console.log(`📊 Query executed. Found ${result.data ? result.data.length : 0} task records`);
        if (result.error) {
            console.error(`❌ Supabase error:`, result.error);
        }
        
        // Enhance data with farm name
        if (result.data && result.data.length > 0) {
            result.data = await enhanceWithFarmName(result.data, farmId);
        }
        
        return result;
    } catch (error) {
        console.error('❌ Tasks data module query error:', error);
        return { data: null, error: error };
    }
}

// 4. The 'generateResponse' function: Creates the final HTML and metadata object.
function generateResponse(data, queryParams) {
    console.log(`📝 Generating response for ${data.length} task records`);
    
    const htmlContent = generateTasksReportHTML(data, queryParams);
    const summary = calculateTasksSummary(data);

    const metadata = {
        title: `Task Assignment Report - ${data[0]?.farm_name || 'Unknown Farm'}`,
        description: `${data.length} tasks found${queryParams.searchTerms.length ? ` matching: ${queryParams.searchTerms.join(', ')}` : ''}`,
        recordCount: data.length,
        farmName: data[0]?.farm_name,
        summary: summary,
        searchQuery: queryParams,
        dataType: dataType,
    };
    
    console.log(`📝 Response metadata:`, JSON.stringify(metadata, null, 2));
    return { htmlContent, metadata };
}

// Helper function: Generates the specific HTML report for this module.
function generateTasksReportHTML(taskData, query = {}) {
    try {
        if (!taskData || taskData.length === 0) {
            return '<p>No tasks found for the specified criteria.</p>';
        }

        const farmName = taskData[0].farm_name || 'Unknown Farm';
        const currentDate = new Date().toLocaleString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true
        });

        let reportTitle = 'Task Assignment Report';
        if (query.searchTerms && query.searchTerms.length > 0) {
            reportTitle = `Tasks: ${query.searchTerms.join(', ')}`;
        }

        let tableRows = '';
        taskData.forEach(task => {
            const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString('en-US') : '-';
            const assignedDate = task.assigned_at ? new Date(task.assigned_at).toLocaleDateString('en-US') : '-';
            const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
            
            // Use the color coding from the view
            const textColor = task.color_code || '#333';
            const bgColor = task.bg_color_code || '#fff';
            
            let statusIcon = '';
            switch (task.status?.toLowerCase()) {
                case 'pending': statusIcon = '⏳'; break;
                case 'completed': statusIcon = '✅'; break;
                case 'in_progress': statusIcon = '🔄'; break;
                default: statusIcon = '📋';
            }
            
            let priorityIndicator = '';
            if (isOverdue) priorityIndicator = '🚨 ';
            else if (task.due_date && new Date(task.due_date) <= new Date(Date.now() + 24*60*60*1000)) {
                priorityIndicator = '⚠️ ';
            }
            
            tableRows += `
            <tr style="background-color: ${bgColor}; color: ${textColor};">
                <td>${statusIcon} ${task.task_type || 'Task'}</td>
                <td>${task.assigned_to_name || 'Unassigned'}</td>
                <td>${task.assigned_role_name || '-'}</td>
                <td>${priorityIndicator}${dueDate}</td>
                <td style="font-weight: ${task.status === 'completed' ? 'normal' : 'bold'};">${task.status || 'Unknown'}</td>
                <td>${task.tower_identifier || '-'}</td>
                <td>${task.is_recurring ? '🔄' : ''}</td>
                <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${task.notes || '-'}</td>
            </tr>`;
        });

        const summary = calculateTasksSummary(taskData);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${reportTitle} - ${farmName}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; color: #333; line-height: 1.4; background: #f8f9fa; }
        .container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        
        /* Header with print button */
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        h1 { font-size: 18px; margin: 0; color: #4F46E5; border-bottom: 2px solid #4F46E5; padding-bottom: 5px; }
        .print-button { background: #4F46E5; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold; }
        .print-button:hover { background: #4338CA; }
        .print-button:active { background: #3730A3; }
        
        .report-info { margin-bottom: 20px; font-size: 11px; color: #666; background: #f8f9fa; padding: 12px; border-radius: 6px; border-left: 4px solid #4F46E5; }
        .report-info div { margin-bottom: 4px; }
        .search-info { background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 6px; padding: 10px; margin-bottom: 15px; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f8f9fa; font-weight: bold; color: #4F46E5; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        tr:hover { background-color: #f0f4ff; }
        .summary { margin-bottom: 15px; padding: 10px; background: #eef2ff; border-radius: 6px; font-size: 11px; border-left: 4px solid #4F46E5; }
        .footer { margin-top: 20px; font-size: 10px; color: #666; text-align: center; border-top: 1px solid #ddd; padding-top: 10px; }
        
        /* Print styles */
        @media print {
            body { background: white; margin: 0; }
            .container { box-shadow: none; border-radius: 0; padding: 10px; }
            .print-button { display: none !important; }
            .header { display: block; }
            h1 { font-size: 16px; margin-bottom: 10px; border-bottom: 1px solid #333; }
            .report-info { background: #f5f5f5 !important; border: 1px solid #ddd; }
            .search-info { background: #f5f5f5 !important; border: 1px solid #ddd; }
            .summary { background: #f5f5f5 !important; border: 1px solid #ddd; }
            th { background: #f0f0f0 !important; color: #333 !important; }
            table { font-size: 10px; }
            th, td { padding: 6px; }
        }
        
        @media screen and (max-width: 768px) {
            .header { flex-direction: column; align-items: stretch; }
            .print-button { margin-top: 10px; }
            table { font-size: 10px; }
            th, td { padding: 4px; }
        }
    </style>
    <script>
        function printReport() {
            window.print();
        }
    </script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${reportTitle}</h1>
            <button class="print-button" onclick="printReport()">🖨️ Print Report</button>
        </div>
        <div class="report-info">
            <div><strong>Farm:</strong> ${farmName}</div>
            <div><strong>Generated:</strong> ${currentDate}</div>
            <div><strong>Total Tasks:</strong> ${taskData.length}</div>
            <div><strong>Source:</strong> Sproutify AI</div>
        </div>
        ${query.searchTerms && query.searchTerms.length > 0 ? `
        <div class="search-info">
            <strong>🎯 Search Results:</strong> Found ${taskData.length} tasks matching: ${query.searchTerms.join(', ')}
        </div>` : ''}
        <div class="summary">
            <strong>📊 Quick Summary:</strong> 
            ⏳ ${summary.pending || 0} Pending • 
            ✅ ${summary.completed || 0} Completed • 
            🚨 ${summary.overdue || 0} Overdue • 
            👥 ${summary.assigned || 0} Assigned
        </div>
        <table>
            <thead>
                <tr>
                    <th>Task Type</th><th>Assigned To</th><th>Role</th><th>Due Date</th>
                    <th>Status</th><th>Tower</th><th>Recurring</th><th>Notes</th>
                </tr>
            </thead>
            <tbody>${tableRows}</tbody>
        </table>
        <div class="footer">
            <em>Generated by <strong>Sproutify AI</strong> • ${currentDate}</em>
            <div style="margin-top: 4px; font-size: 9px;">Your intelligent farm management assistant</div>
        </div>
    </div>
</body>
</html>`;
    } catch (error) {
        console.error('Error generating tasks HTML:', error);
        return `<h1>Error</h1><p>There was an error generating the task assignment report: ${error.message}</p>`;
    }
}

// 5. Export the standard module interface
module.exports = {
    name,
    keywords,
    dataType,
    parse,
    query,
    generateResponse,
};