/**
 * Affective State Tracker — Behavioral Affect Modeling
 *
 * Models S_a — the learner's motivational and emotional state vector.
 * All signals are derived from BEHAVIORAL observations (text patterns,
 * timing, interaction patterns). No biometric data — fully FERPA/COPPA
 * compliant.
 *
 * Tracked dimensions:
 *   energy       — Session-level fatigue (decays over time)
 *   curiosity    — Self-initiated exploration beyond curriculum scope
 *   frustration  — Consecutive failures, terse responses, hint over-use
 *   confidence   — Learner's self-efficacy (inferred + self-reported)
 *
 * Design:
 * - Each signal is a continuous 0-1 value
 * - Signals are updated per-turn with exponential smoothing
 * - The tracker emits "gating signals" for the pedagogical policy:
 *   → High frustration → reduce difficulty
 *   → Low energy → suggest break
 *   → High curiosity → allow exploration tangent
 *   → Low confidence → increase scaffolding
 */

// ─── Types ─────────────────────────────────────────────────────

export interface AffectiveSignals {
  energy: number;       // 0 = exhausted, 1 = fresh
  curiosity: number;    // 0 = passive, 1 = actively exploring
  frustration: number;  // 0 = calm, 1 = very frustrated
  confidence: number;   // 0 = no self-belief, 1 = strong self-efficacy
}

export interface AffectiveGatingSignals {
  shouldReduceDifficulty: boolean;
  shouldSuggestBreak: boolean;
  shouldAllowExploration: boolean;
  shouldIncreaseScaffolding: boolean;
  shouldCelebrateProgress: boolean;
  cognitiveLoadEstimate: number; // 0-1
}

export interface InteractionSignals {
  messageLength: number;           // Character count of student message
  responseTimeMs: number;          // Time between agent message and student reply
  isCorrect: boolean | null;       // null if not an assessment turn
  wasHintRequest: boolean;         // Student explicitly asked for help
  wasSelfInitiatedQuestion: boolean; // Student asked something beyond the curriculum
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  selfReportedConfidence?: number; // 1-5 if student was asked
}

// ─── Constants ─────────────────────────────────────────────────

const SESSION_FATIGUE_MINUTES = 90;     // Full session = 90 min before energy hits floor
const ENERGY_FLOOR = 0.1;              // Energy never hits zero (can always do something)
const FRUSTRATION_DECAY = 0.85;         // Exponential smoothing: frustration decays 15% per turn
const CURIOSITY_DECAY = 0.95;          // Curiosity decays slowly when not reinforced
const SHORT_RESPONSE_THRESHOLD = 15;    // < 15 chars = terse/disengaged
const LONG_RESPONSE_BONUS = 80;         // > 80 chars = engaged
const HINT_FRUSTRATION_BOOST = 0.08;    // Each hint request slightly bumps frustration
const FAILURE_FRUSTRATION_BOOST = 0.15; // Each failure significantly bumps frustration
const SUCCESS_FRUSTRATION_DECAY = 0.12; // Each success reduces frustration

// ─── Tracker ───────────────────────────────────────────────────

export class AffectiveStateTracker {
  private signals: AffectiveSignals;
  private sessionStartTime: number;
  private turnCount: number = 0;
  private hintRequestCount: number = 0;
  private messageLengths: number[] = [];
  private responseTimes: number[] = [];

  constructor(sessionStartTime: number = Date.now()) {
    this.sessionStartTime = sessionStartTime;
    this.signals = {
      energy: 1.0,
      curiosity: 0.5,
      frustration: 0.0,
      confidence: 0.5,
    };
  }

  // ── Update from Interaction ──────────────────────────────────

