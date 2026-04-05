import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ThemeProvider } from './components/ThemeProvider';
import { Layout } from './components/Layout';
import { ProgressSidebar } from './components/tutoring/ProgressSidebar';
import { ChatWindow } from './components/tutoring/ChatWindow';
import { InputArea } from './components/tutoring/InputArea';
import { WorkspaceDashboard } from './components/tutoring/WorkspaceDashboard';
import { KnowledgeGraphView } from './components/tutoring/KnowledgeGraphView';
import { LearnerStateProvider } from './context/LearnerStateContext';

type PanelMode = 'split' | 'workspace-full' | 'chat-full';

export default function App() {
  const [currentView, setCurrentView] = useState<'main' | 'knowledge-graph'>('main');
  
  // ─── Responsive State ────────────────────────────────────────
  const [isDesktop, setIsDesktop] = useState(false);
  
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    handleResize(); // Init
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ─── Resizable Panel State ────────────────────────────────────
  const [panelMode, setPanelMode] = useState<PanelMode>('split');
  // Default to 60% workspace on desktop, 55% on mobile
  const [workspacePercent, setWorkspacePercent] = useState(60); 
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // ─── Drag Resize Logic ────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      
      let percent = 50;
      if (isDesktop) {
        // Desktop: Left-to-right calculation
        const x = e.clientX - rect.left;
        percent = (x / rect.width) * 100;
      } else {
        // Mobile: Top-to-bottom calculation
        const y = e.clientY - rect.top;
        percent = (y / rect.height) * 100;
      }
      
      // Clamp between 25% and 75%
      setWorkspacePercent(Math.min(75, Math.max(25, percent)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Prevent text selection during drag and set appropriate cursor
    document.body.style.userSelect = 'none';
    document.body.style.cursor = isDesktop ? 'col-resize' : 'row-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, isDesktop]);

  // ─── Panel Mode Toggles ───────────────────────────────────────
  const toggleWorkspaceFull = useCallback(() => {
    setPanelMode(prev => prev === 'workspace-full' ? 'split' : 'workspace-full');
  }, []);

  const toggleChatFull = useCallback(() => {
    setPanelMode(prev => prev === 'chat-full' ? 'split' : 'chat-full');
  }, []);

  // Quick preset sizes
  const setPreset = useCallback((preset: '50-50' | '70-30' | '30-70') => {
    setPanelMode('split');
    switch (preset) {
      case '50-50': setWorkspacePercent(50); break;
      case '70-30': setWorkspacePercent(70); break;
      case '30-70': setWorkspacePercent(30); break;
    }
  }, []);

  // ─── Compute Panel Styles ─────────────────────────────────────
  const showWorkspace = panelMode !== 'chat-full';
  const showChat = panelMode !== 'workspace-full';
  const showResizer = panelMode === 'split';

  const workspaceStyle: React.CSSProperties = panelMode === 'workspace-full'
    ? { flex: 1 }
    : panelMode === 'chat-full'
      ? { display: 'none' }
      : isDesktop 
        ? { width: `${workspacePercent}%`, flexShrink: 0 }
        : { height: `${workspacePercent}%`, flexShrink: 0 };

  const chatStyle: React.CSSProperties = panelMode === 'chat-full'
    ? { flex: 1 }
    : panelMode === 'workspace-full'
      ? { display: 'none' }
      : isDesktop
        ? { width: `${100 - workspacePercent}%`, flexShrink: 0 }
        : { height: `${100 - workspacePercent}%`, flexShrink: 0 };

  return (
    <ThemeProvider defaultTheme="system" storageKey="lumina-theme">
      <LearnerStateProvider>
        <Layout sidebar={<ProgressSidebar onOpenKnowledgeGraph={() => setCurrentView('knowledge-graph')} />}>
          {currentView === 'main' ? (
            <div ref={containerRef} className="flex flex-col lg:flex-row h-full w-full overflow-hidden relative">
              
              {/* ── Workspace Section ─────────────────────────────── */}
              {showWorkspace && (
                <div 
                  className="overflow-y-auto bg-muted/10 relative group/workspace min-h-0 min-w-0"
                  style={workspaceStyle}
                >
                  {/* Fullscreen toggle for workspace */}
                  <div className="absolute top-3 right-3 z-20 flex items-center gap-1 opacity-0 group-hover/workspace:opacity-100 transition-opacity duration-200 shadow-sm">
                    {panelMode === 'split' && (
                      <div className="flex gap-1 mr-1">
                        <button
                          onClick={() => setPreset('70-30')}
                          title="Workspace 70%"
                          className="px-2 py-1 flex items-center justify-center text-[10px] rounded-md bg-card/90 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted font-bold transition-all"
                        >
                          70
                        </button>
                        <button
                          onClick={() => setPreset('50-50')}
                          title="Equal split"
                          className="px-2 py-1 flex items-center justify-center text-[10px] rounded-md bg-card/90 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted font-bold transition-all"
                        >
                          50
                        </button>
                        <button
                          onClick={() => setPreset('30-70')}
                          title="Chat 70%"
                          className="px-2 py-1 flex items-center justify-center text-[10px] rounded-md bg-card/90 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted font-bold transition-all"
                        >
                          30
                        </button>
                      </div>
                    )}
                    <button
                      onClick={toggleWorkspaceFull}
                      title={panelMode === 'workspace-full' ? 'Exit fullscreen' : 'Workspace fullscreen'}
                      className="p-1.5 rounded-lg bg-card/90 border border-border/40 text-muted-foreground hover:text-foreground transition-all hover:bg-muted"
                    >
                      {panelMode === 'workspace-full' ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
                      )}
                    </button>
                  </div>
                  <WorkspaceDashboard />
                </div>
              )}

              {/* ── Draggable Resize Handle ───────────────────────── */}
              {showResizer && (
                <div
                  onMouseDown={handleMouseDown}
                  className={`
                    relative flex-shrink-0 z-30 group/resizer transition-colors
                    ${isDesktop ? 'w-0 h-full cursor-col-resize' : 'w-full h-0 cursor-row-resize'}
                    ${isDragging ? 'select-none' : ''}
                  `}
                >
                  {/* Visual Line */}
                  <div className={`
                    absolute transition-all duration-150
                    ${isDesktop 
                      ? 'top-0 bottom-0 -left-[1px] w-[2px]' 
                      : 'left-0 right-0 -top-[1px] h-[2px]'}
                    ${isDragging 
                      ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]' 
                      : 'bg-border/60 group-hover/resizer:bg-blue-500/60'}
                  `} />
                  
                  {/* Larger Hit Area */}
                  <div className={`
                    absolute 
                    ${isDesktop ? '-left-2 -right-2 top-0 bottom-0' : '-top-2 -bottom-2 left-0 right-0'}
                  `} />
                  
                  {/* Grip Dots */}
                  <div className={`absolute flex gap-1 transition-opacity duration-150 ${
                    isDragging ? 'opacity-100' : 'opacity-0 group-hover/resizer:opacity-100'
                  } ${isDesktop ? 'top-1/2 -translate-y-1/2 -left-[1px] flex-col' : 'left-1/2 -translate-x-1/2 -top-[1px]'}`}>
                    {isDesktop ? (
                      <div className="w-1 h-8 rounded-full bg-blue-500/80" />
                    ) : (
                      <div className="w-8 h-1 rounded-full bg-blue-500/80" />
                    )}
                  </div>
                </div>
              )}

              {/* ── Chat Section ──────────────────────────────────── */}
              {showChat && (
                <div 
                  className={`
                    flex flex-col bg-background flex-shrink-0 z-10 relative group/chat min-h-0 min-w-0
                    ${isDesktop ? 'border-l border-border/40' : 'border-t border-border/40 shadow-[0_-4px_24px_-12px_rgba(0,0,0,0.1)]'}
                  `}
                  style={chatStyle}
                >
                  {/* Fullscreen toggle for chat */}
                  <div className="absolute top-3 right-3 z-20 opacity-0 group-hover/chat:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={toggleChatFull}
                      title={panelMode === 'chat-full' ? 'Exit fullscreen' : 'Chat fullscreen'}
                      className="p-1.5 rounded-lg bg-card/90 border border-border/40 text-muted-foreground hover:text-foreground transition-all hover:bg-muted shadow-sm"
                    >
                      {panelMode === 'chat-full' ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
                      )}
                    </button>
                  </div>
                  <ChatWindow />
                  <InputArea />
                </div>
              )}

            </div>
          ) : (
            <KnowledgeGraphView onClose={() => setCurrentView('main')} />
          )}
        </Layout>
      </LearnerStateProvider>
    </ThemeProvider>
  );
}
