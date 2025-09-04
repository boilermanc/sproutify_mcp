// services/data_modules/allocationEfficiency.js
const supabase = require('../../config/database');

const name = 'Allocation Efficiency Report';
const keywords = ['allocation efficiency', 'how efficient are allocations'];
const dataType = 'rpt_allocation_efficiency';

function parse(userMessage) {
    const query = { searchTerms: ['allocation efficiency'] };
    return query;
}

async function query(farmId, queryParams) {
    return await supabase.from('rpt_allocation_efficiency').select('*').eq('farm_id', farmId);
}

function generateResponse(data, queryParams) {
    const htmlContent = generateAllocationEfficiencyHTML(data);
    const metadata = {
        title: `Weekly Allocation Efficiency`,
        description: `Analysis of allocation success rates over the last 30 days.`,
        recordCount: data.length,
        dataType: dataType,
    };
    return { htmlContent, metadata };
}

function generateAllocationEfficiencyHTML(data) {
    let tableRows = '';
    data.forEach(item => {
        tableRows += `
            <tr>
                <td>${new Date(item.allocation_week).toLocaleDateString()}</td>
                <td>${item.plant_name}</td>
                <td>${item.total_allocations}</td>
                <td>${item.successful_deliveries}</td>
                <td>${item.overdue_allocations}</td>
                <td>${item.avg_days_to_delivery?.toFixed(1) || 'N/A'}</td>
                <td>${item.success_rate_percent}%</td>
            </tr>`;
    });
    return `<!DOCTYPE html><html><head><title>Allocation Efficiency</title><style>body{font-family:Arial,sans-serif}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}th{background-color:#f2f2f2}</style></head><body><h1>Weekly Allocation Efficiency</h1><table><thead><tr><th>Week Of</th><th>Plant</th><th>Total Allocations</th><th>Successful</th><th>Overdue</th><th>Avg. Days to Delivery</th><th>Success Rate</th></tr></thead><tbody>${tableRows}</tbody></table></body></html>`;
}

module.exports = { name, keywords, dataType, parse, query, generateResponse };