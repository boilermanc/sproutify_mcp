// config/constants.js

const APP_INFO = {
    SERVICE_NAME: 'sproutify-ai-smart-search',
    VERSION: process.env.npm_package_version || '3.0.0-modular',
    ENVIRONMENT: process.env.NODE_ENV || 'production',
};

const FEATURES = [
    '🧠 Smart Query Parsing',
    '📦 Modular Data Handling',
    '🎯 Filtered Results',
    '🌱 Sproutify AI Branding',
    '📊 Multi-Data Source Support'
];

const DATA_SOURCES = [
    '🗼 Tower Management',
    '🐛 Pest Control Applications',
    '🔬 Nutrient Monitoring',
    '💡 Lighting Usage',
    '📡 Sensor Readings'
];

const ENDPOINTS = [
    'GET / - Health check',
    'POST /webhook/n8n - Main webhook',
    'GET /api/temp-data/:tableId - Get temp data',
    'GET /api/tower-data/:farmId - Get tower data'
];

module.exports = {
    APP_INFO,
    FEATURES,
    DATA_SOURCES,
    ENDPOINTS
};