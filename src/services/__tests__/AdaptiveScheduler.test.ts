import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getNextAdaptiveTopic, REVIEW_THRESHOLD_MS } from '../AdaptiveScheduler';
import { CurriculumNode } from '../KnowledgeGraphService';

describe('AdaptiveScheduler - Spaced Repetition & ZPD Routing', () => {
  beforeEach(() => {
    // Mock the system time manually for deterministic test runs
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockNodes: CurriculumNode[] = [
    { id: 'math', label: 'Math', type: 'domain', status: 'mastered', prerequisites: [] },
    { id: 'arithmetic', label: 'Arithmetic', type: 'topic', status: 'mastered', prerequisites: [] },
    { id: 'fractions', label: 'Fractions', type: 'topic', status: 'learning', prerequisites: ['arithmetic'] },
    { id: 'algebra', label: 'Algebra', type: 'topic', status: 'learning', prerequisites: ['arithmetic'] },
    { id: 'calculus', label: 'Calculus', type: 'topic', status: 'locked', prerequisites: ['algebra', 'fractions'] }
  ];

  it('should prioritize Spaced Repetition if a mastered topic has decayed past the threshold', () => {
    const now = 1000000000000;
    vi.setSystemTime(now);

    const masteryProbabilities = {
      'arithmetic': 0.95,
      'fractions': 0.8,
      'algebra': 0.4
    };

    // Arithmetic was last reviewed 25 hours ago, passing the 24 hour threshold
    const lastReviewed = {
      'arithmetic': now - (REVIEW_THRESHOLD_MS + 1000) 
    };

    const nextTopic = getNextAdaptiveTopic(mockNodes, masteryProbabilities, lastReviewed);

    // It MUST route the student back to Arithmetic for review!
    expect(nextTopic).toBe('arithmetic');
  });

  it('should route to the weakest learning topic (ZPD) if no spaced reviews are required', () => {
    const now = 1000000000000;
    vi.setSystemTime(now);

    const masteryProbabilities = {
      'arithmetic': 0.95,
      'fractions': 0.8,
      'algebra': 0.4  // Algebra is the weakest active topic
    };

    // Arithmetic was reviewed 1 hour ago (well under threshold)
    const lastReviewed = {
      'arithmetic': now - (60 * 60 * 1000) 
    };

    const nextTopic = getNextAdaptiveTopic(mockNodes, masteryProbabilities, lastReviewed);

    // It MUST completely skip Arithmetic and route to the weakest "learning" state topic
    expect(nextTopic).toBe('algebra');
  });

  it('should return null if everything is unlocked but completely mastered and no decays occurred', () => {
    const now = 1000000000000;
    vi.setSystemTime(now);

    const perfectNodes: CurriculumNode[] = mockNodes.map(n => ({...n, status: 'mastered'}));
    
    // Everything mastered, nothing requires review yet
    const nextTopic = getNextAdaptiveTopic(perfectNodes, {}, {
        'arithmetic': now,
        'fractions': now,
        'algebra': now,
        'calculus': now
    });

    expect(nextTopic).toBeNull();
  });
});
