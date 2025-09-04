// services/data_modules/tower.js
const supabase = require('../../config/database');
const { calculateTowerSummary } = require('../../utils/summaryCalculators');

// 1. Define the module's identity
const name = 'Tower Data';
const keywords = ['tower', 'plant', 'grow', 'lettuce', 'oak', 'available', 'clean'];
const dataType = 'towers';

// 2. The 'parse' function: Extracts query parameters from the user's message.
function parse(userMessage) {
    console.log(`🔍 Tower module parsing: "${userMessage}"`);
    
    // Convert to lowercase for case-insensitive matching
    const lowerMessage = userMessage.toLowerCase();
    
    const query = {
        searchTerms: [],
        plantNames: [],
        statuses: [],
        maintenanceFilter: null,
        availabilityFilter: null
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
    ];

    plantPatterns.forEach(({ pattern, match }) => {
        if (pattern.test(lowerMessage)) {
            query.plantNames.push(match);
            if (!query.searchTerms.includes(match)) query.searchTerms.push(match);
            console.log(`🌱 Found plant: ${match}`);
        }
    });

    // Case-insensitive status filtering
    if (/available|empty|free/i.test(lowerMessage)) {
        query.statuses.push('Available', 'Partially Available');
        query.availabilityFilter = true;
        if (!query.searchTerms.includes('available')) query.searchTerms.push('available');
        console.log(`📍 Found availability filter`);
    }
    if (/growing|planted|active/i.test(lowerMessage)) {
        query.statuses.push('Growing');
        if (!query.searchTerms.includes('growing')) query.searchTerms.push('growing');
        console.log(`🌿 Found growing filter`);
    }
    if (/clean|cleaned|cleaning/i.test(lowerMessage)) {
        query.statuses.push('Clean');
        if (!query.searchTerms.includes('clean')) query.searchTerms.push('clean');
        console.log(`🧽 Found clean filter`);
    }
    if (/maintenance|repair|service/i.test(lowerMessage)) {
        query.maintenanceFilter = true;
        if (!query.searchTerms.includes('maintenance needed')) query.searchTerms.push('maintenance needed');
        console.log(`🔧 Found maintenance filter`);
    }

    console.log(`📋 Final parsed query:`, JSON.stringify(query, null, 2));
    return query;
}

// 3. The 'query' function: Fetches data from Supabase based on parsed parameters.
async function query(farmId, queryParams) {
    console.log(`🔍 Tower module querying farmId: ${farmId}`);
    console.log(`📋 Query params:`, JSON.stringify(queryParams, null, 2));
    
    try {
        let supabaseQuery = supabase
            .from('tower_display_with_plants')
            .select('*')
            .eq('farm_id', farmId);

        console.log(`🏢 Base query: SELECT * FROM tower_display_with_plants WHERE farm_id = ${farmId}`);

        // Apply filters based on parsed query
        if (queryParams.plantNames.length > 0) {
            const plantName = queryParams.plantNames[0]; // Using simplified logic for now
            console.log(`🔍 Filtering by plant name: "${plantName}"`);
            if (plantName === 'lettuce') {
                supabaseQuery = supabaseQuery.ilike('plant_name', '%lettuce%');
            } else {
                supabaseQuery = supabaseQuery.ilike('plant_name', `%${plantName}%`);
            }
        } else if (queryParams.statuses.length > 0) {
            console.log(`🔍 Filtering by status: ${queryParams.statuses.join(', ')}`);
            supabaseQuery = supabaseQuery.in('tower_status', queryParams.statuses);
        } else if (queryParams.maintenanceFilter) {
            console.log(`🔍 Filtering by maintenance needed`);
            supabaseQuery = supabaseQuery.eq('has_maintenance', true);
        } else if (queryParams.availabilityFilter) {
            console.log(`🔍 Filtering by availability`);
            supabaseQuery = supabaseQuery.gt('overall_available_ports', 0);
        }
        
        const result = await supabaseQuery;
        
        console.log(`📊 Query executed. Found ${result.data ? result.data.length : 0} tower records`);
        if (result.error) {
            console.error(`❌ Supabase error:`, result.error);
        }
        
        return result;
    } catch (error) {
        console.error('❌ Tower data module query error:', error);
        // Return an error structure that the controller can handle
        return { data: null, error: error };
    }
}

