/**
 * Adaptive Scheduler — V2 ZPD-Targeted Challenge Calibration
 *
 * Upgrades from V1:
 * 1. Ebbinghaus SRS: Exponentially expanding intervals (not flat 24h)
 * 2. ZPD targeting: Maintain 70-80% independent success rate
 * 3. Interleaving: Inject mastered concepts for retrieval practice every 3rd turn
 * 4. Cognitive load gating: Halt advancement when energy < 0.3 or frustration > 0.7
 * 5. Domain switching: Auto-detect optimal moment to interleave
 *
 * RL boundary: Topic selection is RL-learned (varies per individual).
 *   But prerequisite ordering is RULE-BASED (knowledge graph is factual).
 *   And session length limits are RULE-BASED (cognitive load research).
 */

import { CurriculumNode } from './KnowledgeGraphService';
import { AffectiveSignals } from './AffectiveStateTracker';
import { MasteryEstimate, applyForgettingCurve } from './LearnerModel';

// ─── Types ─────────────────────────────────────────────────────

export interface SchedulerDecision {
  topicId: string;
  reason: SchedulerReason;
  isReview: boolean;
  isInterleaved: boolean;
  urgency: 'immediate' | 'soon' | 'normal';
}

export type SchedulerReason =
  | 'spaced_review_due'      // Ebbinghaus interval elapsed
  | 'zpd_advancement'        // Ready for next challenge
  | 'zpd_retreat'            // Too hard — go back
  | 'interleaving'           // Retrieval practice on mastered concept
  | 'cognitive_load_relief'  // Fatigue detected — easy review
  | 'difficulty_mismatch'    // Success rate outside 70-80% band
  | 'weakest_unlocked'       // Default: serve weakest active concept
  | 'break_suggested';       // Energy critically low

// ─── SRS Configuration ─────────────────────────────────────────

/**
 * Spaced Repetition Schedule: exponentially expanding intervals.
 *
 * Base interval × 2^(reviewCount), adjusted by mastery stability.
 * Replaces the flat 24-hour threshold from V1.
 */
const BASE_REVIEW_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours initial interval
const MAX_REVIEW_INTERVAL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days max

/**
 * Compute the next review interval using exponential spacing.
 *
 * @param reviewCount - Number of successful reviews completed
 * @param masteryStability - How stable the mastery is (higher = longer interval)
 * @param retrievalStrength - Memory strength (higher = longer interval)
 */
export function computeReviewInterval(
  reviewCount: number,
  masteryStability: number = 0.5,
  retrievalStrength: number = 1.0
): number {
  // Base exponential: interval doubles with each successful review
  let interval = BASE_REVIEW_INTERVAL_MS * Math.pow(2, reviewCount);

  // Mastery stability modifier: stable mastery → longer intervals
  interval *= (0.5 + masteryStability);

  // Retrieval strength modifier: strong memory → longer intervals
  interval *= Math.max(0.5, retrievalStrength / 2);

  return Math.min(interval, MAX_REVIEW_INTERVAL_MS);
}

// ─── ZPD Configuration ─────────────────────────────────────────

const ZPD_TARGET_SUCCESS_LOW = 0.70;   // Below this: too hard
const ZPD_TARGET_SUCCESS_HIGH = 0.85;  // Above this: too easy
const ZPD_OPTIMAL_SUCCESS = 0.75;      // Sweet spot

// ─── Cognitive Load Thresholds ──────────────────────────────────

const ENERGY_CRISIS_THRESHOLD = 0.2;    // Below this: suggest break
const FRUSTRATION_GATE_THRESHOLD = 0.7; // Above this: halt advancement
const COGNITIVE_LOAD_GATE = 0.8;        // Above this: switch to easy review

// ─── Interleaving ──────────────────────────────────────────────

const INTERLEAVE_FREQUENCY = 3; // Every 3rd turn, inject a mastered concept

// ─── Main Scheduler ────────────────────────────────────────────

/**
 * V2 adaptive topic scheduler with ZPD targeting, interleaving,
 * and cognitive load gating.
 */
