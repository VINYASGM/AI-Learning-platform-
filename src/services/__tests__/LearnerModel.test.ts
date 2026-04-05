import { describe, it, expect, beforeEach } from 'vitest';
import {
  updateMasteryProbability,
  getAdaptiveBKTParams,
  applyForgettingCurve,
  computeUncertainty,
  computeEffectiveDecayRate,
  updateRetrievalStrength,
  updateMasteryEstimate,
  createInitialEstimate,
  getMasteryStage,
  BASE_DECAY_RATES,
} from '../LearnerModel';

describe('LearnerModel V2', () => {
  describe('BKT Core', () => {
    it('increases mastery on correct answer', () => {
      const result = updateMasteryProbability(0.5, true);
      expect(result).toBeGreaterThan(0.5);
    });

    it('decreases mastery on incorrect answer', () => {
      const result = updateMasteryProbability(0.5, false);
      expect(result).toBeLessThan(0.5);
    });

    it('clamps mastery between 0.01 and 0.999', () => {
      const high = updateMasteryProbability(0.999, true);
      const low = updateMasteryProbability(0.01, false);
      expect(high).toBeLessThanOrEqual(0.999);
      expect(low).toBeGreaterThanOrEqual(0.01);
    });
  });

  describe('Adaptive BKT Params', () => {
    it('adjusts learning rate by concept class', () => {
      const factual = getAdaptiveBKTParams(0.5, 5, 'factual');
      const transfer = getAdaptiveBKTParams(0.5, 5, 'transfer');
      expect(factual.pT).toBeGreaterThan(transfer.pT);
    });

    it('increases learning rate for high-performing students', () => {
      const fastLearner = getAdaptiveBKTParams(0.9, 5, 'procedural');
      const struggling = getAdaptiveBKTParams(0.2, 5, 'procedural');
      expect(fastLearner.pT).toBeGreaterThan(struggling.pT);
    });

    it('reduces guess rate with more assessments', () => {
      const few = getAdaptiveBKTParams(0.5, 1, 'procedural');
      const many = getAdaptiveBKTParams(0.5, 10, 'procedural');
      expect(few.pG).toBeGreaterThan(many.pG);
    });
  });

  describe('Tiered Forgetting Curve', () => {
    it('applies decay over time', () => {
      const oneDayMs = 24 * 60 * 60 * 1000;
      const decayed = applyForgettingCurve(0.8, 0.05, oneDayMs);
      expect(decayed).toBeLessThan(0.8);
      expect(decayed).toBeGreaterThan(0);
    });

    it('no decay for zero time', () => {
      expect(applyForgettingCurve(0.8, 0.05, 0)).toBe(0.8);
    });

    it('floors at 0.01', () => {
      const yearMs = 365 * 24 * 60 * 60 * 1000;
      const result = applyForgettingCurve(0.5, 0.1, yearMs);
      expect(result).toBe(0.01);
    });

    it('different concept classes have different base decay', () => {
      expect(BASE_DECAY_RATES.factual).toBeGreaterThan(BASE_DECAY_RATES.procedural);
      expect(BASE_DECAY_RATES.procedural).toBeGreaterThan(BASE_DECAY_RATES.misconception_resistant);
    });

    it('computes different effective rates by mastery stage', () => {
      const novice = computeEffectiveDecayRate('procedural', 0.1);
      const mastered = computeEffectiveDecayRate('procedural', 0.9);
      expect(novice).toBeGreaterThan(mastered);
    });
  });

  describe('Uncertainty', () => {
    it('decreases with more assessments', () => {
      const few = computeUncertainty(1, 0);
      const many = computeUncertainty(20, 0);
      expect(few).toBeGreaterThan(many);
    });

    it('increases with time since last test', () => {
      const recent = computeUncertainty(5, 0);
      const stale = computeUncertainty(5, 30 * 24 * 60 * 60 * 1000);
      expect(stale).toBeGreaterThan(recent);
    });
  });

  describe('Retrieval Strength', () => {
    it('increases on correct active retrieval', () => {
      expect(updateRetrievalStrength(1.0, true, true)).toBe(1.3);
    });

    it('increases less on passive review', () => {
      expect(updateRetrievalStrength(1.0, true, false)).toBe(1.1);
    });

    it('decreases slightly on failure', () => {
      expect(updateRetrievalStrength(1.0, false)).toBe(0.9);
    });

    it('caps at 5.0', () => {
      expect(updateRetrievalStrength(4.9, true, true)).toBe(5.0);
    });

    it('floors at 0.5', () => {
      expect(updateRetrievalStrength(0.5, false)).toBe(0.5);
    });
  });

  describe('Mastery Stage', () => {
    it('classifies correctly', () => {
      expect(getMasteryStage(0.1)).toBe('novice');
      expect(getMasteryStage(0.4)).toBe('developing');
      expect(getMasteryStage(0.7)).toBe('proficient');
      expect(getMasteryStage(0.9)).toBe('mastered');
    });
  });

  describe('Full Mastery Estimate Update', () => {
    it('creates initial estimate with correct defaults', () => {
      const est = createInitialEstimate('factual');
      expect(est.p).toBe(0.1);
      expect(est.uncertainty).toBe(1.0);
      expect(est.conceptClass).toBe('factual');
      expect(est.decayRate).toBe(BASE_DECAY_RATES.factual);
    });

    it('updates all fields on correct answer', () => {
      const initial = createInitialEstimate('procedural');
      const updated = updateMasteryEstimate(initial, true);

      expect(updated.p).toBeGreaterThan(initial.p);
      expect(updated.assessmentCount).toBe(1);
      expect(updated.uncertainty).toBeLessThan(initial.uncertainty);
      expect(updated.retrievalStrength).toBeGreaterThan(initial.retrievalStrength);
    });

    it('updates all fields on incorrect answer', () => {
      const initial = createInitialEstimate('conceptual');
      initial.p = 0.5;
      const updated = updateMasteryEstimate(initial, false);

      expect(updated.p).toBeLessThan(0.5);
      expect(updated.assessmentCount).toBe(1);
      expect(updated.retrievalStrength).toBeLessThan(initial.retrievalStrength);
    });
  });
});
