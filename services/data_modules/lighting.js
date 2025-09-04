// services/data_modules/lighting.js
const supabase = require('../../config/database');
const { calculateLightingSummary } = require('../../utils/summaryCalculators');
const { enhanceWithFarmName } = require('../../utils/farmUtils');

// 1. Define the module's identity
const name = 'Lighting Usage Report';
const keywords = ['lighting', 'lights', 'energy', 'usage', 'cost', 'zones', 'fixtures', 'kwh', 'electricity'];
const dataType = 'lighting';

// 2. The 'parse' function: Extracts query parameters from the user's message.
function parse(userMessage) {
    console.log(`💡 Lighting module parsing: "${userMessage}"`);
    
    // Convert to lowercase for case-insensitive matching
    const lowerMessage = userMessage.toLowerCase();
    
    const query = {
        searchTerms: [],
        timeFilter: null,
        zoneFilter: null,
        costFilter: null,
        usageFilter: null
    };

    // Time period filtering
    if (/daily|day|today/i.test(lowerMessage)) {
        query.timeFilter = 'daily';
        if (!query.searchTerms.includes('daily')) query.searchTerms.push('daily');
        console.log(`📅 Found time filter: daily`);
    }
    if (/weekly|week|this.*week/i.test(lowerMessage)) {
        query.timeFilter = 'weekly';
        if (!query.searchTerms.includes('weekly')) query.searchTerms.push('weekly');
        console.log(`📅 Found time filter: weekly`);
    }
    if (/monthly|month|this.*month/i.test(lowerMessage)) {
        query.timeFilter = 'monthly';
        if (!query.searchTerms.includes('monthly')) query.searchTerms.push('monthly');
        console.log(`📅 Found time filter: monthly`);
    }

    // Zone filtering
    if (/zone|zones|area|areas/i.test(lowerMessage)) {
        query.zoneFilter = true;
        if (!query.searchTerms.includes('zones')) query.searchTerms.push('zones');
        console.log(`🏢 Found zone filter`);
    }

    // Cost-related filtering
    if (/cost|expensive|cheap|budget|price/i.test(lowerMessage)) {
        query.costFilter = true;
        if (!query.searchTerms.includes('cost analysis')) query.searchTerms.push('cost analysis');
        console.log(`💰 Found cost filter`);
    }
    if (/high.*cost|expensive/i.test(lowerMessage)) {
        query.costFilter = 'high';
        if (!query.searchTerms.includes('high cost')) query.searchTerms.push('high cost');
        console.log(`💸 Found high cost filter`);
    }

    // Usage-related filtering
    if (/high.*usage|heavy.*usage|intensive/i.test(lowerMessage)) {
        query.usageFilter = 'high';
        if (!query.searchTerms.includes('high usage')) query.searchTerms.push('high usage');
        console.log(`⚡ Found high usage filter`);
    }
    if (/low.*usage|minimal.*usage|efficient/i.test(lowerMessage)) {
        query.usageFilter = 'low';
        if (!query.searchTerms.includes('efficient usage')) query.searchTerms.push('efficient usage');
        console.log(`🌱 Found low usage filter`);
    }

    // Energy efficiency keywords
    if (/efficiency|efficient|optimize|energy.*saving/i.test(lowerMessage)) {
        query.efficiencyFilter = true;
        if (!query.searchTerms.includes('efficiency')) query.searchTerms.push('efficiency');
        console.log(`⚡ Found efficiency filter`);
    }

    console.log(`📋 Final parsed query:`, JSON.stringify(query, null, 2));
    return query;
}

