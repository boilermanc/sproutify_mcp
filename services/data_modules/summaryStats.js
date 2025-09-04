// services/data_modules/summaryStats.js
const supabase = require('../../config/database');

const name = 'Quick Summary Stats';
const keywords = ["today's numbers", 'quick summary', 'summary stats', 'dashboard'];
const dataType = 'rpt_summary_stats';

function parse(userMessage) {
    const query = { searchTerms: ["today's numbers"] };
    return query;
}

async function query(farmId, queryParams) {
    // This view is special; it returns only one row per farm.
    return await supabase.from('rpt_summary_stats').select('*').eq('farm_id', farmId).limit(1);
}

function generateResponse(data, queryParams) {
    // This report is unique and doesn't use a table.
    const htmlContent = generateSummaryStatsHTML(data[0]); // Pass the single row of data
    const metadata = {
        title: `Today's Farm Summary`,
        description: `A quick overview of key metrics for today.`,
        recordCount: 1,
        dataType: dataType,
    };
    return { htmlContent, metadata };
}

function generateSummaryStatsHTML(item) {
    if (!item) return `<p>No summary data available for today.</p>`;
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Today's Farm Summary</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 20px; background-color: #f0f2f5; }
            .dashboard { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
            .card { background-color: #fff; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .card h2 { font-size: 16px; color: #666; margin-top: 0; margin-bottom: 5px; text-transform: uppercase; }
            .card .value { font-size: 36px; font-weight: bold; color: #333; }
            .card .status { height: 5px; border-radius: 3px; margin-top: 15px; }
        </style>
    </head>
    <body>
        <h1>Today's Farm Summary</h1>
        <div class="dashboard">
            <div class="card">
                <h2>Pending Deliveries</h2>
                <div class="value">${item.pending_deliveries}</div>
                <div class="status" style="background-color: ${item.overdue_status_color};"></div>
            </div>
            <div class="card">
                <h2>Overdue (>5 days)</h2>
                <div class="value">${item.overdue_deliveries}</div>
                <div class="status" style="background-color: ${item.overdue_status_color};"></div>
            </div>
            <div class="card">
                <h2>Old Inventory (>7 days)</h2>
                <div class="value">${item.old_inventory_batches} <span style="font-size:18px;">batches</span></div>
                <div class="status" style="background-color: ${item.old_inventory_color};"></div>
            </div>
            <div class="card">
                <h2>Today's Deliveries</h2>
                <div class="value">${item.todays_deliveries}</div>
                <div class="status" style="background-color: ${item.activity_level_color};"></div>
            </div>
        </div>
    </body>
    </html>`;
}

module.exports = { name, keywords, dataType, parse, query, generateResponse };