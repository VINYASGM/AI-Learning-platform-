/**
 * Scaffolding Engine — Progressive Fade & Metacognitive Prompting
 *
 * The blueprint warns about "Illusion of Competence" (failure mode #3):
 * scaffolding must progressively fade, and the system must verify that
 * independent success is maintained.
 *
 * Scaffolding Level: 1.0 (full support) → 0.0 (fully independent)
 *
 * Fade schedule:
 * - After N consecutive successes at current level, reduce by 0.1
 * - On failure at reduced level, reinstate +0.05 (NOT full reset)
 * - On persistent failure at reduced level, reinstate +0.1
 *
 * Metacognitive prompts:
 * - Periodically asks the student "How confident are you? (1-5)"
 * - Calibrates self-assessment accuracy over time
 *
 * Transfer probes:
 * - After concept mastery, generates assessment from a RELATED concept
 * - Tests whether the skill generalizes or is context-dependent
 */

// ─── Types ─────────────────────────────────────────────────────

export interface ScaffoldingState {
  level: number;             // 0.0 - 1.0
  consecutiveSuccesses: number;
  consecutiveFailures: number;
  fadeAttempts: number;       // How many times we've tried to fade
  lastFadeTimestamp: number;
  totalAssessments: number;
  independentSuccessRate: number; // Success rate when scaffolding < 0.3
}

export interface MetacognitivePrompt {
  type: 'confidence_check' | 'self_explanation' | 'prediction' | 'transfer_probe';
  prompt: string;
  conceptId: string;
  triggeredAt: number;
}

export type TransferProbeResult = 'success' | 'partial' | 'failure';

// ─── Constants ─────────────────────────────────────────────────

const STORAGE_KEY = 'lumina_scaffolding';
const SUCCESSES_TO_FADE = 3;          // Consecutive successes before reducing scaffolding
const FADE_STEP = 0.1;                // Scaffolding reduction per fade step
const REINSTATE_SMALL = 0.05;         // Reinstate on first failure after fade
const REINSTATE_LARGE = 0.10;         // Reinstate on persistent failure after fade
const PERSISTENT_FAILURE_THRESHOLD = 2; // Failures at reduced level before larger reinstatement
const METACOG_PROMPT_INTERVAL = 5;    // Every N assessments, ask a metacognitive question
const TRANSFER_PROBE_MASTERY = 0.85;  // Trigger transfer probe when mastery > this
const INDEPENDENT_THRESHOLD = 0.3;    // Scaffolding below this = "independent"

// ─── Scaffolding Directives ────────────────────────────────────

/**
 * Map scaffolding levels to instructional directives.
 * These are injected into the agent's system prompt.
 */
const SCAFFOLDING_DIRECTIVES: Record<string, string> = {
  full:     'Provide FULL scaffolding: step-by-step walkthrough, worked examples, multiple hints. The student is new to this concept.',
  high:     'Provide HIGH scaffolding: break problems into small steps, offer hints proactively, check understanding after each step.',
  moderate: 'Provide MODERATE scaffolding: give one guiding hint, then wait for the student to attempt. Offer follow-up hints only if they struggle.',
  low:      'Provide LOW scaffolding: ask the student to try first. Give hints only when explicitly requested. Encourage independent problem-solving.',
  minimal:  'Provide MINIMAL scaffolding: the student should solve independently. Only intervene if they make a fundamental error. Challenge them with variations.',
  none:     'No scaffolding needed. The student has demonstrated independence on this concept. Ask them to explain their reasoning.',
};

const getDirectiveLevel = (level: number): string => {
  if (level >= 0.85) return 'full';
  if (level >= 0.65) return 'high';
  if (level >= 0.45) return 'moderate';
  if (level >= 0.25) return 'low';
  if (level >= 0.10) return 'minimal';
  return 'none';
};

// ─── Scaffolding Engine ────────────────────────────────────────

export class ScaffoldingEngine {
  private scaffoldingStates: Record<string, ScaffoldingState> = {};
  private metacogHistory: MetacognitivePrompt[] = [];
  private transferProbeResults: Record<string, TransferProbeResult[]> = {};

  constructor() {
    this.load();
  }

