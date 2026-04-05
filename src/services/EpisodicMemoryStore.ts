/**
 * Episodic Memory Store
 * 
 * Persistent, indexed memory of all learning episodes — not just chat logs.
 * Every interaction is stored as a structured Episode, retrievable by concept,
 * strategy, outcome, and time. This enables the recursive learning loop to
 * reference what worked and what failed across sessions.
 */

import { TeachingVariant } from './LearnerProfile';

// ─── Core Types ────────────────────────────────────────────────

export type EpisodeOutcome = 'success' | 'failure' | 'partial';

export interface Episode {
  id: string;
  timestamp: number;
  conceptId: string;
  conceptLabel: string;
  strategyUsed: TeachingVariant;
  outcome: EpisodeOutcome;

  // Scoring axes (0.0–1.0)
  clarityScore: number;      // Did the student understand without re-explanation?
  engagementScore: number;   // Did the student respond substantively?
  progressScore: number;     // Did BKT mastery probability increase?
  efficiencyScore: number;   // How few turns to achieve progress?

  // Context
  masteryBefore: number;
  masteryAfter: number;
  turnsInEpisode: number;
  studentMessages: string[];   // Stripped summaries, not full chat
  agentSummary: string;        // Brief summary of agent's approach

  // Meta
  isConsolidated: boolean;     // True if this is a compressed summary
  interventionApplied?: string; // Meta-cognitive intervention that was active
}

export interface EpisodeQuery {
  conceptId?: string;
  strategyUsed?: TeachingVariant;
  outcome?: EpisodeOutcome;
  since?: number;
  limit?: number;
}

// ─── Constants ────────────────────────────────────────────────

const STORAGE_KEY = 'lumina_episodic_memory';
const CONSOLIDATION_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_EPISODES = 500; // Storage boundary

// ─── Store ────────────────────────────────────────────────────

export class EpisodicMemoryStore {
  private episodes: Episode[] = [];

  constructor() {
    this.load();
  }

