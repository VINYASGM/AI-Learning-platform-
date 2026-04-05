import React from 'react';
import { motion } from 'motion/react';
import { PlayCircle, Clock, BookOpen } from 'lucide-react';

const VIDEOS = [
  { id: 1, title: 'Introduction to Linear Equations', duration: '5:24', topic: 'Algebra Basics', active: true },
  { id: 2, title: 'Solving for Unknown Variables', duration: '8:12', topic: 'Algebra Basics', active: false },
  { id: 3, title: 'Properties of Equality', duration: '4:45', topic: 'Core Concepts', active: false },
];

export function VideoLibraryView() {
  return (
    <div className="flex flex-col lg:flex-row h-full gap-4 max-h-[800px]">
      {/* Video Player Area */}
      <div className="flex-1 flex flex-col rounded-2xl border border-border bg-card shadow-sm overflow-hidden min-h-[300px]">
        <div className="flex-1 bg-black/95 relative group flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="w-16 h-16 rounded-full bg-blue-500/90 text-white flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.5)] z-10"
          >
            <PlayCircle className="w-8 h-8 ml-1" />
          </motion.button>
          
          <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-col gap-2">
            <h3 className="text-white font-medium text-lg blur-0">Introduction to Linear Equations</h3>
            <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 w-1/3 rounded-full" />
            </div>
            <div className="flex justify-between text-[11px] text-white/60 font-mono">
              <span>01:45</span>
              <span>05:24</span>
            </div>
          </div>
        </div>
      </div>

      {/* Playlist Sidebar */}
      <div className="w-full lg:w-80 flex flex-col gap-3 overflow-y-auto">
        <div className="flex items-center gap-2 mb-2 px-1">
          <BookOpen className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold text-foreground tracking-tight">Recommended Review</h4>
        </div>
        
        {VIDEOS.map((vid) => (
          <div 
            key={vid.id} 
            className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
              vid.active 
                ? 'bg-blue-500/10 border-blue-500/30' 
                : 'bg-card border-border hover:bg-muted/50 hover:border-border/80'
            }`}
          >
            <div className={`mt-1 bg-background rounded-lg p-2 flex items-center justify-center shadow-sm border ${vid.active ? 'border-blue-500/30 text-blue-500' : 'border-border text-foreground/50'}`}>
              <PlayCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 flex flex-col">
              <h5 className={`font-medium text-sm leading-tight mb-1 ${vid.active ? 'text-blue-500' : 'text-foreground'}`}>
                {vid.title}
              </h5>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {vid.duration}
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-muted font-medium text-[10px]">
                  {vid.topic}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
