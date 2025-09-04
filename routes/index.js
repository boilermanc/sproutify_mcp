// routes/index.js
const express = require('express');
const router = express.Router();
const apiRoutes = require('./api');

// All our routes will be prefixed with nothing for now, but you could add /api/v1 here
router.use('/', apiRoutes);

module.exports = router;