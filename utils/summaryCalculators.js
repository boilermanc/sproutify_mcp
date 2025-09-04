// utils/summaryCalculators.js
// This file contains utility functions to calculate summary statistics for different data types.
// Each function is designed to be robust, handling potential missing data gracefully.

/**
 * Calculates summary statistics for tower data.
 * @param {object[]} towerData - An array of tower data objects from Supabase.
 * @returns {{growing: number, clean: number, available: number, maintenance: number}} An object with summary counts.
 */
function calculateTowerSummary(towerData) {
  try {
    if (!Array.isArray(towerData)) return { growing: 0, clean: 0, available: 0, maintenance: 0 };

    return {
      growing: towerData.filter(t => t.tower_status && t.tower_status.toLowerCase() === 'growing').length,
      clean: towerData.filter(t => t.tower_status && t.tower_status.toLowerCase() === 'clean').length,
      available: towerData.filter(t => t.tower_status && t.tower_status.toLowerCase().includes('available')).length,
      maintenance: towerData.filter(t => t.has_maintenance).length
    };
  } catch (error) {
    console.error('Error calculating tower summary:', error);
    return { growing: 0, clean: 0, available: 0, maintenance: 0 };
  }
}

/**
 * Calculates summary statistics for pest application data.
 * @param {object[]} pestData - An array of pest application data objects.
 * @returns {{organic: number, biological: number, chemical: number, omriCertified: number}} An object with summary counts.
 */
function calculatePestSummary(pestData) {
  try {
    if (!Array.isArray(pestData)) return { organic: 0, biological: 0, chemical: 0, omriCertified: 0 };
    
    return {
      organic: pestData.filter(p => p.product_type && p.product_type.toLowerCase().includes('organic')).length,
      biological: pestData.filter(p => p.product_type && p.product_type.toLowerCase().includes('biological')).length,
      chemical: pestData.filter(p => p.product_type && p.product_type.toLowerCase().includes('chemical')).length,
      omriCertified: pestData.filter(p => p.omri_certified).length
    };
  } catch (error) {
    console.error('Error calculating pest summary:', error);
    return { organic: 0, biological: 0, chemical: 0, omriCertified: 0 };
  }
}

/**
 * Calculates summary statistics for nutrient monitoring data.
 * @param {object[]} monitoringData - An array of monitoring data objects.
 * @returns {{needsAttention: number, goodStatus: number, neverRead: number}} An object with summary counts.
 */
function calculateMonitoringSummary(monitoringData) {
  try {
    if (!Array.isArray(monitoringData)) return { needsAttention: 0, goodStatus: 0, neverRead: 0 };
    
    return {
      needsAttention: monitoringData.filter(m => m.needs_attention).length,
      goodStatus: monitoringData.filter(m => !m.needs_attention).length,
      neverRead: monitoringData.filter(m => !m.read_at).length // Assumes 'read_at' is the field for read timestamp
    };
  } catch (error) {
    console.error('Error calculating monitoring summary:', error);
    return { needsAttention: 0, goodStatus: 0, neverRead: 0 };
  }
}

/**
 * Calculates summary statistics for lighting usage data.
 * @param {object[]} lightingData - An array of lighting data objects.
 * @returns {{totalHours: string, totalEnergy: string, totalCost: string, avgZones: string}} An object with formatted summary strings.
 */
function calculateLightingSummary(lightingData) {
  try {
    if (!Array.isArray(lightingData) || lightingData.length === 0) {
        return { totalHours: '0.0', totalEnergy: '0.00', totalCost: '0.00', avgZones: '0.0' };
    }
    
    const totalHours = lightingData.reduce((sum, l) => sum + (l.total_usage_hours || 0), 0);
    const totalEnergy = lightingData.reduce((sum, l) => sum + (l.total_energy_used_kwh || 0), 0);
    const totalCost = lightingData.reduce((sum, l) => sum + (l.total_cost || 0), 0);
    const avgZones = (lightingData.reduce((sum, l) => sum + (l.zones_active || 0), 0) / lightingData.length);

    return {
      totalHours: totalHours.toFixed(1),
      totalEnergy: totalEnergy.toFixed(2),
      totalCost: totalCost.toFixed(2),
      avgZones: avgZones.toFixed(1)
    };
  } catch (error) {
    console.error('Error calculating lighting summary:', error);
    return { totalHours: '0.0', totalEnergy: '0.00', totalCost: '0.00', avgZones: '0.0' };
  }
}

