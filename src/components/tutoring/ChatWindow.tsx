import { motion } from 'motion/react';
import { Bot, User, Sparkles } from 'lucide-react';
import { TypingIndicator } from './TypingIndicator';
import { useLearnerState } from '../../context/LearnerStateContext';

export function ChatWindow() {
  const { chatHistory, isTyping } = useLearnerState();
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth bg-gradient-to-b from-background to-muted/20">
      <div className="text-center mb-10">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card shadow-sm border border-border/50 text-xs font-medium text-muted-foreground"
        >
          <motion.div
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          >
            <Sparkles size={14} className="text-yellow-500" />
          </motion.div>
          <span>Session started • Adaptive Sequencing Active</span>
        </motion.div>
      </div>

      {chatHistory.map((msg, i) => (
        <motion.div
          key={msg.id}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: i * 0.2, type: "spring", stiffness: 250, damping: 20 }}
          className={`flex gap-3 md:gap-4 max-w-3xl mx-auto ${msg.role === 'student' ? 'flex-row-reverse' : ''}`}
        >
          <motion.div 
            whileHover={{ scale: 1.1, rotate: msg.role === 'tutor' ? 5 : -5 }}
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-md z-10 ${
              msg.role === 'tutor' 
                ? 'bg-gradient-to-br from-foreground to-foreground/80 text-background' 
                : 'bg-gradient-to-br from-muted to-muted/80 text-foreground border border-border/50'
            }`}
          >
            {msg.role === 'tutor' ? (
              <motion.div
                animate={{ y: [0, -2, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              >
                <Bot size={20} />
              </motion.div>
            ) : (
              <User size={20} />
            )}
          </motion.div>
          
          <div className={`flex flex-col ${msg.role === 'student' ? 'items-end' : 'items-start'} max-w-[80%]`}>
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 mx-2 opacity-70">
              {msg.role === 'tutor' ? 'Lumina AI' : 'You'}
            </span>
            <motion.div 
              whileHover={{ scale: 1.01 }}
              className={`px-5 py-4 text-[15px] leading-relaxed shadow-sm relative ${
                msg.role === 'tutor' 
                  ? 'bg-card border border-border/40 text-foreground rounded-2xl rounded-tl-sm' 
                  : 'bg-gradient-to-br from-foreground to-foreground/90 text-background rounded-2xl rounded-tr-sm'
              }`}
            >
              {msg.content.split('\n').map((line, j) => {
                const parts = line.split(/(`[^`]+`)/g);
                return (
                  <p key={j} className={j > 0 ? 'mt-3' : ''}>
                    {parts.map((part, k) => {
                      if (part.startsWith('`') && part.endsWith('`')) {
                        return (
                          <code key={k} className={`px-1.5 py-0.5 rounded-md font-mono text-[13px] ${msg.role === 'tutor' ? 'bg-muted text-foreground' : 'bg-background/20 text-background'}`}>
                            {part.slice(1, -1)}
                          </code>
                        );
                      }
                      return <span key={k}>{part}</span>;
                    })}
                  </p>
                );
              })}
            </motion.div>
          </div>
        </motion.div>
      ))}
      
      {/* Typing Indicator */}
      {isTyping && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring" }}
          className="flex gap-3 md:gap-4 max-w-3xl mx-auto"
        >
          <motion.div 
            animate={{ y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-md bg-gradient-to-br from-foreground to-foreground/80 text-background z-10"
          >
            <Bot size={20} />
          </motion.div>
          <div className="flex flex-col items-start">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 mx-2 opacity-70">Lumina AI</span>
            <div className="px-5 py-4 rounded-2xl bg-card border border-border/40 text-foreground rounded-tl-sm shadow-sm">
              <TypingIndicator />
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
