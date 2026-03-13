-- Seed service protocols for common industries
-- These are templates that can be customized per site

-- ============================================================================
-- ROOFING PROTOCOLS
-- ============================================================================
INSERT INTO service_protocols (
  industry_id,
  job_type,
  description,
  diagnosis_signals,
  typical_labor_hours_min,
  typical_labor_hours_max,
  material_cost_min,
  material_cost_max,
  typical_price_min,
  typical_price_max,
  scope_of_work,
  risk_factors,
  requires_inspection,
  urgency_keywords,
  follow_up_questions
) VALUES
(
  (SELECT id FROM industries WHERE slug = 'roofing'),
  'roof_inspection',
  'Comprehensive roof inspection and assessment',
  '["leak", "damage", "age", "storm", "missing shingles", "sagging"]',
  1, 2,
  0, 50,
  150, 350,
  'Complete visual inspection of roof surface, flashing, gutters, and ventilation. Includes written report with photos and recommendations.',
  '["hidden damage may require additional assessment", "access limitations on steep roofs"]',
  false,
  '["leak", "water damage", "storm", "emergency"]',
  '["How old is your roof?", "Have you noticed any leaks or water stains?", "Was there recent storm damage?"]'
),
(
  (SELECT id FROM industries WHERE slug = 'roofing'),
  'shingle_repair',
  'Repair or replace damaged shingles',
  '["missing shingles", "curling", "cracked", "blown off", "granule loss"]',
  2, 4,
  100, 500,
  350, 1200,
  'Remove damaged shingles, inspect underlayment, install matching replacement shingles, seal and secure.',
  '["underlying deck damage", "matching existing shingles may be difficult", "warranty limitations"]',
  true,
  '["missing", "blown off", "storm damage"]',
  '["How many shingles are affected?", "Do you know the brand/color of your current shingles?"]'
),
(
  (SELECT id FROM industries WHERE slug = 'roofing'),
  'flashing_repair',
  'Repair or replace roof flashing',
  '["leak around chimney", "leak at wall", "rusted flashing", "separated flashing"]',
  2, 6,
  75, 400,
  400, 1500,
  'Remove old flashing, inspect substrate, install new flashing with proper overlap and sealant.',
  '["chimney masonry may need repair", "multiple penetrations increase complexity"]',
  true,
  '["leak", "chimney", "skylight"]',
  '["Where is the leak located?", "Is it around a chimney, skylight, or wall?"]'
),
(
  (SELECT id FROM industries WHERE slug = 'roofing'),
  'roof_replacement',
  'Complete roof replacement',
  '["old roof", "multiple leaks", "extensive damage", "20+ years old", "full replacement"]',
  16, 40,
  3000, 15000,
  8000, 35000,
  'Complete tear-off of existing roofing, inspect and repair decking as needed, install underlayment, new shingles/materials, flashing, and ventilation.',
  '["deck replacement may be needed", "permit requirements", "weather delays", "disposal costs"]',
  true,
  '["replacement", "new roof", "old roof"]',
  '["What is the approximate square footage of your roof?", "What type of roofing material do you prefer?", "Is this an insurance claim?"]'
),
(
  (SELECT id FROM industries WHERE slug = 'roofing'),
  'gutter_repair',
  'Repair or replace gutters and downspouts',
  '["clogged gutters", "leaking gutters", "sagging", "overflow", "detached"]',
  2, 6,
  50, 500,
  250, 1200,
  'Clean gutters, repair or replace damaged sections, resecure hangers, ensure proper slope and drainage.',
  '["fascia board damage", "ice dam issues in winter"]',
  true,
  '["overflow", "clogged", "leaking"]',
  '["Are your gutters leaking or overflowing?", "How many linear feet of gutters need attention?"]'
)
ON CONFLICT (industry_id, job_type) DO NOTHING;

