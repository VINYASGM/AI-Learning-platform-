/**
 * Tutor Belief State — The Central State Vector s_t
 *
 * The formal POMDP belief state of the recursive tutor system.
 * Contains 7 sub-states and serves as the single source of truth
 * for all pedagogical decisions.
 *
 * Sub-states:
 *   S_k: Knowledge state (per-skill mastery with uncertainty + decay)
 *   S_m: Misconception state (active misconceptions with confidence)
 *   S_a: Motivation/affect state (energy, curiosity, frustration, confidence)
 *   S_session: Session context (time, tasks, recent success rate)
 *   S_history: History features (days since last session, velocity)
 *   S_curriculum: Curriculum state (current topic, pending reviews)
 *   S_goal: Goal state (active goals, progress)
 *
 * All state is persisted to localStorage and rehydrated on load.
 */

import {
  MasteryEstimate,
  ConceptClass,
  createInitialEstimate,
  updateMasteryEstimate,
  applyForgettingCurve,
  computeUncertainty,
} from './LearnerModel';

// ─── Sub-State Types ───────────────────────────────────────────

export interface AffectiveState {
  energy: number;       // 0-1, decays over session
  curiosity: number;    // 0-1, spikes on self-initiated exploration
  frustration: number;  // 0-1, increases on consecutive failures
  confidence: number;   // 0-1, learner's self-efficacy estimate
}

export interface SessionContext {
  sessionStartTime: number;
  timeInSessionMs: number;
  tasksCompleted: number;
  recentSuccessRate: number;  // Rolling window of last 5
  turnsThisSession: number;
  hintRequestsThisSession: number;
}

export interface HistoryFeatures {
  daysSinceLastSession: number;
  overallVelocity: number;       // Concepts mastered per session (rolling avg)
  totalSessions: number;
  scaffoldingLevels: Record<string, number>; // Per-concept 0-1
}

export interface CurriculumState {
  currentTopicId: string;
  recentTopics: string[];        // Last 5 topics studied
  pendingReviews: string[];      // Concepts due for spaced review
}

export interface GoalState {
  activeGoals: string[];
  goalProgress: Record<string, number>; // 0-1 per goal
}

// ─── Full Belief State ─────────────────────────────────────────

export interface BeliefState {
  // S_k: Knowledge state
  knowledgeState: Record<string, MasteryEstimate>;

  // S_a: Affective state
  affectiveState: AffectiveState;

  // S_session: Session context
  sessionContext: SessionContext;

  // S_history: Historical features
  historyFeatures: HistoryFeatures;

  // S_curriculum: Curriculum state
  curriculumState: CurriculumState;

  // S_goal: Goal state
  goalState: GoalState;

  // Meta
  lastUpdated: number;
  version: number;
}

// ─── Constants ─────────────────────────────────────────────────

const STORAGE_KEY = 'lumina_belief_state';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes = new session
const RECENT_WINDOW = 5; // Rolling window size for success rate
const CONFIDENCE_THRESHOLD = 0.85; // Below this → critique needed

// ─── Concept Class Registry ───────────────────────────────────

/**
 * Map of concept IDs to their class type.
 * Start with manual classification; evolve to LLM-inferred.
 */
const CONCEPT_CLASS_MAP: Record<string, ConceptClass> = {
  'sub-addition': 'procedural',
  'sub-multiplication': 'procedural',
  'topic-arithmetic': 'procedural',
  'sub-linear': 'procedural',
  'sub-quadratics': 'conceptual',
  'topic-algebra': 'conceptual',
  'sub-limits': 'conceptual',
  'sub-derivatives': 'transfer',
  'topic-calculus': 'transfer',
  'domain-math': 'factual',
};

export const getConceptClass = (conceptId: string): ConceptClass => {
  return CONCEPT_CLASS_MAP[conceptId] || 'procedural';
};

// ─── State Manager ─────────────────────────────────────────────

export class TutorBeliefStateManager {
  private state: BeliefState;
  private recentOutcomes: boolean[] = []; // For rolling success rate

