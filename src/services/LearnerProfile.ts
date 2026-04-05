/**
 * Learner Profile — V2 Hierarchical Pedagogical Action Space
 *
 * Upgrades from V1 (flat 4 TeachingVariant):
 * - 9 macro-action categories with specific micro-actions
 * - Hierarchical contextual bandit: select macro first, then micro
 * - RL-learned vs rule-based boundary enforced
 * - Backward-compatible: TeachingVariant still exported as a union type
 *
 * RL Boundary (per blueprint):
 *   ✅ RL-learned: pacing, timing, difficulty, explanation style, motivation
 *   🔒 Rule-based: factual accuracy, ethics, prerequisites, session limits
 *   🔒 Constrained: difficulty bounded by ZPD, motivation never manipulative
 */

import { AffectiveSignals } from './AffectiveStateTracker';

// ─── V1 Compatibility ──────────────────────────────────────────

export type TeachingVariant =
  | 'Visual Analogy'
  | 'Socratic Questioning'
  | 'Direct Instruction'
  | 'Real-world Application';

export const TEACHING_VARIANTS: TeachingVariant[] = [
  'Visual Analogy',
  'Socratic Questioning',
  'Direct Instruction',
  'Real-world Application'
];

// ─── V2 Hierarchical Action Space ──────────────────────────────

export type MacroAction =
  | 'instruction'
  | 'assessment'
  | 'difficulty_adjust'
  | 'scaffolding'
  | 'review'
  | 'motivation'
  | 'exploration'
  | 'metacognition'
  | 'session';

export type MicroAction =
  // Instruction
  | 'explain_formal'
  | 'explain_intuitive'
  | 'explain_analogy'
  | 'explain_example'
  // Assessment
  | 'ask_diagnostic'
  | 'assign_practice'
  | 'give_transfer_task'
  // Difficulty
  | 'increase_difficulty'
  | 'decrease_difficulty'
  | 'maintain_level'
  // Scaffolding
  | 'give_hint'
  | 'decompose_problem'
  | 'provide_worked_example'
  // Review
  | 'schedule_spaced_review'
  | 'revisit_misconception'
  | 'retrieval_practice'
  // Motivation
  | 'acknowledge_progress'
  | 'reframe_failure'
  | 'connect_to_goals'
  | 'suggest_break'
  // Exploration
  | 'curiosity_tangent'
  | 'suggest_project'
  // Metacognition
  | 'prompt_self_explanation'
  | 'ask_prediction'
  | 'request_confidence'
  // Session
  | 'summarize_session'
  | 'set_agenda'
  | 'suggest_return_time';

export interface PedagogicalAction {
  macro: MacroAction;
  micro: MicroAction;
  systemPromptDirective: string;
}

// ─── Macro → Micro Mapping ─────────────────────────────────────

const MACRO_MICROS: Record<MacroAction, MicroAction[]> = {
  instruction: ['explain_formal', 'explain_intuitive', 'explain_analogy', 'explain_example'],
  assessment: ['ask_diagnostic', 'assign_practice', 'give_transfer_task'],
  difficulty_adjust: ['increase_difficulty', 'decrease_difficulty', 'maintain_level'],
  scaffolding: ['give_hint', 'decompose_problem', 'provide_worked_example'],
  review: ['schedule_spaced_review', 'revisit_misconception', 'retrieval_practice'],
  motivation: ['acknowledge_progress', 'reframe_failure', 'connect_to_goals', 'suggest_break'],
  exploration: ['curiosity_tangent', 'suggest_project'],
  metacognition: ['prompt_self_explanation', 'ask_prediction', 'request_confidence'],
  session: ['summarize_session', 'set_agenda', 'suggest_return_time'],
};

// ─── Action → Directive Mapping ────────────────────────────────