-- ============================================================================
-- HVAC PROTOCOLS
-- ============================================================================
INSERT INTO service_protocols (
  industry_id,
  job_type,
  description,
  diagnosis_signals,
  typical_labor_hours_min,
  typical_labor_hours_max,
  material_cost_min,
  material_cost_max,
  typical_price_min,
  typical_price_max,
  scope_of_work,
  risk_factors,
  requires_inspection,
  urgency_keywords,
  follow_up_questions
) VALUES
(
  (SELECT id FROM industries WHERE slug = 'hvac'),
  'ac_tune_up',
  'Annual AC maintenance and tune-up',
  '["maintenance", "tune up", "annual service", "not cooling well"]',
  1, 2,
  20, 100,
  89, 199,
  'Inspect and clean condenser coils, check refrigerant levels, test electrical connections, lubricate moving parts, replace air filter.',
  '["may discover additional repairs needed", "refrigerant top-off extra"]',
  false,
  '["maintenance", "tune up", "service"]',
  '["When was your last AC service?", "Is your system cooling properly?"]'
),
(
  (SELECT id FROM industries WHERE slug = 'hvac'),
  'ac_repair',
  'Diagnose and repair AC system issues',
  '["not cooling", "warm air", "not turning on", "strange noise", "ice on unit"]',
  1, 4,
  50, 800,
  150, 1500,
  'Diagnose issue, repair or replace faulty component, test system operation.',
  '["compressor failure may require replacement", "refrigerant leaks require additional repair", "older systems may have discontinued parts"]',
  true,
  '["not cooling", "broken", "emergency", "no AC"]',
  '["Is the system running but not cooling, or not running at all?", "Do you hear any unusual sounds?", "How old is your AC unit?"]'
),
(
  (SELECT id FROM industries WHERE slug = 'hvac'),
  'compressor_replacement',
  'Replace AC compressor',
  '["compressor failure", "not pumping", "seized", "electrical failure"]',
  4, 8,
  800, 2500,
  1500, 4000,
  'Remove failed compressor, evacuate and recover refrigerant, install new compressor, recharge system, test operation.',
  '["system age may warrant full replacement", "warranty coverage varies", "refrigerant type affects cost"]',
  true,
  '["compressor", "not working"]',
  '["How old is your AC system?", "Has a technician diagnosed the compressor as failed?"]'
),
(
  (SELECT id FROM industries WHERE slug = 'hvac'),
  'furnace_repair',
  'Diagnose and repair furnace issues',
  '["not heating", "no heat", "pilot light out", "strange smell", "short cycling"]',
  1, 4,
  50, 600,
  150, 1200,
  'Diagnose issue, repair or replace faulty component, test system operation and safety.',
  '["heat exchanger cracks are serious safety issues", "carbon monoxide risk", "older furnaces may need replacement"]',
  true,
  '["no heat", "not heating", "emergency", "cold"]',
  '["Is the furnace running but not producing heat?", "Do you smell gas or burning?", "How old is your furnace?"]'
),
(
  (SELECT id FROM industries WHERE slug = 'hvac'),
  'system_replacement',
  'Full HVAC system replacement',
  '["old system", "frequent repairs", "inefficient", "replacement", "new system"]',
  8, 24,
  4000, 12000,
  8000, 25000,
  'Remove existing equipment, install new furnace and AC unit, connect ductwork, electrical, and refrigerant lines, test and commission system.',
  '["ductwork modifications may be needed", "electrical upgrades possible", "permit requirements", "equipment sizing critical"]',
  true,
  '["replacement", "new system", "upgrade"]',
  '["What is the square footage of your home?", "What type of system do you currently have?", "Are you interested in high-efficiency options?"]'
)
ON CONFLICT (industry_id, job_type) DO NOTHING;

