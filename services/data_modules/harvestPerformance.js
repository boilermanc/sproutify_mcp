// services/data_modules/harvestPerformance.js
const supabase = require('../../config/database');

const name = 'Harvest Performance Report';
const keywords = ['harvest performance', 'how are we harvesting', 'harvest summary'];
const dataType = 'rpt_harvest_performance';

function parse(userMessage) {
    const query = { searchTerms: ['harvest performance'] };
    // Could add parsing for timeframes e.g., this week/month
    return query;
}

async function query(farmId, queryParams) {
    // This view already filters for the last 30 days.
    return await supabase.from('rpt_harvest_performance').select('*').eq('farm_id', farmId);
}

function generateResponse(data, queryParams) {
    const htmlContent = generateHarvestPerformanceHTML(data);
    const metadata = {
        title: `Weekly Harvest Performance`,
        description: `Performance summary for the last 30 days, grouped by week.`,
        recordCount: data.length,
        dataType: dataType,
    };
    return { htmlContent, metadata };
}

function generateHarvestPerformanceHTML(data) {
    let tableRows = '';
    data.forEach(item => {
        tableRows += `
            <tr>
                <td>${new Date(item.harvest_week).toLocaleDateString()}</td>
                <td>${item.plant_name}</td>
                <td>${item.total_harvested}</td>
                <td style="color: ${item.performance_color};">${item.delivery_rate_percent}%</td>
                <td style="color: ${item.waste_color};">${item.waste_rate_percent}%</td>
            </tr>`;
    });
    return `<!DOCTYPE html><html><head><title>Harvest Performance</title><style>body{font-family:Arial,sans-serif}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}th{background-color:#f2f2f2}</style></head><body><h1>Weekly Harvest Performance</h1><table><thead><tr><th>Week Of</th><th>Plant</th><th>Total Harvested</th><th>Delivery Rate</th><th>Waste Rate</th></tr></thead><tbody>${tableRows}</tbody></table></body></html>`;
}

module.exports = { name, keywords, dataType, parse, query, generateResponse };