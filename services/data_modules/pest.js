// services/data_modules/pest.js
const supabase = require('../../config/database');

// 1. Define the module's identity
const name = 'Pest Application Data';
const keywords = ['pest', 'pesticide', 'application', 'spray', 'insecticide', 'fungicide'];
const dataType = 'pest_applications';

// 2. The 'parse' function
function parse(userMessage) {
    console.log(`🔍 Pest module parsing: "${userMessage}"`);
    
    // Convert to lowercase for case-insensitive matching
    const lowerMessage = userMessage.toLowerCase();
    
    const query = { 
        searchTerms: [], 
        productNames: [], 
        productTypes: [], 
        timeFilter: null, 
        omriFilter: null,
        showAll: false
    };
    
    // Product name patterns (case-insensitive)
    const productPatterns = [
        { pattern: /pyganic/i, match: 'Pyganic' }, 
        { pattern: /pageant/i, match: 'Pageant' },
        { pattern: /milstop/i, match: 'MilStop SP' }, 
        { pattern: /thuricide|bt/i, match: 'Thuricide (BT)' },
        { pattern: /enstar/i, match: 'Enstar II' }
    ];
    
    productPatterns.forEach(({ pattern, match }) => {
        if (pattern.test(lowerMessage)) { 
            query.productNames.push(match); 
            query.searchTerms.push(match);
            console.log(`📝 Found product: ${match}`);
        }
    });
    
    // Product type patterns
    if (/insecticide|insect/i.test(lowerMessage)) { 
        query.productTypes.push('Insecticide'); 
        query.searchTerms.push('insecticide');
        console.log(`📝 Found product type: Insecticide`);
    }
    if (/fungicide|fungus/i.test(lowerMessage)) { 
        query.productTypes.push('Fungicide'); 
        query.searchTerms.push('fungicide');
        console.log(`📝 Found product type: Fungicide`);
    }
    
    // Time filtering - be more aggressive about catching "recent" requests
    if (lowerMessage.includes('recent') || 
        lowerMessage.includes('latest') || 
        lowerMessage.includes('most recent') ||
        lowerMessage.includes('current') ||
        /last.*applications?/i.test(lowerMessage)) {
        query.timeFilter = 'recent'; 
        query.searchTerms.push('recent');
        console.log(`📅 Time filter: recent (detected from: ${lowerMessage})`);
    } else if (lowerMessage.includes('last month') || lowerMessage.includes('past month')) { 
        query.timeFilter = 'last_month'; 
        query.searchTerms.push('last month');
        console.log(`📅 Time filter: last month`);
    } else if (lowerMessage.includes('last week') || lowerMessage.includes('past week')) { 
        query.timeFilter = 'last_week'; 
        query.searchTerms.push('last week');
        console.log(`📅 Time filter: last week`);
    } else if (lowerMessage.includes('this year') || lowerMessage.includes('current year')) { 
        query.timeFilter = 'this_year'; 
        query.searchTerms.push('this year');
        console.log(`📅 Time filter: this year`);
    } else if (lowerMessage.includes('all') || lowerMessage.includes('show all')) {
        query.showAll = true;
        query.searchTerms.push('all');
        console.log(`📅 Show all records`);
    }
    
    // OMRI/Organic filtering
    if (lowerMessage.includes('omri') || lowerMessage.includes('organic') || lowerMessage.includes('certified')) { 
        query.omriFilter = true; 
        query.searchTerms.push('OMRI certified');
        console.log(`🌱 OMRI filter enabled`);
    }
    
    console.log(`📋 Final parsed query:`, JSON.stringify(query, null, 2));
    return query;
}