/**
 * Calculates summary statistics for sensor reading data.
 * @param {object[]} sensorData - An array of sensor data objects, assumed to be sorted by time descending.
 * @returns {{uniqueSensors: number, readingTypes: number, latestReading: string}} An object with summary counts.
 */
function calculateSensorSummary(sensorData) {
  try {
    if (!Array.isArray(sensorData)) return { uniqueSensors: 0, readingTypes: 0, latestReading: 'No readings' };

    const uniqueSensors = new Set(sensorData.map(s => s.sensor_name)).size;
    const readingTypes = new Set(sensorData.map(s => s.reading_type)).size;
    
    // Assumes the data is pre-sorted with the latest reading at index 0
    const latestReading = sensorData.length > 0 && sensorData[0].time 
      ? new Date(sensorData[0].time).toLocaleTimeString('en-US') 
      : 'No readings';

    return {
      uniqueSensors: uniqueSensors,
      readingTypes: readingTypes,
      latestReading: latestReading
    };
  } catch (error) {
    console.error('Error calculating sensor summary:', error);
    return { uniqueSensors: 0, readingTypes: 0, latestReading: 'Error' };
  }
}

/**
 * Calculates summary statistics for spacer inventory data.
 * @param {object[]} spacerData - An array of spacer inventory data objects.
 * @returns {{ready: number, growing: number, available: number, totalQuantity: number, totalTrays: number}} An object with summary counts.
 */
function calculateSpacerSummary(spacerData) {
  try {
    if (!Array.isArray(spacerData) || spacerData.length === 0) {
      return {
        ready: 0,
        growing: 0,
        available: 0,
        totalQuantity: 0,
        totalTrays: 0
      };
    }

    const summary = {
      ready: 0,
      growing: 0,
      available: 0,
      totalQuantity: 0,
      totalTrays: spacerData.length
    };

    spacerData.forEach(spacer => {
      const status = spacer.status?.toLowerCase();
      const quantity = parseInt(spacer.quantity) || 0;
      
      summary.totalQuantity += quantity;
      
      if (status === 'ready') {
        summary.ready += quantity;
      } else if (status === 'growing') {
        summary.growing += quantity;
      } else if (status === 'available') {
        summary.available += quantity;
      }
    });

    return summary;
  } catch (error) {
    console.error('Error calculating spacer summary:', error);
    return {
      ready: 0,
      growing: 0,
      available: 0,
      totalQuantity: 0,
      totalTrays: 0
    };
  }
}

/**
 * Calculates summary statistics for pending deliveries data.
 * @param {object[]} pendingData - An array of pending delivery data objects.
 * @returns {{totalDeliveries: number, urgentDeliveries: number, overdueDeliveries: number, wholesaleCustomers: number, consumerCustomers: number}} An object with summary counts.
 */
function calculatePendingDeliveriesSummary(pendingData) {
  try {
    if (!Array.isArray(pendingData) || pendingData.length === 0) {
      return {
        totalDeliveries: 0,
        urgentDeliveries: 0,
        overdueDeliveries: 0,
        wholesaleCustomers: 0,
        consumerCustomers: 0
      };
    }

    const summary = {
      totalDeliveries: pendingData.length,
      urgentDeliveries: 0,
      overdueDeliveries: 0,
      wholesaleCustomers: 0,
      consumerCustomers: 0
    };

    const today = new Date();
    const uniqueCustomers = new Set();

    pendingData.forEach(delivery => {
      // Count urgent deliveries
      if (delivery.delivery_urgency?.toLowerCase() === 'urgent') {
        summary.urgentDeliveries++;
      }

      // Count overdue deliveries
      if (delivery.expected_delivery_date) {
        const expectedDate = new Date(delivery.expected_delivery_date);
        if (expectedDate < today) {
          summary.overdueDeliveries++;
        }
      }

      // Count unique customers by type
      const customerKey = `${delivery.customer_name}_${delivery.customer_type}`;
      if (!uniqueCustomers.has(customerKey)) {
        uniqueCustomers.add(customerKey);
        const customerType = delivery.customer_type?.toLowerCase();
        if (customerType?.includes('wholesale') || customerType?.includes('retailer')) {
          summary.wholesaleCustomers++;
        } else if (customerType?.includes('consumer') || customerType?.includes('direct')) {
          summary.consumerCustomers++;
        }
      }
    });

    return summary;
  } catch (error) {
    console.error('Error calculating pending deliveries summary:', error);
    return {
      totalDeliveries: 0,
      urgentDeliveries: 0,
      overdueDeliveries: 0,
      wholesaleCustomers: 0,
      consumerCustomers: 0
    };
  }
}

