import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Play, FileCode2, Terminal, Code2, RefreshCw } from 'lucide-react';

export function CodeSandboxView() {
  const [code, setCode] = useState("def solve_equation(x):\n    return 2 * x + 4 == 10\n\nprint(solve_equation(3)) # Should print True");
  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = () => {
    setIsRunning(true);
    setOutput("");
    setTimeout(() => {
      setIsRunning(false);
      setOutput("True\n\n[Process completed successfully]");
    }, 800);
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/20">
        <div className="flex items-center gap-2">
          <FileCode2 className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-muted-foreground">main.py</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-600 rounded-md text-xs font-medium transition-colors"
          >
            {isRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {isRunning ? 'Running...' : 'Run Code'}
          </button>
        </div>
      </div>

      {/* Editor & Terminal Layout */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Editor Area */}
        <div className="flex-1 bg-background/50 relative p-4 flex flex-col font-mono text-sm border-b lg:border-b-0 lg:border-r border-border/50 min-h-[50%] lg:min-h-0">
          <div className="absolute top-2 right-4 flex gap-1 opacity-50">
             <Code2 className="w-4 h-4" />
          </div>
          <textarea 
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full h-full bg-transparent border-none outline-none resize-none text-foreground leading-relaxed"
            spellCheck={false}
          />
        </div>

        {/* Terminal Area */}
        <div className="flex-1 lg:max-w-md bg-black/90 p-4 font-mono text-xs overflow-y-auto flex flex-col">
          <div className="flex items-center gap-2 text-muted-foreground mb-3 opacity-70">
            <Terminal className="w-4 h-4" />
            <span className="uppercase tracking-wider text-[10px]">Terminal Output</span>
          </div>
          <div className="flex-1 text-green-400 whitespace-pre-wrap">
            {output || <span className="text-muted-foreground/40 italic">Output will appear here after execution...</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
