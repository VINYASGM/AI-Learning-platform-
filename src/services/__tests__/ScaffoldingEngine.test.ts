import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { ScaffoldingEngine } from '../ScaffoldingEngine';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

beforeAll(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
});

describe('ScaffoldingEngine', () => {
  let engine: ScaffoldingEngine;

  beforeEach(() => {
    localStorageMock.clear();
    engine = new ScaffoldingEngine();
  });

  describe('Scaffolding Fade', () => {
    it('starts at full scaffolding', () => {
      expect(engine.getLevel('test-concept')).toBe(1.0);
    });

    it('reduces scaffolding after consecutive successes', () => {
      // 3 consecutive successes → fade
      engine.processAssessment('test', true, 0.5);
      engine.processAssessment('test', true, 0.5);
      const result = engine.processAssessment('test', true, 0.5);
      
      expect(result.didFade).toBe(true);
      expect(result.newLevel).toBeLessThan(1.0);
    });

    it('reinstates scaffolding on failure after fade', () => {
      // Fade first
      engine.processAssessment('test', true, 0.5);
      engine.processAssessment('test', true, 0.5);
      engine.processAssessment('test', true, 0.5); // Triggers fade

      // Then fail
      const result = engine.processAssessment('test', false, 0.5);
      expect(result.didReinstate).toBe(true);
    });

    it('never exceeds 1.0 or goes below 0.0', () => {
      // Many failures should not exceed 1.0
      for (let i = 0; i < 10; i++) {
        engine.processAssessment('test', false, 0.3);
      }
      expect(engine.getLevel('test')).toBeLessThanOrEqual(1.0);

      // Many successes should not go below 0.0
      for (let i = 0; i < 50; i++) {
        engine.processAssessment('easy', true, 0.9);
      }
      expect(engine.getLevel('easy')).toBeGreaterThanOrEqual(0.0);
    });
  });

  describe('Metacognitive Prompting', () => {
    it('triggers on interval', () => {
      // Fill total assessments to hit the interval
      for (let i = 0; i < 4; i++) {
        engine.processAssessment('metacog-test', true, 0.5);
      }
      const prompt = engine.shouldPromptMetacognition('metacog-test', 0.5);
      // May or may not trigger depending on 5th turn (interval check)
      // The 5th assessment hits totalAssessments % 5 === 0
      engine.processAssessment('metacog-test', true, 0.5);
      const prompt2 = engine.shouldPromptMetacognition('metacog-test', 0.5);
      expect(prompt2).toBeTruthy();
    });
  });

  describe('Scaffolding Directive', () => {
    it('generates directive string', () => {
      const directive = engine.buildScaffoldingDirective('test-concept');
      expect(directive).toContain('SCAFFOLDING CONTROL');
      expect(directive).toContain('scaffolding');
    });
  });

  describe('Transfer Probes', () => {
    it('records and queries transfer results', () => {
      engine.recordTransferProbe('concept-a', 'success');
      engine.recordTransferProbe('concept-a', 'failure');
      expect(engine.getTransferSuccessRate('concept-a')).toBe(0.5);
    });
  });
});
