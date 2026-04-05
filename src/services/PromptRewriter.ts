/**
 * Prompt Rewriter — Self-Reflective Prompt Evolution
 * 
 * After significant teaching episodes, the agent generates a self-critique
 * and rewrites its per-concept teaching directives. The rewrite depth is
 * context-adaptive:
 * 
 * - CONSERVATIVE (stable concepts): Only tone and hint density
 * - MODERATE (fluctuating progress): Tone, analogies, scaffolding depth, question types
 * - AGGRESSIVE (struggling concepts): Full pedagogical strategy rewrite
 * 
 * Guardrails: Rewrites cannot override safety rules or anti-cheating protocols.
 * Version-tracked for rollback if outcomes degrade.
 */

import { Episode, EpisodicMemoryStore } from './EpisodicMemoryStore';
import { FeedbackDirective } from './RecursiveLearningEngine';

// ─── Types ────────────────────────────────────────────────────

export type RewriteDepth = 'conservative' | 'moderate' | 'aggressive';

export interface PromptOverlay {
  id: string;
  conceptId: string;
  version: number;
  depth: RewriteDepth;
  directive: string;         // The rewritten teaching directive
  generatedFrom: string;     // Episode ID that triggered this rewrite
  timestamp: number;
  performanceAtCreation: number; // Composite score when created
  isActive: boolean;
}

export interface ReflectionInput {
  episode: Episode;
  memorySummary: string;
  feedbackDirectives: FeedbackDirective[];
  consecutiveFailures: number;
}

export interface ReflectionOutput {
  overlay: PromptOverlay;
  selfCritique: string;
  depthUsed: RewriteDepth;
}

// ─── Constants ────────────────────────────────────────────────

const STORAGE_KEY = 'lumina_prompt_overlays';
const MAX_OVERLAY_VERSIONS = 5; // Keep last 5 versions per concept

// ─── Rewriter ─────────────────────────────────────────────────

export class PromptRewriter {
  private overlays: PromptOverlay[] = [];

  constructor(private memoryStore: EpisodicMemoryStore) {
    this.load();
  }

