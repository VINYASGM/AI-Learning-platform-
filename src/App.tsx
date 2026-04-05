import { useState } from 'react';
import { ThemeProvider } from './components/ThemeProvider';
import { Layout } from './components/Layout';
import { ProgressSidebar } from './components/tutoring/ProgressSidebar';
import { ChatWindow } from './components/tutoring/ChatWindow';
import { InputArea } from './components/tutoring/InputArea';
import { WorkspaceDashboard } from './components/tutoring/WorkspaceDashboard';
import { KnowledgeGraphView } from './components/tutoring/KnowledgeGraphView';

import { LearnerStateProvider } from './context/LearnerStateContext';

export default function App() {
  const [currentView, setCurrentView] = useState<'main' | 'knowledge-graph'>('main');

  return (
    <ThemeProvider defaultTheme="system" storageKey="neutral-ui-theme">
      <LearnerStateProvider>
        <Layout sidebar={<ProgressSidebar onOpenKnowledgeGraph={() => setCurrentView('knowledge-graph')} />}>
          {currentView === 'main' ? (
            <div className="flex flex-col h-full w-full overflow-hidden">
              {/* Workspace Section - Top Half */}
              <div className="flex-1 w-full overflow-y-auto bg-muted/10">
                <WorkspaceDashboard />
              </div>

              {/* Chat Section - Bottom Half */}
              <div className="w-full h-[45vh] min-h-[350px] flex flex-col border-t border-border/40 bg-background flex-shrink-0 z-10 shadow-[0_-4px_24px_-12px_rgba(0,0,0,0.1)]">
                <ChatWindow />
                <InputArea />
              </div>
            </div>
          ) : (
            <KnowledgeGraphView onClose={() => setCurrentView('main')} />
          )}
        </Layout>
      </LearnerStateProvider>
    </ThemeProvider>
  );
}
