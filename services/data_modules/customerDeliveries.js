// services/data_modules/customerDeliveries.js
const supabase = require('../../config/database');

const name = 'Customer Delivery Summary';
const keywords = ['customer deliveries', 'top customers', 'who are we delivering to'];
const dataType = 'rpt_customer_deliveries';

function parse(userMessage) {
    const query = { searchTerms: ['customer deliveries'] };
    // Future enhancement: parse customer names to filter.
    return query;
}

async function query(farmId, queryParams) {
    return await supabase.from('rpt_customer_deliveries').select('*').eq('farm_id', farmId);
}

function generateResponse(data, queryParams) {
    const htmlContent = generateCustomerDeliveriesHTML(data);
    const metadata = {
        title: `Customer Delivery Summary`,
        description: `Summary of deliveries to customers over the last 30 days.`,
        recordCount: data.length,
        dataType: dataType,
    };
    return { htmlContent, metadata };
}

function generateCustomerDeliveriesHTML(data) {
    let tableRows = '';
    data.forEach(item => {
        tableRows += `
            <tr>
                <td>${item.customer_name}</td>
                <td style="color: ${item.customer_type_color}; font-weight: bold;">${item.customer_type}</td>
                <td>${item.completed_deliveries}</td>
                <td>${item.pending_deliveries}</td>
                <td>${item.total_quantity_delivered}</td>
                <td style="color: ${item.completion_rate_color};">${item.completion_rate_percent}%</td>
            </tr>`;
    });
    return `<!DOCTYPE html><html><head><title>Customer Delivery Summary</title><style>body{font-family:Arial,sans-serif}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}th{background-color:#f2f2f2}</style></head><body><h1>Customer Delivery Summary (Last 30 Days)</h1><table><thead><tr><th>Customer</th><th>Type</th><th>Completed</th><th>Pending</th><th>Total Qty</th><th>Completion %</th></tr></thead><tbody>${tableRows}</tbody></table></body></html>`;
}

module.exports = { name, keywords, dataType, parse, query, generateResponse };