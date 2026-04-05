/**
 * Meta-Cognitive Agent
 * 
 * A second-level monitoring agent that observes the teaching agent's behavior
 * over rolling windows of episodes. It detects failure patterns and generates
 * corrective interventions injected into the agent's system prompt.
 * 
 * Detected patterns:
 * - Confusion Loops: Student asking clarifying questions 3+ times
 * - Disengagement Signals: Short/terse responses, increasing gaps
 * - Repetition Traps: Agent generating structurally identical hints
 * - Difficulty Mismatch: Consistent failures suggesting ZPD miscalibration
 * 
 * Self-monitors: Tracks whether its own interventions improved outcomes (recursive on itself).
 */

import { Episode, EpisodicMemoryStore } from './EpisodicMemoryStore';

// ─── Types ────────────────────────────────────────────────────

export type InterventionType = 
  | 'strategy_shift' 
  | 'difficulty_adjust' 
  | 'topic_redirect'
  | 'tone_modulation'
  | 'pace_change'
  | 'concept_decompose';

export interface MetaCognitiveIntervention {
  id: string;
  type: InterventionType;
  reason: string;
  directive: string;       // Injected into agent's next system prompt
  confidence: number;      // 0–1, how sure the meta-agent is
  timestamp: number;
  conceptId: string;
  isActive: boolean;
  outcomeSinceApplied?: 'improved' | 'worsened' | 'neutral';
}

export type PatternType = 
  | 'confusion_loop' 
  | 'disengagement'
  | 'repetition_trap'
  | 'difficulty_mismatch'
  | 'strategy_exhaustion';

export interface DetectedPattern {
  type: PatternType;
  confidence: number;
  evidence: string;
  conceptId: string;
}

// ─── Constants ────────────────────────────────────────────────

const ROLLING_WINDOW_SIZE = 8;
const CONFUSION_THRESHOLD = 3;
const DISENGAGEMENT_SCORE_THRESHOLD = 0.3;
const FAILURE_STREAK_THRESHOLD = 3;
const INTERVENTION_CONFIDENCE_THRESHOLD = 0.6;

// ─── Agent ────────────────────────────────────────────────────

export class MetaCognitiveAgent {
  private interventions: MetaCognitiveIntervention[] = [];

  constructor(private memoryStore: EpisodicMemoryStore) {
    this.loadInterventions();
  }

  // ── Persistence ──────────────────────────────────────────────

  private loadInterventions(): void {
    try {
      const raw = localStorage.getItem('lumina_metacog_interventions');
      if (raw) this.interventions = JSON.parse(raw);
    } catch {
      this.interventions = [];
    }
  }

  private persistInterventions(): void {
    try {
      localStorage.setItem('lumina_metacog_interventions', JSON.stringify(this.interventions));
    } catch {
      // Silent fail
    }
  }

  // ── Pattern Detection ───────────────────────────────────────

  /**
   * Analyze recent episodes and detect failure patterns.
   */
  public detectPatterns(conceptId?: string): DetectedPattern[] {
    const episodes = conceptId 
      ? this.memoryStore.getEpisodesForConcept(conceptId).slice(0, ROLLING_WINDOW_SIZE)
      : this.memoryStore.getAll().slice(-ROLLING_WINDOW_SIZE);

    if (episodes.length < 2) return [];

    const patterns: DetectedPattern[] = [];

    const confusionLoop = this.detectConfusionLoop(episodes);
    if (confusionLoop) patterns.push(confusionLoop);

    const disengagement = this.detectDisengagement(episodes);
    if (disengagement) patterns.push(disengagement);

    const repetitionTrap = this.detectRepetitionTrap(episodes);
    if (repetitionTrap) patterns.push(repetitionTrap);

    const difficultyMismatch = this.detectDifficultyMismatch(episodes);
    if (difficultyMismatch) patterns.push(difficultyMismatch);

    const strategyExhaustion = this.detectStrategyExhaustion(episodes);
    if (strategyExhaustion) patterns.push(strategyExhaustion);

    return patterns;
  }

  /**
   * Confusion Loop: Student asking for clarification repeatedly on the same concept.
   */
  private detectConfusionLoop(episodes: Episode[]): DetectedPattern | null {
    const sameConceptEps = this.groupByConcept(episodes);

    for (const [conceptId, eps] of sameConceptEps) {
      const lowClarityCount = eps.filter(e => e.clarityScore < 0.4).length;
      if (lowClarityCount >= CONFUSION_THRESHOLD) {
        return {
          type: 'confusion_loop',
          confidence: Math.min(1, lowClarityCount / (CONFUSION_THRESHOLD + 1)),
          evidence: `${lowClarityCount} low-clarity episodes on "${eps[0]?.conceptLabel}" — student is in a confusion loop`,
          conceptId
        };
      }
    }

    return null;
  }

