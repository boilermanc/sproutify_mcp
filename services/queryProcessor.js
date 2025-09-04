// services/queryProcessor.js
const fs = require('fs');
const path = require('path');
const { generateNoDataHTML } = require('../utils/htmlGenerator');

// Dynamically load all data modules from the data_modules directory
const modules = {};
const modulesDir = path.join(__dirname, 'data_modules');
console.log(`📁 Loading modules from: ${modulesDir}`);

try {
    const files = fs.readdirSync(modulesDir);
    console.log(`📂 Files found in directory: ${files.join(', ')}`);
    
    files.forEach(file => {
        if (file.endsWith('.js') && !file.startsWith('_')) {
            const moduleName = path.parse(file).name;
            try {
                const modulePath = path.join(modulesDir, file);
                console.log(`📦 Attempting to load: ${modulePath}`);
                
                modules[moduleName] = require(modulePath);
                
                // Validate the module has required properties
                const module = modules[moduleName];
                const requiredProps = ['name', 'keywords', 'dataType', 'parse', 'query', 'generateResponse'];
                const missingProps = requiredProps.filter(prop => !module[prop]);
                
                if (missingProps.length > 0) {
                    console.error(`⚠️  Module [${moduleName}] missing properties: ${missingProps.join(', ')}`);
                } else {
                    console.log(`✅ Loaded module: ${moduleName} (${module.name}) with keywords: ${module.keywords.join(', ')}`);
                }
            } catch (moduleError) {
                console.error(`❌ Failed to load module [${moduleName}]:`, moduleError.message);
                console.error(`❌ Stack trace:`, moduleError.stack);
            }
        } else {
            console.log(`⏭️  Skipping file: ${file}`);
        }
    });
    console.log(`📦 Total modules loaded successfully: ${Object.keys(modules).length}`);
    console.log(`📦 Module names: ${Object.keys(modules).join(', ')}`);
} catch (error) {
    console.error('❌ FATAL: Could not read data modules directory:', error);
}

// Define the order of checking. More specific keywords should come first.
const moduleCheckOrder = [
    'pendingDeliveries',      // "pending deliveries"
    'availableHarvest',       // "available harvest"
    'harvestPerformance',     // "harvest performance"
    'customerDeliveries',     // "customer deliveries"
    'dailyOperations',        // "daily operations", "what happened today"
    'inventoryAging',         // "inventory aging", "waste risk"
    'allocationEfficiency',   // "allocation efficiency"
    'summaryStats',           // "summary stats", "today's numbers"
	'tasks',
	'spacer',
    'pest',                   // Original modules
    'monitoring',
    'lighting',
    'sensor'
    // 'tower' is intentionally left out, as it's the final fallback.
];

console.log(`🔄 Module check order: ${moduleCheckOrder.join(', ')}`);

/**
 * Processes a user query by selecting the appropriate data module,
 * querying the database, and generating a response.
 */
