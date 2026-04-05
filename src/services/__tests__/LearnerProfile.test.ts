import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getVariantHeuristic, TEACHING_VARIANTS,
  selectPedagogicalAction, microToVariant,
} from '../LearnerProfile';
import type { PolicyContext } from '../LearnerProfile';

describe('LearnerProfile V2', () => {
  describe('V1 Compatibility - getVariantHeuristic', () => {
    it('returns a valid teaching variant', () => {
      const scores = { 'Visual Analogy': 10, 'Socratic Questioning': 5 };
      const result = getVariantHeuristic(scores);
      expect(TEACHING_VARIANTS).toContain(result);
    });

    it('returns random variant with empty scores', () => {
      const result = getVariantHeuristic({});
      expect(TEACHING_VARIANTS).toContain(result);
    });
  });

  describe('Hierarchical Action Selection', () => {
    const baseContext: PolicyContext = {
      masteryLevel: 0.5,
      recentSuccessRate: 0.75,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      scaffoldingLevel: 0.5,
      hasMisconceptions: false,
      turnsSinceInterleave: 0,
      turnsThisSession: 5,
      isPendingReview: false,
    };

    it('selects scaffolding on consecutive failures', () => {
      const ctx = { ...baseContext, consecutiveFailures: 3, hasMisconceptions: false };
      const action = selectPedagogicalAction(ctx, {});
      expect(action.macro).toBe('scaffolding');
    });

    it('selects review for misconceptions with failures', () => {
      const ctx = { ...baseContext, consecutiveFailures: 3, hasMisconceptions: true };
      const action = selectPedagogicalAction(ctx, {});
      expect(action.macro).toBe('review');
    });

    it('selects session on long sessions', () => {
      const ctx = { ...baseContext, turnsThisSession: 35 };
      const action = selectPedagogicalAction(ctx, {});
      expect(action.macro).toBe('session');
    });

    it('returns motivation on high frustration', () => {
      const ctx = {
        ...baseContext,
        affectiveState: { energy: 0.5, curiosity: 0.3, frustration: 0.8, confidence: 0.4 }
      };
      const action = selectPedagogicalAction(ctx, {});
      expect(['motivation', 'scaffolding']).toContain(action.macro);
    });

    it('returns exploration on high curiosity', () => {
      const ctx = {
        ...baseContext,
        affectiveState: { energy: 0.8, curiosity: 0.9, frustration: 0.1, confidence: 0.6 }
      };
      const action = selectPedagogicalAction(ctx, {});
      expect(action.macro).toBe('exploration');
    });

    it('returns difficulty_adjust on very high success rate', () => {
      const ctx = { ...baseContext, recentSuccessRate: 0.95 };
      const action = selectPedagogicalAction(ctx, {});
      expect(action.macro).toBe('difficulty_adjust');
    });

    it('action always has a system prompt directive', () => {
      const action = selectPedagogicalAction(baseContext, {});
      expect(action.systemPromptDirective).toBeTruthy();
      expect(action.systemPromptDirective.length).toBeGreaterThan(10);
    });
  });

  describe('microToVariant mapping', () => {
    it('maps analogy micro to Visual Analogy variant', () => {
      expect(microToVariant('explain_analogy')).toBe('Visual Analogy');
    });

    it('maps diagnostic to Socratic Questioning', () => {
      expect(microToVariant('ask_diagnostic')).toBe('Socratic Questioning');
    });

    it('maps formal explanation to Direct Instruction', () => {
      expect(microToVariant('explain_formal')).toBe('Direct Instruction');
    });

    it('maps real-world example to Real-world Application', () => {
      expect(microToVariant('explain_example')).toBe('Real-world Application');
    });
  });
});