  /**
   * Disengagement: Consistently low engagement scores.
   */
  private detectDisengagement(episodes: Episode[]): DetectedPattern | null {
    const recentEngagement = episodes.slice(0, 4);
    const avgEngagement = recentEngagement.reduce((sum, e) => sum + e.engagementScore, 0) / recentEngagement.length;

    if (avgEngagement < DISENGAGEMENT_SCORE_THRESHOLD) {
      return {
        type: 'disengagement',
        confidence: 1 - avgEngagement, // Lower engagement = higher confidence
        evidence: `Average engagement score over last ${recentEngagement.length} episodes: ${avgEngagement.toFixed(2)} — student is disengaging`,
        conceptId: episodes[0]?.conceptId || 'unknown'
      };
    }

    return null;
  }

  /**
   * Repetition Trap: Agent using the same strategy repeatedly despite failures.
   */
  private detectRepetitionTrap(episodes: Episode[]): DetectedPattern | null {
    if (episodes.length < 3) return null;

    const recent = episodes.slice(0, 4);
    const strategies = recent.map(e => e.strategyUsed);
    const uniqueStrategies = new Set(strategies);

    // If only 1 strategy used across 4+ episodes with failures
    if (uniqueStrategies.size === 1 && recent.filter(e => e.outcome === 'failure').length >= 2) {
      return {
        type: 'repetition_trap',
        confidence: 0.8,
        evidence: `Same strategy "${strategies[0]}" used ${recent.length} times with ${recent.filter(e => e.outcome === 'failure').length} failures — agent is stuck in a repetition trap`,
        conceptId: episodes[0]?.conceptId || 'unknown'
      };
    }

    return null;
  }

  /**
   * Difficulty Mismatch: Consistent failures suggesting the material is too hard/easy.
   */
  private detectDifficultyMismatch(episodes: Episode[]): DetectedPattern | null {
    const recent = episodes.slice(0, FAILURE_STREAK_THRESHOLD + 1);
    const failureStreak = recent.filter(e => e.outcome === 'failure').length;

    if (failureStreak >= FAILURE_STREAK_THRESHOLD) {
      const avgMastery = recent.reduce((sum, e) => sum + e.masteryBefore, 0) / recent.length;
      return {
        type: 'difficulty_mismatch',
        confidence: Math.min(1, failureStreak / (FAILURE_STREAK_THRESHOLD + 1)),
        evidence: `${failureStreak} consecutive failures with average mastery ${avgMastery.toFixed(2)} — material is likely above the student's ZPD`,
        conceptId: episodes[0]?.conceptId || 'unknown'
      };
    }

    return null;
  }

  /**
   * Strategy Exhaustion: All available strategies have been tried and failed.
   */
  private detectStrategyExhaustion(episodes: Episode[]): DetectedPattern | null {
    const sameConceptEps = this.groupByConcept(episodes);

    for (const [conceptId, eps] of sameConceptEps) {
      const failedStrategies = new Set(
        eps.filter(e => e.outcome === 'failure').map(e => e.strategyUsed)
      );
      // If 3+ unique strategies have failed
      if (failedStrategies.size >= 3) {
        return {
          type: 'strategy_exhaustion',
          confidence: 0.9,
          evidence: `${failedStrategies.size} different strategies have all failed for "${eps[0]?.conceptLabel}" — concept may need decomposition`,
          conceptId
        };
      }
    }

    return null;
  }

  // ── Intervention Generation ─────────────────────────────────

  /**
   * Generate interventions from detected patterns.
   * Only generates interventions above the confidence threshold.
   */
  public generateInterventions(patterns: DetectedPattern[]): MetaCognitiveIntervention[] {
    const newInterventions: MetaCognitiveIntervention[] = [];

    for (const pattern of patterns) {
      if (pattern.confidence < INTERVENTION_CONFIDENCE_THRESHOLD) continue;

      // Don't duplicate active interventions of the same type for the same concept
      const alreadyActive = this.interventions.some(
        i => i.isActive && i.type === this.mapPatternToIntervention(pattern.type) && i.conceptId === pattern.conceptId
      );
      if (alreadyActive) continue;

      const intervention = this.createIntervention(pattern);
      if (intervention) {
        newInterventions.push(intervention);
        this.interventions.push(intervention);
      }
    }

    if (newInterventions.length > 0) {
      this.persistInterventions();
    }

    return newInterventions;
  }

