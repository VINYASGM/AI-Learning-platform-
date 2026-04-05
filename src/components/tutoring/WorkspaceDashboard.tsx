import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MonitorPlay, Code, Video, RotateCcw, CheckCircle2, MousePointerClick, Activity } from 'lucide-react';
import { useLearnerState } from '../../context/LearnerStateContext';

import { CodeSandboxView } from './CodeSandboxView';
import { VideoLibraryView } from './VideoLibraryView';

type TabView = 'simulator' | 'sandbox' | 'video';

export function WorkspaceDashboard() {
  const { workspaceStep, setWorkspaceStep } = useLearnerState();
  const step = workspaceStep || 0;
  const [activeTab, setActiveTab] = useState<TabView>('simulator');

  const reset = () => setWorkspaceStep(0);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto h-full flex flex-col overflow-y-auto">
      {/* Sleek Compact Header */}
      <header className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">Workspace</h1>
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold text-green-500 bg-green-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider border border-green-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Active
          </div>
        </div>

        {/* Top Tab Bar */}
        <div className="flex bg-muted/50 p-1 rounded-xl border border-border/50">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'simulator' 
                ? 'bg-background shadow-sm text-foreground border border-border' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <MonitorPlay className="w-4 h-4" />
            <span className="hidden sm:inline">Simulator</span>
          </button>
          <button
            onClick={() => setActiveTab('sandbox')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'sandbox' 
                ? 'bg-background shadow-sm text-foreground border border-border' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Code className="w-4 h-4" />
            <span className="hidden sm:inline">Sandbox</span>
          </button>
          <button
            onClick={() => setActiveTab('video')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'video' 
                ? 'bg-background shadow-sm text-foreground border border-border' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Video className="w-4 h-4" />
            <span className="hidden sm:inline">Videos</span>
          </button>
        </div>
      </header>

      {/* Main Tab Content Area */}
      <div className="flex-1 flex flex-col min-h-0">
        <AnimatePresence mode="wait">
          {activeTab === 'simulator' && (
            <motion.div
              key="simulator"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 rounded-3xl border border-border bg-card shadow-sm overflow-hidden flex flex-col relative group min-h-[350px]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 opacity-50 z-0" />
              
              <div className="p-3 md:p-4 border-b border-border/50 flex justify-between items-center bg-background/50 backdrop-blur-sm relative z-10">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Interactive Math Simulator</span>
                <span className="text-xs font-medium bg-blue-500/10 text-blue-600 px-2.5 py-1 rounded-full border border-blue-500/20">Algebraic Equations</span>
              </div>

              {/* Responsive scaling container */}
              <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 text-center relative z-10 pb-16">
                <div className="h-full max-h-[400px] w-full flex items-center justify-center">
                  
                  {/* CSS clamp allows dynamic scaling of the text based on viewport height and width */}
                  <div className="flex items-center justify-center font-mono tracking-wider text-foreground/80 relative" style={{ fontSize: 'clamp(2rem, 5vmin, 6rem)' }}>
                    <AnimatePresence mode="popLayout">
                      {step < 2 && (
                        <motion.div
                          layout
                          key="coeff"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, y: 30, scale: 0.5, filter: "blur(4px)" }}
                          transition={{ type: "spring", stiffness: 300, damping: 25 }}
                          className="flex items-center"
                        >
                          {step === 0 ? (
                            <span className="px-[0.2em]">2</span>
                          ) : (
                            <motion.button
                              whileHover={{ scale: 1.1, y: -4 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setWorkspaceStep(2)}
                              className="text-purple-500 bg-purple-500/10 hover:bg-purple-500/20 px-[0.4em] py-[0.1em] rounded-2xl cursor-pointer transition-colors border border-purple-500/30 flex items-center gap-2 relative group shadow-sm text-[0.8em]"
                              title="Divide both sides by 2"
                            >
                              2
                              <MousePointerClick className="w-[0.5em] h-[0.5em] opacity-0 group-hover:opacity-100 transition-opacity absolute -top-[0.8em] -left-[0.8em] text-purple-600 drop-shadow-md" />
                            </motion.button>
                          )}
                        </motion.div>
                      )}

                      <motion.div
                        layout
                        key="var"
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className={`flex items-center px-[0.2em] transition-colors duration-500 ${step === 2 ? "text-green-500 font-bold" : ""}`}
                      >
                        x
                      </motion.div>

                      {step === 0 && (
                        <motion.div
                          layout
                          key="addend"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, y: -30, scale: 0.5, filter: "blur(4px)" }}
                          transition={{ type: "spring", stiffness: 300, damping: 25 }}
                          className="flex items-center mx-[0.4em]"
                        >
                          <motion.button
                            whileHover={{ scale: 1.1, y: -4 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setWorkspaceStep(1)}
                            className="text-blue-500 bg-blue-500/10 hover:bg-blue-500/20 px-[0.4em] py-[0.1em] rounded-2xl cursor-pointer transition-colors border border-blue-500/30 flex items-center gap-[0.2em] relative group shadow-sm text-[0.8em]"
                            title="Subtract 4 from both sides"
                          >
                            + 4
                            <MousePointerClick className="w-[0.5em] h-[0.5em] opacity-0 group-hover:opacity-100 transition-opacity absolute -top-[0.8em] -right-[0.8em] text-blue-600 drop-shadow-md" />
                          </motion.button>
                        </motion.div>
                      )}

                      <motion.div
                        layout
                        key="equals"
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className={`flex items-center mx-[0.5em] transition-colors duration-500 ${step === 2 ? "text-green-500/50" : "text-muted-foreground"}`}
                      >
                        =
                      </motion.div>

                      <motion.div
                        layout
                        key="result"
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className={`flex items-center relative transition-colors duration-500 ${step === 2 ? "text-green-500 font-bold" : ""}`}
                      >
                        <AnimatePresence mode="popLayout">
                          <motion.span
                            key={step}
                            initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                            exit={{ opacity: 0, y: -20, filter: "blur(4px)" }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className="inline-block"
                          >
                            {step === 0 ? "10" : step === 1 ? "6" : "3"}
                          </motion.span>
                        </AnimatePresence>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>

                {/* Progress & Hint feedback tightly integrated under equation */}
                <div className="absolute bottom-20 left-0 right-0 flex items-center justify-center">
                  <AnimatePresence mode="wait">
                    {step === 0 && (
                      <motion.p key="hint0" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-muted-foreground text-sm leading-relaxed px-4 text-center">
                        Click on the <span className="text-blue-500 font-medium bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">+ 4</span> to subtract it from both sides and isolate the x term.
                      </motion.p>
                    )}
                    {step === 1 && (
                      <motion.p key="hint1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-muted-foreground text-sm leading-relaxed px-4 text-center">
                        Now click on the <span className="text-purple-500 font-medium bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">2</span> to divide both sides and solve for x.
                      </motion.p>
                    )}
                    {step === 2 && (
                      <motion.p key="hint2" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="text-green-600 font-medium text-sm flex items-center justify-center gap-2 bg-green-500/10 px-4 py-2 rounded-full border border-green-500/20 shadow-sm mt-4">
                        <CheckCircle2 className="w-5 h-5" /> Equation solved successfully!
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Tidy Bottom Controls */}
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-background/80 backdrop-blur-md border-t border-border/50 flex flex-col sm:flex-row items-center sm:justify-between gap-3 sm:gap-0 z-20">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground hidden sm:inline">Current Mode:</span>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-md text-blue-500 text-xs font-semibold">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    Interactive
                  </div>
                </div>
                <button
                  onClick={reset}
                  disabled={step === 0}
                  className={`flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    step > 0
                      ? 'bg-foreground text-background hover:scale-105 active:scale-95 shadow-sm'
                      : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50 border border-border/50'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Simulator
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'sandbox' && (
            <motion.div
              key="sandbox"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 h-full"
            >
              <CodeSandboxView />
            </motion.div>
          )}

          {activeTab === 'video' && (
            <motion.div
              key="video"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 h-full"
            >
              <VideoLibraryView />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
