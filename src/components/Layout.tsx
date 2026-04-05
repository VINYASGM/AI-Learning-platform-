import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, Settings, BarChart, GraduationCap, Brain } from 'lucide-react';
import { SettingsModal } from './SettingsModal';

export function Layout({ children, sidebar }: { children: React.ReactNode, sidebar: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden selection:bg-foreground selection:text-background font-sans">
      <header className="flex-none h-12 border-b border-border/40 bg-background/80 backdrop-blur-md flex items-center justify-between px-3 md:px-4 z-30 relative shadow-sm">
        <div className="flex items-center gap-2 md:gap-3">
          {/* Mobile menu toggle */}
          <button 
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)} 
            className="lg:hidden p-1.5 -ml-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
          >
            {mobileSidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          
          <motion.div 
            whileHover={{ rotate: 10, scale: 1.1 }} 
            className="bg-gradient-to-br from-foreground to-foreground/80 text-background p-1 rounded flex items-center justify-center shadow-sm"
          >
            <GraduationCap size={16} />
          </motion.div>
          <span className="font-semibold tracking-tight text-sm md:text-base hidden sm:inline-block">Lumina Tutor</span>
        </div>
        
        <div className="flex items-center gap-1.5 md:gap-3">
          {/* Focus Meter (Slimmer) */}
          <div className="hidden md:flex items-center gap-2 px-2 py-1 bg-muted/30 rounded border border-border/50" title="Student Focus Level">
            <Brain size={12} className="text-accent" />
            <div className="flex items-center gap-2 w-24">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground leading-none">Focus 85%</span>
              <div className="flex-1 h-1 bg-muted-foreground/20 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '85%' }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="h-full bg-accent rounded-full" 
                />
              </div>
            </div>
          </div>

          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="hidden sm:flex p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors" title="Analytics">
            <BarChart size={16} />
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.05 }} 
            whileTap={{ scale: 0.95 }} 
            onClick={() => setSettingsOpen(true)}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" 
            title="Settings"
          >
            <Settings size={16} />
          </motion.button>
        </div>
      </header>
      
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {mobileSidebarOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileSidebarOpen(false)}
              className="lg:hidden absolute inset-0 bg-background/80 backdrop-blur-sm z-40"
            />
          )}
        </AnimatePresence>

        {/* Sidebar Container */}
        {/* Mobile: Absolute Drawer. Desktop: Persistent Relative Bar */}
        <aside 
          className={`
            fixed lg:relative inset-y-0 left-0 z-50 lg:z-10
            w-72 bg-background border-r border-border/40 
            transition-transform duration-300 ease-in-out
            ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            flex flex-col shadow-2xl lg:shadow-none
          `}
        >
           {/* Header for mobile drawer close button */}
           <div className="lg:hidden h-12 flex items-center justify-between px-4 border-b border-border/40">
              <span className="font-semibold text-sm">Menu</span>
              <button onClick={() => setMobileSidebarOpen(false)} className="p-1 rounded-md hover:bg-muted">
                <X size={16}/>
              </button>
           </div>
          {sidebar}
        </aside>
        
        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 bg-muted/5 relative z-10">
          {children}
        </main>
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