  private createIntervention(pattern: DetectedPattern): MetaCognitiveIntervention | null {
    const id = `intervention-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const base = {
      id,
      confidence: pattern.confidence,
      timestamp: Date.now(),
      conceptId: pattern.conceptId,
      isActive: true
    };

    switch (pattern.type) {
      case 'confusion_loop':
        return {
          ...base,
          type: 'strategy_shift',
          reason: pattern.evidence,
          directive: 'META-COGNITIVE OVERRIDE: The student is in a confusion loop. STOP using the current explanation strategy. Switch to a completely different approach: if you were using abstract reasoning, switch to concrete examples. If you were asking questions, provide a worked example first. Drastically simplify and start from first principles.'
        };

      case 'disengagement':
        return {
          ...base,
          type: 'tone_modulation',
          reason: pattern.evidence,
          directive: 'META-COGNITIVE OVERRIDE: The student appears disengaged. Make your response more engaging: ask an unexpected question, use a vivid real-world analogy, or connect the concept to something the student cares about. Keep responses shorter and more conversational. Add an element of curiosity or surprise.'
        };

      case 'repetition_trap':
        return {
          ...base,
          type: 'strategy_shift',
          reason: pattern.evidence,
          directive: 'META-COGNITIVE OVERRIDE: You are stuck in a repetition trap — using the same teaching approach repeatedly despite failures. You MUST use a fundamentally different teaching strategy this turn. If previous attempts used questioning, use direct instruction. If previous attempts used examples, use visual analogies.'
        };

      case 'difficulty_mismatch':
        return {
          ...base,
          type: 'difficulty_adjust',
          reason: pattern.evidence,
          directive: 'META-COGNITIVE OVERRIDE: The current material is above the student\'s Zone of Proximal Development. Step back to the most fundamental sub-skill required for this concept. Break the problem into smaller pieces. Provide more scaffolding per step. Do NOT advance until each sub-step is confirmed.'
        };

      case 'strategy_exhaustion':
        return {
          ...base,
          type: 'concept_decompose',
          reason: pattern.evidence,
          directive: 'META-COGNITIVE OVERRIDE: All standard teaching strategies have been exhausted for this concept. The concept likely needs to be decomposed into simpler prerequisite skills. Identify the specific sub-skill the student is missing and teach THAT first before returning to this concept.'
        };

      default:
        return null;
    }
  }

  private mapPatternToIntervention(patternType: PatternType): InterventionType {
    const mapping: Record<PatternType, InterventionType> = {
      'confusion_loop': 'strategy_shift',
      'disengagement': 'tone_modulation',
      'repetition_trap': 'strategy_shift',
      'difficulty_mismatch': 'difficulty_adjust',
      'strategy_exhaustion': 'concept_decompose'
    };
    return mapping[patternType];
  }

  // ── Self-Monitoring ─────────────────────────────────────────

  /**
   * Evaluate whether active interventions improved outcomes.
   * The meta-agent learns from its own interventions (recursive on itself).
   */
  public evaluateInterventionEffectiveness(): void {
    for (const intervention of this.interventions.filter(i => i.isActive)) {
      const episodesSince = this.memoryStore.query({
        conceptId: intervention.conceptId,
        since: intervention.timestamp,
        limit: 5
      });

      if (episodesSince.length < 2) continue; // Not enough data yet

      const avgScoreAfter = episodesSince.reduce((sum, e) => 
        sum + (e.clarityScore + e.engagementScore + e.progressScore + e.efficiencyScore) / 4, 0
      ) / episodesSince.length;

      const episodesBefore = this.memoryStore.query({
        conceptId: intervention.conceptId,
        limit: 5
      }).filter(e => e.timestamp < intervention.timestamp);

      if (episodesBefore.length === 0) continue;

      const avgScoreBefore = episodesBefore.reduce((sum, e) =>
        sum + (e.clarityScore + e.engagementScore + e.progressScore + e.efficiencyScore) / 4, 0
      ) / episodesBefore.length;

      if (avgScoreAfter > avgScoreBefore + 0.1) {
        intervention.outcomeSinceApplied = 'improved';
      } else if (avgScoreAfter < avgScoreBefore - 0.1) {
        intervention.outcomeSinceApplied = 'worsened';
        intervention.isActive = false; // Deactivate ineffective interventions
      } else {
        intervention.outcomeSinceApplied = 'neutral';
      }
    }

    this.persistInterventions();
  }

  // ── Accessors ───────────────────────────────────────────────

  public getActiveInterventions(conceptId?: string): MetaCognitiveIntervention[] {
    return this.interventions.filter(i => 
      i.isActive && (!conceptId || i.conceptId === conceptId)
    );
  }

  public getAllInterventions(): MetaCognitiveIntervention[] {
    return [...this.interventions];
  }

  public getInterventionCount(): number {
    return this.interventions.filter(i => i.isActive).length;
  }

  /**
   * Build the directive string to inject into the agent's system prompt.
   */
  public buildInterventionDirective(conceptId: string): string {
    const active = this.getActiveInterventions(conceptId);
    if (active.length === 0) return '';

    // Sort by confidence, inject highest confidence first
    active.sort((a, b) => b.confidence - a.confidence);

    return active.map(i => i.directive).join('\n\n');
  }

  // ── Helpers ─────────────────────────────────────────────────

  private groupByConcept(episodes: Episode[]): Map<string, Episode[]> {
    const groups = new Map<string, Episode[]>();
    for (const ep of episodes) {
      const existing = groups.get(ep.conceptId) || [];
      existing.push(ep);
      groups.set(ep.conceptId, existing);
    }
    return groups;
  }

  public clear(): void {
    this.interventions = [];
    this.persistInterventions();
  }
}