/**
 * Calculates summary statistics for inventory aging data.
 * @param {object[]} agingData - An array of inventory aging data objects.
 * @returns {{totalItems: number, totalQuantity: number, highRisk: number, mediumRisk: number, lowRisk: number}} An object with summary counts.
 */
function calculateInventoryAgingSummary(agingData) {
  try {
    if (!Array.isArray(agingData) || agingData.length === 0) {
      return {
        totalItems: 0,
        totalQuantity: 0,
        highRisk: 0,
        mediumRisk: 0,
        lowRisk: 0
      };
    }

    const summary = {
      totalItems: agingData.length,
      totalQuantity: 0,
      highRisk: 0,
      mediumRisk: 0,
      lowRisk: 0
    };

    agingData.forEach(item => {
      const quantity = parseInt(item.available_quantity) || 0;
      summary.totalQuantity += quantity;

      const riskLevel = item.waste_risk_level?.toLowerCase();
      if (riskLevel?.includes('high')) {
        summary.highRisk += quantity;
      } else if (riskLevel?.includes('medium')) {
        summary.mediumRisk += quantity;
      } else if (riskLevel?.includes('low')) {
        summary.lowRisk += quantity;
      }
    });

    return summary;
  } catch (error) {
    console.error('Error calculating inventory aging summary:', error);
    return {
      totalItems: 0,
      totalQuantity: 0,
      highRisk: 0,
      mediumRisk: 0,
      lowRisk: 0
    };
  }
}

/**
 * Calculates summary statistics for harvest performance data.
 * @param {object[]} harvestData - An array of harvest performance data objects.
 * @returns {{totalHarvested: number, avgDeliveryRate: string, avgWasteRate: string, weeksReported: number}} An object with summary statistics.
 */
function calculateHarvestPerformanceSummary(harvestData) {
  try {
    if (!Array.isArray(harvestData) || harvestData.length === 0) {
      return {
        totalHarvested: 0,
        avgDeliveryRate: '0.0',
        avgWasteRate: '0.0',
        weeksReported: 0
      };
    }

    const summary = {
      totalHarvested: 0,
      avgDeliveryRate: '0.0',
      avgWasteRate: '0.0',
      weeksReported: harvestData.length
    };

    let totalDeliveryRate = 0;
    let totalWasteRate = 0;

    harvestData.forEach(item => {
      const harvested = parseInt(item.total_harvested) || 0;
      const deliveryRate = parseFloat(item.delivery_rate_percent) || 0;
      const wasteRate = parseFloat(item.waste_rate_percent) || 0;

      summary.totalHarvested += harvested;
      totalDeliveryRate += deliveryRate;
      totalWasteRate += wasteRate;
    });

    summary.avgDeliveryRate = (totalDeliveryRate / harvestData.length).toFixed(1);
    summary.avgWasteRate = (totalWasteRate / harvestData.length).toFixed(1);

    return summary;
  } catch (error) {
    console.error('Error calculating harvest performance summary:', error);
    return {
      totalHarvested: 0,
      avgDeliveryRate: '0.0',
      avgWasteRate: '0.0',
      weeksReported: 0
    };
  }
}

/**
 * Calculates summary statistics for daily operations data.
 * @param {object[]} dailyData - An array of daily operations data objects.
 * @returns {{totalDays: number, totalHarvests: number, totalHarvested: number, totalAllocations: number, totalDeliveries: number, avgSameDayRate: string}} An object with summary statistics.
 */
function calculateDailyOperationsSummary(dailyData) {
  try {
    if (!Array.isArray(dailyData) || dailyData.length === 0) {
      return {
        totalDays: 0,
        totalHarvests: 0,
        totalHarvested: 0,
        totalAllocations: 0,
        totalDeliveries: 0,
        avgSameDayRate: '0.0'
      };
    }

    const summary = {
      totalDays: dailyData.length,
      totalHarvests: 0,
      totalHarvested: 0,
      totalAllocations: 0,
      totalDeliveries: 0,
      avgSameDayRate: '0.0'
    };

    let totalSameDayRate = 0;

    dailyData.forEach(item => {
      summary.totalHarvests += parseInt(item.harvest_batches) || 0;
      summary.totalHarvested += parseInt(item.total_harvested) || 0;
      summary.totalAllocations += parseInt(item.allocations_made) || 0;
      summary.totalDeliveries += parseInt(item.deliveries_completed) || 0;
      totalSameDayRate += parseFloat(item.same_day_delivery_rate) || 0;
    });

    summary.avgSameDayRate = (totalSameDayRate / dailyData.length).toFixed(1);

    return summary;
  } catch (error) {
    console.error('Error calculating daily operations summary:', error);
    return {
      totalDays: 0,
      totalHarvests: 0,
      totalHarvested: 0,
      totalAllocations: 0,
      totalDeliveries: 0,
      avgSameDayRate: '0.0'
    };
  }
}

