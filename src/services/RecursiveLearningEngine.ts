/**
 * Recursive Learning Engine
 * 
 * The core loop that makes agents learn from their own behavior.
 * After each interaction, the engine:
 * 1. Bundles the exchange into a structured Episode
 * 2. Scores the episode on 4 axes (clarity, engagement, progress, efficiency)
 * 3. Synthesizes actionable feedback directives
 * 4. Determines if this episode warrants a self-reflection cycle
 * 
 * Self-reflection is triggered ONLY on significant events:
 * - Mastery threshold crossed (up or down)
 * - Consecutive failures (3+ wrong answers)
 * - Strategy switch occurred
 * - Disengagement detected
 */

import { Episode, EpisodeOutcome, EpisodicMemoryStore } from './EpisodicMemoryStore';
import { TeachingVariant } from './LearnerProfile';
import { ChatMessage } from './AgentOrchestrator';

// ─── Types ────────────────────────────────────────────────────

export interface EpisodeInput {
  conceptId: string;
  conceptLabel: string;
  strategyUsed: TeachingVariant;
  masteryBefore: number;
  masteryAfter: number;
  studentMessages: string[];
  agentResponses: string[];
  wasCorrect: boolean | null; // null if no evaluation happened
  interventionApplied?: string;
}

export interface EpisodeScores {
  clarityScore: number;
  engagementScore: number;
  progressScore: number;
  efficiencyScore: number;
}

export interface FeedbackDirective {
  type: 'hint_density' | 'analogy_shift' | 'scaffolding_depth' | 'tone_adjust' | 'strategy_switch' | 'difficulty_recalibrate';
  instruction: string;
  priority: 'low' | 'medium' | 'high';
  conceptId: string;
}

export interface RecursiveProcessResult {
  episode: Episode;
  scores: EpisodeScores;
  directives: FeedbackDirective[];
  shouldSelfReflect: boolean;
  reflectionReason?: string;
}

// ─── Constants ────────────────────────────────────────────────

const MASTERY_SIGNIFICANT_DELTA = 0.15; // 15% mastery change is significant
const CONSECUTIVE_FAILURE_THRESHOLD = 3;
const SHORT_RESPONSE_THRESHOLD = 15; // Characters — indicates disengagement
const HIGH_TURN_THRESHOLD = 6; // Too many turns for one sub-concept

// ─── Engine ───────────────────────────────────────────────────

export class RecursiveLearningEngine {
  private consecutiveFailures: Record<string, number> = {};
  
  constructor(private memoryStore: EpisodicMemoryStore) {}

  /**
   * Process a completed teaching episode — scores it, stores it, and generates directives.
   */
  public processEpisode(input: EpisodeInput): RecursiveProcessResult {
    const scores = this.scoreEpisode(input);
    const outcome = this.determineOutcome(input, scores);

    const episode: Episode = {
      id: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      conceptId: input.conceptId,
      conceptLabel: input.conceptLabel,
      strategyUsed: input.strategyUsed,
      outcome,
      ...scores,
      masteryBefore: input.masteryBefore,
      masteryAfter: input.masteryAfter,
      turnsInEpisode: input.studentMessages.length,
      studentMessages: input.studentMessages.slice(-3), // Keep last 3 for context
      agentSummary: this.summarizeAgentApproach(input),
      isConsolidated: false,
      interventionApplied: input.interventionApplied
    };

    // Store the episode
    this.memoryStore.addEpisode(episode);

    // Track consecutive failures
    this.updateFailureTracking(input.conceptId, outcome);

    // Generate feedback directives
    const directives = this.synthesizeFeedback(episode, input);

    // Determine if self-reflection is warranted
    const { shouldReflect, reason } = this.evaluateReflectionNeed(episode, input);

    return {
      episode,
      scores,
      directives,
      shouldSelfReflect: shouldReflect,
      reflectionReason: reason
    };
  }

  // ── Scoring ──────────────────────────────────────────────────

  private scoreEpisode(input: EpisodeInput): EpisodeScores {
    return {
      clarityScore: this.scoreclarity(input),
      engagementScore: this.scoreEngagement(input),
      progressScore: this.scoreProgress(input),
      efficiencyScore: this.scoreEfficiency(input)
    };
  }

