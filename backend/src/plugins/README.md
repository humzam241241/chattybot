# Industry Plugins

This folder contains industry-specific plugins for the Service Intelligence Engine.

## Plugin Structure

Each plugin is a folder with the following structure:

```
plugins/
├── roofing/
│   ├── index.js          # Plugin entry point
│   ├── protocols.json    # Job type definitions
│   ├── diagnostics.js    # Industry-specific diagnostic logic
│   └── pricing.js        # Custom pricing adjustments
├── hvac/
│   └── ...
└── plumbing/
    └── ...
```

## Creating a Plugin

1. Create a new folder with the industry slug (e.g., `roofing`)
2. Create an `index.js` that exports the plugin configuration
3. Define protocols in `protocols.json`
4. Optionally add custom diagnostic and pricing logic

## Plugin Interface

```javascript
// index.js
module.exports = {
  slug: 'roofing',
  name: 'Roofing',
  version: '1.0.0',
  
  // Job type protocols
  protocols: require('./protocols.json'),
  
  // Optional: Custom diagnostic signals
  diagnostics: require('./diagnostics'),
  
  // Optional: Custom pricing adjustments
  pricing: require('./pricing'),
  
  // Optional: Custom follow-up templates
  followUpTemplates: require('./templates'),
};
```

## Protocol Definition

```json
{
  "job_type": "roof_inspection",
  "description": "Comprehensive roof inspection",
  "diagnosis_signals": ["leak", "damage", "storm"],
  "typical_labor_hours_min": 1,
  "typical_labor_hours_max": 2,
  "material_cost_min": 0,
  "material_cost_max": 50,
  "typical_price_min": 150,
  "typical_price_max": 350,
  "scope_of_work": "Complete visual inspection...",
  "risk_factors": ["hidden damage", "access limitations"],
  "requires_inspection": false,
  "urgency_keywords": ["leak", "emergency"],
  "follow_up_questions": ["How old is your roof?"]
}
```

## Loading Plugins

Plugins are loaded automatically by the plugin loader. To register a new plugin:

1. Add the plugin folder
2. The loader will detect and register it on server startup
3. Protocols are synced to the database

## Custom Logic

### Diagnostics

```javascript
// diagnostics.js
module.exports = {
  // Analyze problem description for industry-specific signals
  analyzeDescription(description) {
    const signals = [];
    if (description.match(/leak|water/i)) {
      signals.push({ type: 'water_damage', confidence: 0.8 });
    }
    return signals;
  },
  
  // Analyze attachments (photos)
  analyzeAttachment(attachment) {
    // Return detected issues
    return [];
  },
};
```

### Pricing

```javascript
// pricing.js
module.exports = {
  // Adjust estimate based on industry factors
  adjustEstimate(estimate, context) {
    // Apply seasonal adjustments, complexity factors, etc.
    return estimate;
  },
  
  // Calculate material costs
  calculateMaterials(jobType, projectSize) {
    // Return material cost estimate
    return { min: 0, max: 0 };
  },
};
```