const ACTION_DIRECTIVES: Record<MicroAction, string> = {
  // Instruction
  explain_formal: 'Use formal mathematical notation and rigorous definitions. Build from axioms.',
  explain_intuitive: 'Use intuitive reasoning, everyday language, and accessible metaphors. Avoid jargon.',
  explain_analogy: 'Lead with a vivid real-world analogy that maps to the mathematical structure.',
  explain_example: 'Provide a specific worked example, then generalize the pattern.',
  // Assessment
  ask_diagnostic: 'Ask a targeted diagnostic question to assess understanding of the core concept.',
  assign_practice: 'Assign a practice problem at the appropriate difficulty level for independent work.',
  give_transfer_task: 'Present a problem from a different context that requires applying the same underlying concept.',
  // Difficulty
  increase_difficulty: 'Increase challenge slightly. Add an additional constraint or complexity layer to the problem.',
  decrease_difficulty: 'Reduce difficulty. Remove a variable, provide more context, or simplify numbers.',
  maintain_level: 'Keep the current difficulty level. Reinforce with a similarly-structured problem.',
  // Scaffolding
  give_hint: 'Provide one focused, scaffolded hint that points toward the next step without revealing the answer.',
  decompose_problem: 'Break the problem into 2-3 smaller sub-problems. Guide through the first sub-problem.',
  provide_worked_example: 'Show a complete worked example of a similar (but different) problem, then ask them to solve the original.',
  // Review
  schedule_spaced_review: 'Revisit a previously learned concept for spaced retrieval practice.',
  revisit_misconception: 'Revisit a known misconception with a carefully designed "conceptual conflict" problem.',
  retrieval_practice: 'Without re-teaching, ask the student to recall and explain a previously mastered concept.',
  // Motivation
  acknowledge_progress: 'Explicitly acknowledge what the student has accomplished. Be specific about growth.',
  reframe_failure: 'Reframe the failure as a learning opportunity. Normalize productive struggle.',
  connect_to_goals: 'Connect the current work to the student\'s expressed goals and interests.',
  suggest_break: 'Gently suggest a break. The student may be experiencing cognitive fatigue.',
  // Exploration
  curiosity_tangent: 'Follow the student\'s curiosity to an adjacent topic. Support self-directed exploration.',
  suggest_project: 'Suggest a hands-on project that applies the concept in a creative, open-ended way.',
  // Metacognition
  prompt_self_explanation: 'Ask the student to explain their reasoning in their own words before proceeding.',
  ask_prediction: 'Before solving, ask the student to predict what they think the answer will be.',
  request_confidence: 'Ask: "How confident are you in your approach? (1-5)"',
  // Session
  summarize_session: 'Provide a brief summary of what was covered and what was accomplished.',
  set_agenda: 'Outline what the next session will focus on based on the student\'s current progress.',
  suggest_return_time: 'Suggest an optimal return time based on the spaced repetition schedule.',
};

// ─── Tone Profile ──────────────────────────────────────────────

export interface ToneProfile {
  formality: number;      // 0 (casual) to 1 (formal)
  encouragement: number;  // 0 (neutral) to 1 (highly encouraging)
  humor: number;          // 0 (none) to 1 (funny)
}

export const DEFAULT_TONE_PROFILE: ToneProfile = {
  formality: 0.3,        // Fairly casual but academic
  encouragement: 0.9,    // Very encouraging
  humor: 0.5             // Occasional jokes/analogies
};

// ─── Policy Selection Context ──────────────────────────────────

export interface PolicyContext {
  masteryLevel: number;           // 0-1
  recentSuccessRate: number;      // 0-1
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  scaffoldingLevel: number;       // 0-1
  hasMisconceptions: boolean;
  affectiveState?: AffectiveSignals;
  turnsSinceInterleave: number;
  turnsThisSession: number;
  isPendingReview: boolean;
}

// ─── Hierarchical Policy ───────────────────────────────────────

/**
 * V1 backward-compatible function.
 * Still returns a TeachingVariant for the existing system prompt.
 */
export function getVariantHeuristic(banditScores: Record<string, number>): TeachingVariant {
  const EPSILON = 0.2;

  if (Math.random() < EPSILON || Object.keys(banditScores).length === 0) {
    return TEACHING_VARIANTS[Math.floor(Math.random() * TEACHING_VARIANTS.length)];
  }

  let bestVariant = TEACHING_VARIANTS[0];
  let maxScore = -Infinity;

  for (const variant of TEACHING_VARIANTS) {
    const score = banditScores[variant] || 0;
    if (score > maxScore) {
      maxScore = score;
      bestVariant = variant;
    }
  }

  return bestVariant;
}

/**
 * V2 hierarchical action selection.
 *
 * Step 1 (RULE-BASED): Select macro action based on state constraints
 * Step 2 (RL-LEARNED): Select micro action using contextual bandit
 *
 * The key principle: RL optimizes the "how" and "when,"
 * while rules enforce the "what not to do."
 */