async function process(userMessage, farmId) {
    console.log(`\n🚀 ======= QUERY PROCESSOR STARTING =======`);
    console.log(`📝 User query: "${userMessage}"`);
    console.log(`🏢 Farm ID: ${farmId} (type: ${typeof farmId})`);
    console.log(`📦 Available modules: ${Object.keys(modules).join(', ')}`);
    
    // Convert user message to lowercase for case-insensitive matching
    const lowerUserMessage = userMessage.toLowerCase();
    console.log(`🔤 Lowercase query: "${lowerUserMessage}"`);
    
    // Start with the tower module as the default.
    let targetModule = null;
    let matchedKeywords = [];
    let moduleSelectionLog = [];

    // Check for more specific modules from our priority list.
    console.log(`🔍 ======= MODULE SELECTION PROCESS =======`);
    
    for (let i = 0; i < moduleCheckOrder.length; i++) {
        const moduleName = moduleCheckOrder[i];
        const mod = modules[moduleName];
        
        console.log(`${i + 1}. Checking module: [${moduleName}]`);
        
        if (!mod) {
            const logEntry = `   ❌ Module [${moduleName}] not found in loaded modules`;
            console.log(logEntry);
            moduleSelectionLog.push(logEntry);
            continue;
        }
        
        if (!mod.keywords || !Array.isArray(mod.keywords)) {
            const logEntry = `   ⚠️  Module [${moduleName}] has no keywords defined or keywords is not an array`;
            console.log(logEntry);
            moduleSelectionLog.push(logEntry);
            continue;
        }
        
        console.log(`   📋 Module [${moduleName}] keywords: [${mod.keywords.join(', ')}]`);
        
        // Check if any keywords match (case-insensitive)
        const matchingKeywords = [];
        mod.keywords.forEach(keyword => {
            const lowerKeyword = keyword.toLowerCase();
            if (lowerUserMessage.includes(lowerKeyword)) {
                matchingKeywords.push(keyword);
                console.log(`   ✅ MATCH found: "${keyword}" in "${userMessage}"`);
            } else {
                console.log(`   ❌ No match: "${keyword}" not in "${lowerUserMessage}"`);
            }
        });
        
        if (matchingKeywords.length > 0) {
            targetModule = mod;
            matchedKeywords = matchingKeywords;
            const logEntry = `   🎯 SELECTED MODULE: [${mod.name}] for keywords: [${matchingKeywords.join(', ')}]`;
            console.log(logEntry);
            moduleSelectionLog.push(logEntry);
            break; // Found the best match, stop searching.
        } else {
            const logEntry = `   ⏭️  No keywords matched for [${moduleName}]`;
            console.log(logEntry);
            moduleSelectionLog.push(logEntry);
        }
    }
    
    // If no specific module found, use tower as fallback
    if (!targetModule) {
        targetModule = modules.tower;
        const logEntry = `🏗️  No specific module matched, using fallback: [${targetModule?.name || 'tower'}]`;
        console.log(logEntry);
        moduleSelectionLog.push(logEntry);
    }
    
    // Safety check: If for some reason even the tower module failed to load.
    if (!targetModule) {
        console.error("❌ FATAL: No suitable module available, including tower fallback.");
        const errorMsg = "No data modules available. Please check server configuration.";
        throw new Error(errorMsg);
    }

    console.log(`🔍 ======= MODULE SELECTION SUMMARY =======`);
    moduleSelectionLog.forEach(log => console.log(log));
    console.log(`🧠 FINAL SELECTION: [${targetModule.name}]`);
    console.log(`🔍 Original query: "${userMessage}"`);
    console.log(`🏷️  Matched keywords: [${matchedKeywords.join(', ') || 'none - using fallback'}]`);

    try {
        // 1. Parse the user's message using the selected module's parser.
        console.log(`\n📋 ======= PARSING PHASE =======`);
        console.log(`📋 Parsing query with [${targetModule.name}] module...`);
        
        const queryParams = targetModule.parse(userMessage);
        console.log(`📋 Parsed query params:`, JSON.stringify(queryParams, null, 2));

        // 2. Execute the database query using the selected module's query function.
        console.log(`\n🔍 ======= QUERY EXECUTION PHASE =======`);
        console.log(`🔍 Executing database query with [${targetModule.name}]...`);
        console.log(`🏢 Using farm ID: ${farmId}`);
        
        const startTime = Date.now();
        const result = await targetModule.query(farmId, queryParams);
        const queryTime = Date.now() - startTime;
        
        console.log(`⏱️  Query completed in ${queryTime}ms`);
        console.log(`📊 Raw result structure:`, {
            hasData: !!result.data,
            dataLength: result.data ? result.data.length : 'null',
            hasError: !!result.error,
            errorMessage: result.error ? result.error.message : 'none'
        });
        
        const { data, error } = result;
        
        if (error) {
            console.error(`❌ DB Error in [${targetModule.name}] module:`, {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint
            });
            throw new Error(`Database error in ${targetModule.name}: ${error.message}`);
        }

        // 3. Generate HTML and metadata.
        console.log(`\n📝 ======= RESPONSE GENERATION PHASE =======`);
        
        if (!data || data.length === 0) {
            console.log(`⚠️  No data found for query - generating no-data response`);
            console.log(`📊 Data is: ${data === null ? 'null' : data === undefined ? 'undefined' : `empty array (length: ${data.length})`}`);
            
            // If no data, use the generic "no data" HTML generator.
            const response = {
                htmlContent: generateNoDataHTML(targetModule.name, queryParams),
                metadata: {
                    title: `No ${targetModule.name} Found`,
                    description: `No data found for the specified criteria.`,
                    recordCount: 0,
                    searchQuery: queryParams,
                    dataType: targetModule.dataType,
                    farmId: farmId,
                    queryTime: queryTime,
                    moduleSelection: moduleSelectionLog,
                    matchedKeywords: matchedKeywords
                }
            };
            
            console.log(`📝 No-data response generated`);
            return response;
        } else {
            console.log(`✅ Generating response with ${data.length} records`);
            console.log(`📊 Sample record keys:`, data[0] ? Object.keys(data[0]).slice(0, 5).join(', ') + '...' : 'none');
            
            // If data exists, let the module generate its specific response.
            const response = targetModule.generateResponse(data, queryParams);
            
            // Add some metadata
            if (response.metadata) {
                response.metadata.farmId = farmId;
                response.metadata.queryTime = queryTime;
                response.metadata.matchedKeywords = matchedKeywords;
                response.metadata.moduleSelection = moduleSelectionLog;
            }
            
            console.log(`🎉 Successfully generated response: "${response.metadata?.title || 'Unknown'}"`);
            return response;
        }
        
    } catch (error) {
        console.error(`\n❌ ======= ERROR IN QUERY PROCESSING =======`);
        console.error(`❌ Error details:`, {
            message: error.message,
            name: error.name,
            stack: error.stack?.split('\n').slice(0, 5).join('\n') + '...'
        });
        
        // Return user-friendly error response
        console.error(`❌ Full error details logged above for debugging`);
        
        return {
            htmlContent: `
                <html>
                <head>
                    <title>Sproutify AI - Temporary Issue</title>
                    <style>
                        body{font-family:Arial,sans-serif;margin:20px;background:#f8f9fa}
                        .container{background:white;padding:40px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);max-width:500px;margin:0 auto;text-align:center}
                        h1{color:#6A5ACD;font-size:20px;margin-bottom:20px}
                        .icon{font-size:48px;margin-bottom:20px}
                        .message{color:#666;font-size:14px;line-height:1.6;margin-bottom:30px}
                        .suggestions{background:#f0e6ff;padding:20px;border-radius:6px;text-align:left;margin-bottom:20px}
                        .suggestions h3{color:#6A5ACD;font-size:16px;margin-bottom:10px}
                        .suggestions ul{margin:0;padding-left:20px}
                        .suggestions li{margin-bottom:8px;color:#555}
                        .footer{color:#999;font-size:12px;border-top:1px solid #eee;padding-top:15px}
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="icon">🌱</div>
                        <h1>Hmm, we encountered a small hiccup</h1>
                        <div class="message">
                            I'm having trouble accessing your <strong>${targetModule.name.toLowerCase()}</strong> right now. 
                            This might be a temporary issue with the data connection.
                        </div>
                        <div class="suggestions">
                            <h3>Here's what you can try:</h3>
                            <ul>
                                <li>Try asking for a different type of report (towers, deliveries, etc.)</li>
                                <li>Refresh and try your query again in a moment</li>
                                <li>Try rephrasing your question</li>
                                <li>Ask for a different farm data type</li>
                            </ul>
                        </div>
                        <div class="footer">
                            <div><strong>Sproutify AI</strong> • Your intelligent farm assistant</div>
                            <div style="margin-top:8px;">The technical team has been notified of this issue</div>
                        </div>
                    </div>
                </body>
                </html>
            `,
            metadata: {
                title: 'Temporary Data Issue',
                description: `Unable to access ${targetModule.name.toLowerCase()} at this time`,
                recordCount: 0,
                error: true,
                errorType: 'user_friendly',
                farmId: farmId,
                moduleUsed: targetModule.name
            }
        };
    } finally {
        console.log(`\n🏁 ======= QUERY PROCESSOR FINISHED =======\n`);
    }
}

module.exports = { process };