/**
 * Calculates summary statistics for customer deliveries data.
 * @param {object[]} customerData - An array of customer delivery data objects.
 * @returns {{totalCustomers: number, totalCompleted: number, totalPending: number, totalQuantityDelivered: number, avgCompletionRate: string, wholesaleCustomers: number, consumerCustomers: number}} An object with summary statistics.
 */
function calculateCustomerDeliveriesSummary(customerData) {
  try {
    if (!Array.isArray(customerData) || customerData.length === 0) {
      return {
        totalCustomers: 0,
        totalCompleted: 0,
        totalPending: 0,
        totalQuantityDelivered: 0,
        avgCompletionRate: '0.0',
        wholesaleCustomers: 0,
        consumerCustomers: 0
      };
    }

    const summary = {
      totalCustomers: customerData.length,
      totalCompleted: 0,
      totalPending: 0,
      totalQuantityDelivered: 0,
      avgCompletionRate: '0.0',
      wholesaleCustomers: 0,
      consumerCustomers: 0
    };

    let totalCompletionRate = 0;

    customerData.forEach(customer => {
      summary.totalCompleted += parseInt(customer.completed_deliveries) || 0;
      summary.totalPending += parseInt(customer.pending_deliveries) || 0;
      summary.totalQuantityDelivered += parseInt(customer.total_quantity_delivered) || 0;
      totalCompletionRate += parseFloat(customer.completion_rate_percent) || 0;

      const customerType = customer.customer_type?.toLowerCase();
      if (customerType?.includes('wholesale') || customerType?.includes('retailer')) {
        summary.wholesaleCustomers++;
      } else if (customerType?.includes('consumer') || customerType?.includes('direct')) {
        summary.consumerCustomers++;
      }
    });

    summary.avgCompletionRate = (totalCompletionRate / customerData.length).toFixed(1);

    return summary;
  } catch (error) {
    console.error('Error calculating customer deliveries summary:', error);
    return {
      totalCustomers: 0,
      totalCompleted: 0,
      totalPending: 0,
      totalQuantityDelivered: 0,
      avgCompletionRate: '0.0',
      wholesaleCustomers: 0,
      consumerCustomers: 0
    };
  }
}

/**
 * Calculates summary statistics for available harvest data.
 * @param {object[]} harvestData - An array of available harvest data objects.
 * @returns {{totalQuantity: number, plantTypes: number, veryFreshItems: number, regularFreshItems: number, avgDaysSinceHarvest: string}} An object with summary statistics.
 */
function calculateAvailableHarvestSummary(harvestData) {
  try {
    if (!Array.isArray(harvestData) || harvestData.length === 0) {
      return {
        totalQuantity: 0,
        plantTypes: 0,
        veryFreshItems: 0,
        regularFreshItems: 0,
        avgDaysSinceHarvest: '0.0'
      };
    }

    const summary = {
      totalQuantity: 0,
      plantTypes: 0,
      veryFreshItems: 0,
      regularFreshItems: 0,
      avgDaysSinceHarvest: '0.0'
    };

    const uniquePlants = new Set();
    let totalDays = 0;

    harvestData.forEach(item => {
      summary.totalQuantity += parseInt(item.available_quantity) || 0;
      uniquePlants.add(item.plant_name);
      
      const freshness = item.freshness_level?.toLowerCase();
      if (freshness === 'very_fresh') {
        summary.veryFreshItems++;
      } else {
        summary.regularFreshItems++;
      }

      totalDays += parseInt(item.days_since_harvest) || 0;
    });

    summary.plantTypes = uniquePlants.size;
    summary.avgDaysSinceHarvest = (totalDays / harvestData.length).toFixed(1);

    return summary;
  } catch (error) {
    console.error('Error calculating available harvest summary:', error);
    return {
      totalQuantity: 0,
      plantTypes: 0,
      veryFreshItems: 0,
      regularFreshItems: 0,
      avgDaysSinceHarvest: '0.0'
    };
  }
}

/**
 * Calculates summary statistics for allocation efficiency data.
 * @param {object[]} allocationData - An array of allocation efficiency data objects.
 * @returns {{totalWeeks: number, totalAllocations: number, totalSuccessful: number, totalOverdue: number, avgSuccessRate: string, avgDaysToDelivery: string}} An object with summary statistics.
 */