  // ── Persistence ──────────────────────────────────────────────

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.episodes = JSON.parse(raw);
      }
    } catch {
      console.warn('[EpisodicMemory] Failed to load from localStorage, starting fresh.');
      this.episodes = [];
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.episodes));
    } catch {
      console.warn('[EpisodicMemory] Failed to persist to localStorage.');
    }
  }

  // ── Write ────────────────────────────────────────────────────

  public addEpisode(episode: Episode): void {
    this.episodes.push(episode);

    // Enforce storage cap — drop oldest consolidated episodes first
    if (this.episodes.length > MAX_EPISODES) {
      const consolidated = this.episodes.filter(e => e.isConsolidated);
      if (consolidated.length > 0) {
        const oldestConsolidated = consolidated[0];
        this.episodes = this.episodes.filter(e => e.id !== oldestConsolidated.id);
      } else {
        this.episodes.shift(); // Drop absolute oldest
      }
    }

    this.persist();
  }

  // ── Read ─────────────────────────────────────────────────────

  public query(q: EpisodeQuery): Episode[] {
    let results = [...this.episodes];

    if (q.conceptId) {
      results = results.filter(e => e.conceptId === q.conceptId);
    }
    if (q.strategyUsed) {
      results = results.filter(e => e.strategyUsed === q.strategyUsed);
    }
    if (q.outcome) {
      results = results.filter(e => e.outcome === q.outcome);
    }
    if (q.since) {
      results = results.filter(e => e.timestamp >= q.since);
    }

    // Sort by recency
    results.sort((a, b) => b.timestamp - a.timestamp);

    if (q.limit) {
      results = results.slice(0, q.limit);
    }

    return results;
  }

  public getEpisodesForConcept(conceptId: string): Episode[] {
    return this.query({ conceptId });
  }

  public getSuccessfulStrategies(conceptId: string): TeachingVariant[] {
    const successes = this.query({ conceptId, outcome: 'success' });
    const strategyScores = new Map<TeachingVariant, number>();

    for (const ep of successes) {
      const current = strategyScores.get(ep.strategyUsed) || 0;
      // Weight by composite score
      const compositeScore = (ep.clarityScore + ep.engagementScore + ep.progressScore + ep.efficiencyScore) / 4;
      strategyScores.set(ep.strategyUsed, current + compositeScore);
    }

    // Return sorted by effectiveness
    return [...strategyScores.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([variant]) => variant);
  }

  public getFailurePatterns(conceptId: string): { strategy: TeachingVariant; count: number; avgClarity: number }[] {
    const failures = this.query({ conceptId, outcome: 'failure' });
    const strategyFailures = new Map<TeachingVariant, { count: number; totalClarity: number }>();

    for (const ep of failures) {
      const current = strategyFailures.get(ep.strategyUsed) || { count: 0, totalClarity: 0 };
      strategyFailures.set(ep.strategyUsed, {
        count: current.count + 1,
        totalClarity: current.totalClarity + ep.clarityScore
      });
    }

    return [...strategyFailures.entries()]
      .map(([strategy, data]) => ({
        strategy,
        count: data.count,
        avgClarity: data.totalClarity / data.count
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Find episodes similar to the given one by concept family and outcome pattern.
   * Used for transfer learning across related concepts.
   */
  public getSimilarEpisodes(episode: Episode, limit: number = 5): Episode[] {
    return this.episodes
      .filter(e => e.id !== episode.id)
      .map(e => ({
        episode: e,
        similarity: this.computeSimilarity(episode, e)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(r => r.episode);
  }

  private computeSimilarity(a: Episode, b: Episode): number {
    let score = 0;

    // Same concept family (share prefix like "sub-" from same "topic-")
    if (a.conceptId === b.conceptId) score += 3;
    else if (a.conceptId.split('-')[0] === b.conceptId.split('-')[0]) score += 1;

    // Same strategy
    if (a.strategyUsed === b.strategyUsed) score += 2;

    // Similar mastery range
    const masteryDiff = Math.abs(a.masteryBefore - b.masteryBefore);
    if (masteryDiff < 0.1) score += 2;
    else if (masteryDiff < 0.3) score += 1;

    // Similar outcome
    if (a.outcome === b.outcome) score += 1;

    return score;
  }

  // ── Maintenance ──────────────────────────────────────────────

  /**
   * Consolidate old episodes: compress episodes older than 7 days
   * into summary records to bound storage while preserving key learnings.
   */
  public consolidateOldEpisodes(): number {
    const now = Date.now();
    let consolidated = 0;

    this.episodes = this.episodes.map(ep => {
      if (!ep.isConsolidated && (now - ep.timestamp) > CONSOLIDATION_AGE_MS) {
        consolidated++;
        return {
          ...ep,
          isConsolidated: true,
          studentMessages: [], // Drop verbose data
          agentSummary: `[Consolidated] ${ep.outcome} teaching ${ep.conceptLabel} via ${ep.strategyUsed}. Progress: ${ep.masteryBefore.toFixed(2)} → ${ep.masteryAfter.toFixed(2)}`
        };
      }
      return ep;
    });

    if (consolidated > 0) {
      this.persist();
    }

    return consolidated;
  }

  /**
   * Generate a concise summary of recent episode memory for injection into LLM prompts.
   */
  public generateMemorySummary(conceptId: string, maxEpisodes: number = 5): string {
    const recent = this.query({ conceptId, limit: maxEpisodes });
    if (recent.length === 0) return 'No prior teaching episodes for this concept.';

    const successRate = recent.filter(e => e.outcome === 'success').length / recent.length;
    const avgClarity = recent.reduce((sum, e) => sum + e.clarityScore, 0) / recent.length;
    const bestStrategies = this.getSuccessfulStrategies(conceptId);

    const lines = [
      `EPISODIC MEMORY (last ${recent.length} episodes for "${recent[0]?.conceptLabel || conceptId}"):`,
      `- Success rate: ${(successRate * 100).toFixed(0)}%`,
      `- Average clarity: ${(avgClarity * 100).toFixed(0)}%`,
      `- Best strategies: ${bestStrategies.length > 0 ? bestStrategies.join(', ') : 'None yet'}`,
    ];

    const failures = this.getFailurePatterns(conceptId);
    if (failures.length > 0) {
      lines.push(`- Strategies to AVOID: ${failures.map(f => `${f.strategy} (failed ${f.count}x)`).join(', ')}`);
    }

    return lines.join('\n');
  }

  // ── Accessors ────────────────────────────────────────────────

  public getAll(): Episode[] {
    return [...this.episodes];
  }

  public getCount(): number {
    return this.episodes.length;
  }

  public clear(): void {
    this.episodes = [];
    this.persist();
  }
}
