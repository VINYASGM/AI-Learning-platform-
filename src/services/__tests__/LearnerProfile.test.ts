import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getVariantHeuristic, TEACHING_VARIANTS } from '../LearnerProfile';

describe('LearnerProfile - Multi-Armed Bandit Epsilon-Greedy', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should exploit the highest scoring variant when not exploring', () => {
    // Force Math.random to return 0.5 (above 0.2 EPSILON, forcing exploit mode)
    vi.mocked(Math.random).mockReturnValue(0.5);

    const scores = {
      'Visual Analogy': 10,
      'Socratic Questioning': -5,
      'Direct Instruction': 20, // highest
      'Real-world Application': 0
    };

    const variant = getVariantHeuristic(scores);
    expect(variant).toBe('Direct Instruction');
  });

  it('should explore a random variant even if scores exist if the random threshold hits', () => {
    // Force Math.random to return 0.05 (below 0.2 EPSILON, forcing explore mode)
    // The second call to Math.random is for array indexing. Let's return 0 for index 0 ('Visual Analogy')
    vi.mocked(Math.random)
      .mockReturnValueOnce(0.05) // Epsilon trigger
      .mockReturnValueOnce(0);    // Array index 0

    const scores = {
      'Visual Analogy': -99, // Worst score technically, but we are exploring mathematically
      'Socratic Questioning': 50,
      'Direct Instruction': 50,
      'Real-world Application': 50
    };

    const variant = getVariantHeuristic(scores);
    expect(variant).toBe('Visual Analogy');
  });

  it('should default to generic exploration if scores dictionary is completely empty', () => {
    // Force Math.random to return 0.99 (would normally be exploit mode)
    // But since dictionary is empty, it forces explore mode
    vi.mocked(Math.random)
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.99); // This will pick the very last index

    const variant = getVariantHeuristic({});
    expect(variant).toBe(TEACHING_VARIANTS[TEACHING_VARIANTS.length - 1]);
  });
});
