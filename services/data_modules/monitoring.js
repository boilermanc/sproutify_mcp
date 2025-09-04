// services/data_modules/monitoring.js
const supabase = require('../../config/database');
const { calculateMonitoringSummary } = require('../../utils/summaryCalculators');

const name = 'Nutrient Monitoring Data';
const keywords = ['monitoring', 'nutrient', 'ph', 'ec', 'reading'];
const dataType = 'monitoring_data';

function parse(userMessage) {
    console.log(`🔍 Monitoring module parsing: "${userMessage}"`);
    
    // Convert to lowercase for case-insensitive matching
    const lowerMessage = userMessage.toLowerCase();
    
    const query = { 
        searchTerms: [], 
        issueFilter: null, 
        phFilter: null, 
        ecFilter: null, 
        timeFilter: null 
    };
    
    // Issue/problem detection (case-insensitive)
    if (/issue|problem|attention|alert|overdue/i.test(lowerMessage)) { 
        query.issueFilter = true; 
        query.searchTerms.push('needs attention');
        console.log(`⚠️ Found issue filter: needs attention`);
    }
    
    // pH level filters (case-insensitive)
    if (/ph.*low|low.*ph/i.test(lowerMessage)) { 
        query.phFilter = 'low'; 
        query.searchTerms.push('pH low');
        console.log(`📉 Found pH filter: low`);
    }
    if (/ph.*high|high.*ph/i.test(lowerMessage)) { 
        query.phFilter = 'high'; 
        query.searchTerms.push('pH high');
        console.log(`📈 Found pH filter: high`);
    }
    
    // EC level filters (case-insensitive)
    if (/ec.*low|low.*ec/i.test(lowerMessage)) { 
        query.ecFilter = 'low'; 
        query.searchTerms.push('EC low');
        console.log(`⚡ Found EC filter: low`);
    }
    if (/ec.*high|high.*ec/i.test(lowerMessage)) { 
        query.ecFilter = 'high'; 
        query.searchTerms.push('EC high');
        console.log(`⚡ Found EC filter: high`);
    }
    
    // Time-based filters (case-insensitive)
    if (/today/i.test(lowerMessage)) { 
        query.timeFilter = 'today'; 
        query.searchTerms.push('today only');
        console.log(`📅 Found time filter: today`);
    } else if (/recent/i.test(lowerMessage) && !/latest/i.test(lowerMessage)) { 
        query.timeFilter = 'recent'; 
        query.searchTerms.push('recent readings');
        console.log(`📅 Found time filter: recent (last 7 days)`);
    } else if (/latest/i.test(lowerMessage)) {
        // "Latest" should show all data, just sorted by most recent
        query.timeFilter = null;
        query.searchTerms.push('latest');
        console.log(`📅 Found latest request: showing all data sorted by most recent`);
    }
    
    console.log(`📋 Final parsed query:`, JSON.stringify(query, null, 2));
    return query;
}

