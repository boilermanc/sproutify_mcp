// config/database.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Check if the variables are loaded
if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase URL or Key is missing. Make sure .env file is configured.');
    // Export null so the app knows the connection failed
    module.exports = null; 
} else {
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase client initialized.');
    module.exports = supabase;
}