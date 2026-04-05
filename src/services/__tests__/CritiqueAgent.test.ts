import { describe, it, expect, beforeEach } from 'vitest';
import { CritiqueAgent } from '../CritiqueAgent';

describe('CritiqueAgent', () => {
  let agent: CritiqueAgent;

  beforeEach(() => {
    agent = new CritiqueAgent();
  });

  describe('Answer Leakage Detection', () => {
    it('detects direct answer giving', () => {
      const result = agent.critique({
        draftResponse: 'The answer is 42. So you should get 42.',
        scaffoldingLevel: 0.5,
        activeMisconceptions: [],
        masteryLevel: 0.5,
        recentSuccessRate: 0.5,
        frustrationLevel: 0.2,
        conceptLabel: 'Linear Equations',
      });
      const leakageIssue = result.issues.find(i => i.type === 'answer_leakage');
      expect(leakageIssue).toBeTruthy();
      expect(leakageIssue!.severity).toBe('critical');
    });

    it('approves Socratic responses', () => {
      const result = agent.critique({
        draftResponse: 'What do you think would happen if we substituted x = 3 into the equation? Can you try that and tell me what you get?',
        scaffoldingLevel: 0.5,
        activeMisconceptions: [],
        masteryLevel: 0.5,
        recentSuccessRate: 0.5,
        frustrationLevel: 0.2,
        conceptLabel: 'Linear Equations',
      });
      const leakageIssue = result.issues.find(i => i.type === 'answer_leakage');
      expect(leakageIssue).toBeUndefined();
    });
  });

  describe('Scaffolding Mismatch Detection', () => {
    it('flags low scaffolding with high support', () => {
      const result = agent.critique({
        draftResponse: 'Step 1: First we isolate x.\nStep 2: Subtract 5 from both sides.\nStep 3: Divide by 2.\nStep 4: Check your answer.\nHere is a hint: try simplifying first.\nAnother hint: remember to balance the equation.',
        scaffoldingLevel: 0.1,
        activeMisconceptions: [],
        masteryLevel: 0.8,
        recentSuccessRate: 0.9,
        frustrationLevel: 0.0,
        conceptLabel: 'Linear Equations',
      });
      const mismatch = result.issues.find(i => i.type === 'scaffolding_mismatch');
      expect(mismatch).toBeTruthy();
    });
  });

  describe('ZPD Violation Detection', () => {
    it('flags advancing when struggling', () => {
      const result = agent.critique({
        draftResponse: 'Great work! Now let\'s move on to a more advanced topic - quadratic equations!',
        scaffoldingLevel: 0.5,
        activeMisconceptions: [],
        masteryLevel: 0.2,
        recentSuccessRate: 0.3,
        frustrationLevel: 0.5,
        conceptLabel: 'Linear Equations',
      });
      const zpd = result.issues.find(i => i.type === 'zpd_violation');
      expect(zpd).toBeTruthy();
    });
  });

  describe('Critique Gating', () => {
    it('should critique when confidence is low', () => {
      expect(agent.shouldRunCritique({
        compositeConfidence: 0.5,
        hasMisconceptions: false,
        isScaffoldingFading: false,
        isHighStakesTask: false,
      })).toBe(true);
    });

    it('should not critique when confidence is high', () => {
      expect(agent.shouldRunCritique({
        compositeConfidence: 0.9,
        hasMisconceptions: false,
        isScaffoldingFading: false,
        isHighStakesTask: false,
      })).toBe(false);
    });

    it('should always critique with misconceptions', () => {
      expect(agent.shouldRunCritique({
        compositeConfidence: 0.95,
        hasMisconceptions: true,
        isScaffoldingFading: false,
        isHighStakesTask: false,
      })).toBe(true);
    });
  });

  describe('Stats Tracking', () => {
    it('tracks critique and rejection counts', () => {
      // Approve one
      agent.critique({
        draftResponse: 'What do you think the answer is?',
        scaffoldingLevel: 0.5,
        activeMisconceptions: [],
        masteryLevel: 0.5,
        recentSuccessRate: 0.5,
        frustrationLevel: 0.2,
        conceptLabel: 'Test',
      });

      const stats = agent.getStats();
      expect(stats.totalCritiques).toBe(1);
    });
  });
});
