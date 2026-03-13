/**
 * Universal Service Intelligence Engine
 * Industry-agnostic service operations system with 5 AI layers:
 * 1. Intent Engine - detect what user wants
 * 2. Problem Classifier - identify the issue
 * 3. Protocol Engine - determine how to fix it
 * 4. Estimator Engine - calculate cost
 * 5. Conversation Engine - generate response
 */

const intakeService = require('./intakeService');
const problemClassifier = require('./problemClassifier');
const protocolEngine = require('./protocolEngine');
const priceEstimator = require('./priceEstimator');
const estimateGenerator = require('./estimateGenerator');
const quoteSender = require('./quoteSender');
const followUpScheduler = require('./followUpScheduler');
const intentEngine = require('./intentEngine');
const conversationEngine = require('./conversationEngine');
const orchestrator = require('./orchestrator');

module.exports = {
  // Intake
  ...intakeService,

  // Intent Detection (Layer 1)
  ...intentEngine,

  // Classification (Layer 2)
  ...problemClassifier,

  // Protocols (Layer 3)
  ...protocolEngine,

  // Pricing (Layer 4)
  ...priceEstimator,

  // Conversation (Layer 5)
  ...conversationEngine,

  // Estimates
  ...estimateGenerator,

  // Quote delivery
  ...quoteSender,

  // Follow-ups
  ...followUpScheduler,

  // Orchestrator
  ...orchestrator,

  // Convenience re-exports
  intake: intakeService,
  intent: intentEngine,
  classifier: problemClassifier,
  protocols: protocolEngine,
  pricing: priceEstimator,
  conversation: conversationEngine,
  estimates: estimateGenerator,
  quotes: quoteSender,
  followUps: followUpScheduler,
  orchestrator,
};