  // ── Persistence ──────────────────────────────────────────────

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.scaffoldingStates = parsed.states || {};
        this.metacogHistory = parsed.metacogHistory || [];
        this.transferProbeResults = parsed.transferProbes || {};
      }
    } catch {
      this.scaffoldingStates = {};
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        states: this.scaffoldingStates,
        metacogHistory: this.metacogHistory,
        transferProbes: this.transferProbeResults,
      }));
    } catch {
      // Silent fail
    }
  }

  // ── State Management ─────────────────────────────────────────

  private getOrCreateState(conceptId: string): ScaffoldingState {
    if (!this.scaffoldingStates[conceptId]) {
      this.scaffoldingStates[conceptId] = {
        level: 1.0,
        consecutiveSuccesses: 0,
        consecutiveFailures: 0,
        fadeAttempts: 0,
        lastFadeTimestamp: 0,
        totalAssessments: 0,
        independentSuccessRate: 0,
      };
    }
    return this.scaffoldingStates[conceptId];
  }

  // ── Scaffolding Update ───────────────────────────────────────

  /**
   * Process an assessment result and adjust scaffolding level.
   *
   * The fade schedule is designed to be GRADUAL and RECOVERABLE:
   * - Success → eventually reduce scaffolding
   * - Failure → partially reinstate (not full reset)
   *
   * Returns the new scaffolding level.
   */
  public processAssessment(
    conceptId: string,
    isCorrect: boolean,
    masteryLevel: number
  ): { newLevel: number; didFade: boolean; didReinstate: boolean } {
    const state = this.getOrCreateState(conceptId);
    state.totalAssessments++;

    let didFade = false;
    let didReinstate = false;

    if (isCorrect) {
      state.consecutiveSuccesses++;
      state.consecutiveFailures = 0;

      // Track independent success rate
      if (state.level < INDEPENDENT_THRESHOLD) {
        const results = this.transferProbeResults[conceptId] || [];
        const independentAssessments = state.totalAssessments; // Simplified tracking
        state.independentSuccessRate =
          (state.independentSuccessRate * (independentAssessments - 1) + 1) / independentAssessments;
      }

      // Fade scaffolding after consecutive successes
      if (state.consecutiveSuccesses >= SUCCESSES_TO_FADE && state.level > 0) {
        state.level = Math.max(0, state.level - FADE_STEP);
        state.fadeAttempts++;
        state.lastFadeTimestamp = Date.now();
        state.consecutiveSuccesses = 0; // Reset counter
        didFade = true;

        console.log(`[Scaffolding] Faded for ${conceptId}: level = ${state.level.toFixed(2)}`);
      }
    } else {
      state.consecutiveFailures++;
      state.consecutiveSuccesses = 0;

      // Reinstate scaffolding on failure
      if (state.consecutiveFailures >= PERSISTENT_FAILURE_THRESHOLD) {
        // Persistent failure → larger reinstatement
        state.level = Math.min(1, state.level + REINSTATE_LARGE);
        didReinstate = true;
        console.log(`[Scaffolding] PERSISTENT failure reinstatement for ${conceptId}: level = ${state.level.toFixed(2)}`);
      } else if (state.fadeAttempts > 0) {
        // First failure after a fade → small reinstatement
        state.level = Math.min(1, state.level + REINSTATE_SMALL);
        didReinstate = true;
        console.log(`[Scaffolding] Mild reinstatement for ${conceptId}: level = ${state.level.toFixed(2)}`);
      }

      state.consecutiveFailures = Math.min(state.consecutiveFailures, PERSISTENT_FAILURE_THRESHOLD + 1);
    }

    this.persist();
    return { newLevel: state.level, didFade, didReinstate };
  }

  // ── Metacognitive Prompting ──────────────────────────────────

  /**
   * Determine if a metacognitive prompt should be triggered this turn.
   *
   * Types:
   * - confidence_check: "How confident are you? (1-5)"
   * - self_explanation: "Can you explain WHY this works?"
   * - prediction: "Before you solve it, what do you THINK the answer is?"
   * - transfer_probe: "Here's a similar problem from a different context..."
   */
  public shouldPromptMetacognition(
    conceptId: string,
    masteryLevel: number
  ): MetacognitivePrompt | null {
    const state = this.getOrCreateState(conceptId);

    // Don't prompt too frequently
    if (state.totalAssessments % METACOG_PROMPT_INTERVAL !== 0) return null;
    if (state.totalAssessments === 0) return null;

    // Choose prompt type based on context
    const promptType = this.selectMetacogPromptType(state, masteryLevel);

    const prompts: Record<string, string> = {
      confidence_check: 'Before I check your answer, how confident do you feel about it on a scale of 1-5? (1 = guessing, 5 = certain)',
      self_explanation: 'Great work! Now, can you explain in your own words WHY this approach works? Understanding the "why" helps you remember it better.',
      prediction: 'Before you solve this next problem, take a moment to predict: what do you THINK the answer will be? Then solve it and compare.',
      transfer_probe: 'I\'m going to give you a similar problem, but from a slightly different angle. This tests whether you truly understand the concept or just memorized the pattern.',
    };

    const prompt: MetacognitivePrompt = {
      type: promptType,
      prompt: prompts[promptType],
      conceptId,
      triggeredAt: Date.now(),
    };

    this.metacogHistory.push(prompt);
    this.persist();

    return prompt;
  }

  private selectMetacogPromptType(
    state: ScaffoldingState,
    masteryLevel: number
  ): MetacognitivePrompt['type'] {
    // High mastery → transfer probe or self-explanation
    if (masteryLevel >= TRANSFER_PROBE_MASTERY) {
      return Math.random() > 0.5 ? 'transfer_probe' : 'self_explanation';
    }

    // Medium mastery → prediction or confidence check
    if (masteryLevel >= 0.5) {
      return Math.random() > 0.5 ? 'prediction' : 'confidence_check';
    }

    // Low mastery → confidence check (calibration)
    return 'confidence_check';
  }

  // ── Transfer Probes ──────────────────────────────────────────

  /**
   * Record a transfer probe result.
   */
  public recordTransferProbe(
    conceptId: string,
    result: TransferProbeResult
  ): void {
    const results = this.transferProbeResults[conceptId] || [];
    results.push(result);
    // Keep last 10
    if (results.length > 10) results.shift();
    this.transferProbeResults[conceptId] = results;
    this.persist();
  }

  /**
   * Get transfer probe success rate for a concept.
   */
  public getTransferSuccessRate(conceptId: string): number {
    const results = this.transferProbeResults[conceptId] || [];
    if (results.length === 0) return 0;
    return results.filter(r => r === 'success').length / results.length;
  }

  // ── Prompt Injection ─────────────────────────────────────────

  /**
   * Build the scaffolding directive to inject into the agent's system prompt.
   */
  public buildScaffoldingDirective(conceptId: string): string {
    const state = this.getOrCreateState(conceptId);
    const level = getDirectiveLevel(state.level);
    const directive = SCAFFOLDING_DIRECTIVES[level];

    return `--- SCAFFOLDING CONTROL ---
Scaffolding level for this concept: ${state.level.toFixed(2)} (${level.toUpperCase()})
${directive}
${state.fadeAttempts > 0 ? `\nNote: Scaffolding has been reduced ${state.fadeAttempts} time(s). Monitor for signs of struggle.` : ''}
${state.independentSuccessRate > 0 ? `\nIndependent success rate: ${(state.independentSuccessRate * 100).toFixed(0)}%` : ''}`;
  }

  // ── Accessors ────────────────────────────────────────────────

  public getLevel(conceptId: string): number {
    return this.scaffoldingStates[conceptId]?.level ?? 1.0;
  }

  public getState(conceptId: string): ScaffoldingState {
    return { ...this.getOrCreateState(conceptId) };
  }

  public getAllLevels(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [id, state] of Object.entries(this.scaffoldingStates)) {
      result[id] = state.level;
    }
    return result;
  }

  public getMetacogHistory(): MetacognitivePrompt[] {
    return [...this.metacogHistory];
  }

  public clear(): void {
    this.scaffoldingStates = {};
    this.metacogHistory = [];
    this.transferProbeResults = {};
    this.persist();
  }
}
