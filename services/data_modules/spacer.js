// services/data_modules/spacer.js
const supabase = require('../../config/database');
const { calculateSpacerSummary } = require('../../utils/summaryCalculators');
const { enhanceWithFarmName } = require('../../utils/farmUtils');

// 1. Define the module's identity
const name = 'Spacer Inventory';
const keywords = ['spacer', 'tray', 'seedling', 'germination', 'ready', 'seeded', 'inventory'];
const dataType = 'spacers';

// 2. The 'parse' function: Extracts query parameters from the user's message.
function parse(userMessage) {
    console.log(`🔍 Spacer module parsing: "${userMessage}"`);
    
    // Convert to lowercase for case-insensitive matching
    const lowerMessage = userMessage.toLowerCase();
    
    const query = {
        searchTerms: [],
        plantNames: [],
        statuses: [],
        quantityFilter: null,
        readyFilter: null,
        dateFilter: null
    };

    const plantPatterns = [
        { pattern: /green oak|oak.*green|oakleaf.*green/i, match: 'Lettuce, Oakleaf Green' },
        { pattern: /red oak|oak.*red|oakleaf.*red/i, match: 'Lettuce, Oakleaf Red' },
        { pattern: /butter.*rex|rex.*butter/i, match: 'Lettuce, Butter Rex' },
        { pattern: /bibb.*gatsbi|gatsbi.*bibb/i, match: 'Lettuce, Bibb Gatsbi' },
        { pattern: /salanova.*red|red.*salanova/i, match: 'Lettuce, Salanova Red Butter' },
        { pattern: /salanova.*green|green.*salanova/i, match: 'Lettuce, Salanova Green Butter' },
        { pattern: /romaine.*green|green.*romaine/i, match: 'Lettuce, Romaine Green Forest' },
        { pattern: /summer.*crisp|crisp.*summer/i, match: 'Lettuce, Summer Crisp Green' },
        { pattern: /swiss.*chard|chard.*swiss/i, match: 'Swiss Chard, Bright Lights' },
        { pattern: /sorrel.*green|green.*sorrel/i, match: 'Sorrel, Green' },
        { pattern: /lettuce/i, match: 'lettuce' },
        { pattern: /herbs?/i, match: 'herb' },
        { pattern: /basil/i, match: 'basil' },
        { pattern: /cilantro/i, match: 'cilantro' },
        { pattern: /parsley/i, match: 'parsley' },
    ];

    plantPatterns.forEach(({ pattern, match }) => {
        if (pattern.test(lowerMessage)) {
            query.plantNames.push(match);
            if (!query.searchTerms.includes(match)) query.searchTerms.push(match);
            console.log(`🌱 Found plant: ${match}`);
        }
    });

    // Status filtering
    if (/ready|harvest|harvestable/i.test(lowerMessage)) {
        query.statuses.push('Ready');
        query.readyFilter = true;
        if (!query.searchTerms.includes('ready')) query.searchTerms.push('ready');
        console.log(`✅ Found ready filter`);
    }
    if (/growing|germinating|seeded/i.test(lowerMessage)) {
        query.statuses.push('Growing');
        if (!query.searchTerms.includes('growing')) query.searchTerms.push('growing');
        console.log(`🌿 Found growing filter`);
    }
    if (/available|empty|unused/i.test(lowerMessage)) {
        query.statuses.push('Available');
        if (!query.searchTerms.includes('available')) query.searchTerms.push('available');
        console.log(`📦 Found available filter`);
    }

    // Quantity-related filters
    if (/low.*quantity|few.*trays|running.*low/i.test(lowerMessage)) {
        query.quantityFilter = 'low';
        if (!query.searchTerms.includes('low quantity')) query.searchTerms.push('low quantity');
        console.log(`⚠️ Found low quantity filter`);
    }
    if (/high.*quantity|many.*trays|abundant/i.test(lowerMessage)) {
        query.quantityFilter = 'high';
        if (!query.searchTerms.includes('high quantity')) query.searchTerms.push('high quantity');
        console.log(`📈 Found high quantity filter`);
    }

    // Date-related filters
    if (/recent|today|yesterday|this.*week/i.test(lowerMessage)) {
        query.dateFilter = 'recent';
        if (!query.searchTerms.includes('recent')) query.searchTerms.push('recent');
        console.log(`📅 Found recent date filter`);
    }
    if (/overdue|late|past.*due/i.test(lowerMessage)) {
        query.dateFilter = 'overdue';
        if (!query.searchTerms.includes('overdue')) query.searchTerms.push('overdue');
        console.log(`⏰ Found overdue filter`);
    }

    console.log(`📋 Final parsed query:`, JSON.stringify(query, null, 2));
    return query;
}

