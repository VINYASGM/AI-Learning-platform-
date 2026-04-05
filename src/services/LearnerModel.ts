/**
 * Bayesian Knowledge Tracing (BKT) Service — V2
 *
 * Upgrades from V1:
 * 1. Per-concept adaptive BKT parameters (not global defaults)
 * 2. Tiered Ebbinghaus forgetting curves by concept class
 * 3. Uncertainty tracking per mastery estimate
 * 4. Memory strength estimation from retrieval history
 *
 * Design decisions:
 * - Forgetting is NOT a single exponential. Different concept classes
 *   (factual, procedural, conceptual, transfer) decay differently.
 * - Per-learner personalization: decay rates adapt from episode history.
 * - Uncertainty decreases with assessments, increases with time since last test.
 */

// ─── Concept Classification ─────────────────────────────────────

export type ConceptClass =
  | 'factual'           // Pure recall (e.g., "What is π?")
  | 'procedural'        // Step-by-step skill (e.g., solving linear equations)
  | 'conceptual'        // Deep understanding (e.g., why division by zero is undefined)
  | 'misconception_resistant'  // Knowledge that resists decay once truly understood
  | 'transfer'          // Skills that generalize across domains

// ─── Tiered Decay Parameters ────────────────────────────────────

/**
 * Base decay rates (λ) by concept class.
 * Higher λ = faster forgetting.
 * These are starting values — personalized per-learner over time.
 */
export const BASE_DECAY_RATES: Record<ConceptClass, number> = {
  factual: 0.08,                 // Facts decay fast without rehearsal
  procedural: 0.04,              // Procedures stick better (muscle memory)
  conceptual: 0.06,              // Concepts decay moderately
  misconception_resistant: 0.02, // Once truly understood, very durable
  transfer: 0.03,                // Transfer skills are deeply encoded
};

/**
 * Mastery stage multiplier: concepts at higher mastery decay slower.
 */
export const MASTERY_STAGE_MULTIPLIERS: Record<string, number> = {
  novice: 1.5,      // p < 0.3: forgets 50% faster
  developing: 1.0,  // 0.3 ≤ p < 0.6: baseline decay
  proficient: 0.7,  // 0.6 ≤ p < 0.85: forgets 30% slower
  mastered: 0.4,    // p ≥ 0.85: strong retention
};

// ─── BKT Types ──────────────────────────────────────────────────

export interface BKTParams {
  pL0: number; // Initial probability of knowing the skill
  pT: number;  // Probability of learning the skill during a step
  pG: number;  // Probability of guessing correctly without knowing
  pS: number;  // Probability of slipping (mistake despite knowing)
}

export interface MasteryEstimate {
  p: number;              // Current mastery probability (0.01–0.999)
  uncertainty: number;    // How confident the model is (0 = certain, 1 = unknown)
  lastTested: number;     // Timestamp of last assessment
  decayRate: number;      // Personalized λ for this concept
  retrievalStrength: number; // How strongly encoded (increases with successful retrieval)
  assessmentCount: number;   // Number of assessments completed
  conceptClass: ConceptClass;
}

// ─── Default BKT Parameters ────────────────────────────────────

const DEFAULT_PARAMS: BKTParams = {
  pL0: 0.1,
  pT: 0.25,
  pG: 0.2,
  pS: 0.1,
};

// ─── Core BKT Update ───────────────────────────────────────────

/**
 * Standard BKT mastery update.
 * Unchanged from V1 — the mathematical core is sound.
 */
export const updateMasteryProbability = (
  prevPL: number,
  isCorrect: boolean,
  params: BKTParams = DEFAULT_PARAMS
): number => {
  const { pT, pG, pS } = params;

  let pLObserved;

  if (isCorrect) {
    const numerator = prevPL * (1 - pS);
    const denominator = numerator + (1 - prevPL) * pG;
    pLObserved = numerator / denominator;
  } else {
    const numerator = prevPL * pS;
    const denominator = numerator + (1 - prevPL) * (1 - pG);
    pLObserved = numerator / denominator;
  }

  const newPL = pLObserved + (1 - pLObserved) * pT;

  return Math.min(Math.max(newPL, 0.01), 0.999);
};

