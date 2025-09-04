// services/data_modules/sensor.js
const supabase = require('../../config/database');
const { calculateSensorSummary } = require('../../utils/summaryCalculators');

const name = 'Sensor Reading Data';
const keywords = ['sensor', 'temperature', 'humidity', 'data'];
const dataType = 'sensor_data';

function parse(userMessage) {
    const query = { searchTerms: [], readingType: null, timeFilter: null };
    if (/temperature|temp/i.test(userMessage)) { query.readingType = 'temperature'; query.searchTerms.push('temperature'); }
    if (/humidity/i.test(userMessage)) { query.readingType = 'humidity'; query.searchTerms.push('humidity'); }
    if (/recent|latest|today/i.test(userMessage)) { query.timeFilter = 'recent'; query.searchTerms.push('recent'); }
    if (/last.*hour/i.test(userMessage)) { query.timeFilter = 'last_hour'; query.searchTerms.push('last hour'); }
    return query;
}

async function query(farmId, queryParams) {
    let supabaseQuery = supabase.from('sensor_readings_compiled').select('*').eq('farm_id', farmId);
    if (queryParams.readingType) supabaseQuery = supabaseQuery.eq('reading_type', queryParams.readingType);
    if (queryParams.timeFilter === 'recent') supabaseQuery = supabaseQuery.gte('time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    if (queryParams.timeFilter === 'last_hour') supabaseQuery = supabaseQuery.gte('time', new Date(Date.now() - 60 * 60 * 1000).toISOString());
    return await supabaseQuery.order('time', { ascending: false }).limit(100);
}

function generateResponse(data, queryParams) {
    const htmlContent = generateSensorHTML(data, queryParams);
    const summary = calculateSensorSummary(data);
    const metadata = {
        title: `Sensor Readings - Farm Data`,
        description: `${data.length} readings found matching criteria.`, recordCount: data.length,
        summary: summary, searchQuery: queryParams, dataType: dataType,
    };
    return { htmlContent, metadata };
}

function generateSensorHTML(sensorData, query = {}) {
    const reportTitle = 'Sensor Readings Report';
    let tableRows = '';
    sensorData.forEach(sensor => {
        const readingTime = sensor.time ? new Date(sensor.time).toLocaleString('en-US') : '-';
        tableRows += `<tr><td>${sensor.sensor_name || '-'}</td><td>${sensor.reading_type || '-'}</td><td>${sensor.value?.toFixed(2) || '-'}</td><td>${readingTime}</td></tr>`;
    });
    const summary = calculateSensorSummary(sensorData);
    return `<!DOCTYPE html><html><head><title>${reportTitle}</title><style>body{font-family:Arial,sans-serif;margin:20px;font-size:12px}h1{font-size:18px;color:#4682B4}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ddd;padding:8px}th{background-color:#f8f9fa;color:#4682B4}.summary{margin-bottom:15px;padding:10px;background:#e6f3ff;border-radius:6px;font-size:11px}</style></head><body><h1>${reportTitle}</h1><div class="summary"><strong>Summary:</strong> ${summary.uniqueSensors} Sensors • ${summary.readingTypes} Reading Types • Latest: ${summary.latestReading}</div><table><thead><tr><th>Sensor</th><th>Reading Type</th><th>Value</th><th>Time</th></tr></thead><tbody>${tableRows}</tbody></table></body></html>`;
}

module.exports = { name, keywords, dataType, parse, query, generateResponse };