-- ============================================================================
-- PLUMBING PROTOCOLS
-- ============================================================================
INSERT INTO service_protocols (
  industry_id,
  job_type,
  description,
  diagnosis_signals,
  typical_labor_hours_min,
  typical_labor_hours_max,
  material_cost_min,
  material_cost_max,
  typical_price_min,
  typical_price_max,
  scope_of_work,
  risk_factors,
  requires_inspection,
  urgency_keywords,
  follow_up_questions
) VALUES
(
  (SELECT id FROM industries WHERE slug = 'plumbing'),
  'drain_cleaning',
  'Clear clogged drains',
  '["clogged", "slow drain", "backed up", "gurgling", "standing water"]',
  0.5, 2,
  10, 100,
  99, 350,
  'Snake or hydro-jet drain to clear blockage, inspect for root intrusion or pipe damage, test drainage.',
  '["may indicate larger sewer line issue", "old pipes may be damaged during cleaning", "recurring clogs suggest bigger problem"]',
  false,
  '["clogged", "backed up", "emergency", "overflow"]',
  '["Which drain is clogged?", "Is it a single drain or multiple?", "Have you had this problem before?"]'
),
(
  (SELECT id FROM industries WHERE slug = 'plumbing'),
  'leak_repair',
  'Repair pipe leaks',
  '["leak", "dripping", "water damage", "wet spot", "water bill high"]',
  1, 4,
  20, 300,
  150, 800,
  'Locate leak, repair or replace damaged section of pipe, test for additional leaks, restore water service.',
  '["hidden leaks may require wall/floor access", "water damage remediation separate", "pipe material affects repair method"]',
  true,
  '["leak", "flooding", "emergency", "water damage"]',
  '["Where is the leak located?", "Is it a steady leak or intermittent?", "Is there visible water damage?"]'
),
(
  (SELECT id FROM industries WHERE slug = 'plumbing'),
  'water_heater_repair',
  'Repair water heater issues',
  '["no hot water", "not enough hot water", "leaking water heater", "strange noise from water heater"]',
  1, 3,
  50, 400,
  150, 700,
  'Diagnose issue, repair or replace faulty component (thermostat, element, valve, anode rod), test operation.',
  '["tank corrosion may require replacement", "gas water heaters have additional safety concerns", "age affects repair viability"]',
  true,
  '["no hot water", "water heater", "leaking"]',
  '["Is it a gas or electric water heater?", "How old is the unit?", "Is there any visible leaking?"]'
),
(
  (SELECT id FROM industries WHERE slug = 'plumbing'),
  'water_heater_replacement',
  'Replace water heater',
  '["old water heater", "replace water heater", "new water heater", "tank failed"]',
  3, 6,
  400, 2000,
  1200, 4000,
  'Remove old water heater, install new unit, connect water and gas/electric, test operation and safety.',
  '["venting modifications for gas units", "electrical upgrades may be needed", "tankless options available", "permit may be required"]',
  true,
  '["replacement", "new water heater"]',
  '["What size is your current water heater?", "Gas or electric?", "Are you interested in tankless?"]'
),
(
  (SELECT id FROM industries WHERE slug = 'plumbing'),
  'toilet_repair',
  'Repair or replace toilet',
  '["running toilet", "toilet leak", "clogged toilet", "toilet not flushing"]',
  0.5, 2,
  20, 150,
  100, 400,
  'Diagnose issue, repair or replace internal components (flapper, fill valve, wax ring), test operation.',
  '["wax ring replacement requires toilet removal", "older toilets may benefit from replacement", "floor damage possible"]',
  false,
  '["toilet", "running", "clogged", "leaking"]',
  '["What is the toilet doing?", "Is it running constantly, leaking at the base, or not flushing?"]'
),
(
  (SELECT id FROM industries WHERE slug = 'plumbing'),
  'sewer_line_repair',
  'Repair or replace sewer line',
  '["sewer backup", "multiple drains clogged", "sewage smell", "yard wet spot"]',
  4, 16,
  500, 5000,
  2000, 15000,
  'Camera inspect sewer line, excavate if needed, repair or replace damaged section, test flow.',
  '["excavation may damage landscaping", "permit required", "city connection issues", "trenchless options may be available"]',
  true,
  '["sewer", "backup", "emergency", "sewage"]',
  '["Are multiple drains affected?", "Do you notice any sewage smell?", "Is there a wet spot in your yard?"]'
)
ON CONFLICT (industry_id, job_type) DO NOTHING;