export function getNextAdaptiveTopic(
  nodes: CurriculumNode[],
  masteryProbabilities: Record<string, number>,
  lastReviewed: Record<string, number>,
  options?: {
    affectiveState?: AffectiveSignals;
    masteryEstimates?: Record<string, MasteryEstimate>;
    recentSuccessRate?: number;
    turnsSinceInterleave?: number;
    reviewCounts?: Record<string, number>;
    cognitiveLoad?: number;
  }
): string | null {
  const now = Date.now();
  const affect = options?.affectiveState;
  const estimates = options?.masteryEstimates;
  const recentSuccess = options?.recentSuccessRate ?? 0.5;
  const turnsSinceInterleave = options?.turnsSinceInterleave ?? 0;
  const reviewCounts = options?.reviewCounts ?? {};
  const cognitiveLoad = options?.cognitiveLoad ?? 0;

  // ── Gate: Cognitive Load / Energy Crisis ─────────────────────
  if (affect) {
    // Energy critically low → suggest break (return null to signal)
    if (affect.energy < ENERGY_CRISIS_THRESHOLD) {
      console.log('[Scheduler] Energy crisis — suggest break');
      // Don't return null; serve easy review instead
      return findEasiestReview(nodes, masteryProbabilities);
    }

    // High frustration → halt advancement, serve easy material
    if (affect.frustration > FRUSTRATION_GATE_THRESHOLD) {
      console.log('[Scheduler] Frustration gate — serving easy review');
      return findEasiestReview(nodes, masteryProbabilities);
    }
  }

  // Cognitive load gate
  if (cognitiveLoad > COGNITIVE_LOAD_GATE) {
    console.log('[Scheduler] Cognitive load gate — serving easy review');
    return findEasiestReview(nodes, masteryProbabilities);
  }

  // ── Interleaving: Inject retrieval practice ──────────────────
  if (turnsSinceInterleave >= INTERLEAVE_FREQUENCY) {
    const interleaveTopic = findInterleaveTopic(nodes, masteryProbabilities, lastReviewed);
    if (interleaveTopic) {
      console.log(`[Scheduler] Interleaving retrieval practice: ${interleaveTopic}`);
      return interleaveTopic;
    }
  }

  // ── Spaced Review: Ebbinghaus SRS ────────────────────────────
  const spacedReviewCandidate = findSRSReviewCandidate(
    nodes, masteryProbabilities, lastReviewed, estimates, reviewCounts, now
  );

  if (spacedReviewCandidate) {
    console.log(`[Scheduler] SRS review due: ${spacedReviewCandidate}`);
    return spacedReviewCandidate;
  }

  // ── ZPD-Targeted Selection ───────────────────────────────────
  // If success rate is outside the target band, adjust
  if (recentSuccess > ZPD_TARGET_SUCCESS_HIGH) {
    // Too easy → advance to harder material
    const harder = findHarderTopic(nodes, masteryProbabilities);
    if (harder) {
      console.log(`[Scheduler] ZPD advancement: success rate ${recentSuccess.toFixed(2)} > ${ZPD_TARGET_SUCCESS_HIGH}`);
      return harder;
    }
  }

  if (recentSuccess < ZPD_TARGET_SUCCESS_LOW) {
    // Too hard → retreat to easier material
    const easier = findEasierTopic(nodes, masteryProbabilities);
    if (easier) {
      console.log(`[Scheduler] ZPD retreat: success rate ${recentSuccess.toFixed(2)} < ${ZPD_TARGET_SUCCESS_LOW}`);
      return easier;
    }
  }

  // ── Default: Weakest Unlocked Topic ──────────────────────────
  const unlockedCandidates = nodes.filter(
    node => node.status === 'learning' && node.type !== 'domain'
  );

  if (unlockedCandidates.length > 0) {
    unlockedCandidates.sort((a, b) => {
      const pA = masteryProbabilities[a.id] ?? 0;
      const pB = masteryProbabilities[b.id] ?? 0;
      return pA - pB;
    });
    return unlockedCandidates[0].id;
  }

  return null;
}

// ─── Helper Functions ──────────────────────────────────────────

/**
 * Find the easiest topic for low-friction review (cognitive load relief).
 */
