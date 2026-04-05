import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Send, Lightbulb, BookOpen, Paperclip, Mic } from 'lucide-react';
import { useLearnerState } from '../../context/LearnerStateContext';

export function InputArea() {
  const [text, setText] = useState('');
  const { sendMessage, isTyping } = useLearnerState();

  const handleSend = () => {
    if (!text.trim() || isTyping) return;
    sendMessage(text);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const requestHint = () => {
    sendMessage("I'm stuck. Can you give me a small hint to help me figure out the next step?");
  };

  const requestExample = () => {
    sendMessage("Can you show me a similar example to help me understand?");
  };

  return (
    <div className="p-4 md:p-6 bg-gradient-to-t from-background via-background to-transparent z-10 pb-6">
      <div className="max-w-3xl mx-auto">
        {/* Scaffolded Help Buttons */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, type: "spring" }}
          className="flex flex-wrap gap-2 mb-4"
        >
          <motion.button 
            onClick={requestHint}
            disabled={isTyping}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border border-border/60 bg-card/80 backdrop-blur-sm text-xs font-semibold ${isTyping ? 'opacity-50 cursor-not-allowed' : 'text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:shadow-md'} transition-all`}
          >
            <Lightbulb size={14} className="text-yellow-500" />
            <span>I need a hint</span>
          </motion.button>
          <motion.button 
            onClick={requestExample}
            disabled={isTyping}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border border-border/60 bg-card/80 backdrop-blur-sm text-xs font-semibold ${isTyping ? 'opacity-50 cursor-not-allowed' : 'text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:shadow-md'} transition-all`}
          >
            <BookOpen size={14} className="text-blue-500" />
            <span>Show an example</span>
          </motion.button>
        </motion.div>
        
        {/* Input Field */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, type: "spring", stiffness: 200, damping: 20 }}
          className="relative flex items-end gap-2 bg-card/90 backdrop-blur-xl border border-border/50 rounded-[2rem] p-2 shadow-lg focus-within:shadow-xl focus-within:border-foreground/30 focus-within:ring-4 focus-within:ring-foreground/5 transition-all duration-300"
        >
          <div className="flex gap-1 pb-1 pl-2">
            <motion.button 
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
              className="p-2.5 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted"
            >
              <Paperclip size={18} />
            </motion.button>
          </div>
          <textarea 
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isTyping}
            placeholder="Type your answer or ask for help..."
            className="flex-1 max-h-32 min-h-[44px] bg-transparent border-0 focus:ring-0 resize-none py-3.5 px-2 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
            rows={1}
          />
          <div className="flex gap-1 pb-1 pr-1">
            <motion.button 
              whileHover={{ scale: 1.1, rotate: -5 }}
              whileTap={{ scale: 0.9 }}
              className="p-2.5 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted hidden sm:block"
            >
              <Mic size={18} />
            </motion.button>
            <motion.button 
              onClick={handleSend}
              disabled={isTyping || !text.trim()}
              whileHover={{ scale: 1.05, rotate: -10 }}
              whileTap={{ scale: 0.95 }}
              className={`p-3 rounded-full shadow-md hover:shadow-lg transition-all ${(!text.trim() || isTyping) ? 'bg-muted text-muted-foreground' : 'bg-gradient-to-br from-foreground to-foreground/90 text-background'}`}
            >
              <Send size={18} className="ml-0.5" />
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
