// routes/api.js
const express = require('express');
const webhookController = require('../controllers/webhookController');
const router = express.Router();

// ===================================================================
//                        DIAGNOSTIC TEST ROUTE
// ===================================================================
// This simple route does not connect to any database or external service.
// It's used to test the fundamental connection from the web server to the Node.js app.
router.get('/test', (req, res) => {
    console.log('✅ /test route hit successfully!');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify({ 
        status: 'success', 
        message: 'Hello from the MCP server! The basic connection is working.' 
    }));
});
// ===================================================================
//                        END OF DIAGNOSTIC ROUTE
// ===================================================================


// Health check endpoint
router.get('/', webhookController.healthCheck);

// The main webhook endpoint
router.post('/webhook/n8n', webhookController.handleN8nWebhook);

// Other API endpoints
router.get('/api/tower-data/:farmId', webhookController.getTowerData);
router.get('/api/temp-data/:tableId', webhookController.getTempData);

module.exports = router;