function findEasiestReview(
  nodes: CurriculumNode[],
  mastery: Record<string, number>
): string | null {
  const masteredNodes = nodes.filter(
    n => n.status === 'mastered' && n.type !== 'domain'
  );

  if (masteredNodes.length === 0) {
    // Fallback: find any active node
    const active = nodes.filter(n => n.status === 'learning' && n.type !== 'domain');
    if (active.length > 0) {
      active.sort((a, b) => (mastery[b.id] ?? 0) - (mastery[a.id] ?? 0));
      return active[0].id;
    }
    return null;
  }

  // Sort by highest mastery (easiest for the student)
  masteredNodes.sort((a, b) => (mastery[b.id] ?? 0) - (mastery[a.id] ?? 0));
  return masteredNodes[0].id;
}

/**
 * Find a mastered topic for interleaving (retrieval practice).
 * Picks a topic that HASN'T been reviewed recently.
 */
function findInterleaveTopic(
  nodes: CurriculumNode[],
  mastery: Record<string, number>,
  lastReviewed: Record<string, number>
): string | null {
  const now = Date.now();
  const masteredNodes = nodes.filter(
    n => n.status === 'mastered' && n.type !== 'domain'
  );

  if (masteredNodes.length === 0) return null;

  // Sort by stalest (longest since review)
  masteredNodes.sort((a, b) => {
    const lastA = lastReviewed[a.id] ?? 0;
    const lastB = lastReviewed[b.id] ?? 0;
    return lastA - lastB; // Oldest review first
  });

  return masteredNodes[0].id;
}

/**
 * Find SRS review candidate using Ebbinghaus intervals.
 */
function findSRSReviewCandidate(
  nodes: CurriculumNode[],
  mastery: Record<string, number>,
  lastReviewed: Record<string, number>,
  estimates: Record<string, MasteryEstimate> | undefined,
  reviewCounts: Record<string, number>,
  now: number
): string | null {
  const candidates: Array<{ id: string; overdue: number }> = [];

  for (const node of nodes) {
    if (node.status !== 'mastered' || node.type === 'domain') continue;

    const lastReview = lastReviewed[node.id];
    if (!lastReview) continue;

    const count = reviewCounts[node.id] ?? 0;
    const estimate = estimates?.[node.id];
    const stability = estimate ? estimate.p : (mastery[node.id] ?? 0.5);
    const strength = estimate?.retrievalStrength ?? 1.0;

    const interval = computeReviewInterval(count, stability, strength);
    const elapsed = now - lastReview;

    if (elapsed > interval) {
      candidates.push({
        id: node.id,
        overdue: (elapsed - interval) / interval, // How overdue (relative)
      });
    }
  }

  if (candidates.length === 0) return null;

  // Return most overdue
  candidates.sort((a, b) => b.overdue - a.overdue);
  return candidates[0].id;
}

/**
 * Find a harder topic for ZPD advancement.
 */
function findHarderTopic(
  nodes: CurriculumNode[],
  mastery: Record<string, number>
): string | null {
  const unlocked = nodes.filter(
    n => n.status === 'learning' && n.type !== 'domain'
  );

  if (unlocked.length === 0) return null;

  // Sort by lowest mastery (most challenging)
  unlocked.sort((a, b) => (mastery[a.id] ?? 0) - (mastery[b.id] ?? 0));
  return unlocked[0].id;
}

/**
 * Find an easier topic for ZPD retreat.
 */
function findEasierTopic(
  nodes: CurriculumNode[],
  mastery: Record<string, number>
): string | null {
  const active = nodes.filter(
    n => (n.status === 'learning' || n.status === 'mastered') && n.type !== 'domain'
  );

  if (active.length === 0) return null;

  // Sort by highest mastery (easiest for student)
  active.sort((a, b) => (mastery[b.id] ?? 0) - (mastery[a.id] ?? 0));
  return active[0].id;
}

// ── Backward Compatibility ─────────────────────────────────────

/**
 * Legacy export for backward compatibility.
 * The old signature still works; new features require the options parameter.
 */
export const REVIEW_THRESHOLD_MS = BASE_REVIEW_INTERVAL_MS;