// ─── Adaptive BKT Parameters ───────────────────────────────────

/**
 * Compute per-concept BKT parameters adapted from episode history.
 * Instead of global defaults, the system learns concept-specific rates.
 *
 * @param globalSuccessRate - The student's overall success rate on this concept
 * @param assessmentCount - Number of assessments completed
 * @param conceptClass - The class of concept (affects learning rate)
 */
export const getAdaptiveBKTParams = (
  globalSuccessRate: number,
  assessmentCount: number,
  conceptClass: ConceptClass = 'procedural'
): BKTParams => {
  // Base learning rate varies by concept class
  const basePT: Record<ConceptClass, number> = {
    factual: 0.35,                // Facts can be learned quickly
    procedural: 0.25,             // Procedures take moderate practice
    conceptual: 0.15,             // Concepts need deeper processing
    misconception_resistant: 0.10, // Takes significant effort to truly understand
    transfer: 0.08,               // Transfer skills develop slowly
  };

  let pT = basePT[conceptClass];

  // Adapt learning rate based on demonstrated aptitude
  if (assessmentCount > 3) {
    if (globalSuccessRate > 0.8) {
      pT = Math.min(0.5, pT * 1.3); // Fast learner — increase pT
    } else if (globalSuccessRate < 0.3) {
      pT = Math.max(0.05, pT * 0.7); // Struggling — decrease pT (needs more practice)
    }
  }

  // Adapt guess rate: if the student has very few assessments, assume higher guessing
  const pG = assessmentCount < 3 ? 0.25 : 0.15;

  // Adapt slip rate: lower for mastered concepts (less likely to slip)
  const pS = globalSuccessRate > 0.7 ? 0.05 : 0.12;

  return {
    pL0: DEFAULT_PARAMS.pL0,
    pT,
    pG,
    pS,
  };
};

// ─── Tiered Forgetting Curve ───────────────────────────────────

/**
 * Get the mastery stage label from a probability value.
 */
export const getMasteryStage = (p: number): string => {
  if (p < 0.3) return 'novice';
  if (p < 0.6) return 'developing';
  if (p < 0.85) return 'proficient';
  return 'mastered';
};

/**
 * Compute the effective decay rate for a concept given its class,
 * mastery stage, and personalized retrieval strength.
 *
 * λ_effective = λ_base × masteryMultiplier × (1 / retrievalStrength)
 *
 * Higher retrieval strength = slower decay (active retrieval builds durability).
 */
export const computeEffectiveDecayRate = (
  conceptClass: ConceptClass,
  masteryP: number,
  retrievalStrength: number = 1.0
): number => {
  const baseλ = BASE_DECAY_RATES[conceptClass];
  const stage = getMasteryStage(masteryP);
  const stageMultiplier = MASTERY_STAGE_MULTIPLIERS[stage] ?? 1.0;

  // Retrieval strength dampens decay: more successful retrievals = slower forgetting
  const retrievalDamping = 1 / Math.max(0.5, retrievalStrength);

  return baseλ * stageMultiplier * retrievalDamping;
};

/**
 * Apply Ebbinghaus forgetting curve to a mastery probability.
 *
 * p_decayed = p × e^(-λ_effective × Δt)
 *
 * Where Δt is measured in DAYS (not milliseconds).
 */
export const applyForgettingCurve = (
  p: number,
  decayRate: number,
  timeSinceLastTestMs: number
): number => {
  if (timeSinceLastTestMs <= 0) return p;

  const days = timeSinceLastTestMs / (24 * 60 * 60 * 1000);
  const decayed = p * Math.exp(-decayRate * days);

  // Floor at 0.01 — knowledge never fully disappears (priming effect)
  return Math.max(0.01, decayed);
};

// ─── Uncertainty Tracking ──────────────────────────────────────

/**
 * Compute uncertainty in the mastery estimate.
 *
 * Uncertainty decreases with more assessments (more data = more confidence).
 * Uncertainty increases with time since last test (staleness).
 *
 * Range: 0 (very certain) to 1 (very uncertain)
 */
