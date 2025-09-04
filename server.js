// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./routes'); // Import the main router from your new routes/index.js

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Core Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ===== MAIN ROUTES =====
// All API logic is now handled by the routes module
app.use('/', routes);

// 404 handler for unmatched routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled Server Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error. Please check the server logs.',
    error: err.message, // Add the error message for better debugging
    timestamp: new Date().toISOString()
  });
});

// ===== SERVER STARTUP (for standalone mode ONLY) =====
// This block ensures that app.listen() is only called when you run
// 'node server.js' from the command line. It will NOT run when
// 'passenger_wsgi.js' requires this file. This is critical for Passenger.
if (require.main === module) {
  const port = process.env.PORT || 3001;
  app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Sproutify AI Server running in standalone mode`);
    console.log(`🎧 Listening on port ${port}`);
    console.log(`🔗 Health check: http://localhost:${port}/`);
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, shutting down gracefully');
  process.exit(0);
});
process.on('SIGINT', () => {
  console.log('👋 SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Export the app for passenger_wsgi.js and for testing.
// This MUST be the last line.
module.exports = app;