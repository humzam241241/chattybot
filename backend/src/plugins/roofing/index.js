/**
 * Roofing Industry Plugin
 * Specialized protocols and logic for roofing services
 */

module.exports = {
  slug: 'roofing',
  name: 'Roofing',
  description: 'Roof repair, replacement, and inspection services',
  icon: '🏠',
  version: '1.0.0',

  protocols: [
    {
      job_type: 'roof_inspection',
      description: 'Comprehensive roof inspection and assessment',
      diagnosis_signals: ['leak', 'damage', 'age', 'storm', 'missing shingles', 'sagging', 'inspection'],
      typical_labor_hours_min: 1,
      typical_labor_hours_max: 2,
      material_cost_min: 0,
      material_cost_max: 50,
      typical_price_min: 150,
      typical_price_max: 350,
      scope_of_work: 'Complete visual inspection of roof surface, flashing, gutters, and ventilation. Includes written report with photos and recommendations.',
      risk_factors: ['Hidden damage may require additional assessment', 'Access limitations on steep roofs'],
      requires_inspection: false,
      urgency_keywords: ['leak', 'water damage', 'storm', 'emergency'],
      follow_up_questions: ['How old is your roof?', 'Have you noticed any leaks or water stains?', 'Was there recent storm damage?'],
    },
    {
      job_type: 'shingle_repair',
      description: 'Repair or replace damaged shingles',
      diagnosis_signals: ['missing shingles', 'curling', 'cracked', 'blown off', 'granule loss', 'shingle'],
      typical_labor_hours_min: 2,
      typical_labor_hours_max: 4,
      material_cost_min: 100,
      material_cost_max: 500,
      typical_price_min: 350,
      typical_price_max: 1200,
      scope_of_work: 'Remove damaged shingles, inspect underlayment, install matching replacement shingles, seal and secure.',
      risk_factors: ['Underlying deck damage', 'Matching existing shingles may be difficult', 'Warranty limitations'],
      requires_inspection: true,
      urgency_keywords: ['missing', 'blown off', 'storm damage'],
      follow_up_questions: ['How many shingles are affected?', 'Do you know the brand/color of your current shingles?'],
    },
    {
      job_type: 'flashing_repair',
      description: 'Repair or replace roof flashing',
      diagnosis_signals: ['leak around chimney', 'leak at wall', 'rusted flashing', 'separated flashing', 'flashing'],
      typical_labor_hours_min: 2,
      typical_labor_hours_max: 6,
      material_cost_min: 75,
      material_cost_max: 400,
      typical_price_min: 400,
      typical_price_max: 1500,
      scope_of_work: 'Remove old flashing, inspect substrate, install new flashing with proper overlap and sealant.',
      risk_factors: ['Chimney masonry may need repair', 'Multiple penetrations increase complexity'],
      requires_inspection: true,
      urgency_keywords: ['leak', 'chimney', 'skylight'],
      follow_up_questions: ['Where is the leak located?', 'Is it around a chimney, skylight, or wall?'],
    },
    {
      job_type: 'roof_replacement',
      description: 'Complete roof replacement',
      diagnosis_signals: ['old roof', 'multiple leaks', 'extensive damage', '20+ years old', 'full replacement', 'new roof'],
      typical_labor_hours_min: 16,
      typical_labor_hours_max: 40,
      material_cost_min: 3000,
      material_cost_max: 15000,
      typical_price_min: 8000,
      typical_price_max: 35000,
      scope_of_work: 'Complete tear-off of existing roofing, inspect and repair decking as needed, install underlayment, new shingles/materials, flashing, and ventilation.',
      risk_factors: ['Deck replacement may be needed', 'Permit requirements', 'Weather delays', 'Disposal costs'],
      requires_inspection: true,
      urgency_keywords: ['replacement', 'new roof', 'old roof'],
      follow_up_questions: ['What is the approximate square footage of your roof?', 'What type of roofing material do you prefer?', 'Is this an insurance claim?'],
    },
    {
      job_type: 'gutter_repair',
      description: 'Repair or replace gutters and downspouts',
      diagnosis_signals: ['clogged gutters', 'leaking gutters', 'sagging', 'overflow', 'detached', 'gutter'],
      typical_labor_hours_min: 2,
      typical_labor_hours_max: 6,
      material_cost_min: 50,
      material_cost_max: 500,
      typical_price_min: 250,
      typical_price_max: 1200,
      scope_of_work: 'Clean gutters, repair or replace damaged sections, resecure hangers, ensure proper slope and drainage.',
      risk_factors: ['Fascia board damage', 'Ice dam issues in winter'],
      requires_inspection: true,
      urgency_keywords: ['overflow', 'clogged', 'leaking'],
      follow_up_questions: ['Are your gutters leaking or overflowing?', 'How many linear feet of gutters need attention?'],
    },
    {
      job_type: 'emergency_tarp',
      description: 'Emergency roof tarping for storm damage',
      diagnosis_signals: ['storm damage', 'tree fell', 'emergency', 'hole in roof', 'tarp'],
      typical_labor_hours_min: 2,
      typical_labor_hours_max: 4,
      material_cost_min: 100,
      material_cost_max: 300,
      typical_price_min: 500,
      typical_price_max: 1500,
      scope_of_work: 'Emergency response to secure damaged roof area with heavy-duty tarp to prevent further water damage.',
      risk_factors: ['Temporary solution only', 'Underlying damage assessment needed', 'Weather conditions may affect timing'],
      requires_inspection: false,
      urgency_keywords: ['emergency', 'storm', 'tree', 'hole', 'urgent', 'water coming in'],
      follow_up_questions: ['Is water actively coming into your home?', 'What caused the damage?', 'How large is the damaged area?'],
    },
  ],

  diagnostics: {
    analyzeDescription(description) {
      const signals = [];
      const lower = description.toLowerCase();

      if (lower.match(/leak|water|drip|wet/)) {
        signals.push({ type: 'water_intrusion', confidence: 0.85, severity: 'high' });
      }
      if (lower.match(/storm|hail|wind|tree/)) {
        signals.push({ type: 'storm_damage', confidence: 0.8, severity: 'high' });
      }
      if (lower.match(/old|age|year|decade/)) {
        signals.push({ type: 'age_related', confidence: 0.7, severity: 'medium' });
      }
      if (lower.match(/missing|blown|gone|fell/)) {
        signals.push({ type: 'material_loss', confidence: 0.9, severity: 'high' });
      }
      if (lower.match(/sag|dip|bow|uneven/)) {
        signals.push({ type: 'structural_concern', confidence: 0.75, severity: 'high' });
      }

      return signals;
    },

    analyzeAttachment(attachment) {
      return [];
    },
  },

  pricing: {
    adjustEstimate(estimate, context) {
      let adjusted = { ...estimate };

      if (context.roofPitch && context.roofPitch > 8) {
        adjusted.priceLow *= 1.15;
        adjusted.priceHigh *= 1.15;
        adjusted.riskWarnings = adjusted.riskWarnings || [];
        adjusted.riskWarnings.push('Steep roof pitch may increase labor costs');
      }

      if (context.stories && context.stories > 2) {
        adjusted.priceLow *= 1.1;
        adjusted.priceHigh *= 1.1;
        adjusted.riskWarnings = adjusted.riskWarnings || [];
        adjusted.riskWarnings.push('Multi-story building may require additional equipment');
      }

      if (context.season === 'winter') {
        adjusted.timelineDaysMax = Math.ceil(adjusted.timelineDaysMax * 1.5);
        adjusted.riskWarnings = adjusted.riskWarnings || [];
        adjusted.riskWarnings.push('Winter weather may cause scheduling delays');
      }

      return adjusted;
    },

    calculateMaterials(jobType, projectSize, roofType = 'asphalt') {
      const materialCosts = {
        asphalt: { perSquare: 100 },
        metal: { perSquare: 350 },
        tile: { perSquare: 400 },
        slate: { perSquare: 600 },
      };

      const sizes = {
        small: 15,
        medium: 25,
        large: 35,
        xl: 50,
      };

      const squares = sizes[projectSize] || 25;
      const costPerSquare = materialCosts[roofType]?.perSquare || 100;

      return {
        min: squares * costPerSquare * 0.8,
        max: squares * costPerSquare * 1.2,
      };
    },
  },
};
