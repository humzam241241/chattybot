/**
 * Plumbing Industry Plugin
 * Specialized protocols and logic for plumbing services
 */

module.exports = {
  slug: 'plumbing',
  name: 'Plumbing',
  description: 'Pipe repair, drain cleaning, and water heater services',
  icon: '🔧',
  version: '1.0.0',

  protocols: [
    {
      job_type: 'drain_cleaning',
      description: 'Clear clogged drains',
      diagnosis_signals: ['clogged', 'slow drain', 'backed up', 'gurgling', 'standing water', 'drain'],
      typical_labor_hours_min: 0.5,
      typical_labor_hours_max: 2,
      material_cost_min: 10,
      material_cost_max: 100,
      typical_price_min: 99,
      typical_price_max: 350,
      scope_of_work: 'Snake or hydro-jet drain to clear blockage, inspect for root intrusion or pipe damage, test drainage.',
      risk_factors: ['May indicate larger sewer line issue', 'Old pipes may be damaged during cleaning', 'Recurring clogs suggest bigger problem'],
      requires_inspection: false,
      urgency_keywords: ['clogged', 'backed up', 'emergency', 'overflow'],
      follow_up_questions: ['Which drain is clogged?', 'Is it a single drain or multiple?', 'Have you had this problem before?'],
    },
    {
      job_type: 'leak_repair',
      description: 'Repair pipe leaks',
      diagnosis_signals: ['leak', 'dripping', 'water damage', 'wet spot', 'water bill high', 'pipe'],
      typical_labor_hours_min: 1,
      typical_labor_hours_max: 4,
      material_cost_min: 20,
      material_cost_max: 300,
      typical_price_min: 150,
      typical_price_max: 800,
      scope_of_work: 'Locate leak, repair or replace damaged section of pipe, test for additional leaks, restore water service.',
      risk_factors: ['Hidden leaks may require wall/floor access', 'Water damage remediation separate', 'Pipe material affects repair method'],
      requires_inspection: true,
      urgency_keywords: ['leak', 'flooding', 'emergency', 'water damage'],
      follow_up_questions: ['Where is the leak located?', 'Is it a steady leak or intermittent?', 'Is there visible water damage?'],
    },
    {
      job_type: 'water_heater_repair',
      description: 'Repair water heater issues',
      diagnosis_signals: ['no hot water', 'not enough hot water', 'leaking water heater', 'strange noise from water heater', 'water heater'],
      typical_labor_hours_min: 1,
      typical_labor_hours_max: 3,
      material_cost_min: 50,
      material_cost_max: 400,
      typical_price_min: 150,
      typical_price_max: 700,
      scope_of_work: 'Diagnose issue, repair or replace faulty component (thermostat, element, valve, anode rod), test operation.',
      risk_factors: ['Tank corrosion may require replacement', 'Gas water heaters have additional safety concerns', 'Age affects repair viability'],
      requires_inspection: true,
      urgency_keywords: ['no hot water', 'water heater', 'leaking'],
      follow_up_questions: ['Is it a gas or electric water heater?', 'How old is the unit?', 'Is there any visible leaking?'],
    },
    {
      job_type: 'water_heater_replacement',
      description: 'Replace water heater',
      diagnosis_signals: ['old water heater', 'replace water heater', 'new water heater', 'tank failed'],
      typical_labor_hours_min: 3,
      typical_labor_hours_max: 6,
      material_cost_min: 400,
      material_cost_max: 2000,
      typical_price_min: 1200,
      typical_price_max: 4000,
      scope_of_work: 'Remove old water heater, install new unit, connect water and gas/electric, test operation and safety.',
      risk_factors: ['Venting modifications for gas units', 'Electrical upgrades may be needed', 'Tankless options available', 'Permit may be required'],
      requires_inspection: true,
      urgency_keywords: ['replacement', 'new water heater'],
      follow_up_questions: ['What size is your current water heater?', 'Gas or electric?', 'Are you interested in tankless?'],
    },
    {
      job_type: 'toilet_repair',
      description: 'Repair or replace toilet',
      diagnosis_signals: ['running toilet', 'toilet leak', 'clogged toilet', 'toilet not flushing', 'toilet'],
      typical_labor_hours_min: 0.5,
      typical_labor_hours_max: 2,
      material_cost_min: 20,
      material_cost_max: 150,
      typical_price_min: 100,
      typical_price_max: 400,
      scope_of_work: 'Diagnose issue, repair or replace internal components (flapper, fill valve, wax ring), test operation.',
      risk_factors: ['Wax ring replacement requires toilet removal', 'Older toilets may benefit from replacement', 'Floor damage possible'],
      requires_inspection: false,
      urgency_keywords: ['toilet', 'running', 'clogged', 'leaking'],
      follow_up_questions: ['What is the toilet doing?', 'Is it running constantly, leaking at the base, or not flushing?'],
    },
    {
      job_type: 'sewer_line_repair',
      description: 'Repair or replace sewer line',
      diagnosis_signals: ['sewer backup', 'multiple drains clogged', 'sewage smell', 'yard wet spot', 'sewer'],
      typical_labor_hours_min: 4,
      typical_labor_hours_max: 16,
      material_cost_min: 500,
      material_cost_max: 5000,
      typical_price_min: 2000,
      typical_price_max: 15000,
      scope_of_work: 'Camera inspect sewer line, excavate if needed, repair or replace damaged section, test flow.',
      risk_factors: ['Excavation may damage landscaping', 'Permit required', 'City connection issues', 'Trenchless options may be available'],
      requires_inspection: true,
      urgency_keywords: ['sewer', 'backup', 'emergency', 'sewage'],
      follow_up_questions: ['Are multiple drains affected?', 'Do you notice any sewage smell?', 'Is there a wet spot in your yard?'],
    },
    {
      job_type: 'faucet_repair',
      description: 'Repair or replace faucet',
      diagnosis_signals: ['dripping faucet', 'leaky faucet', 'faucet not working', 'low water pressure faucet'],
      typical_labor_hours_min: 0.5,
      typical_labor_hours_max: 2,
      material_cost_min: 10,
      material_cost_max: 200,
      typical_price_min: 100,
      typical_price_max: 350,
      scope_of_work: 'Diagnose issue, repair or replace faucet components or entire faucet, test operation.',
      risk_factors: ['Valve replacement may be needed', 'Supply line condition', 'Older fixtures may need full replacement'],
      requires_inspection: false,
      urgency_keywords: ['faucet', 'dripping', 'leaking'],
      follow_up_questions: ['Which faucet is the issue?', 'Is it dripping or not working at all?', 'Would you like to replace the faucet?'],
    },
  ],

  diagnostics: {
    analyzeDescription(description) {
      const signals = [];
      const lower = description.toLowerCase();

      if (lower.match(/leak|drip|water/)) {
        signals.push({ type: 'water_leak', confidence: 0.85, severity: 'high' });
      }
      if (lower.match(/clog|backed|slow|drain/)) {
        signals.push({ type: 'drainage_issue', confidence: 0.9, severity: 'medium' });
      }
      if (lower.match(/sewer|sewage|smell|odor/)) {
        signals.push({ type: 'sewer_issue', confidence: 0.85, severity: 'high' });
      }
      if (lower.match(/no hot water|cold water only/)) {
        signals.push({ type: 'water_heater_issue', confidence: 0.9, severity: 'medium' });
      }
      if (lower.match(/flood|burst|emergency/)) {
        signals.push({ type: 'emergency', confidence: 0.95, severity: 'critical' });
      }

      return signals;
    },
  },

  pricing: {
    adjustEstimate(estimate, context) {
      let adjusted = { ...estimate };

      if (context.pipeType === 'galvanized') {
        adjusted.priceLow *= 1.2;
        adjusted.priceHigh *= 1.2;
        adjusted.riskWarnings = adjusted.riskWarnings || [];
        adjusted.riskWarnings.push('Galvanized pipes may require additional work');
      }

      if (context.accessDifficulty === 'hard') {
        adjusted.priceLow *= 1.25;
        adjusted.priceHigh *= 1.25;
        adjusted.riskWarnings = adjusted.riskWarnings || [];
        adjusted.riskWarnings.push('Difficult access may increase labor time');
      }

      if (context.isEmergency) {
        adjusted.priceLow *= 1.5;
        adjusted.priceHigh *= 1.5;
      }

      return adjusted;
    },
  },
};