  constructor() {
    this.state = this.load();
    this.checkSessionBoundary();
  }

  // ── Persistence ──────────────────────────────────────────────

  private load(): BeliefState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as BeliefState;
        // Migrate old mastery probabilities if needed
        return { ...this.createDefault(), ...parsed };
      }
    } catch {
      console.warn('[BeliefState] Failed to load, starting fresh.');
    }
    return this.createDefault();
  }

  private persist(): void {
    try {
      this.state.lastUpdated = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      console.warn('[BeliefState] Failed to persist.');
    }
  }

  private createDefault(): BeliefState {
    return {
      knowledgeState: {},
      affectiveState: {
        energy: 1.0,
        curiosity: 0.5,
        frustration: 0.0,
        confidence: 0.5,
      },
      sessionContext: {
        sessionStartTime: Date.now(),
        timeInSessionMs: 0,
        tasksCompleted: 0,
        recentSuccessRate: 0.5,
        turnsThisSession: 0,
        hintRequestsThisSession: 0,
      },
      historyFeatures: {
        daysSinceLastSession: 0,
        overallVelocity: 0,
        totalSessions: 0,
        scaffoldingLevels: {},
      },
      curriculumState: {
        currentTopicId: 'sub-linear',
        recentTopics: [],
        pendingReviews: [],
      },
      goalState: {
        activeGoals: ['Master Algebra'],
        goalProgress: {},
      },
      lastUpdated: Date.now(),
      version: 1,
    };
  }

  // ── Session Management ───────────────────────────────────────

  private checkSessionBoundary(): void {
    const timeSinceLastUpdate = Date.now() - this.state.lastUpdated;
    if (timeSinceLastUpdate > SESSION_TIMEOUT_MS) {
      // New session detected
      const daysSince = timeSinceLastUpdate / (24 * 60 * 60 * 1000);
      this.state.historyFeatures.daysSinceLastSession = daysSince;
      this.state.historyFeatures.totalSessions++;

      // Reset session context
      this.state.sessionContext = {
        sessionStartTime: Date.now(),
        timeInSessionMs: 0,
        tasksCompleted: 0,
        recentSuccessRate: this.state.sessionContext.recentSuccessRate,
        turnsThisSession: 0,
        hintRequestsThisSession: 0,
      };

      // Reset affective state for new session
      this.state.affectiveState.energy = 1.0;
      this.state.affectiveState.frustration = 0.0;

      // Apply forgetting curves to all knowledge
      this.applyDecayToAllKnowledge();

      this.persist();
      console.log(`[BeliefState] New session detected. ${daysSince.toFixed(1)} days since last session.`);
    }
  }

  /**
   * Apply forgetting curves to all knowledge nodes.
   * Called at session boundaries to reflect time-based decay.
   */
  private applyDecayToAllKnowledge(): void {
    const now = Date.now();
    for (const [conceptId, estimate] of Object.entries(this.state.knowledgeState)) {
      const timeSince = now - estimate.lastTested;
      if (timeSince > 0) {
        const decayed = applyForgettingCurve(estimate.p, estimate.decayRate, timeSince);
        const newUncertainty = computeUncertainty(estimate.assessmentCount, timeSince);
        this.state.knowledgeState[conceptId] = {
          ...estimate,
          p: decayed,
          uncertainty: newUncertainty,
        };
      }
    }
  }

  // ── Knowledge State Updates ──────────────────────────────────

  /**
   * Get the current (decay-adjusted) mastery estimate for a concept.
   */
  public getMasteryEstimate(conceptId: string): MasteryEstimate {
    const existing = this.state.knowledgeState[conceptId];
    if (!existing) {
      const conceptClass = getConceptClass(conceptId);
      return createInitialEstimate(conceptClass);
    }

    // Apply forgetting curve to return current "real" mastery
    const timeSince = Date.now() - existing.lastTested;
    if (timeSince > 60 * 60 * 1000) { // Only decay after 1 hour
      return {
        ...existing,
        p: applyForgettingCurve(existing.p, existing.decayRate, timeSince),
        uncertainty: computeUncertainty(existing.assessmentCount, timeSince),
      };
    }

    return existing;
  }

  /**
   * Get the raw (non-decayed) mastery probability for backward compatibility.
   */
  public getRawMastery(conceptId: string): number {
    return this.state.knowledgeState[conceptId]?.p ?? 0.1;
  }

  /**
   * Update knowledge state after an assessment.
   * Returns the updated estimate.
   */
  public updateKnowledge(
    conceptId: string,
    isCorrect: boolean
  ): { before: MasteryEstimate; after: MasteryEstimate } {
    const conceptClass = getConceptClass(conceptId);
    const current = this.state.knowledgeState[conceptId] || createInitialEstimate(conceptClass);

    const updated = updateMasteryEstimate(current, isCorrect);
    this.state.knowledgeState[conceptId] = updated;

    // Update rolling success rate
    this.recentOutcomes.push(isCorrect);
    if (this.recentOutcomes.length > RECENT_WINDOW) {
      this.recentOutcomes.shift();
    }
    this.state.sessionContext.recentSuccessRate =
      this.recentOutcomes.filter(Boolean).length / this.recentOutcomes.length;

    // Update session context
    this.state.sessionContext.tasksCompleted++;

    this.persist();
    return { before: current, after: updated };
  }

  // ── Affective State Updates ──────────────────────────────────

  /**
   * Update affective state signals.
   * Called after every student interaction.
   */
  public updateAffect(params: {
    isCorrect?: boolean;
    responseTimeMs?: number;
    messageLength?: number;
    wasHintRequest?: boolean;
    wasSelfInitiatedQuestion?: boolean;
    consecutiveFailures?: number;
  }): void {
    const {
      isCorrect,
      wasHintRequest,
      wasSelfInitiatedQuestion,
      consecutiveFailures = 0,
    } = params;

    // Energy: decays over session time
    const minutesInSession = (Date.now() - this.state.sessionContext.sessionStartTime) / (60 * 1000);
    this.state.affectiveState.energy = Math.max(0.1, 1.0 - (minutesInSession / 90));

    // Frustration: increases with consecutive failures and hint requests
    if (isCorrect === false) {
      this.state.affectiveState.frustration = Math.min(1,
        this.state.affectiveState.frustration + 0.15
      );
    } else if (isCorrect === true) {
      this.state.affectiveState.frustration = Math.max(0,
        this.state.affectiveState.frustration - 0.1
      );
    }
    if (consecutiveFailures >= 3) {
      this.state.affectiveState.frustration = Math.min(1,
        consecutiveFailures * 0.2
      );
    }

    // Curiosity: spikes on self-initiated exploration
    if (wasSelfInitiatedQuestion) {
      this.state.affectiveState.curiosity = Math.min(1,
        this.state.affectiveState.curiosity + 0.15
      );
    } else {
      // Natural decay per turn
      this.state.affectiveState.curiosity = Math.max(0,
        this.state.affectiveState.curiosity - 0.02
      );
    }

    // Confidence: rolling success rate calibrated by self-assessment
    this.state.affectiveState.confidence = this.state.sessionContext.recentSuccessRate;

    // Track hint requests
    if (wasHintRequest) {
      this.state.sessionContext.hintRequestsThisSession++;
    }

    this.state.sessionContext.turnsThisSession++;
    this.state.sessionContext.timeInSessionMs = Date.now() - this.state.sessionContext.sessionStartTime;

    this.persist();
  }

  // ── Curriculum State ─────────────────────────────────────────

  public setCurrentTopic(topicId: string): void {
    const prev = this.state.curriculumState.currentTopicId;
    this.state.curriculumState.currentTopicId = topicId;

    // Track recent topics (deduped, max 5)
    if (prev !== topicId) {
      this.state.curriculumState.recentTopics =
        [topicId, ...this.state.curriculumState.recentTopics.filter(t => t !== topicId)].slice(0, 5);
    }

    this.persist();
  }

  public addPendingReview(conceptId: string): void {
    if (!this.state.curriculumState.pendingReviews.includes(conceptId)) {
      this.state.curriculumState.pendingReviews.push(conceptId);
      this.persist();
    }
  }

  public removePendingReview(conceptId: string): void {
    this.state.curriculumState.pendingReviews =
      this.state.curriculumState.pendingReviews.filter(id => id !== conceptId);
    this.persist();
  }

  // ── Scaffolding ──────────────────────────────────────────────

  public getScaffoldingLevel(conceptId: string): number {
    return this.state.historyFeatures.scaffoldingLevels[conceptId] ?? 1.0;
  }

  public setScaffoldingLevel(conceptId: string, level: number): void {
    this.state.historyFeatures.scaffoldingLevels[conceptId] =
      Math.max(0, Math.min(1, level));
    this.persist();
  }

  // ── Composite Confidence Score ───────────────────────────────

  /**
   * Compute the composite confidence score used for recursion gating.
   * If confidence > CONFIDENCE_THRESHOLD (0.85), skip the critique loop.
   *
   * Factors:
   * - Current topic mastery + certainty
   * - Recent success rate
   * - Low frustration
   * - No active misconceptions (checked externally)
   */
  public computeCompositeConfidence(activeMisconceptionCount: number = 0): number {
    const topicId = this.state.curriculumState.currentTopicId;
    const estimate = this.getMasteryEstimate(topicId);

    // Mastery confidence: high mastery + low uncertainty = high confidence
    const masteryConfidence = estimate.p * (1 - estimate.uncertainty);

    // Session signal: recent success
    const sessionConfidence = this.state.sessionContext.recentSuccessRate;

    // Penalty for misconceptions
    const misconceptionPenalty = activeMisconceptionCount * 0.2;

    // Penalty for frustration
    const frustrationPenalty = this.state.affectiveState.frustration * 0.3;

    const composite = (
      masteryConfidence * 0.4 +
      sessionConfidence * 0.3 +
      (1 - frustrationPenalty) * 0.15 +
      (1 - misconceptionPenalty) * 0.15
    );

    return Math.max(0, Math.min(1, composite));
  }

  /**
   * Whether the current state warrants a critique pass.
   */
  public shouldCritique(activeMisconceptionCount: number = 0): boolean {
    return this.computeCompositeConfidence(activeMisconceptionCount) < CONFIDENCE_THRESHOLD;
  }

  // ── Accessors ────────────────────────────────────────────────

  public getState(): BeliefState {
    return { ...this.state };
  }

  public getAffectiveState(): AffectiveState {
    return { ...this.state.affectiveState };
  }

  public getSessionContext(): SessionContext {
    return { ...this.state.sessionContext };
  }

  public getHistoryFeatures(): HistoryFeatures {
    return { ...this.state.historyFeatures };
  }

  public getCurriculumState(): CurriculumState {
    return { ...this.state.curriculumState };
  }

  public getGoalState(): GoalState {
    return { ...this.state.goalState };
  }

  /**
   * Get all mastery probabilities as a flat Record (backward compatibility).
   */
  public getMasteryProbabilities(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [id, estimate] of Object.entries(this.state.knowledgeState)) {
      result[id] = this.getMasteryEstimate(id).p;
    }
    return result;
  }

  /**
   * Import legacy mastery probabilities into the belief state.
   */
  public importLegacyMastery(probs: Record<string, number>): void {
    for (const [conceptId, p] of Object.entries(probs)) {
      if (!this.state.knowledgeState[conceptId]) {
        const estimate = createInitialEstimate(getConceptClass(conceptId));
        estimate.p = p;
        this.state.knowledgeState[conceptId] = estimate;
      }
    }
    this.persist();
  }

  public clear(): void {
    this.state = this.createDefault();
    this.recentOutcomes = [];
    this.persist();
  }
}
