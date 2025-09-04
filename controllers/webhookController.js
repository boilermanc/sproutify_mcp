// controllers/webhookController.js
const queryProcessor = require('../services/queryProcessor');
const supabase = require('../config/database');
// Corrected: Import all constants from the constants file.
const { APP_INFO, FEATURES, DATA_SOURCES, ENDPOINTS } = require('../config/constants'); 
const { generateMockTableHTML } = require('../utils/htmlGenerator');

/**
 * Provides a detailed health check of the server using centralized constants.
 */
exports.healthCheck = (req, res) => {
    // This health check now uses the imported constants for a single source of truth.
    res.json({
        status: 'MCP Server is running',
        service: APP_INFO.SERVICE_NAME,
        version: APP_INFO.VERSION,
        environment: APP_INFO.ENVIRONMENT,
        timestamp: new Date().toISOString(),
        passenger: typeof(PhusionPassenger) !== 'undefined',
        supabase: {
            connected: !!supabase,
            url: process.env.SUPABASE_URL ? 'configured' : 'missing'
        },
        features: FEATURES,
        dataSources: DATA_SOURCES,
        endpoints: ENDPOINTS
    });
};

/**
 * Handles the main n8n webhook, processes the user query, and returns HTML.
 */
exports.handleN8nWebhook = async (req, res, next) => {
    try {
        const { sessionId, message, chatInput, farmID, farm_id } = req.body;
        const actualFarmId = farmID || farm_id;
        const userMessage = (message || chatInput)?.toLowerCase() || '';
        const tableId = `table_${sessionId}_${Date.now()}`;

        console.log(`🎯 n8n webhook received for farm ${actualFarmId}: "${userMessage}"`);

        let result;
        if (supabase && actualFarmId) {
            // Delegate all complex logic to the queryProcessor service
            result = await queryProcessor.process(userMessage, actualFarmId);
        } else {
            // Fallback for missing requirements
            console.log(`⚠️ Missing requirements - Supabase: ${!!supabase}, FarmID: ${!!actualFarmId}`);
            result = {
                htmlContent: generateMockTableHTML(),
                metadata: {
                    title: 'Mock Data Table',
                    description: supabase ? 'No farm ID provided' : 'Supabase not available',
                    recordCount: 3,
                    dataType: 'mock'
                }
            };
        }
        
        res.json({
            success: true,
            message: 'Data retrieved successfully!',
            tableId: tableId,
            widgetCode: result.htmlContent,
            tempDataUrl: `/api/temp-data/${tableId}`,
            metadata: {
                ...result.metadata,
                farmId: actualFarmId,
                userMessage: userMessage,
                originalMessage: message || chatInput,
                createdAt: new Date().toISOString(),
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        // Pass the error to the global error handling middleware in server.js
        console.error('❌ Webhook Controller Error:', error.stack);
        next(error);
    }
};

/**
 * Provides raw tower data for a given farm.
 */
exports.getTowerData = async (req, res, next) => {
    try {
        const { farmId } = req.params;
        console.log(`📊 Direct tower data request for farm: ${farmId}`);

        if (!supabase) {
            return res.status(503).json({ success: false, error: 'Database service not available' });
        }
        
        const { data, error } = await supabase
            .from('tower_display_with_plants')
            .select('*')
            .eq('farm_id', farmId);
        
        if (error) {
            // Let the global handler deal with this as a server error
            throw new Error(`Database error: ${error.message}`);
        }
        
        res.json({
            success: true,
            farmId: farmId,
            data: data || [],
            count: data ? data.length : 0,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Tower data endpoint error:', error);
        next(error);
    }
};

/**
 * Provides mock data for temporary tables (for compatibility).
 */
exports.getTempData = (req, res) => {
    const { tableId } = req.params;
    console.log(`📊 Temp data requested for table: ${tableId}`);

    const mockData = [
        { name: 'John Doe', email: 'john@example.com', status: 'Active' },
        { name: 'Jane Smith', email: 'jane@example.com', status: 'Pending' },
        { name: 'Bob Johnson', email: 'bob@example.com', status: 'Inactive' }
    ];

    res.json({
        tableId: tableId,
        data: mockData,
        count: mockData.length,
        timestamp: new Date().toISOString()
    });
};