function calculateAllocationEfficiencySummary(allocationData) {
  try {
    if (!Array.isArray(allocationData) || allocationData.length === 0) {
      return {
        totalWeeks: 0,
        totalAllocations: 0,
        totalSuccessful: 0,
        totalOverdue: 0,
        avgSuccessRate: '0.0',
        avgDaysToDelivery: '0.0'
      };
    }

    const summary = {
      totalWeeks: allocationData.length,
      totalAllocations: 0,
      totalSuccessful: 0,
      totalOverdue: 0,
      avgSuccessRate: '0.0',
      avgDaysToDelivery: '0.0'
    };

    let totalSuccessRate = 0;
    let totalDaysToDelivery = 0;
    let deliveryDaysCount = 0;

    allocationData.forEach(item => {
      summary.totalAllocations += parseInt(item.total_allocations) || 0;
      summary.totalSuccessful += parseInt(item.successful_deliveries) || 0;
      summary.totalOverdue += parseInt(item.overdue_allocations) || 0;
      totalSuccessRate += parseFloat(item.success_rate_percent) || 0;

      if (item.avg_days_to_delivery !== null && item.avg_days_to_delivery !== undefined) {
        totalDaysToDelivery += parseFloat(item.avg_days_to_delivery);
        deliveryDaysCount++;
      }
    });

    summary.avgSuccessRate = (totalSuccessRate / allocationData.length).toFixed(1);
    summary.avgDaysToDelivery = deliveryDaysCount > 0 ? 
      (totalDaysToDelivery / deliveryDaysCount).toFixed(1) : '0.0';

    return summary;
  } catch (error) {
    console.error('Error calculating allocation efficiency summary:', error);
    return {
      totalWeeks: 0,
      totalAllocations: 0,
      totalSuccessful: 0,
      totalOverdue: 0,
      avgSuccessRate: '0.0',
      avgDaysToDelivery: '0.0'
    };
  }
}

/**
 * Calculates summary statistics for task assignment data.
 * @param {object[]} taskData - An array of task assignment data objects.
 * @returns {{totalTasks: number, pending: number, completed: number, overdue: number, assigned: number, unassigned: number, towerTasks: number, recurringTasks: number}} An object with summary statistics.
 */
function calculateTasksSummary(taskData) {
  try {
    if (!Array.isArray(taskData) || taskData.length === 0) {
      return {
        totalTasks: 0,
        pending: 0,
        completed: 0,
        overdue: 0,
        assigned: 0,
        unassigned: 0,
        towerTasks: 0,
        recurringTasks: 0
      };
    }

    const summary = {
      totalTasks: taskData.length,
      pending: 0,
      completed: 0,
      overdue: 0,
      assigned: 0,
      unassigned: 0,
      towerTasks: 0,
      recurringTasks: 0
    };

    const now = new Date();

    taskData.forEach(task => {
      const status = task.status?.toLowerCase();
      const dueDate = task.due_date ? new Date(task.due_date) : null;
      
      // Count by status
      if (status === 'pending') {
        summary.pending++;
      } else if (status === 'completed') {
        summary.completed++;
      }
      
      // Count overdue (past due date and not completed)
      if (dueDate && dueDate < now && status !== 'completed') {
        summary.overdue++;
      }
      
      // Count assigned vs unassigned
      if (task.assigned_to) {
        summary.assigned++;
      } else {
        summary.unassigned++;
      }
      
      // Count tower-related tasks
      if (task.tower_id) {
        summary.towerTasks++;
      }
      
      // Count recurring tasks
      if (task.is_recurring) {
        summary.recurringTasks++;
      }
    });

    return summary;
  } catch (error) {
    console.error('Error calculating tasks summary:', error);
    return {
      totalTasks: 0,
      pending: 0,
      completed: 0,
      overdue: 0,
      assigned: 0,
      unassigned: 0,
      towerTasks: 0,
      recurringTasks: 0
    };
  }
}

// Export all the calculator functions for use in other modules
module.exports = {
  calculateTowerSummary,
  calculatePestSummary,
  calculateMonitoringSummary,
  calculateLightingSummary,
  calculateSensorSummary,
  calculateSpacerSummary,
  calculatePendingDeliveriesSummary,
  calculateInventoryAgingSummary,
  calculateHarvestPerformanceSummary,
  calculateDailyOperationsSummary,
  calculateCustomerDeliveriesSummary,
  calculateAvailableHarvestSummary,
  calculateAllocationEfficiencySummary,
  calculateTasksSummary,
};