export function selectPedagogicalAction(
  context: PolicyContext,
  banditScores: Record<string, number>
): PedagogicalAction {
  // ── Step 1: Rule-based macro selection ──────────────────────

  const macro = selectMacroAction(context);

  // ── Step 2: Contextual bandit micro selection ───────────────

  const availableMicros = MACRO_MICROS[macro];
  const micro = selectMicroAction(availableMicros, banditScores, context);

  return {
    macro,
    micro,
    systemPromptDirective: ACTION_DIRECTIVES[micro],
  };
}

/**
 * Rule-based macro action selection.
 * Enforces hard constraints and safety rules.
 */
function selectMacroAction(ctx: PolicyContext): MacroAction {
  // ── RULE: Always intervene after 2-3 consecutive failures ───
  if (ctx.consecutiveFailures >= 3) {
    if (ctx.hasMisconceptions) return 'review'; // Revisit misconception
    return 'scaffolding'; // Break down the problem
  }

  // ── RULE: Session boundaries ─────────────────────────────────
  if (ctx.turnsThisSession > 30 || (ctx.affectiveState?.energy ?? 1) < 0.15) {
    return 'session'; // Wrap up
  }

  // ── RULE: Cognitive load / fatigue gating ────────────────────
  if (ctx.affectiveState) {
    if (ctx.affectiveState.frustration > 0.7) {
      return Math.random() > 0.5 ? 'motivation' : 'scaffolding';
    }
    if (ctx.affectiveState.energy < 0.25) {
      return 'motivation'; // Suggest break or connect to goals
    }
    if (ctx.affectiveState.curiosity > 0.8) {
      return 'exploration'; // Allow curiosity tangent
    }
  }

  // ── RULE: Pending spaced review ──────────────────────────────
  if (ctx.isPendingReview) {
    return 'review';
  }

  // ── RULE: Active misconception → address it ──────────────────
  if (ctx.hasMisconceptions && ctx.consecutiveFailures >= 1) {
    return 'review'; // revisit_misconception
  }

  // ── RULE: Scaffolding check after successes ──────────────────
  if (ctx.consecutiveSuccesses >= 3 && ctx.scaffoldingLevel > 0.3) {
    return 'metacognition'; // Test independence before fading scaffolding
  }

  // ── RL-LEARNED: Context-dependent selection ──────────────────
  // If success rate is in ZPD band and no special conditions, use bandit
  if (ctx.recentSuccessRate >= 0.70 && ctx.recentSuccessRate <= 0.85) {
    // Sweet spot — assess or instruct based on bandit
    return Math.random() > 0.4 ? 'assessment' : 'instruction';
  }

  if (ctx.recentSuccessRate > 0.85) {
    return 'difficulty_adjust'; // Too easy → increase
  }

  if (ctx.recentSuccessRate < 0.70) {
    return ctx.scaffoldingLevel > 0.5 ? 'instruction' : 'scaffolding';
  }

  return 'instruction'; // Default
}

/**
 * Contextual bandit micro-action selection with epsilon-greedy exploration.
 */
function selectMicroAction(
  available: MicroAction[],
  banditScores: Record<string, number>,
  context: PolicyContext
): MicroAction {
  const EPSILON = 0.15; // 15% exploration rate

  // Explore: random
  if (Math.random() < EPSILON) {
    return available[Math.floor(Math.random() * available.length)];
  }

  // Exploit: highest bandit score among available micro-actions
  let bestMicro = available[0];
  let maxScore = -Infinity;

  for (const micro of available) {
    const score = banditScores[micro] || 0;
    if (score > maxScore) {
      maxScore = score;
      bestMicro = micro;
    }
  }

  return bestMicro;
}

/**
 * Map a V2 micro-action back to a V1 TeachingVariant for backward compatibility.
 */
export function microToVariant(micro: MicroAction): TeachingVariant {
  switch (micro) {
    case 'explain_analogy':
    case 'curiosity_tangent':
      return 'Visual Analogy';
    case 'ask_diagnostic':
    case 'prompt_self_explanation':
    case 'ask_prediction':
    case 'request_confidence':
      return 'Socratic Questioning';
    case 'explain_formal':
    case 'provide_worked_example':
    case 'decompose_problem':
      return 'Direct Instruction';
    case 'explain_example':
    case 'connect_to_goals':
    case 'suggest_project':
      return 'Real-world Application';
    default:
      return 'Socratic Questioning';
  }
}