// 3. Updated query function using the correct view
async function query(farmId, queryParams) {
    console.log(`🔍 Pest module querying farmId: ${farmId}`);
    console.log(`📋 Query params:`, JSON.stringify(queryParams, null, 2));
    
    try {
        // Use the correct view: pest_recent_applications
        let supabaseQuery = supabase
            .from('pest_recent_applications')
            .select('*')
            .eq('farm_id', farmId);
        
        console.log(`🏢 Base query: SELECT * FROM pest_recent_applications WHERE farm_id = ${farmId}`);
        
        // Product filtering
        if (queryParams.productNames.length > 0) {
            supabaseQuery = supabaseQuery.ilike('product_name', `%${queryParams.productNames[0]}%`);
            console.log(`🔍 Added product name filter: ${queryParams.productNames[0]}`);
        } else if (queryParams.productTypes.length > 0) {
            supabaseQuery = supabaseQuery.ilike('product_type', `%${queryParams.productTypes[0]}%`);
            console.log(`🔍 Added product type filter: ${queryParams.productTypes[0]}`);
        }
        
        // Time filtering
        if (queryParams.timeFilter && !queryParams.showAll) {
            const now = new Date(); 
            let startDate;
            
            if (queryParams.timeFilter === 'last_month') {
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            } else if (queryParams.timeFilter === 'last_week') {
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            } else if (queryParams.timeFilter === 'this_year') {
                startDate = new Date(now.getFullYear(), 0, 1);
            } else if (queryParams.timeFilter === 'recent') {
                // For "recent", go back 90 days to catch more data
                startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            }
            
            if (startDate) {
                const dateStr = startDate.toISOString().split('T')[0];
                console.log(`📅 Filtering for dates >= ${dateStr} OR NULL dates`);
                
                // Include both recent dates AND NULL dates using OR syntax
                supabaseQuery = supabaseQuery.or(`application_date.gte.${dateStr},application_date.is.null`);
            }
        }
        
        // OMRI filtering
        if (queryParams.omriFilter) {
            supabaseQuery = supabaseQuery.eq('omri_certified', true);
            console.log(`🌱 Added OMRI filter: omri_certified = true`);
        }
        
        const result = await supabaseQuery.order('application_date', { ascending: false, nullsLast: true });
        
        console.log(`📊 Query executed. Found ${result.data ? result.data.length : 0} records`);
        if (result.error) {
            console.error(`❌ Supabase error:`, result.error);
        }
        
        // Enhanced debugging when no data is found
        if (!result.data || result.data.length === 0) {
            console.log(`🔍 No data found with current filters, running diagnostic queries...`);
            
            // Check total records for this farm in the correct view
            const totalResult = await supabase
                .from('pest_recent_applications')
                .select('product_name, application_date, omri_certified, product_type')
                .eq('farm_id', farmId);
            
            console.log(`📊 Total records for farm ${farmId} in pest_recent_applications:`, totalResult.data?.length || 0);
            if (totalResult.data && totalResult.data.length > 0) {
                console.log(`📋 All records for this farm:`, totalResult.data);
                
                // Count records with and without dates
                const withDates = totalResult.data.filter(r => r.application_date).length;
                const withoutDates = totalResult.data.filter(r => !r.application_date).length;
                console.log(`📅 Records with dates: ${withDates}, without dates: ${withoutDates}`);
                
                // Show date range
                const dates = totalResult.data
                    .filter(r => r.application_date)
                    .map(r => r.application_date)
                    .sort();
                if (dates.length > 0) {
                    console.log(`📅 Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
                }
            }
            
            // Also check if the old view has data (for comparison)
            const oldViewResult = await supabase
                .from('pest_control_products_recent_applications')
                .select('count(*)')
                .eq('farm_id', farmId);
            console.log(`📊 Records in old view (pest_control_products_recent_applications):`, oldViewResult.data?.[0]?.count || 0);
        }
        
        return result;
        
    } catch (error) {
        console.error(`❌ Exception in pest query:`, error);
        return { data: null, error: error };
    }
}

// 4. The 'generateResponse' function
function generateResponse(data, queryParams) {
    console.log(`📝 Generating response for ${data.length} pest application records`);
    
    const htmlContent = generatePestApplicationHTML(data, queryParams);
    
    const metadata = {
        title: `Pest Applications - Farm Data`,
        description: `${data.length} applications found matching criteria.`, 
        recordCount: data.length,
        searchQuery: queryParams, 
        dataType: dataType,
    };
    return { htmlContent, metadata };
}

// 5. Helper function to generate the HTML with print button
function generatePestApplicationHTML(pestData, query = {}) {
    const currentDate = new Date().toLocaleString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric', 
        hour: 'numeric', minute: '2-digit', hour12: true 
    });
    
    let reportTitle = 'Pest Control Application Report';
    if (query.searchTerms && query.searchTerms.length > 0) {
        reportTitle = `Pest Applications: ${query.searchTerms.join(', ')}`;
    }
    
    let tableRows = '';
    if (pestData && pestData.length > 0) {
        pestData.forEach(app => {
            const applicationDate = app.application_date ? 
                new Date(app.application_date).toLocaleDateString('en-US') : 
                '<em style="color:#999">No date recorded</em>';
            
            const treatmentArea = app.treatment_area || '-';
            const applicatorName = app.applicator_name || '-';
            const productType = app.product_type || '-';
            const doseInfo = app.dose_amount && app.dose_unit ? 
                `${app.dose_amount} ${app.dose_unit}` : '-';
            
            tableRows += `<tr>
                <td><strong>${app.product_name || 'Unknown Product'}</strong></td>
                <td><span class="product-type ${productType.toLowerCase()}">${productType}</span></td>
                <td>${applicationDate}</td>
                <td>${treatmentArea}</td>
                <td>${doseInfo}</td>
                <td>${applicatorName}</td>
                <td><span class="omri-badge ${app.omri_certified ? 'certified' : 'not-certified'}">${app.omri_certified ? 'Yes' : 'No'}</span></td>
            </tr>`;
        });
    }
    
    return `<!DOCTYPE html>
<html>
<head>
    <title>${reportTitle}</title>
    <style>
        body{font-family:Arial,sans-serif;margin:20px;font-size:12px;background:#f8f9fa}
        .container{background:white;padding:20px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1)}
        
        /* Header with print button */
        .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px}
        h1{font-size:18px;color:#2c5530;margin:0}
        .print-button{background:#2c5530;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:bold}
        .print-button:hover{background:#1e3d21}
        .print-button:active{background:#0f1f11}
        
        .info{color:#666;font-size:10px;margin-bottom:15px}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #ddd;padding:10px;text-align:left}
        th{background-color:#2c5530;color:white;font-weight:bold}
        tr:nth-child(even){background-color:#f9f9f9}
        .product-type{padding:3px 8px;border-radius:12px;font-size:10px;font-weight:bold}
        .product-type.insecticide{background:#ffebee;color:#c62828}
        .product-type.fungicide{background:#e8f5e9;color:#2e7d32}
        .omri-badge{padding:2px 6px;border-radius:10px;font-size:9px;font-weight:bold}
        .omri-badge.certified{background:#4caf50;color:white}
        .omri-badge.not-certified{background:#f44336;color:white}
        em{color:#999}
        .no-data{text-align:center;padding:40px;color:#666;font-style:italic}
        
        /* Print styles */
        @media print {
            body{background:white;margin:0}
            .container{box-shadow:none;border-radius:0;padding:10px}
            .print-button{display:none !important}
            .header{display:block}
            h1{font-size:16px;margin-bottom:10px}
            .info{margin-bottom:10px}
            th{background:#f0f0f0 !important;color:#333 !important}
            .product-type.insecticide{background:#f5f5f5 !important;color:#333 !important}
            .product-type.fungicide{background:#f5f5f5 !important;color:#333 !important}
            .omri-badge{background:#f0f0f0 !important;color:#333 !important;border:1px solid #ddd}
            table{font-size:10px}
            th,td{padding:6px}
        }
        
        @media screen and (max-width: 768px) {
            .header{flex-direction:column;align-items:stretch}
            .print-button{margin-top:10px}
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
        <div class="info">Generated on ${currentDate}</div>
        ${pestData.length > 0 ? `
        <table>
            <thead>
                <tr>
                    <th>Product Name</th>
                    <th>Type</th>
                    <th>Application Date</th>
                    <th>Treatment Area</th>
                    <th>Dose</th>
                    <th>Applicator</th>
                    <th>OMRI Certified</th>
                </tr>
            </thead>
            <tbody>${tableRows}</tbody>
        </table>
        ` : `
        <div class="no-data">
            <h3>No pest applications found</h3>
            <p>No pest control applications found for this farm matching the specified criteria.</p>
            <p><strong>Farm ID:</strong> Using current farm configuration</p>
            <p><strong>Query:</strong> ${JSON.stringify(query.searchTerms || [], null, 2)}</p>
        </div>
        `}
    </div>
</body>
</html>`;
}

// 6. Export the standard module interface
module.exports = { name, keywords, dataType, parse, query, generateResponse };