async function query(farmId, queryParams) {
    console.log(`🔍 Monitoring module querying farmId: ${farmId}`);
    console.log(`📋 Query params:`, JSON.stringify(queryParams, null, 2));
    
    try {
        let supabaseQuery = supabase
            .from('monitoring_tower_dashboard_fixed')
            .select('*')
            .eq('farm_id', farmId);
        
        console.log(`🏢 Base query: SELECT * FROM monitoring_tower_dashboard_fixed WHERE farm_id = ${farmId}`);
        
        // Apply issue filter using the computed needs_attention field
        if (queryParams.issueFilter) {
            supabaseQuery = supabaseQuery.eq('needs_attention', true);
            console.log(`⚠️ Added issue filter: needs_attention = true`);
        }
        
        // Apply pH filters using ph_color
        if (queryParams.phFilter === 'low') {
            supabaseQuery = supabaseQuery.eq('ph_color', 'red');
            console.log(`📉 Added pH low filter: ph_color = red`);
        } else if (queryParams.phFilter === 'high') {
            supabaseQuery = supabaseQuery.eq('ph_color', 'purple');
            console.log(`📈 Added pH high filter: ph_color = purple`);
        }
        
        // Apply EC filters using ec_status (updated for new view)
        if (queryParams.ecFilter === 'low') {
            supabaseQuery = supabaseQuery.or('ec_status.ilike.%low%,ec_status.ilike.%very_low%');
            console.log(`⚡ Added EC low filter: ec_status contains 'low'`);
        } else if (queryParams.ecFilter === 'high') {
            supabaseQuery = supabaseQuery.or('ec_status.ilike.%high%,ec_status.ilike.%very_high%');
            console.log(`⚡ Added EC high filter: ec_status contains 'high'`);
        }
        
        // Apply time filter - be more lenient with "recent"
        if (queryParams.timeFilter === 'today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            supabaseQuery = supabaseQuery.gte('read_at', today.toISOString());
            console.log(`📅 Added today filter: read_at >= ${today.toISOString()}`);
        } else if (queryParams.timeFilter === 'recent') {
            // Make "recent" more lenient - last 7 days instead of 1 day
            const lastWeek = new Date();
            lastWeek.setDate(lastWeek.getDate() - 7);
            supabaseQuery = supabaseQuery.gte('read_at', lastWeek.toISOString());
            console.log(`📅 Added recent filter: read_at >= ${lastWeek.toISOString()} (last 7 days)`);
        }
        // Note: "latest" doesn't apply any time filter - just sorts by most recent
        
        // Order by row_number and tower_number_within_row for proper numerical sorting
        const result = await supabaseQuery
            .order('row_number', { ascending: true })
            .order('tower_number_within_row', { ascending: true });
        
        console.log(`📊 Query executed. Found ${result.data ? result.data.length : 0} monitoring records`);
        if (result.error) {
            console.error(`❌ Supabase error:`, result.error);
            return { 
                data: null, 
                error: new Error(`Unable to retrieve monitoring data. Please try again later.`)
            };
        }
        
        // Enhanced debugging when no data is found
        if (!result.data || result.data.length === 0) {
            console.log(`🔍 No monitoring data found, running diagnostic query...`);
            
            const totalResult = await supabase
                .from('monitoring_tower_dashboard_fixed')
                .select('tower_identifier, needs_attention, ph_color, ec_status, read_at')
                .eq('farm_id', farmId);
            
            console.log(`📊 Total monitoring records for farm ${farmId}:`, totalResult.data?.length || 0);
            if (totalResult.data && totalResult.data.length > 0) {
                console.log(`📋 Sample records:`, totalResult.data.slice(0, 3));
            }
        }
        
        return result;
        
    } catch (error) {
        console.error(`❌ Exception in monitoring query:`, error);
        return { 
            data: null, 
            error: new Error(`Unable to access monitoring data. Please try again later.`)
        };
    }
}

function generateResponse(data, queryParams) {
    console.log(`📝 Generating response for ${data.length} monitoring records`);
    
    const htmlContent = generateMonitoringHTML(data, queryParams);
    const summary = calculateMonitoringSummary ? calculateMonitoringSummary(data) : {
        needsAttention: data.filter(d => d.needs_attention).length,
        goodStatus: data.filter(d => !d.needs_attention).length,
        neverRead: data.filter(d => !d.read_at).length
    };
    
    const metadata = {
        title: `Monitoring Dashboard - ${data[0]?.farm_name || 'Farm Data'}`,
        description: `${data.length} towers monitored matching criteria.`, 
        recordCount: data.length,
        farmName: data[0]?.farm_name || 'Unknown Farm', 
        summary: summary, 
        searchQuery: queryParams, 
        dataType: dataType,
    };
    return { htmlContent, metadata };
}