  /**
   * Clarity: Did the student understand without needing re-explanation?
   * High if correct on first try with few turns. Low if many clarification requests.
   */
  private scoreclarity(input: EpisodeInput): number {
    if (input.wasCorrect === null) return 0.5; // No evaluation — neutral

    let score = input.wasCorrect ? 0.7 : 0.2;

    // Penalize if many turns were needed (indicates confusion)
    const turnPenalty = Math.max(0, (input.studentMessages.length - 2) * 0.1);
    score = Math.max(0, score - turnPenalty);

    // Bonus if student showed understanding in language (heuristic: longer substantive responses)
    const avgResponseLength = input.studentMessages.reduce((sum, m) => sum + m.length, 0) / Math.max(1, input.studentMessages.length);
    if (avgResponseLength > 50 && input.wasCorrect) {
      score = Math.min(1, score + 0.15);
    }

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Engagement: Did the student respond substantively or disengage?
   * Short/terse responses signal disengagement.
   */
  private scoreEngagement(input: EpisodeInput): number {
    if (input.studentMessages.length === 0) return 0;

    const avgLength = input.studentMessages.reduce((sum, m) => sum + m.length, 0) / input.studentMessages.length;

    if (avgLength < SHORT_RESPONSE_THRESHOLD) return 0.2; // Very short — disengaged
    if (avgLength < 30) return 0.4;
    if (avgLength < 80) return 0.7;
    return 0.9; // Substantive responses
  }

  /**
   * Progress: Did BKT mastery probability increase?
   */
  private scoreProgress(input: EpisodeInput): number {
    const delta = input.masteryAfter - input.masteryBefore;
    
    if (delta > 0.3) return 1.0;   // Major progress
    if (delta > 0.15) return 0.8;  // Good progress
    if (delta > 0.05) return 0.6;  // Some progress
    if (delta > -0.05) return 0.4; // Neutral
    if (delta > -0.15) return 0.2; // Regression
    return 0.0;                    // Significant regression
  }

  /**
   * Efficiency: How few turns did it take to achieve progress?
   * Fewer turns for the same outcome = more efficient teaching.
   */
  private scoreEfficiency(input: EpisodeInput): number {
    const turns = input.studentMessages.length;
    const progress = input.masteryAfter - input.masteryBefore;

    if (progress <= 0) return 0.2; // No progress = inefficient by definition
    
    // Ratio: progress per turn
    const ratio = progress / turns;
    
    if (ratio > 0.15) return 1.0;  // Huge progress in few turns
    if (ratio > 0.08) return 0.8;
    if (ratio > 0.04) return 0.6;
    if (ratio > 0.02) return 0.4;
    return 0.2;
  }

  // ── Outcome Classification ──────────────────────────────────

  private determineOutcome(input: EpisodeInput, scores: EpisodeScores): EpisodeOutcome {
    const compositeScore = (scores.clarityScore + scores.engagementScore + scores.progressScore + scores.efficiencyScore) / 4;

    if (input.wasCorrect === true && compositeScore >= 0.6) return 'success';
    if (input.wasCorrect === false) return 'failure';
    if (compositeScore >= 0.4) return 'partial';
    return 'failure';
  }

  // ── Feedback Synthesis ──────────────────────────────────────

  private synthesizeFeedback(episode: Episode, input: EpisodeInput): FeedbackDirective[] {
    const directives: FeedbackDirective[] = [];

    // Low clarity → reduce hint density, be more explicit
    if (episode.clarityScore < 0.4) {
      directives.push({
        type: 'hint_density',
        instruction: 'Reduce hint layers. Provide more explicit scaffolding — the student is struggling to follow the chain of hints.',
        priority: 'high',
        conceptId: episode.conceptId
      });
    }

    // Low engagement → shift tone, add analogies
    if (episode.engagementScore < 0.3) {
      directives.push({
        type: 'tone_adjust',
        instruction: 'Student appears disengaged. Increase conversational warmth, use real-world analogies, and ask open-ended curiosity questions.',
        priority: 'high',
        conceptId: episode.conceptId
      });
    }

    // Low efficiency + some progress → optimize scaffolding
    if (episode.efficiencyScore < 0.4 && episode.progressScore > 0.3) {
      directives.push({
        type: 'scaffolding_depth',
        instruction: 'Teaching is working but taking too many turns. Compress scaffolding: combine multiple hint steps into richer single prompts.',
        priority: 'medium',
        conceptId: episode.conceptId
      });
    }

    // Consistent failures with current strategy → switch
    const failCount = this.consecutiveFailures[episode.conceptId] || 0;
    if (failCount >= 2) {
      const successfulStrategies = this.memoryStore.getSuccessfulStrategies(episode.conceptId);
      const suggestion = successfulStrategies.length > 0
        ? successfulStrategies[0]
        : 'a different approach than ' + episode.strategyUsed;

      directives.push({
        type: 'strategy_switch',
        instruction: `Current strategy "${episode.strategyUsed}" has failed ${failCount} times consecutively. Switch to ${suggestion}.`,
        priority: 'high',
        conceptId: episode.conceptId
      });
    }

    // Mastery regression → recalibrate difficulty
    if (input.masteryAfter < input.masteryBefore - 0.1) {
      directives.push({
        type: 'difficulty_recalibrate',
        instruction: 'Mastery is regressing. The material may be above the student\'s Zone of Proximal Development. Step back to a simpler sub-problem.',
        priority: 'high',
        conceptId: episode.conceptId
      });
    }

    return directives;
  }

  // ── Reflection Gate ─────────────────────────────────────────

  /**
   * Determines if this episode warrants a self-reflection cycle.
   * Triggered ONLY on significant events to conserve LLM budget.
   */
  private evaluateReflectionNeed(episode: Episode, input: EpisodeInput): { shouldReflect: boolean; reason?: string } {
    // 1. Mastery threshold crossed
    const masteryDelta = Math.abs(input.masteryAfter - input.masteryBefore);
    if (masteryDelta >= MASTERY_SIGNIFICANT_DELTA) {
      return {
        shouldReflect: true,
        reason: `Mastery shifted significantly: ${input.masteryBefore.toFixed(2)} → ${input.masteryAfter.toFixed(2)} (Δ${masteryDelta.toFixed(2)})`
      };
    }

    // 2. Consecutive failures
    const failures = this.consecutiveFailures[episode.conceptId] || 0;
    if (failures >= CONSECUTIVE_FAILURE_THRESHOLD) {
      return {
        shouldReflect: true,
        reason: `${failures} consecutive failures on "${episode.conceptLabel}" — strategy is not working`
      };
    }

    // 3. Disengagement detected
    if (episode.engagementScore < 0.25) {
      return {
        shouldReflect: true,
        reason: `Disengagement detected (engagement score: ${episode.engagementScore.toFixed(2)}) — student may be losing interest`
      };
    }

    // 4. First episode for a new concept
    const priorEpisodes = this.memoryStore.getEpisodesForConcept(episode.conceptId);
    if (priorEpisodes.length <= 1) {
      return {
        shouldReflect: true,
        reason: `First teaching episode for "${episode.conceptLabel}" — establishing baseline teaching approach`
      };
    }

    return { shouldReflect: false };
  }

  // ── Helpers ─────────────────────────────────────────────────

  private updateFailureTracking(conceptId: string, outcome: EpisodeOutcome): void {
    if (outcome === 'failure') {
      this.consecutiveFailures[conceptId] = (this.consecutiveFailures[conceptId] || 0) + 1;
    } else {
      this.consecutiveFailures[conceptId] = 0;
    }
  }

  private summarizeAgentApproach(input: EpisodeInput): string {
    const outcomeWord = input.wasCorrect === true ? 'successful' : input.wasCorrect === false ? 'unsuccessful' : 'unevaluated';
    return `Taught "${input.conceptLabel}" using ${input.strategyUsed}. ${input.studentMessages.length} turns. Outcome: ${outcomeWord}. Mastery: ${input.masteryBefore.toFixed(2)} → ${input.masteryAfter.toFixed(2)}.`;
  }

  /**
   * Get the current consecutive failure count for a concept.
   */
  public getConsecutiveFailures(conceptId: string): number {
    return this.consecutiveFailures[conceptId] || 0;
  }
}
