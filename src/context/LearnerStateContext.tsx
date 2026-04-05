import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { UploadedFile } from '../services/FileUploadService';
import { 
  curriculumNodes, 
  CurriculumNode, 
  markNodeMastered,
  detectConceptGaps,
  applyCurriculumInserts
} from '../services/KnowledgeGraphService';
import { ChatMessage, AgentOrchestrator } from '../services/AgentOrchestrator';
import { updateMasteryProbability, MasteryEstimate, ConceptClass } from '../services/LearnerModel';
import { getNextAdaptiveTopic } from '../services/AdaptiveScheduler';
import {
  ToneProfile, DEFAULT_TONE_PROFILE, getVariantHeuristic, TeachingVariant,
  selectPedagogicalAction, PolicyContext, PedagogicalAction, microToVariant
} from '../services/LearnerProfile';

// V1 Recursive Learning imports
import { EpisodicMemoryStore, Episode } from '../services/EpisodicMemoryStore';
import { RecursiveLearningEngine, RecursiveProcessResult } from '../services/RecursiveLearningEngine';
import { MetaCognitiveAgent, DetectedPattern } from '../services/MetaCognitiveAgent';
import { PromptRewriter, ReflectionOutput } from '../services/PromptRewriter';

// V2 imports
import { TutorBeliefStateManager, AffectiveState } from '../services/TutorBeliefState';
import { AffectiveStateTracker, AffectiveSignals, AffectiveGatingSignals } from '../services/AffectiveStateTracker';
import { MisconceptionMap, Misconception } from '../services/MisconceptionMap';
import { RewardEngine, RewardSignals, ModelRoutingContext } from '../services/RewardEngine';
import { ScaffoldingEngine, MetacognitivePrompt } from '../services/ScaffoldingEngine';
import { CritiqueAgent } from '../services/CritiqueAgent';

// ─── Recursive Learning Metrics (V2 extended) ───────────────────

export interface RecursiveLearningMetrics {
  totalEpisodes: number;
  totalSelfReflections: number;
  activeInterventions: number;
  avgCompositeScore: number;
  recentPatterns: DetectedPattern[];
  lastReflection?: ReflectionOutput;
  curriculumEvolutions: number;
  // V2 additions
  affectiveState: AffectiveSignals;
  activeMisconceptions: Misconception[];
  rewardTrajectory: number[];
  scaffoldingLevels: Record<string, number>;
  currentModelTier: string;
  critiqueStats: { totalCritiques: number; totalRejections: number; rejectionRate: number };
  lastPedagogicalAction?: PedagogicalAction;
}

interface LearnerState {
  nodes: CurriculumNode[];
  chatHistory: ChatMessage[];
  currentTopicId: string;
  isTyping: boolean;
  workspaceStep: number | undefined;
  masteryProbabilities: Record<string, number>;
  lastReviewed: Record<string, number>;
  banditScores: Record<string, number>;
  activeVariant: TeachingVariant;
  toneProfile: ToneProfile;
  recursiveMetrics: RecursiveLearningMetrics;
}

interface LearnerStateContextType extends LearnerState {
  sendMessage: (content: string, workspaceStep?: number, attachments?: UploadedFile[]) => Promise<void>;
  setCurrentTopicId: (id: string) => void;
  unlockTopic: (id: string) => void;
  resetChat: () => void;
  setWorkspaceStep: (step: number | undefined) => void;
}

const LearnerStateContext = createContext<LearnerStateContextType | undefined>(undefined);

const orchestrator = new AgentOrchestrator();

// ── V1 Recursive Learning Systems (singleton) ──────────────────
const memoryStore = new EpisodicMemoryStore();
const recursiveEngine = new RecursiveLearningEngine(memoryStore);
const metaCognitiveAgent = new MetaCognitiveAgent(memoryStore);
const promptRewriter = new PromptRewriter(memoryStore);

// ── V2 Systems (singleton) ─────────────────────────────────────
const beliefStateManager = new TutorBeliefStateManager();
const affectiveTracker = new AffectiveStateTracker();
const misconceptionMap = new MisconceptionMap();
const rewardEngine = new RewardEngine();
const scaffoldingEngine = new ScaffoldingEngine();
const critiqueAgent = new CritiqueAgent();

const INITIAL_CHAT: ChatMessage[] = [
  { 
    id: 'msg-0', 
    role: 'tutor', 
    content: 'Welcome back, Jane! I see you are working on **Algebra**. Are you ready to tackle Linear Equations today?', 
    timestamp: Date.now() 
  }
];

