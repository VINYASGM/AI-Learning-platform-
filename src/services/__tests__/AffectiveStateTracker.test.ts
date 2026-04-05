import { describe, it, expect, beforeEach } from 'vitest';
import { AffectiveStateTracker } from '../AffectiveStateTracker';

describe('AffectiveStateTracker', () => {
  let tracker: AffectiveStateTracker;

  beforeEach(() => {
    tracker = new AffectiveStateTracker();
  });

  it('initializes with default signals', () => {
    const signals = tracker.getSignals();
    expect(signals.energy).toBe(1.0);
    expect(signals.curiosity).toBe(0.5);
    expect(signals.frustration).toBe(0.0);
    expect(signals.confidence).toBe(0.5);
  });

  it('increases frustration on failure', () => {
    tracker.update({
      messageLength: 20,
      responseTimeMs: 5000,
      isCorrect: false,
      wasHintRequest: false,
      wasSelfInitiatedQuestion: false,
      consecutiveFailures: 1,
      consecutiveSuccesses: 0,
    });
    expect(tracker.getSignals().frustration).toBeGreaterThan(0);
  });

  it('decreases frustration on success', () => {
    // First bump frustration
    tracker.update({
      messageLength: 20, responseTimeMs: 5000, isCorrect: false,
      wasHintRequest: false, wasSelfInitiatedQuestion: false,
      consecutiveFailures: 1, consecutiveSuccesses: 0,
    });
    const afterFail = tracker.getSignals().frustration;

    // Then succeed
    tracker.update({
      messageLength: 50, responseTimeMs: 3000, isCorrect: true,
      wasHintRequest: false, wasSelfInitiatedQuestion: false,
      consecutiveFailures: 0, consecutiveSuccesses: 1,
    });
    expect(tracker.getSignals().frustration).toBeLessThan(afterFail);
  });

  it('increases curiosity on self-initiated questions', () => {
    const before = tracker.getSignals().curiosity;
    tracker.update({
      messageLength: 50, responseTimeMs: 3000, isCorrect: null,
      wasHintRequest: false, wasSelfInitiatedQuestion: true,
      consecutiveFailures: 0, consecutiveSuccesses: 0,
    });
    expect(tracker.getSignals().curiosity).toBeGreaterThan(before);
  });

  it('computes cognitive load', () => {
    const load = tracker.computeCognitiveLoad();
    expect(load).toBeGreaterThanOrEqual(0);
    expect(load).toBeLessThanOrEqual(1);
  });

  it('computes gating signals', () => {
    const gates = tracker.computeGatingSignals();
    expect(gates).toHaveProperty('shouldReduceDifficulty');
    expect(gates).toHaveProperty('shouldSuggestBreak');
    expect(gates).toHaveProperty('shouldAllowExploration');
    expect(gates).toHaveProperty('shouldIncreaseScaffolding');
    expect(gates).toHaveProperty('cognitiveLoadEstimate');
  });

  it('tracks hint request rate', () => {
    tracker.update({
      messageLength: 10, responseTimeMs: 2000, isCorrect: null,
      wasHintRequest: true, wasSelfInitiatedQuestion: false,
      consecutiveFailures: 0, consecutiveSuccesses: 0,
    });
    expect(tracker.getHintRequestRate()).toBe(1.0);

    tracker.update({
      messageLength: 10, responseTimeMs: 2000, isCorrect: null,
      wasHintRequest: false, wasSelfInitiatedQuestion: false,
      consecutiveFailures: 0, consecutiveSuccesses: 0,
    });
    expect(tracker.getHintRequestRate()).toBe(0.5);
  });
});