// 3. The 'query' function: Fetches data from Supabase based on parsed parameters.
async function query(farmId, queryParams) {
    console.log(`💡 Lighting module querying farmId: ${farmId}`);
    console.log(`📋 Query params:`, JSON.stringify(queryParams, null, 2));
    
    try {
        let supabaseQuery = supabase
            .from('light_total_summary')
            .select('*')
            .eq('farm_id', farmId)
            .order('period_day', { ascending: false })
            .limit(30); // Limit to last 30 days by default

        console.log(`🏢 Base query: SELECT * FROM light_total_summary WHERE farm_id = ${farmId}`);

        // Apply filters based on parsed query
        if (queryParams.timeFilter) {
            const now = new Date();
            let startDate;
            
            if (queryParams.timeFilter === 'daily') {
                startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)); // Last 7 days
                console.log(`📅 Filtering for daily data (last 7 days)`);
            } else if (queryParams.timeFilter === 'weekly') {
                startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)); // Last 30 days
                console.log(`📅 Filtering for weekly data (last 30 days)`);
            } else if (queryParams.timeFilter === 'monthly') {
                startDate = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000)); // Last 90 days
                console.log(`📅 Filtering for monthly data (last 90 days)`);
            }
            
            if (startDate) {
                supabaseQuery = supabaseQuery.gte('period_day', startDate.toISOString().split('T')[0]);
            }
        }

        if (queryParams.costFilter === 'high') {
            console.log(`💸 Filtering for high cost periods`);
            supabaseQuery = supabaseQuery.gte('total_cost', 50); // Adjust threshold as needed
        }

        if (queryParams.usageFilter === 'high') {
            console.log(`⚡ Filtering for high usage periods`);
            supabaseQuery = supabaseQuery.gte('total_usage_hours', 12); // More than 12 hours per day
        } else if (queryParams.usageFilter === 'low') {
            console.log(`🌱 Filtering for low usage periods`);
            supabaseQuery = supabaseQuery.lte('total_usage_hours', 8); // Less than 8 hours per day
        }

        if (queryParams.zoneFilter) {
            console.log(`🏢 Ordering by zones active`);
            supabaseQuery = supabaseQuery.order('zones_active', { ascending: false });
        }
        
        const result = await supabaseQuery;
        
        console.log(`📊 Query executed. Found ${result.data ? result.data.length : 0} lighting records`);
        if (result.error) {
            console.error(`❌ Supabase error:`, result.error);
        }
        
        // Enhance data with farm name
        if (result.data && result.data.length > 0) {
            result.data = await enhanceWithFarmName(result.data, farmId);
        }
        
        return result;
    } catch (error) {
        console.error('❌ Lighting data module query error:', error);
        return { data: null, error: error };
    }
}

