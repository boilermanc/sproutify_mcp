// services/data_modules/dailyOperations.js
const supabase = require('../../config/database');

const name = 'Daily Operations Dashboard';
const keywords = ['daily operations', 'what happened today', "what's happening"];
const dataType = 'rpt_daily_operations';

function parse(userMessage) {
    const query = { searchTerms: ['daily operations'] };
    return query;
}

async function query(farmId, queryParams) {
    // The view is already filtered for the last 14 days.
    return await supabase.from('rpt_daily_operations').select('*').eq('farm_id', farmId);
}

function generateResponse(data, queryParams) {
    const htmlContent = generateDailyOperationsHTML(data);
    const metadata = {
        title: `Daily Operations Dashboard`,
        description: `A summary of farm operations over the last 14 days.`,
        recordCount: data.length,
        dataType: dataType,
    };
    return { htmlContent, metadata };
}

function generateDailyOperationsHTML(data) {
    let tableRows = '';
    data.forEach(item => {
        tableRows += `
            <tr>
                <td>${new Date(item.harvest_date).toLocaleDateString()}</td>
                <td>${item.harvest_batches}</td>
                <td>${item.total_harvested}</td>
                <td>${item.allocations_made}</td>
                <td>${item.deliveries_completed}</td>
                <td>${item.same_day_delivery_rate || 0}%</td>
            </tr>`;
    });
    return `<!DOCTYPE html><html><head><title>Daily Operations Dashboard</title><style>body{font-family:Arial,sans-serif}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}th{background-color:#f2f2f2}</style></head><body><h1>Daily Operations Dashboard (Last 14 Days)</h1><table><thead><tr><th>Date</th><th>Harvests</th><th>Total Qty</th><th>Allocations</th><th>Deliveries</th><th>Same-Day Rate</th></tr></thead><tbody>${tableRows}</tbody></table></body></html>`;
}

module.exports = { name, keywords, dataType, parse, query, generateResponse };