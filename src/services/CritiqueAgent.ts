/**
 * Critique Agent — Pre-Delivery Draft Quality Assurance
 *
 * The blueprint's "Sub-Agent D": evaluates draft responses BEFORE delivery.
 * Prevents pedagogical failures from reaching the student.
 *
 * Runs only on HIGH-STAKES turns (confidence gating):
 * - compositeConfidence < 0.85
 * - Scaffolding is fading (transition point)
 * - Active misconceptions detected
 * - High educational value task (transfer test, misconception correction)
 *
 * Critique checks:
 * 1. Answer leakage — does the response give away the answer?
 * 2. Scaffolding appropriateness — is the support level consistent?
 * 3. Misconception awareness — does it address/reinforce known misconceptions?
 * 4. ZPD alignment — is the difficulty within the learner's zone?
 *
 * Uses the same model infrastructure with a specialized critique prompt.
 * Single retry (depth budget = 1): generate → critique → (rewrite) → deliver.
 *
 * Three-tier model routing applies:
 * - Light tier for routine critique
 * - Frontier tier for misconception-related or high-stakes critique
 */

// ─── Types ─────────────────────────────────────────────────────

export type CritiqueIssueType =
  | 'answer_leakage'
  | 'scaffolding_mismatch'
  | 'misconception_reinforcement'
  | 'zpd_violation'
  | 'tone_mismatch';

export interface CritiqueIssue {
  type: CritiqueIssueType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggestedFix: string;
}

export interface CritiqueResult {
  approved: boolean;
  issues: CritiqueIssue[];
  overallScore: number;        // 0-1, quality of the draft
  rewriteDirective?: string;   // If not approved, how to rewrite
  critiqueTime: number;        // ms taken for critique
}

export interface CritiqueContext {
  draftResponse: string;
  scaffoldingLevel: number;
  activeMisconceptions: string[];
  masteryLevel: number;
  recentSuccessRate: number;
  frustrationLevel: number;
  conceptLabel: string;
}

// ─── Constants ─────────────────────────────────────────────────

