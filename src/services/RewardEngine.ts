/**
 * Multi-Objective Reward Engine
 *
 * Computes the composite reward signal R_t used to train the pedagogical
 * policy. The core design principle:
 *
 *   α₃ (transfer) >> α₁ (correctness) >> α₄ (engagement)
 *
 * The system must be willing to make the learner "less happy" (harder
 * problems, more retrieval, less hand-holding) if it predicts better
 * long-term outcomes.
 *
 * Anti-TikTok-ification defense:
 * - Engagement is BOUNDED (floor, not objective)
 * - Time-on-platform is NEVER a reward component
 * - Content consumption is NEVER a reward component
 * - Transfer and retention DOMINATE the reward signal
 *
 * Also implements three-tier model routing (Q1 answer):
 * - LIGHT:    routine feedback, hints, summarization (fastest, cheapest)
 * - MID:      lesson planning, explanation, multi-step pedagogy
 * - FRONTIER: misconception diagnosis, ambiguous behavior, high-stakes
 *
 * Model tier escalation triggers:
 * - Learner is stuck repeatedly
 * - Composite confidence is low
 * - Task has high educational value (misconception correction, transfer test)
 * - Explanation may shape durable misunderstanding
 * - Learner is advanced and needs subtle reasoning
 */

// ─── Types ─────────────────────────────────────────────────────

export type ModelTier = 'light' | 'mid' | 'frontier';

export interface RewardSignals {
  // Positive signals (α weights)
  correctness: number;          // α₁ = 0.10 — Was the student correct?
  retentionScore: number;       // α₂ = 0.25 — Spaced review performance
  transferScore: number;        // α₃ = 0.30 — Cross-concept application (DOMINANT)
  engagementSignal: number;     // α₄ = 0.05 — Bounded floor, NOT objective
  challengeAcceptance: number;  // α₅ = 0.15 — Did student attempt harder material?
  selfEfficacyDelta: number;    // α₆ = 0.15 — Confidence growth

  // Negative signals (β penalties)
  frustrationSignal: number;    // β₁ = 0.20 — From AffectiveStateTracker
  boredomSignal: number;        // β₂ = 0.15 — High success + low engagement
  dependencySignal: number;     // β₃ = 0.25 — Hint over-reliance
}

export interface RewardWeights {
  α1: number; // correctness
  α2: number; // retention
  α3: number; // transfer
  α4: number; // engagement (bounded)
  α5: number; // challenge acceptance
  α6: number; // self-efficacy
  β1: number; // frustration penalty
  β2: number; // boredom penalty
  β3: number; // dependency penalty
}

export interface ModelRoutingContext {
  compositeConfidence: number;
  consecutiveFailures: number;
  hasMisconceptions: boolean;
  isTransferTask: boolean;
  isScaffoldingFading: boolean;
  learnerMasteryLevel: number;   // 0-1, average mastery
  taskEducationalValue: 'low' | 'medium' | 'high';
}

// ─── Constants ─────────────────────────────────────────────────

/**
 * Default reward weights.
 * Transfer/retention dominate. Engagement is a floor.
 */
const DEFAULT_WEIGHTS: RewardWeights = {
  α1: 0.10,  // correctness — necessary but not sufficient
  α2: 0.25,  // retention — can they remember it later?
  α3: 0.30,  // transfer — can they apply it elsewhere? (DOMINANT)
  α4: 0.05,  // engagement — bounded, never the objective
  α5: 0.15,  // challenge acceptance — do they attempt harder material?
  α6: 0.15,  // self-efficacy — are they believing in themselves more?
  β1: 0.20,  // frustration — penalty for making them miserable
  β2: 0.15,  // boredom — penalty for under-challenging
  β3: 0.25,  // dependency — penalty for creating hint addiction
};

const STORAGE_KEY = 'lumina_reward_history';
const MAX_HISTORY = 200;

// ─── Reward Engine ─────────────────────────────────────────────

export class RewardEngine {
  private weights: RewardWeights;
  private rewardHistory: Array<{ timestamp: number; reward: number; conceptId: string }> = [];

  constructor(weights: RewardWeights = DEFAULT_WEIGHTS) {
    this.weights = weights;
    this.loadHistory();
  }

  // ── Persistence ──────────────────────────────────────────────

