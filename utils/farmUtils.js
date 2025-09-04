// utils/farmUtils.js
const supabase = require('../config/database');

// Cache for farm names to avoid repeated database calls
const farmNameCache = new Map();

/**
 * Gets the farm name for a given farm ID
 * @param {number} farmId - The farm ID to lookup
 * @returns {Promise<string>} The farm name or fallback
 */
async function getFarmName(farmId) {
    try {
        // Check cache first
        if (farmNameCache.has(farmId)) {
            return farmNameCache.get(farmId);
        }

        // Query database for farm name
        const { data, error } = await supabase
            .from('farms')
            .select('farm_name')
            .eq('id', farmId)
            .single();

        if (error || !data) {
            console.warn(`Could not find farm name for ID ${farmId}:`, error?.message);
            const fallback = `Farm ${farmId}`;
            farmNameCache.set(farmId, fallback);
            return fallback;
        }

        const farmName = data.farm_name || `Farm ${farmId}`;
        
        // Cache the result
        farmNameCache.set(farmId, farmName);
        
        return farmName;
    } catch (error) {
        console.error('Error getting farm name:', error);
        return `Farm ${farmId}`;
    }
}

/**
 * Enhances data records with farm names
 * @param {object[]} data - Array of data records with farm_id
 * @param {number} farmId - The farm ID to use for lookup
 * @returns {Promise<object[]>} Data records with farm_name added
 */
async function enhanceWithFarmName(data, farmId) {
    if (!data || data.length === 0) {
        return data;
    }

    const farmName = await getFarmName(farmId);
    
    // Add farm_name to each record
    return data.map(record => ({
        ...record,
        farm_name: farmName
    }));
}

/**
 * Clears the farm name cache (useful for testing or if farm names change)
 */
function clearFarmNameCache() {
    farmNameCache.clear();
}

module.exports = {
    getFarmName,
    enhanceWithFarmName,
    clearFarmNameCache
};