const ANSWER_LEAKAGE_PATTERNS = [
  /the answer is/i,
  /the solution is/i,
  /the result is/i,
  /equals\s+\d+/i,
  /x\s*=\s*\d+.*(?:so|therefore|thus)/i,
  /simply\s+(?:add|subtract|multiply|divide)/i,
  /just\s+(?:do|calculate|compute)/i,
  /here(?:'s| is) (?:the|your) (?:answer|solution)/i,
];

const DIRECT_ANSWER_INDICATORS = [
  /let me (?:show|tell) you (?:the|how)/i,
  /the (?:correct|right) (?:answer|solution|value|result)/i,
  /you (?:should|need to) (?:get|have|find)\s+\d+/i,
];

// Phrases that indicate Socratic guidance (NOT leakage)
const SOCRATIC_INDICATORS = [
  /what do you think/i,
  /can you try/i,
  /how would you/i,
  /why do you think/i,
  /what happens if/i,
  /let's think about/i,
  /consider/i,
  /what if/i,
];

// ─── Critique Agent ────────────────────────────────────────────

export class CritiqueAgent {
  private totalCritiques: number = 0;
  private totalRejections: number = 0;

  /**
   * Evaluate a draft response against pedagogical quality standards.
   * This runs as a FAST, LOCAL heuristic check (no LLM call).
   * LLM-based critique can be layered on top for frontier-tier decisions.
   */
  public critique(context: CritiqueContext): CritiqueResult {
    const startTime = Date.now();
    const issues: CritiqueIssue[] = [];

    // ── Check 1: Answer Leakage ───────────────────────────────
    const leakageIssue = this.checkAnswerLeakage(context.draftResponse);
    if (leakageIssue) issues.push(leakageIssue);

    // ── Check 2: Scaffolding Appropriateness ──────────────────
    const scaffoldingIssue = this.checkScaffoldingAppropriateness(
      context.draftResponse,
      context.scaffoldingLevel
    );
    if (scaffoldingIssue) issues.push(scaffoldingIssue);

    // ── Check 3: Misconception Awareness ──────────────────────
    const misconceptionIssue = this.checkMisconceptionAwareness(
      context.draftResponse,
      context.activeMisconceptions
    );
    if (misconceptionIssue) issues.push(misconceptionIssue);

    // ── Check 4: ZPD Alignment ────────────────────────────────
    const zpdIssue = this.checkZPDAlignment(
      context.draftResponse,
      context.masteryLevel,
      context.recentSuccessRate
    );
    if (zpdIssue) issues.push(zpdIssue);

    // ── Compute Overall Score ──────────────────────────────────
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const highCount = issues.filter(i => i.severity === 'high').length;
    const mediumCount = issues.filter(i => i.severity === 'medium').length;

    const overallScore = Math.max(0,
      1.0 - (criticalCount * 0.4) - (highCount * 0.2) - (mediumCount * 0.1)
    );

    // Approve if no critical issues and score > 0.5
    const approved = criticalCount === 0 && overallScore >= 0.5;

    // Build rewrite directive if not approved
    let rewriteDirective: string | undefined;
    if (!approved) {
      rewriteDirective = this.buildRewriteDirective(issues, context);
    }

    this.totalCritiques++;
    if (!approved) this.totalRejections++;

    const critiqueTime = Date.now() - startTime;

    return {
      approved,
      issues,
      overallScore,
      rewriteDirective,
      critiqueTime,
    };
  }

  // ── Individual Checks ────────────────────────────────────────

  private checkAnswerLeakage(response: string): CritiqueIssue | null {
    // Check for direct answer patterns
    const hasLeakagePattern = ANSWER_LEAKAGE_PATTERNS.some(p => p.test(response));
    const hasDirectIndicator = DIRECT_ANSWER_INDICATORS.some(p => p.test(response));
    const hasSocraticIndicator = SOCRATIC_INDICATORS.some(p => p.test(response));

    if ((hasLeakagePattern || hasDirectIndicator) && !hasSocraticIndicator) {
      return {
        type: 'answer_leakage',
        severity: 'critical',
        description: 'Response appears to directly reveal the answer without requiring student work.',
        suggestedFix: 'Replace direct answers with guiding questions. Ask the student to explain their reasoning.',
      };
    }

    // Check for subtle leakage: response contains numeric answers after "="
    const numericResults = response.match(/=\s*-?\d+(\.\d+)?/g);
    if (numericResults && numericResults.length > 2 && !hasSocraticIndicator) {
      return {
        type: 'answer_leakage',
        severity: 'medium',
        description: 'Response contains multiple computed results that may reveal intermediate or final answers.',
        suggestedFix: 'Show the setup but leave the final computation for the student.',
      };
    }

    return null;
  }

  private checkScaffoldingAppropriateness(
    response: string,
    scaffoldingLevel: number
  ): CritiqueIssue | null {
    const responseLength = response.length;
    const hasWorkedExample = response.includes('Step 1') || response.includes('step 1') ||
      (response.match(/\d+\)/g) || []).length > 3;
    const hasMultipleHints = (response.match(/hint/gi) || []).length > 1;

    // Low scaffolding but providing too much support
    if (scaffoldingLevel < 0.3 && (hasWorkedExample || hasMultipleHints)) {
      return {
        type: 'scaffolding_mismatch',
        severity: 'high',
        description: `Scaffolding level is ${scaffoldingLevel.toFixed(2)} (LOW) but response provides extensive support (worked examples/multiple hints).`,
        suggestedFix: 'Reduce support. Ask the student to attempt independently. Only provide minimal guidance.',
      };
    }

    // High scaffolding but too little support (response very short)
    if (scaffoldingLevel > 0.7 && responseLength < 150 && !hasWorkedExample) {
      return {
        type: 'scaffolding_mismatch',
        severity: 'medium',
        description: `Scaffolding level is ${scaffoldingLevel.toFixed(2)} (HIGH) but response provides minimal support.`,
        suggestedFix: 'Provide more detailed step-by-step guidance, examples, or hints.',
      };
    }

    return null;
  }

  private checkMisconceptionAwareness(
    response: string,
    activeMisconceptions: string[]
  ): CritiqueIssue | null {
    if (activeMisconceptions.length === 0) return null;

    // Check if the response could accidentally reinforce a misconception
    // This is a simplified check; LLM-based verification would be more accurate
    const responseLower = response.toLowerCase();

    const knownRiskPhrases: Record<string, string[]> = {
      'distribute-negative': ['always distribute', 'just multiply', 'simple distribution'],
      'equals-means-answer': ['equals means', 'answer is'],
      'multiply-add-confusion': ['repeated addition', 'just add'],
    };

    for (const misconception of activeMisconceptions) {
      const riskPhrases = knownRiskPhrases[misconception] || [];
      const hasRisk = riskPhrases.some(phrase => responseLower.includes(phrase));

      if (hasRisk) {
        return {
          type: 'misconception_reinforcement',
          severity: 'high',
          description: `Response may inadvertently reinforce known misconception: "${misconception}"`,
          suggestedFix: 'Rephrase to create conceptual conflict that helps the student discover their misconception.',
        };
      }
    }

    return null;
  }

  private checkZPDAlignment(
    response: string,
    masteryLevel: number,
    recentSuccessRate: number
  ): CritiqueIssue | null {
    // If student is struggling (low success rate) but response introduces
    // new concepts → ZPD violation
    if (recentSuccessRate < 0.5 && masteryLevel < 0.3) {
      const introducesNew = /now let('|u)s (?:move on|look at|consider|explore)/i.test(response) ||
        /new concept/i.test(response) ||
        /advanced/i.test(response);

      if (introducesNew) {
        return {
          type: 'zpd_violation',
          severity: 'high',
          description: `Student has ${(recentSuccessRate * 100).toFixed(0)}% success rate and ${(masteryLevel * 100).toFixed(0)}% mastery, but response introduces new/advanced material.`,
          suggestedFix: 'Stay on the current concept. Simplify. Break into smaller sub-steps.',
        };
      }
    }

    return null;
  }

  // ── Rewrite Directive Builder ────────────────────────────────

  private buildRewriteDirective(
    issues: CritiqueIssue[],
    context: CritiqueContext
  ): string {
    const lines = ['CRITIQUE REWRITE DIRECTIVE: The original response had the following issues:'];

    for (const issue of issues) {
      lines.push(`\n[${issue.severity.toUpperCase()}] ${issue.type}: ${issue.description}`);
      lines.push(`  Fix: ${issue.suggestedFix}`);
    }

    lines.push(`\nRewrite the response maintaining the topic "${context.conceptLabel}" ` +
      `at scaffolding level ${context.scaffoldingLevel.toFixed(2)}. ` +
      `Use the Socratic method. Never give the answer directly.`);

    if (context.activeMisconceptions.length > 0) {
      lines.push(`\nActive misconceptions to address: ${context.activeMisconceptions.join(', ')}`);
    }

    return lines.join('\n');
  }

  // ── Determine if Critique is Needed ──────────────────────────

  /**
   * Determine whether a critique pass is needed for this interaction.
   * Uses the confidence gating threshold.
   */
  public shouldRunCritique(params: {
    compositeConfidence: number;
    hasMisconceptions: boolean;
    isScaffoldingFading: boolean;
    isHighStakesTask: boolean;
  }): boolean {
    // Always critique if misconceptions are active
    if (params.hasMisconceptions) return true;

    // Always critique during scaffolding transitions
    if (params.isScaffoldingFading) return true;

    // Always critique high-stakes tasks
    if (params.isHighStakesTask) return true;

    // Confidence gating: critique when uncertain
    if (params.compositeConfidence < 0.85) return true;

    return false;
  }

  // ── Accessors ────────────────────────────────────────────────

  public getStats(): { totalCritiques: number; totalRejections: number; rejectionRate: number } {
    return {
      totalCritiques: this.totalCritiques,
      totalRejections: this.totalRejections,
      rejectionRate: this.totalCritiques > 0
        ? this.totalRejections / this.totalCritiques
        : 0,
    };
  }
}