  private loadHistory(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.rewardHistory = JSON.parse(raw);
    } catch {
      this.rewardHistory = [];
    }
  }

  private persistHistory(): void {
    try {
      // Keep only last MAX_HISTORY entries
      if (this.rewardHistory.length > MAX_HISTORY) {
        this.rewardHistory = this.rewardHistory.slice(-MAX_HISTORY);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.rewardHistory));
    } catch {
      // Silent fail
    }
  }

  // ── Composite Reward Computation ─────────────────────────────

  /**
   * Compute the composite reward R_t from individual signals.
   *
   * R_t = Σ(αᵢ × positive_signalᵢ) - Σ(βⱼ × negative_signalⱼ)
   *
   * Range: approximately -1 to +1
   */
  public computeReward(signals: RewardSignals, conceptId: string): number {
    const positive =
      this.weights.α1 * signals.correctness +
      this.weights.α2 * signals.retentionScore +
      this.weights.α3 * signals.transferScore +
      this.weights.α4 * signals.engagementSignal +
      this.weights.α5 * signals.challengeAcceptance +
      this.weights.α6 * signals.selfEfficacyDelta;

    const negative =
      this.weights.β1 * signals.frustrationSignal +
      this.weights.β2 * signals.boredomSignal +
      this.weights.β3 * signals.dependencySignal;

    const reward = positive - negative;

    // Record in history
    this.rewardHistory.push({
      timestamp: Date.now(),
      reward,
      conceptId,
    });
    this.persistHistory();

    return reward;
  }

  // ── Signal Computation Helpers ───────────────────────────────

  /**
   * Compute the dependency signal: penalty for increasing reliance on scaffolding.
   *
   * High hint request rate + scaffolding not fading = dependency forming.
   */
  public computeDependencySignal(
    hintRequestRate: number,       // 0-1, fraction of turns with hint requests
    scaffoldingLevel: number,      // 0-1, current scaffolding level
    scaffoldingTrend: 'fading' | 'stable' | 'increasing'
  ): number {
    let dependency = 0;

    // High hint request rate
    if (hintRequestRate > 0.5) {
      dependency += (hintRequestRate - 0.5) * 2; // 0.5-1.0 → 0-1
    }

    // Scaffolding not fading when it should be
    if (scaffoldingLevel > 0.6 && scaffoldingTrend !== 'fading') {
      dependency += 0.2;
    }

    // Scaffolding increasing (regression)
    if (scaffoldingTrend === 'increasing') {
      dependency += 0.3;
    }

    return Math.min(1, dependency);
  }

  /**
   * Compute the boredom signal: high success + low engagement = bored.
   *
   * This catches the case where the tutor is serving tasks far below
   * the student's ZPD — they're getting everything right but aren't
   * challenged or engaged.
   */
  public computeBoredomSignal(
    recentSuccessRate: number,     // 0-1, rolling success rate
    engagementScore: number,       // 0-1, from affect tracker
    messageLengthTrend: 'increasing' | 'stable' | 'decreasing'
  ): number {
    let boredom = 0;

    // High success + low engagement = classic boredom
    if (recentSuccessRate > 0.9 && engagementScore < 0.4) {
      boredom += 0.5;
    }

    // Declining message lengths suggest disengagement
    if (messageLengthTrend === 'decreasing') {
      boredom += 0.2;
    }

    // Very high success rate alone is a signal (too easy)
    if (recentSuccessRate > 0.95) {
      boredom += 0.15;
    }

    return Math.min(1, boredom);
  }

  /**
   * Compute transfer score from assessment results on novel problems.
   *
   * Transfer is the DOMINANT reward signal — it measures whether the
   * student can apply learned skills in new contexts.
   */
  public computeTransferScore(
    transferTestResults: boolean[], // Most recent transfer test outcomes
    originalConceptMastery: number  // Mastery on the original concept
  ): number {
    if (transferTestResults.length === 0) return 0;

    const successRate = transferTestResults.filter(Boolean).length / transferTestResults.length;

    // Transfer success when original concept is well-mastered is very valuable
    return successRate * Math.min(1, originalConceptMastery * 1.5);
  }

  /**
   * Compute challenge acceptance: did the student voluntarily attempt harder material?
   */
  public computeChallengeAcceptance(
    voluntarilyAttemptedHarder: boolean,
    successOnHarderChallenge: boolean | null,
    selfEfficacyBefore: number
  ): number {
    if (!voluntarilyAttemptedHarder) return 0;

    let score = 0.5; // Attempting is itself valuable

    if (successOnHarderChallenge === true) {
      score += 0.5; // Success on self-selected harder challenge = max
    } else if (successOnHarderChallenge === false) {
      // Failure on self-selected challenge is still valuable (growth mindset)
      score += 0.1;
    }

    // Extra credit for low-confidence learners who still attempt
    if (selfEfficacyBefore < 0.4) {
      score += 0.2;
    }

    return Math.min(1, score);
  }

  // ── Three-Tier Model Routing ─────────────────────────────────

  /**
   * Determine which model tier to use for the current interaction.
   *
   * The real product is not "best answer every time."
   * It is best allocation of intelligence per moment.
   *
   * Light:    routine feedback, hints, summarization
   * Mid:      lesson planning, explanation, multi-step pedagogy
   * Frontier: misconception diagnosis, ambiguous behavior, high-stakes
   */
  public routeModelTier(context: ModelRoutingContext): ModelTier {
    // ── FRONTIER triggers (any one is sufficient) ──────────────
    if (context.hasMisconceptions) return 'frontier';
    if (context.consecutiveFailures >= 4) return 'frontier';
    if (context.isTransferTask) return 'frontier';
    if (context.compositeConfidence < 0.3) return 'frontier';
    if (context.taskEducationalValue === 'high') return 'frontier';
    if (context.learnerMasteryLevel > 0.8 && context.compositeConfidence < 0.6) {
      // Advanced learner with low confidence = subtle reasoning needed
      return 'frontier';
    }

    // ── MID triggers ──────────────────────────────────────────
    if (context.isScaffoldingFading) return 'mid';
    if (context.consecutiveFailures >= 2) return 'mid';
    if (context.compositeConfidence < 0.6) return 'mid';
    if (context.taskEducationalValue === 'medium') return 'mid';
    if (context.learnerMasteryLevel > 0.6) return 'mid'; // More nuanced teaching

    // ── LIGHT: everything else ────────────────────────────────
    return 'light';
  }

  /**
   * Get the model name for a given tier.
   * These can be configured per deployment.
   */
  public getModelForTier(tier: ModelTier): string {
    switch (tier) {
      case 'light': return 'gemini-2.0-flash-lite';
      case 'mid': return 'gemini-2.5-flash';
      case 'frontier': return 'gemini-2.5-pro';
    }
  }

  // ── Reward Trajectory ────────────────────────────────────────

  /**
   * Get reward history for sparkline visualization.
   */
  public getRewardTrajectory(
    conceptId?: string,
    window: number = 20
  ): number[] {
    const filtered = conceptId
      ? this.rewardHistory.filter(r => r.conceptId === conceptId)
      : this.rewardHistory;

    return filtered.slice(-window).map(r => r.reward);
  }

  /**
   * Get the average reward over a window.
   */
  public getAverageReward(window: number = 10): number {
    const recent = this.rewardHistory.slice(-window);
    if (recent.length === 0) return 0;
    return recent.reduce((sum, r) => sum + r.reward, 0) / recent.length;
  }

  /**
   * Get the reward trend: is the tutor getting better or worse?
   */
  public getRewardTrend(): 'improving' | 'stable' | 'declining' {
    if (this.rewardHistory.length < 10) return 'stable';

    const firstHalf = this.rewardHistory.slice(-10, -5);
    const secondHalf = this.rewardHistory.slice(-5);

    const avgFirst = firstHalf.reduce((s, r) => s + r.reward, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, r) => s + r.reward, 0) / secondHalf.length;

    if (avgSecond > avgFirst + 0.05) return 'improving';
    if (avgSecond < avgFirst - 0.05) return 'declining';
    return 'stable';
  }

  // ── Accessors ────────────────────────────────────────────────

  public getWeights(): RewardWeights {
    return { ...this.weights };
  }

  public getHistoryLength(): number {
    return this.rewardHistory.length;
  }

  public clear(): void {
    this.rewardHistory = [];
    this.persistHistory();
  }
}