export const computeUncertainty = (
  assessmentCount: number,
  timeSinceLastTestMs: number
): number => {
  // Base uncertainty from data volume: asymptotically approaches 0
  const dataUncertainty = 1 / (1 + assessmentCount * 0.3);

  // Staleness: uncertainty grows with time since last assessment
  const days = timeSinceLastTestMs / (24 * 60 * 60 * 1000);
  const stalenessUncertainty = Math.min(0.5, days * 0.02); // Caps at 0.5

  return Math.min(1, dataUncertainty + stalenessUncertainty);
};

// ─── Retrieval Strength ────────────────────────────────────────

/**
 * Update retrieval strength after an assessment.
 *
 * Successful active retrieval strengthens memory more than passive review.
 * Failed retrieval weakens slightly but triggers the "desirable difficulty" benefit.
 */
export const updateRetrievalStrength = (
  currentStrength: number,
  wasCorrect: boolean,
  wasActiveRetrieval: boolean = true
): number => {
  if (wasCorrect) {
    // Active retrieval builds stronger memory traces
    const boost = wasActiveRetrieval ? 0.3 : 0.1;
    return Math.min(5.0, currentStrength + boost);
  } else {
    // Failure slightly weakens but not drastically (desirable difficulty effect)
    return Math.max(0.5, currentStrength - 0.1);
  }
};

// ─── Full Mastery Estimate Update ──────────────────────────────

/**
 * Perform a complete mastery estimate update including:
 * 1. Apply forgetting curve to get decayed mastery
 * 2. Update BKT with new evidence
 * 3. Recalculate uncertainty
 * 4. Update retrieval strength
 * 5. Recalculate personalized decay rate
 */
export const updateMasteryEstimate = (
  prev: MasteryEstimate,
  isCorrect: boolean,
  now: number = Date.now()
): MasteryEstimate => {
  const timeSinceLastTest = now - prev.lastTested;

  // 1. Apply forgetting curve to get the "real" current mastery
  const decayedP = applyForgettingCurve(prev.p, prev.decayRate, timeSinceLastTest);

  // 2. Get adaptive BKT parameters for this concept type
  const successRate = prev.assessmentCount > 0
    ? (prev.p + (isCorrect ? 1 : 0)) / (prev.assessmentCount + 1) // Rough approximation
    : (isCorrect ? 0.5 : 0.1);
  const adaptiveParams = getAdaptiveBKTParams(
    successRate,
    prev.assessmentCount,
    prev.conceptClass
  );

  // 3. BKT update from decayed position
  const updatedP = updateMasteryProbability(decayedP, isCorrect, adaptiveParams);

  // 4. Update retrieval strength
  const newRetrievalStrength = updateRetrievalStrength(
    prev.retrievalStrength,
    isCorrect,
    true // Assume active retrieval for tutor-driven assessments
  );

  // 5. Recalculate personalized decay rate
  const newDecayRate = computeEffectiveDecayRate(
    prev.conceptClass,
    updatedP,
    newRetrievalStrength
  );

  // 6. Update uncertainty
  const newAssessmentCount = prev.assessmentCount + 1;
  const newUncertainty = computeUncertainty(newAssessmentCount, 0); // Just tested

  return {
    p: updatedP,
    uncertainty: newUncertainty,
    lastTested: now,
    decayRate: newDecayRate,
    retrievalStrength: newRetrievalStrength,
    assessmentCount: newAssessmentCount,
    conceptClass: prev.conceptClass,
  };
};

// ─── Factory ───────────────────────────────────────────────────

/**
 * Create a fresh mastery estimate for a new concept.
 */
export const createInitialEstimate = (
  conceptClass: ConceptClass = 'procedural'
): MasteryEstimate => ({
  p: 0.1,
  uncertainty: 1.0,
  lastTested: Date.now(),
  decayRate: BASE_DECAY_RATES[conceptClass],
  retrievalStrength: 1.0,
  assessmentCount: 0,
  conceptClass,
});