function generateMonitoringHTML(monitoringData, query = {}) {
    const currentDate = new Date().toLocaleString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric', 
        hour: 'numeric', minute: '2-digit', hour12: true 
    });
    
    let reportTitle = 'Nutrient Monitoring Dashboard';
    if (query.searchTerms && query.searchTerms.length > 0) {
        reportTitle = `Monitoring: ${query.searchTerms.join(', ')}`;
    }
    
    let tableRows = '';
    if (monitoringData && monitoringData.length > 0) {
        monitoringData.forEach(monitor => {
            const attentionClass = monitor.needs_attention ? 'needs-attention' : 'status-good';
            
            // Use the actual values from the fixed view
            const phValue = monitor.ph_value ? monitor.ph_value.toFixed(1) : 'No Reading';
            const ecValue = monitor.ec_value ? monitor.ec_value.toFixed(1) : 'No Reading';
            
            const phDisplay = monitor.ph_value ? 
                `<span class="ph-badge ${monitor.ph_color || 'unknown'}" title="pH: ${phValue} (${monitor.ph_color})">${phValue}</span>` 
                : 'No Reading';
                
            const ecDisplay = monitor.ec_value ? 
                `<span class="ec-badge ${monitor.ec_status?.toLowerCase() || 'unknown'}" title="EC: ${ecValue} (${monitor.ec_status})">${ecValue}</span>` 
                : 'No Reading';
            
            // Generate issues text based on the fixed view data
            let issues = [];
            if (monitor.ph_color === 'red') issues.push('pH Too Low');
            if (monitor.ph_color === 'purple') issues.push('pH Too High');
            if (monitor.ec_status?.toLowerCase().includes('low')) issues.push('EC Too Low');
            if (monitor.ec_status?.toLowerCase().includes('high')) issues.push('EC Too High');
            if (!monitor.ph_value && !monitor.ec_value) issues.push('No Readings');
            else if (monitor.needs_attention && issues.length === 0) issues.push('Overdue for Reading');
            
            const issuesText = issues.length > 0 ? issues.join(', ') : 'None';
            
            tableRows += `<tr>
                <td><strong>${monitor.tower_identifier || 'Unknown'}</strong></td>
                <td>${phDisplay}</td>
                <td>${ecDisplay}</td>
                <td>${monitor.last_read_human_readable || 'Never'}</td>
                <td>${monitor.reader_name || '-'}</td>
                <td><span class="attention-badge ${attentionClass}">${monitor.needs_attention ? 'Yes' : 'No'}</span></td>
                <td class="issues-cell">${issuesText}</td>
            </tr>`;
        });
    }
    
    const summary = calculateMonitoringSummary ? calculateMonitoringSummary(monitoringData) : {
        needsAttention: monitoringData.filter(d => d.needs_attention).length,
        goodStatus: monitoringData.filter(d => !d.needs_attention).length,
        neverRead: monitoringData.filter(d => !d.read_at).length
    };
    
    return `<!DOCTYPE html>
<html>
<head>
    <title>${reportTitle}</title>
    <style>
        body{font-family:Arial,sans-serif;margin:20px;font-size:12px;background:#f8f9fa}
        .container{background:white;padding:20px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1)}
        
        /* Header with print button */
        .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px}
        h1{font-size:18px;color:#6A5ACD;margin:0}
        .print-button{background:#6A5ACD;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:bold}
        .print-button:hover{background:#5848b8}
        .print-button:active{background:#483ca3}
        
        .info{color:#666;font-size:10px;margin-bottom:15px}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #ddd;padding:10px;text-align:left}
        th{background-color:#f8f9fa;color:#6A5ACD;font-weight:bold}
        tr:nth-child(even){background-color:#f9f9f9}
        
        /* Status badges */
        .attention-badge{padding:3px 8px;border-radius:12px;font-size:10px;font-weight:bold}
        .needs-attention{background:#ffebee;color:#c62828}
        .status-good{background:#e8f5e9;color:#2e7d32}
        
        /* pH and EC badges */
        .ph-badge, .ec-badge{padding:2px 6px;border-radius:8px;font-size:10px;font-weight:bold;color:white;cursor:help}
        .ph-badge.red, .ec-badge.red{background:#f44336}
        .ph-badge.yellow, .ec-badge.yellow{background:#ff9800;color:#333}
        .ph-badge.green, .ec-badge.green, .ec-badge.good{background:#4caf50}
        .ph-badge.blue, .ec-badge.blue{background:#2196f3}
        .ph-badge.purple, .ec-badge.purple{background:#9c27b0}
        .ph-badge.unknown, .ec-badge.unknown{background:#666}
        .ec-badge.low, .ec-badge.very_low{background:#f44336}
        .ec-badge.high, .ec-badge.very_high{background:#ff5722}
        
        .issues-cell{max-width:200px;word-wrap:break-word;font-size:10px}
        .summary{margin-bottom:15px;padding:15px;background:#f0e6ff;border-radius:6px;font-size:11px;border-left:4px solid #6A5ACD}
        
        /* Print styles */
        @media print {
            body{background:white;margin:0}
            .container{box-shadow:none;border-radius:0;padding:10px}
            .print-button{display:none !important}
            .header{display:block}
            h1{font-size:16px;margin-bottom:10px}
            .info{margin-bottom:10px}
            .summary{background:#f5f5f5 !important;border:1px solid #ddd}
            th{background:#f0f0f0 !important;color:#333 !important}
            .ph-badge, .ec-badge{background:#f0f0f0 !important;color:#333 !important;border:1px solid #ddd}
            .attention-badge{background:#f0f0f0 !important;color:#333 !important;border:1px solid #ddd}
            table{font-size:10px}
            th,td{padding:6px}
        }
        
        @media screen and (max-width: 768px) {
            .header{flex-direction:column;align-items:stretch}
            .print-button{margin-top:10px}
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
        <div class="info">Generated on ${currentDate}</div>
        <div class="summary">
            <strong>📊 Summary:</strong> 
            ⚠️ ${summary.needsAttention} Need Attention • 
            ✅ ${summary.goodStatus} Good Status • 
            📊 ${summary.neverRead} Never Read
        </div>
        <table>
            <thead>
                <tr>
                    <th>Tower ID</th>
                    <th>pH Value</th>
                    <th>EC Value</th>
                    <th>Last Reading</th>
                    <th>Read By</th>
                    <th>Needs Attention</th>
                    <th>Issues</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
                ${monitoringData.length === 0 ? '<tr><td colspan="7"><em>No monitoring data found matching the specified criteria.</em></td></tr>' : ''}
            </tbody>
        </table>
    </div>
</body>
</html>`;
}

module.exports = { name, keywords, dataType, parse, query, generateResponse };