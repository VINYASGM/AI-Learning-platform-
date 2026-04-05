import { motion, AnimatePresence } from 'motion/react';
import { MonitorPlay, Code, Video, RotateCcw, CheckCircle2, MousePointerClick, Activity } from 'lucide-react';
import { useLearnerState } from '../../context/LearnerStateContext';

export function WorkspaceDashboard() {
  const { workspaceStep, setWorkspaceStep } = useLearnerState();
  const step = workspaceStep || 0;

  const reset = () => setWorkspaceStep(0);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto h-full flex flex-col overflow-y-auto">
      <header className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Workspace</h1>
          <p className="text-sm text-muted-foreground">Your interactive learning environment.</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border border-border/50">
          <Activity className="w-3.5 h-3.5 text-green-500" />
          <span>Session Active</span>
        </div>
      </header>

      <div className="flex flex-col gap-6 flex-1 pb-4">
        {/* Main Active Session Area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 rounded-3xl border border-border bg-card shadow-sm overflow-hidden flex flex-col relative group min-h-[350px]"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 opacity-50" />
          <div className="p-4 md:p-6 border-b border-border/50 flex justify-between items-center bg-background/50 backdrop-blur-sm relative z-10">
            <div className="flex items-center gap-2">
              <MonitorPlay className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold">Active Simulator</h3>
            </div>
            <span className="text-xs font-medium bg-blue-500/10 text-blue-600 px-2.5 py-1 rounded-full">Algebraic Equations</span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative z-10 pb-20">
            <div className="h-32 flex items-center justify-center mb-2">
              <div className="flex items-center justify-center text-4xl md:text-5xl font-mono tracking-wider text-foreground/80 relative">
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
                        <span className="px-1">2</span>
                      ) : (
                        <motion.button
                          whileHover={{ scale: 1.1, y: -4 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setWorkspaceStep(2)}
                          className="text-purple-500 bg-purple-500/10 hover:bg-purple-500/20 px-4 py-2 rounded-xl cursor-pointer transition-colors border border-purple-500/30 flex items-center gap-2 relative group shadow-sm"
                          title="Divide both sides by 2"
                        >
                          2
                          <MousePointerClick className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-4 -left-4 text-purple-600 drop-shadow-md" />
                        </motion.button>
                      )}
                    </motion.div>
                  )}

                  <motion.div
                    layout
                    key="var"
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className={`flex items-center px-1 transition-colors duration-500 ${step === 2 ? "text-green-500 font-bold text-5xl md:text-6xl" : ""}`}
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
                      className="flex items-center mx-2"
                    >
                      <motion.button
                        whileHover={{ scale: 1.1, y: -4 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setWorkspaceStep(1)}
                        className="text-blue-500 bg-blue-500/10 hover:bg-blue-500/20 px-4 py-2 rounded-xl cursor-pointer transition-colors border border-blue-500/30 flex items-center gap-2 relative group shadow-sm"
                        title="Subtract 4 from both sides"
                      >
                        + 4
                        <MousePointerClick className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-4 -right-4 text-blue-600 drop-shadow-md" />
                      </motion.button>
                    </motion.div>
                  )}

                  <motion.div
                    layout
                    key="equals"
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className={`flex items-center mx-4 transition-colors duration-500 ${step === 2 ? "text-green-500/50" : "text-muted-foreground"}`}
                  >
                    =
                  </motion.div>

                  <motion.div
                    layout
                    key="result"
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className={`flex items-center relative transition-colors duration-500 ${step === 2 ? "text-green-500 font-bold text-5xl md:text-6xl" : ""}`}
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

            <div className="h-16 flex items-center justify-center">
              <AnimatePresence mode="wait">
                {step === 0 && (
                  <motion.p key="hint0" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-muted-foreground max-w-md text-sm leading-relaxed">
                    Click on the <span className="text-blue-500 font-medium bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">+ 4</span> to subtract it from both sides and isolate the x term.
                  </motion.p>
                )}
                {step === 1 && (
                  <motion.p key="hint1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-muted-foreground max-w-md text-sm leading-relaxed">
                    Now click on the <span className="text-purple-500 font-medium bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">2</span> to divide both sides and solve for x.
                  </motion.p>
                )}
                {step === 2 && (
                  <motion.p key="hint2" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="text-green-600 font-medium text-sm flex items-center justify-center gap-2 bg-green-500/10 px-4 py-2 rounded-full border border-green-500/20">
                    <CheckCircle2 className="w-5 h-5" /> Equation solved successfully!
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Interactive Controls Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t border-border/50 flex items-center justify-between z-20">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Interactive Mode</span>
            </div>
            <button
              onClick={reset}
              disabled={step === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                step > 0
                  ? 'bg-foreground text-background hover:scale-105 active:scale-95 shadow-sm'
                  : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </motion.div>

        {/* Quick Tools Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <div className="rounded-2xl border border-border bg-muted/30 p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors cursor-pointer group">
            <div className="p-3 rounded-xl bg-background shadow-sm border border-border group-hover:border-foreground/20 transition-colors">
              <Code className="w-5 h-5 text-foreground/70" />
            </div>
            <div>
              <h4 className="font-medium text-sm">Code Sandbox</h4>
              <p className="text-xs text-muted-foreground">Practice programming</p>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-muted/30 p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors cursor-pointer group">
            <div className="p-3 rounded-xl bg-background shadow-sm border border-border group-hover:border-foreground/20 transition-colors">
              <Video className="w-5 h-5 text-foreground/70" />
            </div>
            <div>
              <h4 className="font-medium text-sm">Video Library</h4>
              <p className="text-xs text-muted-foreground">Review past lessons</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
