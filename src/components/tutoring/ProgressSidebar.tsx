import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Circle, Lock, Trophy, CalendarClock, BrainCircuit, Search, X, Info, BookOpen, ListTree, Network, BookPlus } from 'lucide-react';
import { useLearnerState } from '../../context/LearnerStateContext';
import { REVIEW_THRESHOLD_MS } from '../../services/AdaptiveScheduler';

type UITopic = {
  id: string;
  title: string;
  mastery: number;
  status: 'mastered' | 'learning' | 'locked';
  description: string;
  prerequisites: string[];
  subTopics: string[];
  nextReviewDate?: string | null;
};

interface ProgressSidebarProps {
  onOpenKnowledgeGraph?: () => void;
}

export function ProgressSidebar({ onOpenKnowledgeGraph }: ProgressSidebarProps) {
  const { nodes, masteryProbabilities, lastReviewed, activeVariant, toneProfile, currentTopicId } = useLearnerState();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<UITopic | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Map raw context nodes to the sidebar UI data structure
  const topicsList: UITopic[] = nodes
    .filter(n => n.type !== 'domain')
    .map(node => {
      const pValue = masteryProbabilities[node.id] ?? (node.status === 'learning' ? 0.1 : 0);
      const masteryPct = node.status === 'mastered' ? 100 : Math.floor(pValue * 100);
      
      const reviewDate = lastReviewed[node.id] 
        ? new Date(lastReviewed[node.id] + REVIEW_THRESHOLD_MS).toISOString() 
        : null;

      // Calculate pseudo-subtopics purely for display purposes in modal
      const derivedSubTopics = nodes
        .filter(n => n.type === 'subtopic' && n.prerequisites.includes(node.id))
        .map(n => n.label);

      return {
        id: node.id,
        title: node.label,
        mastery: masteryPct,
        status: node.status,
        description: node.description || 'Navigate the Knowledge Graph to see more details on this concept.',
        prerequisites: node.prerequisites.map(pid => nodes.find(n => n.id === pid)?.label || pid),
        subTopics: derivedSubTopics,
        nextReviewDate: reviewDate
      };
    });

  const filteredTopics = topicsList.filter(topic =>
    topic.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col overflow-y-auto p-4 md:p-6">
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Learner Profile</h2>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50">
          <div className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center font-bold">
            JD
          </div>
          <div>
            <div className="font-medium text-sm">Jane Doe</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <Trophy size={12} className="text-yellow-500" />
              <span>Level 4 Scholar</span>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Tools</h2>
        <div className="space-y-2">
          <button 
            onClick={() => onOpenKnowledgeGraph?.()}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border shadow-sm hover:border-foreground/30 transition-colors text-left group"
          >
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-colors">
              <Network size={16} />
            </div>
            <div>
              <div className="font-medium text-sm">Knowledge Graph</div>
              <div className="text-xs text-muted-foreground">Visualize connections</div>
            </div>
          </button>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-8"
      >
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">AI Telemetry Dashboard</h2>
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-card border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <BrainCircuit size={14} className="text-blue-500" />
              <div className="font-medium text-sm text-muted-foreground">Active Teaching Style</div>
            </div>
            <div className="font-semibold text-sm text-foreground">{activeVariant}</div>
            <div className="text-[10px] uppercase text-muted-foreground mt-1">Epsilon-Greedy Bandit Selection</div>
          </div>
          
          <div className="p-3 rounded-xl bg-card border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Info size={14} className="text-purple-500" />
              <div className="font-medium text-sm text-muted-foreground">Tutor Tone Profile</div>
            </div>
            <div className="space-y-2 mt-3 text-xs">
               <div className="flex justify-between items-center">
                 <span className="text-muted-foreground">Formality</span>
                 <span className="font-medium">{(toneProfile.formality * 100).toFixed(0)}%</span>
               </div>
               <div className="w-full bg-muted rounded-full h-1">
                 <div className="bg-purple-500 h-1 rounded-full" style={{ width: `${toneProfile.formality * 100}%` }} />
               </div>
               <div className="flex justify-between items-center pt-1">
                 <span className="text-muted-foreground">Encouragement</span>
                 <span className="font-medium">{(toneProfile.encouragement * 100).toFixed(0)}%</span>
               </div>
               <div className="w-full bg-muted rounded-full h-1">
                 <div className="bg-pink-500 h-1 rounded-full" style={{ width: `${toneProfile.encouragement * 100}%` }} />
               </div>
            </div>
          </div>
        </div>
      </motion.div>
      
      <div className="flex-1">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Curriculum Tracking</h2>
        
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-all"
          />
        </div>

        <div className="space-y-4 pb-8">
          {filteredTopics.length > 0 ? (
            filteredTopics.map((topic, i) => (
              <motion.div 
                key={topic.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + (i * 0.1) }}
                onClick={() => setSelectedTopic(topic)}
                className={`relative p-3 -mx-3 rounded-xl cursor-pointer transition-colors hover:bg-muted/50 
                ${topic.status === 'locked' ? 'opacity-50 grayscale' : ''}
                ${topic.id === currentTopicId ? 'bg-primary/5 ring-1 ring-primary/20' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    {topic.status === 'mastered' && <CheckCircle2 size={16} className="text-green-500" />}
                    {topic.status === 'learning' && <Circle size={16} className="text-blue-500 fill-blue-500/20" />}
                    {topic.status === 'locked' && <Lock size={16} className="text-muted-foreground" />}
                    <span className="text-sm font-medium">
                      {topic.title} 
                      {topic.id === currentTopicId && <span className="ml-2 text-[10px] text-primary uppercase tracking-wider font-bold">Active</span>}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{topic.mastery}%</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${topic.mastery}%` }}
                    transition={{ duration: 1, ease: "easeOut", delay: 0.5 + (i * 0.1) }}
                    className={`h-full rounded-full ${
                      topic.status === 'mastered' ? 'bg-green-500' : 
                      topic.status === 'learning' ? 'bg-blue-500' : 'bg-muted-foreground'
                    }`}
                  />
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No topics found.
            </div>
          )}
        </div>
      </div>

      {mounted && createPortal(
        <AnimatePresence>
          {selectedTopic && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedTopic(null)}
                className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-xl overflow-hidden z-10"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-semibold">{selectedTopic.title}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          selectedTopic.status === 'mastered' ? 'bg-green-500/10 text-green-500' :
                          selectedTopic.status === 'learning' ? 'bg-blue-500/10 text-blue-500' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {selectedTopic.status.charAt(0).toUpperCase() + selectedTopic.status.slice(1)}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">
                          {selectedTopic.mastery}% Mastery Probability
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedTopic(null)}
                      className="p-2 -mr-2 -mt-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  
                  <div className="space-y-4 mt-6">
                    {/* Description Card */}
                    <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Info className="w-4 h-4 text-blue-500" />
                        <h4 className="text-sm font-semibold text-foreground">Overview</h4>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{selectedTopic.description}</p>
                    </div>
                    
                    {/* Prerequisites Card */}
                    <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
                      <div className="flex items-center gap-2 mb-3">
                        <BookOpen className="w-4 h-4 text-orange-500" />
                        <h4 className="text-sm font-semibold text-foreground">Prerequisites</h4>
                      </div>
                      {selectedTopic.prerequisites.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedTopic.prerequisites.map(prereq => (
                            <span key={prereq} className="text-xs bg-background text-foreground px-2.5 py-1.5 rounded-md border border-border shadow-sm">
                              {prereq}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No prerequisites required.</p>
                      )}
                    </div>
                    
                    {/* Sub-topics Card */}
                    {selectedTopic.subTopics.length > 0 && (
                      <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
                        <div className="flex items-center gap-2 mb-3">
                          <ListTree className="w-4 h-4 text-green-500" />
                          <h4 className="text-sm font-semibold text-foreground">Unlockable Sub-topics</h4>
                        </div>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {selectedTopic.subTopics.map(sub => (
                            <li key={sub} className="text-sm text-muted-foreground flex items-center gap-2 bg-background px-3 py-2 rounded-lg border border-border/50 shadow-sm">
                              <div className="w-1.5 h-1.5 rounded-full bg-foreground/30 flex-shrink-0" />
                              <span className="truncate">{sub}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* SRS Review Card */}
                    {selectedTopic.status === 'mastered' && (
                      <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <CalendarClock className="w-4 h-4 text-purple-500" />
                            <h4 className="text-sm font-semibold text-foreground">Adaptive Spaced Repetition</h4>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground italic mt-2">
                          {selectedTopic.nextReviewDate 
                            ? `Automated scheduler has slated a memory retention review for: ${new Date(selectedTopic.nextReviewDate).toLocaleDateString()}` 
                            : 'This topic has been mastered and is scheduled for automatic background review decay tracking.'
                          }
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 border-t border-border/50 pt-2">
                          Note: The system mathematically overrides standard sequences to force reviews based on timestamp decay. Manual review logic is deprecated.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-4 bg-muted/30 border-t border-border flex justify-end">
                  <button 
                    onClick={() => setSelectedTopic(null)}
                    className="px-4 py-2 bg-foreground text-background text-sm font-medium rounded-lg hover:bg-foreground/90 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
