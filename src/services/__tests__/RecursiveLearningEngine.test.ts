import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RecursiveLearningEngine, EpisodeInput } from '../RecursiveLearningEngine';
import { EpisodicMemoryStore } from '../EpisodicMemoryStore';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

function createInput(overrides: Partial<EpisodeInput> = {}): EpisodeInput {
  return {
    conceptId: 'sub-linear',
    conceptLabel: 'Linear Equations',
    strategyUsed: 'Socratic Questioning',
    masteryBefore: 0.3,
    masteryAfter: 0.5,
    studentMessages: ['I think the answer is x = 5', 'Because 2x + 3 = 13, so 2x = 10'],
    agentResponses: ['Great thinking! Can you show me the steps?'],
    wasCorrect: true,
    ...overrides
  };
}

describe('RecursiveLearningEngine', () => {
  let memoryStore: EpisodicMemoryStore;
  let engine: RecursiveLearningEngine;

  beforeEach(() => {
    localStorageMock.clear();
    memoryStore = new EpisodicMemoryStore();
    engine = new RecursiveLearningEngine(memoryStore);
  });

  describe('Episode Scoring', () => {
    it('should score a successful episode highly on all axes', () => {
      const result = engine.processEpisode(createInput({
        wasCorrect: true,
        masteryBefore: 0.3,
        masteryAfter: 0.6,
        studentMessages: ['I solved it step by step, first I subtracted 3 from both sides to get 2x = 10']
      }));

      expect(result.scores.clarityScore).toBeGreaterThan(0.5);
      expect(result.scores.progressScore).toBeGreaterThan(0.7);
      expect(result.episode.outcome).toBe('success');
    });

    it('should score a failed episode poorly', () => {
      const result = engine.processEpisode(createInput({
        wasCorrect: false,
        masteryBefore: 0.5,
        masteryAfter: 0.3,
        studentMessages: ['idk', '?', 'what']
      }));

      expect(result.scores.clarityScore).toBeLessThan(0.4);
      expect(result.scores.engagementScore).toBeLessThan(0.3); // Short responses
      expect(result.scores.progressScore).toBeLessThan(0.3); // Mastery regressed
      expect(result.episode.outcome).toBe('failure');
    });

    it('should detect low engagement from short responses', () => {
      const result = engine.processEpisode(createInput({
        studentMessages: ['yes', 'no', 'ok']
      }));

      expect(result.scores.engagementScore).toBeLessThan(0.3);
    });

    it('should score high efficiency for large progress in few turns', () => {
      const result = engine.processEpisode(createInput({
        masteryBefore: 0.1,
        masteryAfter: 0.5,
        studentMessages: ['The answer is x = 5 because I divided both sides by 2'],
        wasCorrect: true
      }));

      expect(result.scores.efficiencyScore).toBeGreaterThan(0.7);
    });
  });

  describe('Feedback Synthesis', () => {
    it('should generate strategy_switch directive after consecutive failures', () => {
      // Create 3 consecutive failures
      engine.processEpisode(createInput({ wasCorrect: false, masteryBefore: 0.3, masteryAfter: 0.2 }));
      engine.processEpisode(createInput({ wasCorrect: false, masteryBefore: 0.2, masteryAfter: 0.15 }));
      const result = engine.processEpisode(createInput({ wasCorrect: false, masteryBefore: 0.15, masteryAfter: 0.1 }));

      const switchDirective = result.directives.find(d => d.type === 'strategy_switch');
      expect(switchDirective).toBeDefined();
      expect(switchDirective!.priority).toBe('high');
    });

    it('should generate difficulty_recalibrate on mastery regression', () => {
      const result = engine.processEpisode(createInput({
        wasCorrect: false,
        masteryBefore: 0.6,
        masteryAfter: 0.4
      }));

      const recalDirective = result.directives.find(d => d.type === 'difficulty_recalibrate');
      expect(recalDirective).toBeDefined();
    });

    it('should generate tone_adjust for disengaged students', () => {
      const result = engine.processEpisode(createInput({
        studentMessages: ['k', 'ok', 'sure'],
        wasCorrect: null
      }));

      const toneDirective = result.directives.find(d => d.type === 'tone_adjust');
      expect(toneDirective).toBeDefined();
    });
  });

  describe('Reflection Gate — Significant Events Only', () => {
    it('should trigger reflection on significant mastery shift', () => {
      const result = engine.processEpisode(createInput({
        masteryBefore: 0.3,
        masteryAfter: 0.6 // 30% delta exceeds 15% threshold
      }));

      expect(result.shouldSelfReflect).toBe(true);
      expect(result.reflectionReason).toContain('Mastery shifted significantly');
    });

    it('should trigger reflection on consecutive failures', () => {
      engine.processEpisode(createInput({ wasCorrect: false, masteryBefore: 0.3, masteryAfter: 0.2 }));
      engine.processEpisode(createInput({ wasCorrect: false, masteryBefore: 0.2, masteryAfter: 0.15 }));
      const result = engine.processEpisode(createInput({ wasCorrect: false, masteryBefore: 0.15, masteryAfter: 0.1 }));

      expect(result.shouldSelfReflect).toBe(true);
      expect(result.reflectionReason).toContain('consecutive failures');
    });

    it('should trigger reflection on disengagement', () => {
      const result = engine.processEpisode(createInput({
        studentMessages: ['k', '?'],
        wasCorrect: null,
        masteryBefore: 0.5,
        masteryAfter: 0.5
      }));

      expect(result.shouldSelfReflect).toBe(true);
      expect(result.reflectionReason).toContain('Disengagement');
    });

    it('should trigger reflection on first episode for a concept', () => {
      const result = engine.processEpisode(createInput({
        conceptId: 'brand-new-concept',
        masteryBefore: 0.1,
        masteryAfter: 0.15
      }));

      expect(result.shouldSelfReflect).toBe(true);
      expect(result.reflectionReason).toContain('First teaching episode');
    });

    it('should NOT trigger reflection on routine successful episode', () => {
      // Add a prior episode so it's not the "first" one
      engine.processEpisode(createInput({
        masteryBefore: 0.3,
        masteryAfter: 0.35 // Small change
      }));
      
      const result = engine.processEpisode(createInput({
        wasCorrect: true,
        masteryBefore: 0.35,
        masteryAfter: 0.42 // Another small change, well below 15% threshold
      }));

      expect(result.shouldSelfReflect).toBe(false);
    });
  });

  describe('Episode Storage', () => {
    it('should store episodes in the memory store after processing', () => {
      engine.processEpisode(createInput());
      expect(memoryStore.getCount()).toBe(1);
    });

    it('should accumulate episodes across multiple interactions', () => {
      engine.processEpisode(createInput());
      engine.processEpisode(createInput());
      engine.processEpisode(createInput());
      expect(memoryStore.getCount()).toBe(3);
    });
  });
});