-- ============================================================================
-- ELECTRICAL PROTOCOLS
-- ============================================================================
INSERT INTO service_protocols (
  industry_id,
  job_type,
  description,
  diagnosis_signals,
  typical_labor_hours_min,
  typical_labor_hours_max,
  material_cost_min,
  material_cost_max,
  typical_price_min,
  typical_price_max,
  scope_of_work,
  risk_factors,
  requires_inspection,
  urgency_keywords,
  follow_up_questions
) VALUES
(
  (SELECT id FROM industries WHERE slug = 'electrical'),
  'outlet_repair',
  'Repair or replace electrical outlets',
  '["outlet not working", "sparking outlet", "hot outlet", "loose outlet"]',
  0.5, 2,
  10, 100,
  100, 350,
  'Diagnose issue, repair or replace outlet, test circuit and connections.',
  '["may indicate wiring issues", "GFCI requirements in wet areas", "aluminum wiring concerns in older homes"]',
  false,
  '["sparking", "hot", "burning smell", "not working"]',
  '["Is the outlet sparking or hot to the touch?", "Is it a single outlet or multiple?", "How old is your home?"]'
),
(
  (SELECT id FROM industries WHERE slug = 'electrical'),
  'panel_upgrade',
  'Upgrade electrical panel',
  '["panel upgrade", "more power", "tripping breakers", "fuse box", "old panel"]',
  4, 8,
  500, 2000,
  1500, 4000,
  'Remove old panel, install new panel with appropriate amperage, reconnect circuits, test and label.',
  '["permit required", "utility coordination needed", "may require meter upgrade", "temporary power outage"]',
  true,
  '["panel", "upgrade", "breakers tripping"]',
  '["What is your current panel amperage?", "Are you adding new appliances or an EV charger?", "Do breakers trip frequently?"]'
),
(
  (SELECT id FROM industries WHERE slug = 'electrical'),
  'lighting_installation',
  'Install new lighting fixtures',
  '["new light", "install fixture", "recessed lights", "chandelier"]',
  1, 4,
  50, 500,
  150, 800,
  'Install new fixture, connect wiring, test operation, ensure proper support.',
  '["ceiling access may be limited", "switch upgrades may be needed", "dimmer compatibility"]',
  false,
  '["install", "new light", "fixture"]',
  '["What type of fixture are you installing?", "Is there existing wiring at the location?", "Do you want a dimmer switch?"]'
),
(
  (SELECT id FROM industries WHERE slug = 'electrical'),
  'circuit_installation',
  'Install new electrical circuit',
  '["new circuit", "dedicated circuit", "add outlet", "appliance circuit"]',
  2, 6,
  100, 400,
  300, 1000,
  'Run new wiring from panel, install breaker, connect outlet or hardwired connection, test circuit.',
  '["panel capacity must be sufficient", "routing may require wall/ceiling access", "permit may be required"]',
  true,
  '["new circuit", "dedicated", "appliance"]',
  '["What will the circuit be used for?", "Where is the panel located relative to the new outlet?"]'
),
(
  (SELECT id FROM industries WHERE slug = 'electrical'),
  'ev_charger_installation',
  'Install electric vehicle charger',
  '["EV charger", "electric car", "Tesla charger", "Level 2 charger"]',
  3, 8,
  200, 800,
  500, 2500,
  'Install dedicated circuit, mount charger, connect wiring, test operation, provide usage instructions.',
  '["panel upgrade may be needed", "distance from panel affects cost", "permit required", "utility notification may be needed"]',
  true,
  '["EV", "charger", "electric vehicle", "Tesla"]',
  '["What type of EV do you have?", "Where would you like the charger installed?", "What is your current panel amperage?"]'
)
ON CONFLICT (industry_id, job_type) DO NOTHING;
