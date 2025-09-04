// services/data_modules/availableHarvest.js
const supabase = require('../../config/database');

const name = 'Available Harvest Report';
const keywords = ['available for allocation', 'what can i sell', 'available harvest'];
const dataType = 'rpt_available_harvest';

// This report is simple and doesn't need complex parsing.
function parse(userMessage) {
    const query = { searchTerms: ['available harvest'] };
    // You could add parsing for freshness, e.g., if(userMessage.includes('very fresh')) ...
    return query;
}

// Query the new SQL View directly.
async function query(farmId, queryParams) {
    return await supabase.from('rpt_available_harvest').select('*').eq('farm_id', farmId);
}

// Generate the response.
function generateResponse(data, queryParams) {
    const htmlContent = generateAvailableHarvestHTML(data);
    const metadata = {
        title: `Available Harvest for Allocation`,
        description: `${data.length} fresh product batches are available for allocation.`,
        recordCount: data.length,
        dataType: dataType,
    };
    return { htmlContent, metadata };
}

// Helper HTML function for this specific report.
function generateAvailableHarvestHTML(data) {
    let tableRows = '';
    data.forEach(item => {
        tableRows += `
            <tr>
                <td>${item.plant_name}</td>
                <td>${item.available_quantity}</td>
                <td>${new Date(item.harvest_date).toLocaleDateString()}</td>
                <td>${item.days_since_harvest}</td>
                <td style="color: ${item.freshness_level === 'very_fresh' ? '#34C759' : '#FF9500'};">${item.freshness_level.replace('_', ' ')}</td>
            </tr>`;
    });
    return `<!DOCTYPE html><html><head><title>Available Harvest</title><style>body{font-family:Arial,sans-serif}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}th{background-color:#f2f2f2}</style></head><body><h1>Available Harvest Report</h1><table><thead><tr><th>Plant</th><th>Available Qty</th><th>Harvest Date</th><th>Days Old</th><th>Freshness</th></tr></thead><tbody>${tableRows}</tbody></table></body></html>`;
}

module.exports = { name, keywords, dataType, parse, query, generateResponse };