import { describe, it, expect } from 'vitest';
import { updateMasteryProbability } from '../LearnerModel';

describe('LearnerModel - Bayesian Knowledge Tracing (BKT)', () => {
  it('should significantly increase mastery probability after a correct answer given initial state', () => {
    const initialPL = 0.1;
    const newPL = updateMasteryProbability(initialPL, true);
    
    // P(L) should increase above 0.1
    expect(newPL).toBeGreaterThan(initialPL);
    // Should be exactly calculated based on parameters
    // Numerator = 0.1 * 0.9 = 0.09
    // Denom = 0.09 + (0.9 * 0.2) = 0.09 + 0.18 = 0.27
    // P(L|obs) = 0.09/0.27 = 0.3333
    // P_next = 0.3333 + (1 - 0.3333) * 0.25 = 0.3333 + 0.1666 = 0.5
    expect(newPL).toBeCloseTo(0.5, 2);
  });

  it('should decrease mastery probability after an incorrect answer', () => {
    const initialPL = 0.5;
    const newPL = updateMasteryProbability(initialPL, false);
    
    // P(L) should decrease
    expect(newPL).toBeLessThan(initialPL);
  });

  it('should cap mastery probability at 0.999 safely', () => {
    let pL = 0.95;
    for (let i = 0; i < 5; i++) {
        pL = updateMasteryProbability(pL, true);
    }
    expect(pL).toBeLessThanOrEqual(0.999);
  });

  it('should drop probability but bottom out at 0.01 safely', () => {
    let pL = 0.2;
    for (let i = 0; i < 5; i++) {
        pL = updateMasteryProbability(pL, false);
    }
    expect(pL).toBeGreaterThanOrEqual(0.01);
  });

  it('should surpass mastery threshold (0.90) after approximately 3 successive correct answers from scratch', () => {
    let pL = 0.1;
    // Step 1
    pL = updateMasteryProbability(pL, true);
    expect(pL).toBeCloseTo(0.50, 1);
    
    // Step 2
    pL = updateMasteryProbability(pL, true);
    expect(pL).toBeCloseTo(0.82, 1);

    // Step 3
    pL = updateMasteryProbability(pL, true);
    expect(pL).toBeGreaterThan(0.90);
  });
});