  /**
   * Update all affective signals from a single interaction.
   * Called once per student message.
   */
  public update(interaction: InteractionSignals): AffectiveSignals {
    this.turnCount++;
    this.messageLengths.push(interaction.messageLength);
    if (interaction.responseTimeMs > 0) {
      this.responseTimes.push(interaction.responseTimeMs);
    }
    if (interaction.wasHintRequest) {
      this.hintRequestCount++;
    }

    this.updateEnergy();
    this.updateCuriosity(interaction);
    this.updateFrustration(interaction);
    this.updateConfidence(interaction);

    return this.getSignals();
  }

  // ── Energy ───────────────────────────────────────────────────

  /**
   * Energy decays linearly over session duration.
   * Based on cognitive load research: ~90 min is the attention limit.
   */
  private updateEnergy(): void {
    const minutesInSession = (Date.now() - this.sessionStartTime) / (60 * 1000);
    this.signals.energy = Math.max(
      ENERGY_FLOOR,
      1.0 - (minutesInSession / SESSION_FATIGUE_MINUTES)
    );
  }

  // ── Curiosity ────────────────────────────────────────────────

  /**
   * Curiosity tracks self-initiated exploration.
   * Spikes when: student asks questions beyond curriculum scope.
   * Decays slowly when: student is only answering prompted questions.
   */
  private updateCuriosity(interaction: InteractionSignals): void {
    if (interaction.wasSelfInitiatedQuestion) {
      // Spike: student is exploring
      this.signals.curiosity = Math.min(1,
        this.signals.curiosity + 0.15
      );
    } else {
      // Natural decay per turn (exponential smoothing)
      this.signals.curiosity *= CURIOSITY_DECAY;
    }

    // Long, thoughtful responses also indicate curiosity
    if (interaction.messageLength > LONG_RESPONSE_BONUS) {
      this.signals.curiosity = Math.min(1,
        this.signals.curiosity + 0.03
      );
    }
  }

  // ── Frustration ──────────────────────────────────────────────

  /**
   * Frustration is a compound signal:
   * - Consecutive failures increase it
   * - Hint requests mildly increase it (asking for help can mean struggle)
   * - Terse responses increase it (disengagement signal)
   * - Successes decrease it
   * - Natural decay per turn (frustration fades over time)
   */
  private updateFrustration(interaction: InteractionSignals): void {
    // Base decay: frustration naturally fades
    this.signals.frustration *= FRUSTRATION_DECAY;

    // Failure boost
    if (interaction.isCorrect === false) {
      this.signals.frustration += FAILURE_FRUSTRATION_BOOST;

      // Consecutive failures amplify frustration non-linearly
      if (interaction.consecutiveFailures >= 3) {
        this.signals.frustration += interaction.consecutiveFailures * 0.05;
      }
    }

    // Success relief
    if (interaction.isCorrect === true) {
      this.signals.frustration -= SUCCESS_FRUSTRATION_DECAY;

      // Consecutive successes bring strong relief
      if (interaction.consecutiveSuccesses >= 3) {
        this.signals.frustration -= 0.1;
      }
    }

    // Hint request boost
    if (interaction.wasHintRequest) {
      this.signals.frustration += HINT_FRUSTRATION_BOOST;
    }

    // Terse response boost (< 15 chars is a red flag)
    if (interaction.messageLength < SHORT_RESPONSE_THRESHOLD && interaction.messageLength > 0) {
      this.signals.frustration += 0.05;
    }

    // Clamp
    this.signals.frustration = Math.max(0, Math.min(1, this.signals.frustration));
  }

  // ── Confidence ───────────────────────────────────────────────

  /**
   * Confidence is estimated from:
   * 1. Rolling success rate (primary signal)
   * 2. Self-reported confidence ratings (when available)
   * 3. Response patterns (long, detailed responses = higher confidence)
   */
  private updateConfidence(interaction: InteractionSignals): void {
    // If we have explicit self-reported confidence, weight it heavily
    if (interaction.selfReportedConfidence !== undefined) {
      const normalized = (interaction.selfReportedConfidence - 1) / 4; // 1-5 → 0-1
      // Blend: 60% self-reported + 40% behavioral
      this.signals.confidence = 0.6 * normalized + 0.4 * this.signals.confidence;
      return;
    }

    // Behavioral estimation: exponential smoothing of success rate
    if (interaction.isCorrect !== null) {
      const outcomeSignal = interaction.isCorrect ? 0.8 : 0.2;
      this.signals.confidence = 0.7 * this.signals.confidence + 0.3 * outcomeSignal;
    }

    // Long responses with correct answers indicate high confidence
    if (interaction.isCorrect === true && interaction.messageLength > LONG_RESPONSE_BONUS) {
      this.signals.confidence = Math.min(1, this.signals.confidence + 0.05);
    }
  }