  // ── Persistence ──────────────────────────────────────────────

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.overlays = JSON.parse(raw);
    } catch {
      this.overlays = [];
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.overlays));
    } catch {
      // Silent fail
    }
  }

  // ── Depth Determination ─────────────────────────────────────

  /**
   * Determine the appropriate rewrite depth based on context.
   * This is fully autonomous — no teacher involved.
   */
  public determineDepth(input: ReflectionInput): RewriteDepth {
    const { episode, consecutiveFailures } = input;

    // AGGRESSIVE: Strategy exhaustion, high failure count, or very low composite score
    const compositeScore = (episode.clarityScore + episode.engagementScore + episode.progressScore + episode.efficiencyScore) / 4;
    if (consecutiveFailures >= 4 || compositeScore < 0.2) {
      return 'aggressive';
    }

    // MODERATE: Fluctuating progress, some failures, or declining engagement
    if (consecutiveFailures >= 2 || episode.engagementScore < 0.4 || compositeScore < 0.5) {
      return 'moderate';
    }

    // CONSERVATIVE: Stable concept, minor adjustments needed
    return 'conservative';
  }

  // ── Reflection & Rewrite ────────────────────────────────────

  /**
   * Generate a self-reflection and produce a rewritten prompt overlay.
   * This runs locally (no LLM call) — synthesizes from episode data + memory.
   */
  public generateReflection(input: ReflectionInput): ReflectionOutput {
    const depth = this.determineDepth(input);
    const { episode, feedbackDirectives, memorySummary } = input;

    // Generate self-critique
    const selfCritique = this.buildSelfCritique(episode, depth);

    // Generate the prompt overlay directive
    const directive = this.buildOverlayDirective(episode, feedbackDirectives, depth, memorySummary);

    const overlay: PromptOverlay = {
      id: `overlay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      conceptId: episode.conceptId,
      version: this.getLatestVersion(episode.conceptId) + 1,
      depth,
      directive,
      generatedFrom: episode.id,
      timestamp: Date.now(),
      performanceAtCreation: (episode.clarityScore + episode.engagementScore + episode.progressScore + episode.efficiencyScore) / 4,
      isActive: true
    };

    // Deactivate all previous overlays for this concept
    this.overlays
      .filter(o => o.conceptId === episode.conceptId)
      .forEach(o => { o.isActive = false; });

    // Add new overlay
    this.overlays.push(overlay);

    // Prune old versions
    this.pruneOldVersions(episode.conceptId);

    this.persist();

    return { overlay, selfCritique, depthUsed: depth };
  }

  // ── Self-Critique ───────────────────────────────────────────

  private buildSelfCritique(episode: Episode, depth: RewriteDepth): string {
    const lines: string[] = [];

    lines.push(`[Self-Reflection on "${episode.conceptLabel}" | Depth: ${depth.toUpperCase()}]`);
    lines.push(`Strategy used: ${episode.strategyUsed} | Outcome: ${episode.outcome}`);
    lines.push(`Mastery: ${episode.masteryBefore.toFixed(2)} → ${episode.masteryAfter.toFixed(2)}`);
    lines.push('');

    // Analyze what went wrong or right
    if (episode.clarityScore < 0.4) {
      lines.push('⚠ CLARITY ISSUE: My explanations were not landing. The student needed multiple clarifications.');
    } else if (episode.clarityScore > 0.7) {
      lines.push('✓ Clarity was strong — explanations were understood.');
    }

    if (episode.engagementScore < 0.3) {
      lines.push('⚠ ENGAGEMENT DROP: Student responses were terse — I may be boring or frustrating them.');
    } else if (episode.engagementScore > 0.7) {
      lines.push('✓ Student was actively engaged.');
    }

    if (episode.progressScore < 0.3) {
      lines.push('⚠ NO PROGRESS: Mastery did not improve — my approach is not effective for this concept.');
    }

    if (episode.efficiencyScore < 0.3) {
      lines.push('⚠ INEFFICIENT: Too many turns needed — I should tighten my scaffolding.');
    }

    return lines.join('\n');
  }

  // ── Overlay Directive Builder ───────────────────────────────

  private buildOverlayDirective(
    episode: Episode,
    directives: FeedbackDirective[],
    depth: RewriteDepth,
    memorySummary: string
  ): string {
    const sections: string[] = [];

    sections.push(`RECURSIVE LEARNING OVERLAY (v${this.getLatestVersion(episode.conceptId) + 1}) for "${episode.conceptLabel}":`);

    // Inject memory context
    if (memorySummary) {
      sections.push(memorySummary);
    }

    // Apply directives based on depth
    switch (depth) {
      case 'conservative':
        sections.push(this.buildConservativeDirective(episode, directives));
        break;
      case 'moderate':
        sections.push(this.buildModerateDirective(episode, directives));
        break;
      case 'aggressive':
        sections.push(this.buildAggressiveDirective(episode, directives));
        break;
    }

    // Safety guardrail
    sections.push('GUARDRAIL: These adjustments NEVER override anti-cheating rules, safety protocols, or factual grounding requirements.');

    return sections.join('\n\n');
  }

  private buildConservativeDirective(episode: Episode, directives: FeedbackDirective[]): string {
    const lines = ['ADJUSTMENTS (Conservative — fine-tuning only):'];

    if (episode.clarityScore < 0.5) {
      lines.push('- Use simpler vocabulary and shorter sentences for this concept.');
    }
    if (episode.engagementScore < 0.5) {
      lines.push('- Add a brief real-world connection before diving into the problem.');
    }

    const hintDirective = directives.find(d => d.type === 'hint_density');
    if (hintDirective) {
      lines.push(`- ${hintDirective.instruction}`);
    }

    const toneDirective = directives.find(d => d.type === 'tone_adjust');
    if (toneDirective) {
      lines.push(`- ${toneDirective.instruction}`);
    }

    if (lines.length === 1) {
      lines.push('- Minor adjustments: maintain current approach but be slightly more explicit in explanations.');
    }

    return lines.join('\n');
  }

  private buildModerateDirective(episode: Episode, directives: FeedbackDirective[]): string {
    const lines = ['ADJUSTMENTS (Moderate — structural modifications):'];

    // Include all relevant directives
    for (const d of directives.filter(d => d.priority === 'high' || d.priority === 'medium')) {
      lines.push(`- [${d.priority.toUpperCase()}] ${d.instruction}`);
    }

    // Strategy-specific guidance
    const successfulStrategies = this.memoryStore.getSuccessfulStrategies(episode.conceptId);
    if (successfulStrategies.length > 0) {
      lines.push(`- PREFER these strategies that worked before: ${successfulStrategies.join(', ')}`);
    }

    const failurePatterns = this.memoryStore.getFailurePatterns(episode.conceptId);
    if (failurePatterns.length > 0) {
      lines.push(`- AVOID these strategies that failed: ${failurePatterns.map(f => f.strategy).join(', ')}`);
    }

    // Scaffolding depth
    if (episode.efficiencyScore < 0.4) {
      lines.push('- Restructure scaffolding: combine multiple small hints into one richer, context-complete prompt.');
    }

    if (episode.clarityScore < 0.3) {
      lines.push('- Switch explanation modality: if using text, try walking through a concrete example. If using examples, try visual/spatial reasoning.');
    }

    return lines.join('\n');
  }

  private buildAggressiveDirective(episode: Episode, directives: FeedbackDirective[]): string {
    const lines = ['ADJUSTMENTS (Aggressive — full pedagogical restructure):'];

    // Include ALL directives
    for (const d of directives) {
      lines.push(`- [${d.priority.toUpperCase()}] ${d.instruction}`);
    }

    lines.push('');
    lines.push('CRITICAL RESTRUCTURE REQUIRED:');
    lines.push(`The current teaching approach for "${episode.conceptLabel}" is fundamentally failing.`);

    // Check if concept needs decomposition
    const allEpisodes = this.memoryStore.getEpisodesForConcept(episode.conceptId);
    const failureRate = allEpisodes.filter(e => e.outcome === 'failure').length / Math.max(1, allEpisodes.length);

    if (failureRate > 0.7) {
      lines.push('- DECOMPOSE: This concept is too complex as a single unit. Break it into 2-3 prerequisite sub-skills and teach each one individually.');
      lines.push('- IDENTIFY the specific sub-skill the student is stuck on by asking diagnostic questions.');
    }

    lines.push('- COMPLETELY CHANGE your teaching approach — do not reuse ANY elements from previous failed attempts.');
    lines.push('- START with the simplest possible version of the concept (even if it feels too easy).');
    lines.push('- USE multiple modalities simultaneously: example + analogy + visual description.');

    // Self-generated learning
    const similarEpisodes = this.memoryStore.getSimilarEpisodes(episode, 3);
    const successfulSimilar = similarEpisodes.filter(e => e.outcome === 'success');
    if (successfulSimilar.length > 0) {
      lines.push(`- TRANSFER LEARNING: Similar concept "${successfulSimilar[0].conceptLabel}" was taught successfully with ${successfulSimilar[0].strategyUsed}. Adapt that approach.`);
    }

    return lines.join('\n');
  }

  // ── Rollback ────────────────────────────────────────────────

  /**
   * Rollback to a previous overlay version if the current one degraded performance.
   */
  public rollbackOverlay(conceptId: string): PromptOverlay | null {
    const conceptOverlays = this.overlays
      .filter(o => o.conceptId === conceptId)
      .sort((a, b) => b.version - a.version);

    if (conceptOverlays.length < 2) return null;

    // Deactivate current
    conceptOverlays[0].isActive = false;

    // Reactivate previous
    conceptOverlays[1].isActive = true;

    this.persist();
    return conceptOverlays[1];
  }

  /**
   * Check if the current overlay is performing worse than the previous version.
   * If so, auto-rollback.
   */
  public autoRollbackCheck(conceptId: string): boolean {
    const active = this.getActiveOverlay(conceptId);
    if (!active || active.version <= 1) return false;

    const recentEpisodes = this.memoryStore.query({ conceptId, since: active.timestamp, limit: 3 });
    if (recentEpisodes.length < 2) return false;

    const currentPerformance = recentEpisodes.reduce((sum, e) =>
      sum + (e.clarityScore + e.engagementScore + e.progressScore + e.efficiencyScore) / 4, 0
    ) / recentEpisodes.length;

    // If performance degraded significantly since overlay was created
    if (currentPerformance < active.performanceAtCreation - 0.15) {
      this.rollbackOverlay(conceptId);
      return true;
    }

    return false;
  }

  // ── Accessors ───────────────────────────────────────────────

  public getActiveOverlay(conceptId: string): PromptOverlay | null {
    return this.overlays.find(o => o.conceptId === conceptId && o.isActive) || null;
  }

  public getActiveOverlayDirective(conceptId: string): string {
    const overlay = this.getActiveOverlay(conceptId);
    return overlay ? overlay.directive : '';
  }

  public getAllOverlays(): PromptOverlay[] {
    return [...this.overlays];
  }

  public getOverlayHistory(conceptId: string): PromptOverlay[] {
    return this.overlays
      .filter(o => o.conceptId === conceptId)
      .sort((a, b) => b.version - a.version);
  }

  public getTotalReflections(): number {
    return this.overlays.length;
  }

  // ── Helpers ─────────────────────────────────────────────────

  private getLatestVersion(conceptId: string): number {
    const conceptOverlays = this.overlays.filter(o => o.conceptId === conceptId);
    if (conceptOverlays.length === 0) return 0;
    return Math.max(...conceptOverlays.map(o => o.version));
  }

  private pruneOldVersions(conceptId: string): void {
    const conceptOverlays = this.overlays
      .filter(o => o.conceptId === conceptId)
      .sort((a, b) => b.version - a.version);

    if (conceptOverlays.length > MAX_OVERLAY_VERSIONS) {
      const toRemove = new Set(
        conceptOverlays.slice(MAX_OVERLAY_VERSIONS).map(o => o.id)
      );
      this.overlays = this.overlays.filter(o => !toRemove.has(o.id));
    }
  }

  public clear(): void {
    this.overlays = [];
    this.persist();
  }
}
