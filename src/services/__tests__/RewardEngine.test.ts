import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import { RewardEngine } from '../RewardEngine';
import type { RewardSignals, ModelRoutingContext } from '../RewardEngine';

// Mock localStorage for Node test environment
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
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });
});

describe('RewardEngine', () => {
  let engine: RewardEngine;

  beforeEach(() => {
    localStorageMock.clear();
    engine = new RewardEngine();
  });

  describe('Composite Reward', () => {
    it('computes positive reward for good signals', () => {
      const signals: RewardSignals = {
        correctness: 1.0,
        retentionScore: 0.8,
        transferScore: 0.7,
        engagementSignal: 0.5,
        challengeAcceptance: 0.6,
        selfEfficacyDelta: 0.2,
        frustrationSignal: 0.0,
        boredomSignal: 0.0,
        dependencySignal: 0.0,
      };
      const reward = engine.computeReward(signals, 'test-concept');
      expect(reward).toBeGreaterThan(0);
    });

    it('computes negative reward for bad signals', () => {
      const signals: RewardSignals = {
        correctness: 0.0,
        retentionScore: 0.0,
        transferScore: 0.0,
        engagementSignal: 0.0,
        challengeAcceptance: 0.0,
        selfEfficacyDelta: -0.5,
        frustrationSignal: 1.0,
        boredomSignal: 0.8,
        dependencySignal: 1.0,
      };
      const reward = engine.computeReward(signals, 'test-concept');
      expect(reward).toBeLessThan(0);
    });

    it('transfer dominates the reward signal', () => {
      const withTransfer: RewardSignals = {
        correctness: 0.0, retentionScore: 0.0, transferScore: 1.0,
        engagementSignal: 0.0, challengeAcceptance: 0.0, selfEfficacyDelta: 0.0,
        frustrationSignal: 0.0, boredomSignal: 0.0, dependencySignal: 0.0,
      };
      const withCorrectness: RewardSignals = {
        correctness: 1.0, retentionScore: 0.0, transferScore: 0.0,
        engagementSignal: 0.0, challengeAcceptance: 0.0, selfEfficacyDelta: 0.0,
        frustrationSignal: 0.0, boredomSignal: 0.0, dependencySignal: 0.0,
      };
      const transferReward = engine.computeReward(withTransfer, 'a');
      const correctnessReward = engine.computeReward(withCorrectness, 'b');
      expect(transferReward).toBeGreaterThan(correctnessReward);
    });
  });

  describe('Model Routing', () => {
    it('routes to frontier for misconceptions', () => {
      const ctx: ModelRoutingContext = {
        compositeConfidence: 0.8,
        consecutiveFailures: 0,
        hasMisconceptions: true,
        isTransferTask: false,
        isScaffoldingFading: false,
        learnerMasteryLevel: 0.5,
        taskEducationalValue: 'low',
      };
      expect(engine.routeModelTier(ctx)).toBe('frontier');
    });

    it('routes to frontier for transfer tasks', () => {
      const ctx: ModelRoutingContext = {
        compositeConfidence: 0.8,
        consecutiveFailures: 0,
        hasMisconceptions: false,
        isTransferTask: true,
        isScaffoldingFading: false,
        learnerMasteryLevel: 0.5,
        taskEducationalValue: 'medium',
      };
      expect(engine.routeModelTier(ctx)).toBe('frontier');
    });

    it('routes to mid for scaffolding fade', () => {
      const ctx: ModelRoutingContext = {
        compositeConfidence: 0.8,
        consecutiveFailures: 0,
        hasMisconceptions: false,
        isTransferTask: false,
        isScaffoldingFading: true,
        learnerMasteryLevel: 0.5,
        taskEducationalValue: 'low',
      };
      expect(engine.routeModelTier(ctx)).toBe('mid');
    });

    it('routes to light for simple tasks', () => {
      const ctx: ModelRoutingContext = {
        compositeConfidence: 0.9,
        consecutiveFailures: 0,
        hasMisconceptions: false,
        isTransferTask: false,
        isScaffoldingFading: false,
        learnerMasteryLevel: 0.3,
        taskEducationalValue: 'low',
      };
      expect(engine.routeModelTier(ctx)).toBe('light');
    });

    it('maps tiers to correct model names', () => {
      expect(engine.getModelForTier('light')).toContain('lite');
      expect(engine.getModelForTier('mid')).toContain('flash');
      expect(engine.getModelForTier('frontier')).toContain('pro');
    });
  });

  describe('Signal Computation', () => {
    it('computes dependency signal', () => {
      const highDep = engine.computeDependencySignal(0.8, 0.7, 'increasing');
      const lowDep = engine.computeDependencySignal(0.2, 0.3, 'fading');
      expect(highDep).toBeGreaterThan(lowDep);
    });

    it('computes boredom signal', () => {
      const bored = engine.computeBoredomSignal(0.95, 0.2, 'decreasing');
      const engaged = engine.computeBoredomSignal(0.7, 0.8, 'stable');
      expect(bored).toBeGreaterThan(engaged);
    });
  });
});