  // ── Cognitive Load Estimation ────────────────────────────────

  /**
   * Estimates cognitive load from observable behavioral signals.
   * High cognitive load = slow responses + errors + declining message quality.
   *
   * Range: 0 (minimal load) to 1 (overloaded)
   */
  public computeCognitiveLoad(): number {
    let load = 0;

    // Factor 1: Low energy
    load += (1 - this.signals.energy) * 0.25;

    // Factor 2: High frustration
    load += this.signals.frustration * 0.30;

    // Factor 3: Increasing response times (compare last 3 vs first 3)
    if (this.responseTimes.length >= 6) {
      const early = this.responseTimes.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
      const recent = this.responseTimes.slice(-3).reduce((a, b) => a + b, 0) / 3;
      if (recent > early * 1.5) {
        load += 0.20; // Response times increasing by 50%+ → cognitive strain
      }
    }

    // Factor 4: Declining message lengths (disengagement)
    if (this.messageLengths.length >= 6) {
      const early = this.messageLengths.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
      const recent = this.messageLengths.slice(-3).reduce((a, b) => a + b, 0) / 3;
      if (recent < early * 0.5) {
        load += 0.15; // Message lengths dropping by 50%+ → terse/tired
      }
    }

    // Factor 5: High hint request rate
    const hintRate = this.turnCount > 0 ? this.hintRequestCount / this.turnCount : 0;
    if (hintRate > 0.5) {
      load += 0.10; // Asking for hints on >50% of turns
    }

    return Math.min(1, load);
  }

  // ── Gating Signals ───────────────────────────────────────────

  /**
   * Compute gating signals for the pedagogical policy.
   * These are boolean triggers that modify the tutor's behavior.
   */
  public computeGatingSignals(): AffectiveGatingSignals {
    const cognitiveLoad = this.computeCognitiveLoad();

    return {
      shouldReduceDifficulty: this.signals.frustration > 0.6 || cognitiveLoad > 0.7,
      shouldSuggestBreak: this.signals.energy < 0.2 || cognitiveLoad > 0.85,
      shouldAllowExploration: this.signals.curiosity > 0.7 && this.signals.frustration < 0.3,
      shouldIncreaseScaffolding: this.signals.confidence < 0.3 || this.signals.frustration > 0.5,
      shouldCelebrateProgress: this.signals.confidence > 0.7 && this.signals.frustration < 0.2,
      cognitiveLoadEstimate: cognitiveLoad,
    };
  }

  // ── Accessors ────────────────────────────────────────────────

  public getSignals(): AffectiveSignals {
    return { ...this.signals };
  }

  public getTurnCount(): number {
    return this.turnCount;
  }

  public getHintRequestRate(): number {
    return this.turnCount > 0 ? this.hintRequestCount / this.turnCount : 0;
  }

  /**
   * Import signals from external source (e.g., TutorBeliefState).
   */
  public importSignals(signals: AffectiveSignals): void {
    this.signals = { ...signals };
  }

  public reset(sessionStartTime: number = Date.now()): void {
    this.sessionStartTime = sessionStartTime;
    this.turnCount = 0;
    this.hintRequestCount = 0;
    this.messageLengths = [];
    this.responseTimes = [];
    this.signals = {
      energy: 1.0,
      curiosity: 0.5,
      frustration: 0.0,
      confidence: 0.5,
    };
  }
}