export const LearnerStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [nodes, setNodes] = useState<CurriculumNode[]>(() => {
    const saved = localStorage.getItem('lumina_nodes');
    return saved ? JSON.parse(saved) : curriculumNodes;
  });

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('lumina_chat');
    return saved ? JSON.parse(saved) : INITIAL_CHAT;
  });

  const [currentTopicId, setCurrentTopicId] = useState<string>('sub-linear');
  const [isTyping, setIsTyping] = useState(false);
  const [workspaceStep, setWorkspaceStep] = useState<number | undefined>(undefined);
  
  const [masteryProbabilities, setMasteryProbabilities] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('lumina_mastery_probs');
    return saved ? JSON.parse(saved) : {};
  });

  const [lastReviewed, setLastReviewed] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('lumina_last_reviewed');
    return saved ? JSON.parse(saved) : {};
  });

  const [banditScores, setBanditScores] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('lumina_bandit_scores');
    return saved ? JSON.parse(saved) : {};
  });

  const [recursiveMetrics, setRecursiveMetrics] = useState<RecursiveLearningMetrics>({
    totalEpisodes: memoryStore.getCount(),
    totalSelfReflections: promptRewriter.getTotalReflections(),
    activeInterventions: metaCognitiveAgent.getInterventionCount(),
    avgCompositeScore: 0,
    recentPatterns: [],
    curriculumEvolutions: 0,
    // V2
    affectiveState: affectiveTracker.getSignals(),
    activeMisconceptions: misconceptionMap.getActiveMisconceptions(),
    rewardTrajectory: rewardEngine.getRewardTrajectory(),
    scaffoldingLevels: scaffoldingEngine.getAllLevels(),
    currentModelTier: 'mid',
    critiqueStats: orchestrator.getCritiqueStats(),
    lastPedagogicalAction: undefined,
  });

  // Consecutive outcomes tracking
  const consecutiveFailuresRef = useRef<number>(0);
  const consecutiveSuccessesRef = useRef<number>(0);
  const turnsSinceInterleaveRef = useRef<number>(0);
  const episodeMessagesRef = useRef<string[]>([]);
  const agentResponsesRef = useRef<string[]>([]);
  const lastEvaluationRef = useRef<boolean | null>(null);
  const turnsThisSessionRef = useRef<number>(0);

  const toneProfile = DEFAULT_TONE_PROFILE;
  const activeVariant = getVariantHeuristic(banditScores);

  // Sync to LocalStorage
  useEffect(() => { localStorage.setItem('lumina_nodes', JSON.stringify(nodes)); }, [nodes]);
  useEffect(() => { localStorage.setItem('lumina_chat', JSON.stringify(chatHistory)); }, [chatHistory]);
  useEffect(() => { localStorage.setItem('lumina_mastery_probs', JSON.stringify(masteryProbabilities)); }, [masteryProbabilities]);
  useEffect(() => { localStorage.setItem('lumina_last_reviewed', JSON.stringify(lastReviewed)); }, [lastReviewed]);
  useEffect(() => { localStorage.setItem('lumina_bandit_scores', JSON.stringify(banditScores)); }, [banditScores]);

  // Periodic consolidation + meta-cognitive evaluation
  useEffect(() => {
    const interval = setInterval(() => {
      const consolidated = memoryStore.consolidateOldEpisodes();
      if (consolidated > 0) console.log(`[RECURSIVE] Consolidated ${consolidated} old episodes`);
      metaCognitiveAgent.evaluateInterventionEffectiveness();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const unlockTopic = useCallback((topicId: string) => {
    setNodes(prev => markNodeMastered(prev, topicId));
  }, []);

  const resetChat = useCallback(() => {
    setChatHistory(INITIAL_CHAT);
    localStorage.removeItem('lumina_chat');
    episodeMessagesRef.current = [];
    agentResponsesRef.current = [];
    lastEvaluationRef.current = null;
    consecutiveFailuresRef.current = 0;
    consecutiveSuccessesRef.current = 0;
  }, []);

  /**
   * ─── THE V2 RECURSIVE TUTOR CONTROL LOOP ────────────────────
   *
   * 9-step cycle runs after each evaluation:
   * 1. OBSERVE   — episode data collected during interaction
   * 2. UPDATE    — belief state, affect, misconceptions, scaffolding
   * 3. REFLECT   — V1 recursive engine + V2 confidence check
   * 4. PLAN      — select next pedagogical action (hierarchical policy)
   * 5. CRITIQUE  — evaluate draft response (CritiqueAgent)
   * 6. SELECT    — bandit selects micro-action
   * 7. EXECUTE   — delivered via LLM (in sendMessage)
   * 8. EVALUATE  — score episode (this function = steps 1-2, 8-9)
   * 9. META-REFLECT — periodic, not per-turn
   */
  const runRecursiveLearningLoop = useCallback((
    conceptId: string,
    conceptLabel: string,
    strategy: TeachingVariant,
    masteryBefore: number,
    masteryAfter: number,
    wasCorrect: boolean | null,
    studentMessage: string
  ) => {
    // ── Step 2: UPDATE ─────────────────────────────────────────

    // Update belief state
    if (wasCorrect !== null) {
      beliefStateManager.updateKnowledge(conceptId, wasCorrect);
    }

    // Update affective state
    const affectiveUpdate = affectiveTracker.update({
      messageLength: studentMessage.length,
      responseTimeMs: 0, // Not available yet
      isCorrect: wasCorrect,
      wasHintRequest: /hint|help|stuck|confused/i.test(studentMessage),
      wasSelfInitiatedQuestion: /\?$/.test(studentMessage.trim()) && 
        !/^(yes|no|ok|sure|yeah|nah)/i.test(studentMessage.trim()),
      consecutiveFailures: consecutiveFailuresRef.current,
      consecutiveSuccesses: consecutiveSuccessesRef.current,
    });

    // Update belief state affect
    beliefStateManager.updateAffect({
      isCorrect: wasCorrect ?? undefined,
      messageLength: studentMessage.length,
      wasHintRequest: /hint|help|stuck|confused/i.test(studentMessage),
      wasSelfInitiatedQuestion: /\?$/.test(studentMessage.trim()),
      consecutiveFailures: consecutiveFailuresRef.current,
    });

    // Misconception analysis
    misconceptionMap.analyzeError(
      conceptId, conceptLabel, studentMessage, wasCorrect ?? true
    );

    // Scaffolding update
    if (wasCorrect !== null) {
      scaffoldingEngine.processAssessment(conceptId, wasCorrect, masteryAfter);
    }

    // ── Step 8: EVALUATE (V1 recursive engine) ─────────────────

    const activeIntervention = metaCognitiveAgent.getActiveInterventions(conceptId)[0];
    const result: RecursiveProcessResult = recursiveEngine.processEpisode({
      conceptId,
      conceptLabel,
      strategyUsed: strategy,
      masteryBefore,
      masteryAfter,
      studentMessages: [...episodeMessagesRef.current],
      agentResponses: [...agentResponsesRef.current],
      wasCorrect,
      interventionApplied: activeIntervention?.directive
    });

    // ── Compute composite reward R_t ───────────────────────────

    const gating = affectiveTracker.computeGatingSignals();
    const scaffoldLevel = scaffoldingEngine.getLevel(conceptId);
    const hintRate = affectiveTracker.getHintRequestRate();
    const transferRate = scaffoldingEngine.getTransferSuccessRate(conceptId);

    const rewardSignals: RewardSignals = {
      correctness: wasCorrect ? 1.0 : 0.0,
      retentionScore: masteryAfter > 0.7 ? masteryAfter : 0,
      transferScore: transferRate,
      engagementSignal: Math.min(0.5, result.episode.engagementScore), // BOUNDED
      challengeAcceptance: consecutiveSuccessesRef.current >= 3 && 
        scaffoldLevel < 0.5 ? 0.8 : 0.3,
      selfEfficacyDelta: affectiveUpdate.confidence - 0.5,
      frustrationSignal: affectiveUpdate.frustration,
      boredomSignal: rewardEngine.computeBoredomSignal(
        beliefStateManager.getSessionContext().recentSuccessRate,
        affectiveUpdate.curiosity > 0.5 ? 0.7 : 0.3,
        'stable'
      ),
      dependencySignal: rewardEngine.computeDependencySignal(
        hintRate, scaffoldLevel, 'stable'
      ),
    };

    const reward = rewardEngine.computeReward(rewardSignals, conceptId);

    // ── Step 3: REFLECT ────────────────────────────────────────

    const patterns = metaCognitiveAgent.detectPatterns(conceptId);
    const newInterventions = metaCognitiveAgent.generateInterventions(patterns);

    let reflectionOutput: ReflectionOutput | undefined;
    if (result.shouldSelfReflect) {
      const memorySummary = memoryStore.generateMemorySummary(conceptId);
      reflectionOutput = promptRewriter.generateReflection({
        episode: result.episode,
        memorySummary,
        feedbackDirectives: result.directives,
        consecutiveFailures: recursiveEngine.getConsecutiveFailures(conceptId)
      });
    }

    promptRewriter.autoRollbackCheck(conceptId);

    // ── Step 9: META-REFLECT (periodic) ────────────────────────

    const totalEpisodes = memoryStore.getCount();
    if (totalEpisodes % 10 === 0 && totalEpisodes > 0) {
      console.log(`[META-REFLECT] Periodic deep reflection at episode ${totalEpisodes}`);
      const trend = rewardEngine.getRewardTrend();
      console.log(`[META-REFLECT] Reward trend: ${trend}, Avg reward: ${rewardEngine.getAverageReward().toFixed(3)}`);
    }

    // ── Curriculum evolution ────────────────────────────────────

    const allEpisodes = memoryStore.getAll();
    const gaps = detectConceptGaps(nodes, allEpisodes);
    if (gaps.length > 0) {
      setNodes(prev => applyCurriculumInserts(prev, gaps));
    }

    // ── Update metrics ─────────────────────────────────────────

    const recentEpisodes = memoryStore.query({ limit: 20 });
    const avgScore = recentEpisodes.length > 0
      ? recentEpisodes.reduce((sum, e) => sum + (e.clarityScore + e.engagementScore + e.progressScore + e.efficiencyScore) / 4, 0) / recentEpisodes.length
      : 0;

    setRecursiveMetrics(prev => ({
      totalEpisodes: memoryStore.getCount(),
      totalSelfReflections: promptRewriter.getTotalReflections(),
      activeInterventions: metaCognitiveAgent.getInterventionCount(),
      avgCompositeScore: avgScore,
      recentPatterns: patterns,
      lastReflection: reflectionOutput ?? prev.lastReflection,
      curriculumEvolutions: gaps.length + (prev.curriculumEvolutions || 0),
      // V2
      affectiveState: affectiveUpdate,
      activeMisconceptions: misconceptionMap.getActiveMisconceptions(),
      rewardTrajectory: rewardEngine.getRewardTrajectory(),
      scaffoldingLevels: scaffoldingEngine.getAllLevels(),
      currentModelTier: rewardEngine.routeModelTier({
        compositeConfidence: beliefStateManager.computeCompositeConfidence(
          misconceptionMap.getActiveCount(conceptId)
        ),
        consecutiveFailures: consecutiveFailuresRef.current,
        hasMisconceptions: misconceptionMap.getActiveCount(conceptId) > 0,
        isTransferTask: false,
        isScaffoldingFading: scaffoldLevel < 0.5,
        learnerMasteryLevel: masteryAfter,
        taskEducationalValue: 'medium',
      }),
      critiqueStats: orchestrator.getCritiqueStats(),
      lastPedagogicalAction: prev.lastPedagogicalAction,
    }));

    // Reset episode tracking
    episodeMessagesRef.current = [];
    agentResponsesRef.current = [];
    lastEvaluationRef.current = null;

  }, [nodes]);

  const sendMessage = useCallback(async (content: string, currentWorkspaceStep?: number, attachments?: UploadedFile[]) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'student',
      content,
      timestamp: Date.now(),
      attachments,
    };
    
    episodeMessagesRef.current.push(content);
    turnsThisSessionRef.current++;
    turnsSinceInterleaveRef.current++;
    
    setChatHistory(prev => [...prev, userMsg]);
    setIsTyping(true);

    const currentTopicLabel = nodes.find(n => n.id === currentTopicId)?.label || 'General Knowledge';
    
    // ── Step 4: PLAN — Select pedagogical action ──────────────
    const currentMastery = masteryProbabilities[currentTopicId] ?? 0.1;
    const policyContext: PolicyContext = {
      masteryLevel: currentMastery,
      recentSuccessRate: beliefStateManager.getSessionContext().recentSuccessRate,
      consecutiveFailures: consecutiveFailuresRef.current,
      consecutiveSuccesses: consecutiveSuccessesRef.current,
      scaffoldingLevel: scaffoldingEngine.getLevel(currentTopicId),
      hasMisconceptions: misconceptionMap.getActiveCount(currentTopicId) > 0,
      affectiveState: affectiveTracker.getSignals(),
      turnsSinceInterleave: turnsSinceInterleaveRef.current,
      turnsThisSession: turnsThisSessionRef.current,
      isPendingReview: beliefStateManager.getCurriculumState().pendingReviews.includes(currentTopicId),
    };

    const action = selectPedagogicalAction(policyContext, banditScores);
    const actionVariant = microToVariant(action.micro);

    // ── Build V2 context injections ────────────────────────────
    const episodicMemorySummary = memoryStore.generateMemorySummary(currentTopicId);
    const metaCognitiveDirective = metaCognitiveAgent.buildInterventionDirective(currentTopicId);
    const promptOverlayDirective = promptRewriter.getActiveOverlayDirective(currentTopicId);
    const misconceptionInjection = misconceptionMap.buildPromptInjection(currentTopicId);
    const scaffoldingDirective = scaffoldingEngine.buildScaffoldingDirective(currentTopicId);
    const gatingSignals = affectiveTracker.computeGatingSignals();
    const compositeConfidence = beliefStateManager.computeCompositeConfidence(
      misconceptionMap.getActiveCount(currentTopicId)
    );

    // Model routing context
    const modelRoutingContext: ModelRoutingContext = {
      compositeConfidence,
      consecutiveFailures: consecutiveFailuresRef.current,
      hasMisconceptions: misconceptionMap.getActiveCount(currentTopicId) > 0,
      isTransferTask: action.micro === 'give_transfer_task',
      isScaffoldingFading: scaffoldingEngine.getLevel(currentTopicId) < 0.5,
      learnerMasteryLevel: currentMastery,
      taskEducationalValue: action.macro === 'review' ? 'medium' : 
        action.micro === 'give_transfer_task' ? 'high' : 'low',
    };

    const aiMsgId = `msg-${Date.now() + 1}`;
    setChatHistory(prev => [
      ...prev,
      { id: aiMsgId, role: 'tutor', content: '', timestamp: Date.now() }
    ]);

    // ── Step 7: EXECUTE — Send to LLM ─────────────────────────
    const finalContent = await orchestrator.sendMessage(
      chatHistory,
      content,
      { 
        currentTopicLabel,
        currentTopicId,
        isInteractiveWorkspaceActive: currentWorkspaceStep !== undefined, 
        workspaceStep: currentWorkspaceStep,
        teachingVariant: actionVariant,
        toneProfile,
        // V1 recursive
        episodicMemorySummary,
        metaCognitiveDirective: metaCognitiveDirective || undefined,
        promptOverlayDirective: promptOverlayDirective || undefined,
        // V2 enrichments
        misconceptionInjection: misconceptionInjection || undefined,
        scaffoldingDirective,
        pedagogicalActionDirective: action.systemPromptDirective,
        affectiveGating: gatingSignals,
        compositeConfidence,
        scaffoldingLevel: scaffoldingEngine.getLevel(currentTopicId),
        activeMisconceptions: misconceptionMap.getConfirmedMisconceptions(currentTopicId)
          .map(m => m.errorSignature || m.id),
        masteryLevel: currentMastery,
        recentSuccessRate: beliefStateManager.getSessionContext().recentSuccessRate,
        frustrationLevel: affectiveTracker.getSignals().frustration,
        hasMisconceptions: misconceptionMap.getActiveCount(currentTopicId) > 0,
        isScaffoldingFading: scaffoldingEngine.getLevel(currentTopicId) < 0.5,
        isHighStakesTask: action.micro === 'give_transfer_task' || 
          action.micro === 'revisit_misconception',
        modelRoutingContext,
        attachments,
      },
      (chunkText) => {
        setChatHistory(prev => prev.map(msg => 
          msg.id === aiMsgId ? { ...msg, content: chunkText } : msg
        ));
      },
      (functionName, args) => {
        if (functionName === 'updateWorkspaceStep' && args?.stepNumber !== undefined) {
          setWorkspaceStep(args.stepNumber);
        } else if (functionName === 'evaluateStudentAnswer' && typeof args?.isCorrect === 'boolean') {
          lastEvaluationRef.current = args.isCorrect;

          // Track consecutive outcomes
          if (args.isCorrect) {
            consecutiveSuccessesRef.current++;
            consecutiveFailuresRef.current = 0;
          } else {
            consecutiveFailuresRef.current++;
            consecutiveSuccessesRef.current = 0;
          }

          setLastReviewed(prev => ({ ...prev, [currentTopicId]: Date.now() }));
          
          // Update bandit scores for the V2 micro-action
          setBanditScores(prev => {
            const microKey = action.micro;
            const variantKey = actionVariant;
            const rewardDelta = args.isCorrect ? 1 : -0.5;
            return {
              ...prev,
              [variantKey]: (prev[variantKey] ?? 0) + rewardDelta,
              [microKey]: (prev[microKey] ?? 0) + rewardDelta,
            };
          });

          // BKT Update
          setMasteryProbabilities(prev => {
            const currentProb = prev[currentTopicId] ?? 0.1;
            const newProb = updateMasteryProbability(currentProb, args.isCorrect);
            
            // ── TRIGGER V2 RECURSIVE LEARNING LOOP ─────────
            runRecursiveLearningLoop(
              currentTopicId,
              currentTopicLabel,
              actionVariant,
              currentProb,
              newProb,
              args.isCorrect,
              content
            );

            if (newProb >= 0.90) {
              unlockTopic(currentTopicId);
              
              const nextTopic = getNextAdaptiveTopic(
                nodes,
                { ...prev, [currentTopicId]: newProb },
                lastReviewed,
                {
                  affectiveState: affectiveTracker.getSignals(),
                  recentSuccessRate: beliefStateManager.getSessionContext().recentSuccessRate,
                  turnsSinceInterleave: turnsSinceInterleaveRef.current,
                  cognitiveLoad: gatingSignals.cognitiveLoadEstimate,
                }
              );
              if (nextTopic && nextTopic !== currentTopicId) {
                turnsSinceInterleaveRef.current = 0;
                setTimeout(() => setCurrentTopicId(nextTopic), 500);
              }
            }
            
            return { ...prev, [currentTopicId]: newProb };
          });
        } else if (functionName === 'selfReflect') {
          console.log(`[RECURSIVE] Agent-initiated self-reflection:`, args);
          const memorySummary = memoryStore.generateMemorySummary(currentTopicId);
          const currentProb = masteryProbabilities[currentTopicId] ?? 0.1;
          
          const syntheticEpisode: Episode = {
            id: `ep-self-${Date.now()}`,
            timestamp: Date.now(),
            conceptId: currentTopicId,
            conceptLabel: currentTopicLabel,
            strategyUsed: actionVariant,
            outcome: 'partial',
            clarityScore: 0.3,
            engagementScore: 0.5,
            progressScore: 0.3,
            efficiencyScore: 0.3,
            masteryBefore: currentProb,
            masteryAfter: currentProb,
            turnsInEpisode: episodeMessagesRef.current.length,
            studentMessages: [...episodeMessagesRef.current],
            agentSummary: `Agent self-triggered reflection: ${args?.observation || 'approach not working'}`,
            isConsolidated: false
          };

          promptRewriter.generateReflection({
            episode: syntheticEpisode,
            memorySummary,
            feedbackDirectives: [],
            consecutiveFailures: recursiveEngine.getConsecutiveFailures(currentTopicId)
          });
        } else if (functionName === 'requestConfidenceRating') {
          console.log(`[V2] Confidence rating requested: timing=${args?.timing}`);
        } else if (functionName === 'flagMisconception') {
          console.log(`[V2] Misconception flagged by agent:`, args);
          if (args?.pattern && args?.evidence) {
            misconceptionMap.analyzeError(
              currentTopicId,
              currentTopicLabel,
              args.evidence,
              false // Agent flagged it = wrong answer
            );
          }
        }
      }
    );

    agentResponsesRef.current.push(finalContent);
    setIsTyping(false);

    if (finalContent.includes("Topic Mastered!")) {
      unlockTopic(currentTopicId);
    }
  }, [chatHistory, currentTopicId, nodes, unlockTopic, toneProfile, masteryProbabilities, lastReviewed, banditScores, runRecursiveLearningLoop]);

  return (
    <LearnerStateContext.Provider value={{
      nodes,
      chatHistory,
      currentTopicId,
      isTyping,
      workspaceStep,
      masteryProbabilities,
      lastReviewed,
      banditScores,
      activeVariant,
      toneProfile,
      recursiveMetrics,
      sendMessage,
      setCurrentTopicId,
      unlockTopic,
      resetChat,
      setWorkspaceStep
    }}>
      {children}
    </LearnerStateContext.Provider>
  );
};

export const useLearnerState = () => {
  const context = useContext(LearnerStateContext);
  if (!context) {
    throw new Error('useLearnerState must be used within a LearnerStateProvider');
  }
  return context;
};
