// services/data_modules/inventoryAging.js
const supabase = require('../../config/database');

const name = 'Inventory Aging Analysis';
const keywords = ['inventory aging', 'getting old', 'waste risk', 'old inventory'];
const dataType = 'rpt_inventory_aging';

function parse(userMessage) {
    const query = { searchTerms: ['inventory aging'] };
    return query;
}

async function query(farmId, queryParams) {
    return await supabase.from('rpt_inventory_aging').select('*').eq('farm_id', farmId);
}

function generateResponse(data, queryParams) {
    const htmlContent = generateInventoryAgingHTML(data);
    const metadata = {
        title: `Inventory Aging Analysis`,
        description: `Analysis of available inventory by age and waste risk.`,
        recordCount: data.length,
        dataType: dataType,
    };
    return { htmlContent, metadata };
}

function generateInventoryAgingHTML(data) {
    let tableRows = '';
    data.forEach(item => {
        tableRows += `
            <tr style="border-left: 5px solid ${item.risk_color};">
                <td>${item.plant_name}</td>
                <td>${item.available_quantity}</td>
                <td>${item.age_text}</td>
                <td style="color: ${item.age_color}; font-weight: bold;">${item.age_category.replace('_', ' ')}</td>
                <td>${item.waste_risk_level.replace(/_/g, ' ')}</td>
            </tr>`;
    });
    return `<!DOCTYPE html><html><head><title>Inventory Aging Analysis</title><style>body{font-family:Arial,sans-serif}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}th{background-color:#f2f2f2}</style></head><body><h1>Inventory Aging Analysis</h1><table><thead><tr><th>Plant</th><th>Available Qty</th><th>Age</th><th>Category</th><th>Waste Risk</th></tr></thead><tbody>${tableRows}</tbody></table></body></html>`;
}

module.exports = { name, keywords, dataType, parse, query, generateResponse };