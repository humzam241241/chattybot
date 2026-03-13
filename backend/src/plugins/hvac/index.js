/**
 * HVAC Industry Plugin
 * Specialized protocols and logic for heating, ventilation, and AC services
 */

module.exports = {
  slug: 'hvac',
  name: 'HVAC',
  description: 'Heating, ventilation, and air conditioning services',
  icon: '❄️',
  version: '1.0.0',

  protocols: [
    {
      job_type: 'ac_tune_up',
      description: 'Annual AC maintenance and tune-up',
      diagnosis_signals: ['maintenance', 'tune up', 'annual service', 'not cooling well', 'checkup'],
      typical_labor_hours_min: 1,
      typical_labor_hours_max: 2,
      material_cost_min: 20,
      material_cost_max: 100,
      typical_price_min: 89,
      typical_price_max: 199,
      scope_of_work: 'Inspect and clean condenser coils, check refrigerant levels, test electrical connections, lubricate moving parts, replace air filter.',
      risk_factors: ['May discover additional repairs needed', 'Refrigerant top-off extra'],
      requires_inspection: false,
      urgency_keywords: ['maintenance', 'tune up', 'service'],
      follow_up_questions: ['When was your last AC service?', 'Is your system cooling properly?'],
    },
    {
      job_type: 'ac_repair',
      description: 'Diagnose and repair AC system issues',
      diagnosis_signals: ['not cooling', 'warm air', 'not turning on', 'strange noise', 'ice on unit', 'ac broken'],
      typical_labor_hours_min: 1,
      typical_labor_hours_max: 4,
      material_cost_min: 50,
      material_cost_max: 800,
      typical_price_min: 150,
      typical_price_max: 1500,
      scope_of_work: 'Diagnose issue, repair or replace faulty component, test system operation.',
      risk_factors: ['Compressor failure may require replacement', 'Refrigerant leaks require additional repair', 'Older systems may have discontinued parts'],
      requires_inspection: true,
      urgency_keywords: ['not cooling', 'broken', 'emergency', 'no AC', 'hot'],
      follow_up_questions: ['Is the system running but not cooling, or not running at all?', 'Do you hear any unusual sounds?', 'How old is your AC unit?'],
    },
    {
      job_type: 'compressor_replacement',
      description: 'Replace AC compressor',
      diagnosis_signals: ['compressor failure', 'not pumping', 'seized', 'electrical failure', 'compressor'],
      typical_labor_hours_min: 4,
      typical_labor_hours_max: 8,
      material_cost_min: 800,
      material_cost_max: 2500,
      typical_price_min: 1500,
      typical_price_max: 4000,
      scope_of_work: 'Remove failed compressor, evacuate and recover refrigerant, install new compressor, recharge system, test operation.',
      risk_factors: ['System age may warrant full replacement', 'Warranty coverage varies', 'Refrigerant type affects cost'],
      requires_inspection: true,
      urgency_keywords: ['compressor', 'not working'],
      follow_up_questions: ['How old is your AC system?', 'Has a technician diagnosed the compressor as failed?'],
    },
    {
      job_type: 'furnace_repair',
      description: 'Diagnose and repair furnace issues',
      diagnosis_signals: ['not heating', 'no heat', 'pilot light out', 'strange smell', 'short cycling', 'furnace'],
      typical_labor_hours_min: 1,
      typical_labor_hours_max: 4,
      material_cost_min: 50,
      material_cost_max: 600,
      typical_price_min: 150,
      typical_price_max: 1200,
      scope_of_work: 'Diagnose issue, repair or replace faulty component, test system operation and safety.',
      risk_factors: ['Heat exchanger cracks are serious safety issues', 'Carbon monoxide risk', 'Older furnaces may need replacement'],
      requires_inspection: true,
      urgency_keywords: ['no heat', 'not heating', 'emergency', 'cold', 'furnace broken'],
      follow_up_questions: ['Is the furnace running but not producing heat?', 'Do you smell gas or burning?', 'How old is your furnace?'],
    },
    {
      job_type: 'system_replacement',
      description: 'Full HVAC system replacement',
      diagnosis_signals: ['old system', 'frequent repairs', 'inefficient', 'replacement', 'new system', 'upgrade'],
      typical_labor_hours_min: 8,
      typical_labor_hours_max: 24,
      material_cost_min: 4000,
      material_cost_max: 12000,
      typical_price_min: 8000,
      typical_price_max: 25000,
      scope_of_work: 'Remove existing equipment, install new furnace and AC unit, connect ductwork, electrical, and refrigerant lines, test and commission system.',
      risk_factors: ['Ductwork modifications may be needed', 'Electrical upgrades possible', 'Permit requirements', 'Equipment sizing critical'],
      requires_inspection: true,
      urgency_keywords: ['replacement', 'new system', 'upgrade'],
      follow_up_questions: ['What is the square footage of your home?', 'What type of system do you currently have?', 'Are you interested in high-efficiency options?'],
    },
    {
      job_type: 'duct_cleaning',
      description: 'Professional duct cleaning service',
      diagnosis_signals: ['dusty', 'allergies', 'duct cleaning', 'air quality', 'dirty vents'],
      typical_labor_hours_min: 2,
      typical_labor_hours_max: 4,
      material_cost_min: 0,
      material_cost_max: 50,
      typical_price_min: 300,
      typical_price_max: 600,
      scope_of_work: 'Clean all supply and return ducts, clean registers and grilles, sanitize ductwork if requested.',
      risk_factors: ['Duct damage may be discovered', 'Mold remediation separate if found'],
      requires_inspection: false,
      urgency_keywords: ['cleaning', 'dust', 'allergies'],
      follow_up_questions: ['When were your ducts last cleaned?', 'Do you have allergy concerns?', 'How many vents do you have?'],
    },
  ],

  diagnostics: {
    analyzeDescription(description) {
      const signals = [];
      const lower = description.toLowerCase();

      if (lower.match(/not cooling|warm air|hot house/)) {
        signals.push({ type: 'cooling_failure', confidence: 0.9, severity: 'high' });
      }
      if (lower.match(/not heating|no heat|cold house/)) {
        signals.push({ type: 'heating_failure', confidence: 0.9, severity: 'high' });
      }
      if (lower.match(/noise|loud|grinding|squealing/)) {
        signals.push({ type: 'mechanical_issue', confidence: 0.8, severity: 'medium' });
      }
      if (lower.match(/smell|odor|burning|gas/)) {
        signals.push({ type: 'safety_concern', confidence: 0.95, severity: 'critical' });
      }
      if (lower.match(/ice|frozen|frost/)) {
        signals.push({ type: 'refrigerant_issue', confidence: 0.85, severity: 'high' });
      }

      return signals;
    },
  },

  pricing: {
    adjustEstimate(estimate, context) {
      let adjusted = { ...estimate };

      if (context.systemAge && context.systemAge > 15) {
        adjusted.riskWarnings = adjusted.riskWarnings || [];
        adjusted.riskWarnings.push('System age may affect parts availability and repair viability');
      }

      if (context.refrigerantType === 'R22') {
        adjusted.priceLow *= 1.3;
        adjusted.priceHigh *= 1.3;
        adjusted.riskWarnings = adjusted.riskWarnings || [];
        adjusted.riskWarnings.push('R22 refrigerant is phased out and expensive');
      }

      if (context.isEmergency) {
        adjusted.priceLow *= 1.5;
        adjusted.priceHigh *= 1.5;
      }

      return adjusted;
    },
  },
};