// 3. The 'query' function: Fetches data from Supabase based on parsed parameters.
async function query(farmId, queryParams) {
    console.log(`🔍 Spacer module querying farmId: ${farmId}`);
    console.log(`📋 Query params:`, JSON.stringify(queryParams, null, 2));
    
    try {
        let supabaseQuery = supabase
            .from('spacer_inventory')
            .select('*')
            .eq('farm_id', farmId)
            .order('spacer_date', { ascending: false });

        console.log(`🏢 Base query: SELECT * FROM spacer_inventory WHERE farm_id = ${farmId}`);

        // Apply filters based on parsed query
        if (queryParams.plantNames.length > 0) {
            const plantName = queryParams.plantNames[0]; // Using simplified logic for now
            console.log(`🔍 Filtering by plant name: "${plantName}"`);
            if (plantName === 'lettuce') {
                supabaseQuery = supabaseQuery.ilike('plant_type', '%lettuce%');
            } else if (plantName === 'herb') {
                supabaseQuery = supabaseQuery.or('plant_type.ilike.%basil%,plant_type.ilike.%cilantro%,plant_type.ilike.%parsley%');
            } else {
                supabaseQuery = supabaseQuery.ilike('plant_type', `%${plantName}%`);
            }
        } else if (queryParams.statuses.length > 0) {
            console.log(`🔍 Filtering by status: ${queryParams.statuses.join(', ')}`);
            supabaseQuery = supabaseQuery.in('status', queryParams.statuses);
        } else if (queryParams.quantityFilter) {
            console.log(`🔍 Filtering by quantity: ${queryParams.quantityFilter}`);
            if (queryParams.quantityFilter === 'low') {
                supabaseQuery = supabaseQuery.lte('quantity', 5);
            } else if (queryParams.quantityFilter === 'high') {
                supabaseQuery = supabaseQuery.gte('quantity', 20);
            }
        } else if (queryParams.dateFilter) {
            console.log(`🔍 Filtering by date: ${queryParams.dateFilter}`);
            const today = new Date();
            if (queryParams.dateFilter === 'recent') {
                const threeDaysAgo = new Date(today.getTime() - (3 * 24 * 60 * 60 * 1000));
                supabaseQuery = supabaseQuery.gte('spacer_date', threeDaysAgo.toISOString());
            } else if (queryParams.dateFilter === 'overdue') {
                supabaseQuery = supabaseQuery.lt('expected_ready_date', today.toISOString());
                supabaseQuery = supabaseQuery.eq('status', 'Growing');
            }
        }
        
        const result = await supabaseQuery;
        
        console.log(`📊 Query executed. Found ${result.data ? result.data.length : 0} spacer records`);
        if (result.error) {
            console.error(`❌ Supabase error:`, result.error);
        }
        
        // Enhance data with farm name
        if (result.data && result.data.length > 0) {
            result.data = await enhanceWithFarmName(result.data, farmId);
        }
        
        return result;
    } catch (error) {
        console.error('❌ Spacer data module query error:', error);
        // Return an error structure that the controller can handle
        return { data: null, error: error };
    }
}

