import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MetaCognitiveAgent, DetectedPattern } from '../MetaCognitiveAgent';
import { EpisodicMemoryStore, Episode } from '../EpisodicMemoryStore';

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
    studentMessages: ['I solved it'],
    agentSummary: 'Taught successfully.',
    isConsolidated: false,
    ...overrides
  };
}

describe('MetaCognitiveAgent', () => {
  let memoryStore: EpisodicMemoryStore;
  let agent: MetaCognitiveAgent;

  beforeEach(() => {
    localStorageMock.clear();
    memoryStore = new EpisodicMemoryStore();
    agent = new MetaCognitiveAgent(memoryStore);
  });

  afterEach(() => {
    agent.clear();
  });

  describe('Confusion Loop Detection', () => {
    it('should detect confusion loop when 3+ episodes have low clarity', () => {
      // Add 4 low-clarity episodes for the same concept
      for (let i = 0; i < 4; i++) {
        memoryStore.addEpisode(createMockEpisode({ 
          clarityScore: 0.2,
          outcome: 'failure'
        }));
      }

      const patterns = agent.detectPatterns('sub-linear');
      const confusion = patterns.find(p => p.type === 'confusion_loop');
      
      expect(confusion).toBeDefined();
      expect(confusion!.confidence).toBeGreaterThan(0.5);
    });

    it('should NOT detect confusion loop with high clarity episodes', () => {
      for (let i = 0; i < 4; i++) {
        memoryStore.addEpisode(createMockEpisode({ clarityScore: 0.8 }));
      }

      const patterns = agent.detectPatterns('sub-linear');
      const confusion = patterns.find(p => p.type === 'confusion_loop');
      
      expect(confusion).toBeUndefined();
    });
  });

  describe('Disengagement Detection', () => {
    it('should detect disengagement with low engagement scores', () => {
      for (let i = 0; i < 4; i++) {
        memoryStore.addEpisode(createMockEpisode({ engagementScore: 0.15 }));
      }

      const patterns = agent.detectPatterns('sub-linear');
      const disengagement = patterns.find(p => p.type === 'disengagement');

      expect(disengagement).toBeDefined();
      expect(disengagement!.confidence).toBeGreaterThan(0.6);
    });
  });

  describe('Repetition Trap Detection', () => {
    it('should detect repetition trap when same strategy fails repeatedly', () => {
      for (let i = 0; i < 4; i++) {
        memoryStore.addEpisode(createMockEpisode({
          strategyUsed: 'Direct Instruction',
          outcome: i < 2 ? 'failure' : 'partial' // 2 failures minimum
        }));
      }

      const patterns = agent.detectPatterns('sub-linear');
      const repetition = patterns.find(p => p.type === 'repetition_trap');

      expect(repetition).toBeDefined();
    });

    it('should NOT detect repetition trap when strategies are varied', () => {
      const strategies = ['Socratic Questioning', 'Visual Analogy', 'Direct Instruction', 'Real-world Application'] as const;
      for (let i = 0; i < 4; i++) {
        memoryStore.addEpisode(createMockEpisode({
          strategyUsed: strategies[i],
          outcome: 'failure'
        }));
      }

      const patterns = agent.detectPatterns('sub-linear');
      const repetition = patterns.find(p => p.type === 'repetition_trap');

      expect(repetition).toBeUndefined();
    });
  });

  describe('Difficulty Mismatch Detection', () => {
    it('should detect difficulty mismatch on 3+ consecutive failures', () => {
      for (let i = 0; i < 4; i++) {
        memoryStore.addEpisode(createMockEpisode({
          outcome: 'failure',
          masteryBefore: 0.1
        }));
      }

      const patterns = agent.detectPatterns('sub-linear');
      const mismatch = patterns.find(p => p.type === 'difficulty_mismatch');

      expect(mismatch).toBeDefined();
      expect(mismatch!.evidence).toContain('ZPD');
    });
  });

  describe('Intervention Generation', () => {
    it('should generate interventions from detected patterns above confidence threshold', () => {
      for (let i = 0; i < 4; i++) {
        memoryStore.addEpisode(createMockEpisode({ clarityScore: 0.1, outcome: 'failure' }));
      }

      const patterns = agent.detectPatterns('sub-linear');
      const interventions = agent.generateInterventions(patterns);

      expect(interventions.length).toBeGreaterThan(0);
      expect(interventions[0].isActive).toBe(true);
      expect(interventions[0].directive).toContain('META-COGNITIVE OVERRIDE');
    });

    it('should NOT generate duplicate interventions for the same concept/type', () => {
      for (let i = 0; i < 4; i++) {
        memoryStore.addEpisode(createMockEpisode({ clarityScore: 0.1, outcome: 'failure' }));
      }

      const patterns1 = agent.detectPatterns('sub-linear');
      agent.generateInterventions(patterns1);

      const patterns2 = agent.detectPatterns('sub-linear');
      const interventions2 = agent.generateInterventions(patterns2);

      // Should not duplicate since there's already an active one
      expect(interventions2.length).toBe(0);
    });

    it('should build a directive string for prompt injection', () => {
      for (let i = 0; i < 4; i++) {
        memoryStore.addEpisode(createMockEpisode({ clarityScore: 0.1, outcome: 'failure' }));
      }

      const patterns = agent.detectPatterns('sub-linear');
      agent.generateInterventions(patterns);

      const directive = agent.buildInterventionDirective('sub-linear');
      expect(directive).toContain('META-COGNITIVE OVERRIDE');
    });

    it('should return empty directive when no interventions are active', () => {
      const directive = agent.buildInterventionDirective('sub-linear');
      expect(directive).toBe('');
    });
  });

  describe('Strategy Exhaustion Detection', () => {
    it('should detect when 3+ strategies have all failed', () => {
      const strategies = ['Socratic Questioning', 'Visual Analogy', 'Direct Instruction'] as const;
      for (const strategy of strategies) {
        memoryStore.addEpisode(createMockEpisode({
          strategyUsed: strategy,
          outcome: 'failure'
        }));
      }

      const patterns = agent.detectPatterns('sub-linear');
      const exhaustion = patterns.find(p => p.type === 'strategy_exhaustion');

      expect(exhaustion).toBeDefined();
      expect(exhaustion!.confidence).toBeGreaterThan(0.8);
    });
  });
});