// 4. The 'generateResponse' function: Creates the final HTML and metadata object.
function generateResponse(data, queryParams) {
    console.log(`📝 Generating response for ${data.length} lighting records`);
    
    const htmlContent = generateLightingReportHTML(data, queryParams);
    const summary = calculateLightingSummary(data);

    const metadata = {
        title: `Lighting Usage Report - ${data[0]?.farm_name || 'Unknown Farm'}`,
        description: `${data.length} lighting usage periods found${queryParams.searchTerms.length ? ` matching: ${queryParams.searchTerms.join(', ')}` : ''}`,
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
function generateLightingReportHTML(lightingData, query = {}) {
    try {
        if (!lightingData || lightingData.length === 0) {
            return '<p>No lighting usage data to display.</p>';
        }

        const farmName = lightingData[0].farm_name || 'Unknown Farm';
        const currentDate = new Date().toLocaleString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true
        });

        let reportTitle = 'Lighting Usage Report';
        if (query.searchTerms && query.searchTerms.length > 0) {
            reportTitle = `Lighting Usage: ${query.searchTerms.join(', ')}`;
        }

        let tableRows = '';
        lightingData.forEach(period => {
            const periodDate = period.period_day ? new Date(period.period_day).toLocaleDateString('en-US') : '-';
            const cost = period.total_cost ? `$${parseFloat(period.total_cost).toFixed(2)}` : '$0.00';
            const energy = period.total_energy_used_kwh ? parseFloat(period.total_energy_used_kwh).toFixed(2) : '0.00';
            const hours = period.total_usage_hours ? parseFloat(period.total_usage_hours).toFixed(1) : '0.0';
            
            // Color coding based on usage intensity
            let usageClass = '';
            const usageHours = parseFloat(period.total_usage_hours) || 0;
            if (usageHours > 15) usageClass = 'usage-high';
            else if (usageHours > 8) usageClass = 'usage-medium';
            else usageClass = 'usage-low';
            
            // Cost coloring
            let costClass = '';
            const costValue = parseFloat(period.total_cost) || 0;
            if (costValue > 75) costClass = 'cost-high';
            else if (costValue > 25) costClass = 'cost-medium';
            else costClass = 'cost-low';
            
            tableRows += `
            <tr>
                <td>${periodDate}</td>
                <td class="${usageClass}">${hours} hrs</td>
                <td>${energy} kWh</td>
                <td class="${costClass}">${cost}</td>
                <td style="text-align: center;">${period.zones_active || 0}</td>
                <td style="text-align: center;">${period.total_fixtures_active || 0}</td>
                <td style="font-size: 10px;">${period.zones_included || '-'}</td>
            </tr>`;
        });

        const summary = calculateLightingSummary(lightingData);

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
        h1 { font-size: 18px; margin: 0; color: #F59E0B; border-bottom: 2px solid #F59E0B; padding-bottom: 5px; }
        .print-button { background: #F59E0B; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold; }
        .print-button:hover { background: #D97706; }
        .print-button:active { background: #B45309; }
        
        .report-info { margin-bottom: 20px; font-size: 11px; color: #666; background: #f8f9fa; padding: 12px; border-radius: 6px; border-left: 4px solid #F59E0B; }
        .report-info div { margin-bottom: 4px; }
        .search-info { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 10px; margin-bottom: 15px; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f8f9fa; font-weight: bold; color: #F59E0B; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        tr:hover { background-color: #fefbf3; }
        
        /* Usage intensity colors */
        .usage-high { background-color: #fee2e2 !important; color: #dc2626 !important; font-weight: 500; }
        .usage-medium { background-color: #fef3c7 !important; color: #d97706 !important; font-weight: 500; }
        .usage-low { background-color: #d1fae5 !important; color: #059669 !important; font-weight: 500; }
        
        /* Cost colors */
        .cost-high { background-color: #fee2e2 !important; color: #dc2626 !important; font-weight: 500; }
        .cost-medium { background-color: #fef3c7 !important; color: #d97706 !important; font-weight: 500; }
        .cost-low { background-color: #d1fae5 !important; color: #059669 !important; font-weight: 500; }
        
        .summary { margin-bottom: 15px; padding: 10px; background: #fef3c7; border-radius: 6px; font-size: 11px; border-left: 4px solid #F59E0B; }
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
            .usage-high, .usage-medium, .usage-low { background-color: #f5f5f5 !important; color: #333 !important; }
            .cost-high, .cost-medium, .cost-low { background-color: #f5f5f5 !important; color: #333 !important; }
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
            <div><strong>Total Periods:</strong> ${lightingData.length}</div>
            <div><strong>Source:</strong> Sproutify AI</div>
        </div>
        ${query.searchTerms && query.searchTerms.length > 0 ? `
        <div class="search-info">
            <strong>🎯 Search Results:</strong> Found ${lightingData.length} lighting periods matching: ${query.searchTerms.join(', ')}
        </div>` : ''}
        <div class="summary">
            <strong>📊 Quick Summary:</strong> 
            ⏰ ${summary.totalHours} Total Hours • 
            ⚡ ${summary.totalEnergy} kWh • 
            💰 $${summary.totalCost} Total Cost • 
            🏢 ${summary.avgZones} Avg Zones Active
        </div>
        <table>
            <thead>
                <tr>
                    <th>Date</th><th>Usage Hours</th><th>Energy (kWh)</th><th>Cost</th>
                    <th>Zones</th><th>Fixtures</th><th>Zone Names</th>
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
        console.error('Error generating lighting HTML:', error);
        return `<h1>Error</h1><p>There was an error generating the lighting usage report: ${error.message}</p>`;
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