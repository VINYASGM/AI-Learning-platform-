import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  curriculumNodes, 
  CurriculumNode, 
  markNodeMastered 
} from '../services/KnowledgeGraphService';
import { ChatMessage, AgentOrchestrator } from '../services/AgentOrchestrator';
import { updateMasteryProbability } from '../services/LearnerModel';
import { getNextAdaptiveTopic } from '../services/AdaptiveScheduler';
import { ToneProfile, DEFAULT_TONE_PROFILE, getVariantHeuristic, TeachingVariant } from '../services/LearnerProfile';

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
}

interface LearnerStateContextType extends LearnerState {
  sendMessage: (content: string, workspaceStep?: number) => Promise<void>;
  setCurrentTopicId: (id: string) => void;
  unlockTopic: (id: string) => void;
  resetChat: () => void;
  setWorkspaceStep: (step: number | undefined) => void;
}

const LearnerStateContext = createContext<LearnerStateContextType | undefined>(undefined);

const orchestrator = new AgentOrchestrator();

// Initial welcome prompt
const INITIAL_CHAT: ChatMessage[] = [
  { 
    id: 'msg-0', 
    role: 'tutor', 
    content: 'Welcome back, Jane! I see you are working on **Algebra**. Are you ready to tackle Linear Equations today?', 
    timestamp: Date.now() 
  }
];

export const LearnerStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Try to load from localStorage (Simulating Learner State Store)
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

  const toneProfile = DEFAULT_TONE_PROFILE;
  const activeVariant = getVariantHeuristic(banditScores);

  // Sync to LocalStorage (Simulating Learner State Store)
  useEffect(() => {
    localStorage.setItem('lumina_nodes', JSON.stringify(nodes));
  }, [nodes]);

  useEffect(() => {
    localStorage.setItem('lumina_chat', JSON.stringify(chatHistory));
  }, [chatHistory]);

  useEffect(() => {
    localStorage.setItem('lumina_mastery_probs', JSON.stringify(masteryProbabilities));
  }, [masteryProbabilities]);

  useEffect(() => {
    localStorage.setItem('lumina_last_reviewed', JSON.stringify(lastReviewed));
  }, [lastReviewed]);

  useEffect(() => {
    localStorage.setItem('lumina_bandit_scores', JSON.stringify(banditScores));
  }, [banditScores]);

  const unlockTopic = useCallback((topicId: string) => {
    setNodes(prev => markNodeMastered(prev, topicId));
  }, []);

  const resetChat = useCallback(() => {
    setChatHistory(INITIAL_CHAT);
    localStorage.removeItem('lumina_chat');
  }, []);

  const sendMessage = useCallback(async (content: string, workspaceStep?: number) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'student',
      content,
      timestamp: Date.now()
    };
    
    setChatHistory(prev => [...prev, userMsg]);
    setIsTyping(true);

    const currentTopicLabel = nodes.find(n => n.id === currentTopicId)?.label || 'General Knowledge';
    
    // Add a placeholder message for the streaming response
    const aiMsgId = `msg-${Date.now() + 1}`;
    setChatHistory(prev => [
      ...prev,
      { id: aiMsgId, role: 'tutor', content: '', timestamp: Date.now() }
    ]);

    // Stream from LLM, injecting a tool handler
    const finalContent = await orchestrator.sendMessage(
      chatHistory,
      content,
      { 
        currentTopicLabel, 
        isInteractiveWorkspaceActive: workspaceStep !== undefined, 
        workspaceStep,
        teachingVariant: activeVariant,
        toneProfile
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
          // Update Space Repetition Last Reviewed Time
          setLastReviewed(prev => ({ ...prev, [currentTopicId]: Date.now() }));
          
          // Bandit State Update (Reward generation)
          setBanditScores(prev => {
            const currentScore = prev[activeVariant] ?? 0;
            return { ...prev, [activeVariant]: currentScore + (args.isCorrect ? 1 : -0.5) };
          });

          // BKT Update
          setMasteryProbabilities(prev => {
            const currentProb = prev[currentTopicId] ?? 0.1; // default to P(L0)=0.1
            const newProb = updateMasteryProbability(currentProb, args.isCorrect);
            
            // Heuristic adaptive lock: If the probability goes over 0.90, automatically unlock topic.
            if (newProb >= 0.90) {
              unlockTopic(currentTopicId);
              
              // Trigger Adaptive Sequencing!
              const nextTopic = getNextAdaptiveTopic(nodes, { ...prev, [currentTopicId]: newProb }, lastReviewed);
              if (nextTopic && nextTopic !== currentTopicId) {
                setTimeout(() => setCurrentTopicId(nextTopic), 500); // Small delay to let visual unlock pop
              }
            }
            
            return { ...prev, [currentTopicId]: newProb };
          });
        }
      }
    );

    setIsTyping(false);

    // Legacy fallback: If the AI explicitly says "Topic Mastered!", we trigger unlocking logic.
    if (finalContent.includes("Topic Mastered!")) {
      unlockTopic(currentTopicId);
    }
  }, [chatHistory, currentTopicId, nodes, unlockTopic]);

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
