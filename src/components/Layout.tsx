import React, { useState } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, Settings, BarChart, GraduationCap, Brain } from 'lucide-react';

export function Layout({ children, sidebar }: { children: React.ReactNode, sidebar: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden selection:bg-foreground selection:text-background">
      <header className="flex-none h-14 border-b border-border/40 bg-background/80 backdrop-blur-md flex items-center justify-between px-4 z-30 relative">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)} 
            className="p-2 -ml-2 rounded-md hover:bg-muted transition-colors"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <motion.div 
            whileHover={{ rotate: 10, scale: 1.1 }} 
            className="bg-foreground text-background p-1.5 rounded-md flex items-center justify-center"
          >
            <GraduationCap size={18} />
          </motion.div>
          <span className="font-medium tracking-tight">Lumina Tutor</span>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          {/* Focus Meter */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-muted/30 rounded-full border border-border/50 mr-1" title="Student Focus Level">
            <Brain size={14} className="text-blue-500" />
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between w-20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none">Focus</span>
                <span className="text-[10px] font-medium leading-none">85%</span>
              </div>
              <div className="w-20 h-1.5 bg-muted-foreground/20 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '85%' }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="h-full bg-blue-500 rounded-full" 
                />
              </div>
            </div>
          </div>

          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors hidden sm:flex">
            <BarChart size={18} />
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors hidden sm:flex">
            <Settings size={18} />
          </motion.button>
          <div className="w-px h-4 bg-border mx-1 hidden sm:block"></div>
          <ThemeToggle />
        </div>
      </header>
      
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm z-20"
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <aside 
          className={`absolute z-30 w-72 h-full bg-background border-r border-border/40 flex flex-col transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          {sidebar}
        </aside>
        
        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 bg-muted/10 relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
}
