import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EpisodicMemoryStore, Episode, EpisodeOutcome } from '../EpisodicMemoryStore';

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

function createMockEpisode(overrides: Partial<Episode> = {}): Episode {
  return {
    id: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    conceptId: 'sub-linear',
    conceptLabel: 'Linear Equations',
    strategyUsed: 'Socratic Questioning',
    outcome: 'success',
    clarityScore: 0.7,
    engagementScore: 0.8,
    progressScore: 0.6,
    efficiencyScore: 0.7,
    masteryBefore: 0.3,
    masteryAfter: 0.5,
    turnsInEpisode: 3,
    studentMessages: ['I think x = 5', 'Because 2x + 3 = 13'],
    agentSummary: 'Taught Linear Equations using Socratic Questioning. 3 turns. Outcome: successful.',
    isConsolidated: false,
    ...overrides
  };
}

describe('EpisodicMemoryStore', () => {
  let store: EpisodicMemoryStore;

  beforeEach(() => {
    localStorageMock.clear();
    store = new EpisodicMemoryStore();
  });

  afterEach(() => {
    store.clear();
  });

  it('should add and retrieve episodes', () => {
    const ep = createMockEpisode();
    store.addEpisode(ep);
    
    expect(store.getCount()).toBe(1);
    expect(store.getAll()[0].id).toBe(ep.id);
  });

  it('should query episodes by concept', () => {
    store.addEpisode(createMockEpisode({ conceptId: 'sub-linear' }));
    store.addEpisode(createMockEpisode({ conceptId: 'sub-quadratics' }));
    store.addEpisode(createMockEpisode({ conceptId: 'sub-linear' }));

    const results = store.getEpisodesForConcept('sub-linear');
    expect(results.length).toBe(2);
  });

  it('should query episodes by outcome', () => {
    store.addEpisode(createMockEpisode({ outcome: 'success' }));
    store.addEpisode(createMockEpisode({ outcome: 'failure' }));
    store.addEpisode(createMockEpisode({ outcome: 'success' }));

    const successes = store.query({ outcome: 'success' });
    expect(successes.length).toBe(2);
  });

  it('should return successful strategies sorted by effectiveness', () => {
    store.addEpisode(createMockEpisode({ 
      strategyUsed: 'Visual Analogy', 
      outcome: 'success',
      clarityScore: 0.9, engagementScore: 0.9, progressScore: 0.9, efficiencyScore: 0.9
    }));
    store.addEpisode(createMockEpisode({ 
      strategyUsed: 'Socratic Questioning', 
      outcome: 'success',
      clarityScore: 0.5, engagementScore: 0.5, progressScore: 0.5, efficiencyScore: 0.5
    }));

    const strategies = store.getSuccessfulStrategies('sub-linear');
    expect(strategies[0]).toBe('Visual Analogy'); // Higher scores
  });

  it('should return failure patterns', () => {
    store.addEpisode(createMockEpisode({ strategyUsed: 'Direct Instruction', outcome: 'failure', clarityScore: 0.2 }));
    store.addEpisode(createMockEpisode({ strategyUsed: 'Direct Instruction', outcome: 'failure', clarityScore: 0.3 }));

    const patterns = store.getFailurePatterns('sub-linear');
    expect(patterns.length).toBe(1);
    expect(patterns[0].strategy).toBe('Direct Instruction');
    expect(patterns[0].count).toBe(2);
    expect(patterns[0].avgClarity).toBeCloseTo(0.25);
  });

  it('should find similar episodes', () => {
    const target = createMockEpisode({ conceptId: 'sub-linear', strategyUsed: 'Visual Analogy', masteryBefore: 0.3 });
    const similar = createMockEpisode({ conceptId: 'sub-linear', strategyUsed: 'Visual Analogy', masteryBefore: 0.35 });
    const different = createMockEpisode({ conceptId: 'sub-derivatives', strategyUsed: 'Direct Instruction', masteryBefore: 0.9 });

    store.addEpisode(similar);
    store.addEpisode(different);

    const results = store.getSimilarEpisodes(target, 2);
    expect(results[0].id).toBe(similar.id); // More similar comes first
  });

  it('should consolidate old episodes after threshold', () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    // Add an old episode (8 days ago)
    store.addEpisode(createMockEpisode({ 
      timestamp: now - (8 * 24 * 60 * 60 * 1000),
      studentMessages: ['detailed message 1', 'detailed message 2']
    }));

    // Add a recent episode
    store.addEpisode(createMockEpisode({ timestamp: now }));

    const consolidated = store.consolidateOldEpisodes();
    expect(consolidated).toBe(1);

    const allEps = store.getAll();
    const oldEp = allEps.find(e => e.isConsolidated);
    expect(oldEp).toBeDefined();
    expect(oldEp!.studentMessages.length).toBe(0); // Verbose data stripped
    expect(oldEp!.agentSummary).toContain('[Consolidated]');

    vi.useRealTimers();
  });

  it('should generate a memory summary for prompt injection', () => {
    store.addEpisode(createMockEpisode({ outcome: 'success', clarityScore: 0.9 }));
    store.addEpisode(createMockEpisode({ outcome: 'failure', clarityScore: 0.2, strategyUsed: 'Direct Instruction' }));

    const summary = store.generateMemorySummary('sub-linear');
    expect(summary).toContain('EPISODIC MEMORY');
    expect(summary).toContain('Success rate');
    expect(summary).toContain('Average clarity');
  });

  it('should enforce storage cap and evict oldest episodes', () => {
    // Add 502 episodes to exceed the 500 cap
    for (let i = 0; i < 502; i++) {
      store.addEpisode(createMockEpisode({ id: `ep-${i}` }));
    }

    expect(store.getCount()).toBeLessThanOrEqual(500);
  });

  it('should persist to and load from localStorage', () => {
    const ep = createMockEpisode({ id: 'persist-test' });
    store.addEpisode(ep);

    // Create a new store instance (loads from localStorage)
    const store2 = new EpisodicMemoryStore();
    expect(store2.getCount()).toBe(1);
    expect(store2.getAll()[0].id).toBe('persist-test');
  });
});