// 4. The 'generateResponse' function: Creates the final HTML and metadata object.
function generateResponse(data, queryParams) {
    console.log(`📝 Generating response for ${data.length} tower records`);
    
    const htmlContent = generateTowerReportHTML(data, queryParams);
    const summary = calculateTowerSummary(data);

    const metadata = {
        title: `Towers - ${data[0]?.farm_name || 'Unknown Farm'}`,
        description: `${data.length} towers found${queryParams.searchTerms.length ? ` matching: ${queryParams.searchTerms.join(', ')}` : ''}`,
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
function generateTowerReportHTML(towerData, query = {}) {
    try {
        if (!towerData || towerData.length === 0) {
            return '<p>No tower data to display.</p>'; // Fallback, though should be handled before this
        }

        const farmName = towerData[0].farm_name || 'Unknown Farm';
        const currentDate = new Date().toLocaleString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true
        });

        let reportTitle = 'Tower Farm Status Report';
        if (query.searchTerms && query.searchTerms.length > 0) {
            reportTitle = `Towers: ${query.searchTerms.join(', ')}`;
        }

        let tableRows = '';
        towerData.forEach(tower => {
            const datePlanted = tower.date_planted ? new Date(tower.date_planted).toLocaleDateString('en-US') : '-';
            const maintenance = tower.has_maintenance ? 'Yes' : 'No';
            const nextDue = tower.next_maintenance_due ? new Date(tower.next_maintenance_due).toLocaleDateString('en-US') : '-';
            
            let statusClass = '';
            if (tower.tower_status?.toLowerCase() === 'growing') statusClass = 'status-growing';
            else if (tower.tower_status?.toLowerCase() === 'clean') statusClass = 'status-clean';
            else if (tower.tower_status?.toLowerCase().includes('available')) statusClass = 'status-available';
            else if (tower.has_maintenance) statusClass = 'status-maintenance';
            
            let plantName = tower.plant_name || '-';
            if (query.plantNames && query.plantNames.length > 0 && plantName !== '-') {
                if (query.plantNames.some(searchTerm => plantName.toLowerCase().includes(searchTerm.toLowerCase()))) {
                    plantName = `<strong>${plantName}</strong>`;
                }
            }
            
            tableRows += `
            <tr>
                <td>${tower.tower_identifier || ''}</td>
                <td>${tower.farm_name || ''}</td>
                <td class="${statusClass}">${tower.tower_status || ''}</td>
                <td>${plantName}</td>
                <td>${datePlanted}</td>
                <td>${tower.individual_ports_used || 0}</td>
                <td>${tower.overall_available_ports || 0}</td>
                <td>${tower.total_ports || 0}</td>
                <td>${maintenance}</td>
                <td>${nextDue}</td>
            </tr>`;
        });

        const summary = calculateTowerSummary(towerData);

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
        h1 { font-size: 18px; margin: 0; color: #2E8B57; border-bottom: 2px solid #2E8B57; padding-bottom: 5px; }
        .print-button { background: #2E8B57; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold; }
        .print-button:hover { background: #1e6b42; }
        .print-button:active { background: #155c37; }
        
        .report-info { margin-bottom: 20px; font-size: 11px; color: #666; background: #f8f9fa; padding: 12px; border-radius: 6px; border-left: 4px solid #2E8B57; }
        .report-info div { margin-bottom: 4px; }
        .search-info { background: #e8f4fd; border: 1px solid #bee5eb; border-radius: 6px; padding: 10px; margin-bottom: 15px; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f8f9fa; font-weight: bold; color: #2E8B57; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        tr:hover { background-color: #f0f8f0; }
        .status-growing { background-color: #d4edda !important; color: #155724 !important; font-weight: 500; }
        .status-clean { background-color: #cce7ff !important; color: #004085 !important; font-weight: 500; }
        .status-available { background-color: #f0f0f0 !important; color: #495057 !important; font-weight: 500; }
        .status-maintenance { background-color: #fff3cd !important; color: #856404 !important; font-weight: 500; }
        .summary { margin-bottom: 15px; padding: 10px; background: #e8f5e8; border-radius: 6px; font-size: 11px; border-left: 4px solid #2E8B57; }
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
            .status-growing { background-color: #f5f5f5 !important; color: #333 !important; }
            .status-clean { background-color: #f5f5f5 !important; color: #333 !important; }
            .status-available { background-color: #f5f5f5 !important; color: #333 !important; }
            .status-maintenance { background-color: #f5f5f5 !important; color: #333 !important; }
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
            <div><strong>Total Towers:</strong> ${towerData.length}</div>
            <div><strong>Source:</strong> Sproutify AI</div>
        </div>
        ${query.searchTerms && query.searchTerms.length > 0 ? `
        <div class="search-info">
            <strong>🎯 Search Results:</strong> Found ${towerData.length} towers matching: ${query.searchTerms.join(', ')}
        </div>` : ''}
        <div class="summary">
            <strong>📊 Quick Summary:</strong> 
            🌿 ${summary.growing} Growing • 
            🧽 ${summary.clean} Clean • 
            📍 ${summary.available} Available • 
            🔧 ${summary.maintenance} Need Maintenance
        </div>
        <table>
            <thead>
                <tr>
                    <th>Tower ID</th><th>Farm</th><th>Status</th><th>Plant</th><th>Date Planted</th>
                    <th>Ports Used</th><th>Available Ports</th><th>Total Ports</th><th>Maintenance</th><th>Next Due</th>
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
        console.error('Error generating tower HTML:', error);
        return `<h1>Error</h1><p>There was an error generating the tower report: ${error.message}</p>`;
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