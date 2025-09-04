// services/data_modules/pendingDeliveries.js
const supabase = require('../../config/database');

const name = 'Pending Deliveries Report';
const keywords = ['pending deliveries', 'to be delivered', 'needs to be delivered', 'deliveries'];
const dataType = 'rpt_pending_deliveries';

function parse(userMessage) {
    console.log(`🔍 Pending Deliveries module parsing: "${userMessage}"`);
    
    // Convert to lowercase for case-insensitive matching
    const lowerMessage = userMessage.toLowerCase();
    
    const query = { searchTerms: ['pending deliveries'] };
    
    // Check for urgency keywords (case-insensitive)
    if (lowerMessage.includes('urgent') || lowerMessage.includes('priority') || lowerMessage.includes('rush')) {
        query.urgencyFilter = 'urgent';
        query.searchTerms.push('urgent');
        console.log(`⚡ Found urgency filter: urgent`);
    }
    
    // Check for customer type filters (case-insensitive)
    if (lowerMessage.includes('wholesale') || lowerMessage.includes('retailer')) {
        query.customerTypeFilter = 'wholesale';
        query.searchTerms.push('wholesale');
        console.log(`🏢 Found customer type filter: wholesale`);
    }
    
    if (lowerMessage.includes('consumer') || lowerMessage.includes('direct') || lowerMessage.includes('retail')) {
        query.customerTypeFilter = 'consumer';
        query.searchTerms.push('consumer');
        console.log(`👤 Found customer type filter: consumer`);
    }
    
    // Check for time-based filters (case-insensitive)
    if (lowerMessage.includes('overdue') || lowerMessage.includes('late')) {
        query.timeFilter = 'overdue';
        query.searchTerms.push('overdue');
        console.log(`⏰ Found time filter: overdue`);
    }
    
    if (lowerMessage.includes('today') || lowerMessage.includes('due today')) {
        query.timeFilter = 'today';
        query.searchTerms.push('due today');
        console.log(`📅 Found time filter: today`);
    }
    
    console.log(`📋 Final parsed query:`, JSON.stringify(query, null, 2));
    return query;
}

async function query(farmId, queryParams) {
    console.log(`🔍 Pending Deliveries querying farmId: ${farmId}`);
    console.log(`📋 Query params:`, JSON.stringify(queryParams, null, 2));
    
    try {
        let supabaseQuery = supabase
            .from('rpt_pending_deliveries')
            .select('*')
            .eq('farm_id', farmId);
        
        console.log(`🏢 Base query: SELECT * FROM rpt_pending_deliveries WHERE farm_id = ${farmId}`);
        
        // Apply urgency filter
        if (queryParams.urgencyFilter) {
            supabaseQuery = supabaseQuery.eq('delivery_urgency', queryParams.urgencyFilter);
            console.log(`⚡ Added urgency filter: ${queryParams.urgencyFilter}`);
        }
        
        // Apply customer type filter
        if (queryParams.customerTypeFilter) {
            supabaseQuery = supabaseQuery.ilike('customer_type', `%${queryParams.customerTypeFilter}%`);
            console.log(`🏢 Added customer type filter: ${queryParams.customerTypeFilter}`);
        }
        
        // Apply time-based filters
        if (queryParams.timeFilter === 'overdue') {
            // Assuming there's a field that indicates overdue status
            supabaseQuery = supabaseQuery.lt('expected_delivery_date', new Date().toISOString());
            console.log(`⏰ Added overdue filter`);
        } else if (queryParams.timeFilter === 'today') {
            const today = new Date().toISOString().split('T')[0];
            supabaseQuery = supabaseQuery.eq('expected_delivery_date', today);
            console.log(`📅 Added today filter: ${today}`);
        }
        
        const result = await supabaseQuery.order('expected_delivery_date', { ascending: true });
        
        console.log(`📊 Query executed. Found ${result.data ? result.data.length : 0} pending deliveries`);
        if (result.error) {
            console.error(`❌ Supabase error:`, result.error);
        }
        
        // Enhanced debugging when no data is found
        if (!result.data || result.data.length === 0) {
            console.log(`🔍 No pending deliveries found, running diagnostic query...`);
            
            const totalResult = await supabase
                .from('rpt_pending_deliveries')
                .select('customer_name, expected_delivery_date, delivery_urgency')
                .eq('farm_id', farmId);
            
            console.log(`📊 Total pending deliveries for farm ${farmId}:`, totalResult.data?.length || 0);
            if (totalResult.data && totalResult.data.length > 0) {
                console.log(`📋 Sample records:`, totalResult.data.slice(0, 3));
            }
        }
        
        return result;
        
    } catch (error) {
        console.error(`❌ Exception in pending deliveries query:`, error);
        return { data: null, error: error };
    }
}