// 4. The 'generateResponse' function: Creates the final HTML and metadata object.
function generateResponse(data, queryParams) {
    console.log(`📝 Generating response for ${data.length} spacer records`);
    
    const htmlContent = generateSpacerReportHTML(data, queryParams);
    const summary = calculateSpacerSummary(data);

    const metadata = {
        title: `Spacer Inventory - ${data[0]?.farm_name || 'Unknown Farm'}`,
        description: `${data.length} spacer trays found${queryParams.searchTerms.length ? ` matching: ${queryParams.searchTerms.join(', ')}` : ''}`,
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
function generateSpacerReportHTML(spacerData, query = {}) {
    try {
        if (!spacerData || spacerData.length === 0) {
            return '<p>No spacer inventory data to display.</p>'; // Fallback, though should be handled before this
        }

        const farmName = spacerData[0].farm_name || 'Unknown Farm';
        const currentDate = new Date().toLocaleString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true
        });

        let reportTitle = 'Spacer Inventory Report';
        if (query.searchTerms && query.searchTerms.length > 0) {
            reportTitle = `Spacer Inventory: ${query.searchTerms.join(', ')}`;
        }

        let tableRows = '';
        spacerData.forEach(spacer => {
            const seededDate = spacer.seeded_date ? new Date(spacer.seeded_date).toLocaleDateString('en-US') : '-';
            const expectedReady = spacer.expected_ready_date ? new Date(spacer.expected_ready_date).toLocaleDateString('en-US') : '-';
            const spacerDate = spacer.spacer_date ? new Date(spacer.spacer_date).toLocaleDateString('en-US') : '-';
            
            let statusClass = '';
            const status = spacer.status?.toLowerCase();
            if (status === 'ready') statusClass = 'status-ready';
            else if (status === 'growing') statusClass = 'status-growing';
            else if (status === 'available') statusClass = 'status-available';
            
            let plantName = spacer.plant_type || '-';
            if (query.plantNames && query.plantNames.length > 0 && plantName !== '-') {
                if (query.plantNames.some(searchTerm => plantName.toLowerCase().includes(searchTerm.toLowerCase()))) {
                    plantName = `<strong>${plantName}</strong>`;
                }
            }

            // Check if overdue
            const isOverdue = spacer.expected_ready_date && 
                             new Date(spacer.expected_ready_date) < new Date() && 
                             spacer.status === 'Growing';
            
            tableRows += `
            <tr${isOverdue ? ' class="overdue-row"' : ''}>
                <td>${spacer.spacer_id || ''}</td>
                <td class="${statusClass}" style="background-color: ${spacer.status_background_color || ''}; color: ${spacer.status_color || ''}">${spacer.status || ''}</td>
                <td>${plantName}</td>
                <td style="text-align: center; font-weight: bold;">${spacer.quantity || 0}</td>
                <td>${seededDate}</td>
                <td>${expectedReady}${isOverdue ? ' ⚠️' : ''}</td>
                <td>${spacerDate}</td>
            </tr>`;
        });

        const summary = calculateSpacerSummary(spacerData);

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
        h1 { font-size: 18px; margin: 0; color: #7C3AED; border-bottom: 2px solid #7C3AED; padding-bottom: 5px; }
        .print-button { background: #7C3AED; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold; }
        .print-button:hover { background: #6D28D9; }
        .print-button:active { background: #5B21B6; }
        
        .report-info { margin-bottom: 20px; font-size: 11px; color: #666; background: #f8f9fa; padding: 12px; border-radius: 6px; border-left: 4px solid #7C3AED; }
        .report-info div { margin-bottom: 4px; }
        .search-info { background: #fdf4ff; border: 1px solid #e9d5ff; border-radius: 6px; padding: 10px; margin-bottom: 15px; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f8f9fa; font-weight: bold; color: #7C3AED; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        tr:hover { background-color: #f0f0ff; }
        .overdue-row { background-color: #fef2f2 !important; }
        .overdue-row:hover { background-color: #fee2e2 !important; }
        .status-ready { background-color: #dcfce7 !important; color: #166534 !important; font-weight: 500; }
        .status-growing { background-color: #fefce8 !important; color: #ca8a04 !important; font-weight: 500; }
        .status-available { background-color: #eff6ff !important; color: #1e40af !important; font-weight: 500; }
        .summary { margin-bottom: 15px; padding: 10px; background: #f3f4f6; border-radius: 6px; font-size: 11px; border-left: 4px solid #7C3AED; }
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
            .status-ready { background-color: #f5f5f5 !important; color: #333 !important; }
            .status-growing { background-color: #f5f5f5 !important; color: #333 !important; }
            .status-available { background-color: #f5f5f5 !important; color: #333 !important; }
            .overdue-row { background-color: #f5f5f5 !important; }
            table { font-size: 10px; }
            th, td { padding: 6px; }
        }
        
        @media screen and (max-width: 768px) {
            .header { flex-direction: column; align-items: stretch; }
            .print-button { margin-top: 10px; }
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
            <div><strong>Total Spacer Trays:</strong> ${spacerData.length}</div>
            <div><strong>Source:</strong> Sproutify AI</div>
        </div>
        ${query.searchTerms && query.searchTerms.length > 0 ? `
        <div class="search-info">
            <strong>🎯 Search Results:</strong> Found ${spacerData.length} spacer trays matching: ${query.searchTerms.join(', ')}
        </div>` : ''}
        <div class="summary">
            <strong>📊 Quick Summary:</strong> 
            ✅ ${summary.ready || 0} Ready • 
            🌱 ${summary.growing || 0} Growing • 
            📦 ${summary.available || 0} Available • 
            📈 ${summary.totalQuantity || 0} Total Trays
        </div>
        <table>
            <thead>
                <tr>
                    <th>Spacer ID</th><th>Status</th><th>Plant Type</th><th>Quantity</th>
                    <th>Seeded Date</th><th>Expected Ready</th><th>Last Updated</th>
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
        console.error('Error generating spacer HTML:', error);
        return `<h1>Error</h1><p>There was an error generating the spacer inventory report: ${error.message}</p>`;
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