function generateResponse(data, queryParams) {
    console.log(`📝 Generating response for ${data.length} pending delivery records`);
    
    const htmlContent = generatePendingDeliveriesHTML(data, queryParams);
    const metadata = {
        title: `Pending Deliveries Report`,
        description: `${data.length} allocations are pending delivery.`,
        recordCount: data.length,
        searchQuery: queryParams,
        dataType: dataType,
        farmName: data[0]?.farm_name || 'Unknown Farm'
    };
    return { htmlContent, metadata };
}

function generatePendingDeliveriesHTML(data, query = {}) {
    const currentDate = new Date().toLocaleString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric', 
        hour: 'numeric', minute: '2-digit', hour12: true 
    });
    
    let reportTitle = 'Pending Deliveries Report';
    if (query.searchTerms && query.searchTerms.length > 1) {
        reportTitle = `Pending Deliveries: ${query.searchTerms.slice(1).join(', ')}`;
    }
    
    let tableRows = '';
    if (data && data.length > 0) {
        data.forEach(item => {
            const urgencyColor = item.urgency_color || '#ccc';
            const customerTypeColor = item.customer_type_color || '#333';
            const expectedDate = item.expected_delivery_date ? 
                new Date(item.expected_delivery_date).toLocaleDateString('en-US') : '-';
            
            tableRows += `
                <tr style="border-left: 5px solid ${urgencyColor};">
                    <td>${item.customer_name || '-'}</td>
                    <td style="color: ${customerTypeColor};">${item.customer_type || '-'}</td>
                    <td>${item.plant_name || item.product_name || '-'}</td>
                    <td>${item.quantity || '-'}</td>
                    <td>${item.days_pending_text || expectedDate}</td>
                    <td style="color: ${urgencyColor}; font-weight: bold;">${item.delivery_urgency || 'Normal'}</td>
                </tr>`;
        });
    }
    
    const farmName = data[0]?.farm_name || 'Unknown Farm';
    
    return `<!DOCTYPE html>
<html>
<head>
    <title>${reportTitle}</title>
    <style>
        body{font-family:Arial,sans-serif;margin:20px;font-size:12px;background:#f8f9fa}
        .container{background:white;padding:20px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1)}
        
        /* Header with print button */
        .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px}
        h1{font-size:18px;color:#8B4513;margin:0}
        .print-button{background:#8B4513;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:bold}
        .print-button:hover{background:#6f3310}
        .print-button:active{background:#5a2a0d}
        
        .info{color:#666;font-size:10px;margin-bottom:15px}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #ddd;padding:8px;text-align:left}
        th{background-color:#f8f9fa;color:#8B4513;font-weight:bold}
        tr:nth-child(even){background-color:#f9f9f9}
        .summary{margin-bottom:15px;padding:10px;background:#fff3cd;border-radius:6px;font-size:11px;border-left:4px solid #8B4513}
        .urgent{border-left-width:5px !important}
        
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
            table{font-size:10px}
            th,td{padding:6px}
            /* Print urgency colors as borders only */
            tr{border-left:2px solid #ddd !important}
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
        <div class="info">Generated on ${currentDate} • Farm: ${farmName}</div>
        <div class="summary">
            <strong>📊 Summary:</strong> ${data.length} pending deliveries found
            ${query.urgencyFilter ? ` • 🚨 Filtered by: ${query.urgencyFilter}` : ''}
            ${query.customerTypeFilter ? ` • 👥 Customer type: ${query.customerTypeFilter}` : ''}
            ${query.timeFilter ? ` • ⏰ Time filter: ${query.timeFilter}` : ''}
        </div>
        <table>
            <thead>
                <tr>
                    <th>Customer</th>
                    <th>Type</th>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Pending Since</th>
                    <th>Priority</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
                ${data.length === 0 ? '<tr><td colspan="6"><em>No pending deliveries found matching the specified criteria.</em></td></tr>' : ''}
            </tbody>
        </table>
    </div>
</body>
</html>`;
}

module.exports = { name, keywords, dataType, parse, query, generateResponse };