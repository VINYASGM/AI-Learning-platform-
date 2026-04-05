import React, { useCallback, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Network, Sparkles, BrainCircuit, CheckCircle2, Circle, Lock, Filter, Zap } from 'lucide-react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Position,
  MarkerType,
  Node,
  Handle,
  NodeProps,
  BackgroundVariant
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// --- Custom Animated Nodes ---

const DomainNode = ({ data }: NodeProps) => (
  <motion.div
    initial={{ scale: 0.5, opacity: 0 }}
    animate={{ scale: 1, opacity: data.isDimmed ? 0.3 : 1 }}
    whileHover={{ scale: 1.05 }}
    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    className={`relative px-6 py-4 rounded-2xl font-bold text-white text-lg text-center shadow-xl transition-all duration-300 ${data.isHighlighted ? 'ring-4 ring-blue-400 ring-offset-4 ring-offset-background' : ''}`}
    style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}
  >
    <Handle type="target" position={Position.Top} className="!bg-blue-200 !w-3 !h-3 !border-2 !border-blue-600 opacity-0" />
    <div className="flex items-center justify-center gap-2">
      <BrainCircuit className="w-6 h-6 text-blue-200" />
      {data.label as string}
    </div>
    <Handle type="source" position={Position.Bottom} className="!bg-blue-200 !w-3 !h-3 !border-2 !border-blue-600 opacity-0" />
    {!data.isDimmed && <div className="absolute inset-0 rounded-2xl bg-blue-500 blur-xl opacity-40 -z-10 animate-pulse" />}
  </motion.div>
);

const TopicNode = ({ data }: NodeProps) => {
  const StatusIcon = data.status === 'mastered' ? CheckCircle2 : data.status === 'learning' ? Circle : Lock;
  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: data.isDimmed ? 0.3 : 1 }}
      whileHover={{ scale: 1.05, y: -5 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`px-5 py-3 rounded-xl font-semibold text-white text-sm text-center shadow-lg transition-all duration-300 ${data.isHighlighted ? 'ring-4 ring-offset-4 ring-offset-background' : ''}`}
      style={{ 
        background: data.color as string || 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
        '--tw-ring-color': data.ringColor as string || '#34d399'
      } as React.CSSProperties}
    >
      <Handle type="target" position={Position.Top} className="!bg-white !w-2 !h-2 !border-none opacity-50" />
      <div className="flex items-center justify-center gap-1.5">
        {data.status && <StatusIcon className="w-4 h-4 opacity-90" />}
        <span>{data.label as string}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-white !w-2 !h-2 !border-none opacity-50" />
    </motion.div>
  );
};

const SubtopicNode = ({ data }: NodeProps) => {
  const StatusIcon = data.status === 'mastered' ? CheckCircle2 : data.status === 'learning' ? Circle : Lock;
  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: data.isDimmed ? 0.3 : 1 }}
      whileHover={{ scale: 1.05 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`px-4 py-2 rounded-lg font-medium text-foreground text-xs text-center shadow-md border-2 transition-all duration-300 bg-card ${data.isHighlighted ? 'border-blue-500 shadow-blue-500/20 scale-105' : 'border-border'}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground !w-1.5 !h-1.5 !border-none opacity-50" />
      <div className="flex items-center justify-center gap-1.5">
        {data.status && <StatusIcon className={`w-3.5 h-3.5 ${data.status === 'mastered' ? 'text-green-500' : data.status === 'learning' ? 'text-blue-500' : 'text-muted-foreground'}`} />}
        <span>{data.label as string}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground !w-1.5 !h-1.5 !border-none opacity-50" />
    </motion.div>
  );
};

const BridgeNode = ({ data }: NodeProps) => {
  const StatusIcon = data.status === 'mastered' ? CheckCircle2 : data.status === 'learning' ? Circle : Lock;
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: data.isDimmed ? 0.3 : 1 }}
      whileHover={{ scale: 1.08 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`relative px-4 py-2 rounded-lg font-medium text-white text-xs text-center shadow-lg border-2 border-orange-400/50 transition-all duration-300 ${data.isHighlighted ? 'ring-4 ring-orange-400 ring-offset-4 ring-offset-background' : ''}`}
      style={{ background: data.color as string || 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' }}
    >
      <Handle type="target" position={Position.Top} className="!bg-orange-200 !w-2 !h-2 !border-none opacity-50" />
      <div className="flex items-center justify-center gap-1.5">
        <Zap className="w-3 h-3 text-orange-200" />
        {data.status && <StatusIcon className="w-3 h-3 opacity-90" />}
        <span>{data.label as string}</span>
      </div>
      {data.isAutoGenerated && (
        <div className="text-[9px] text-orange-200/80 mt-0.5">Auto-generated</div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-orange-200 !w-2 !h-2 !border-none opacity-50" />
      {!data.isDimmed && <div className="absolute inset-0 rounded-lg bg-orange-500 blur-lg opacity-30 -z-10 animate-pulse" />}
    </motion.div>
  );
};

const nodeTypes = {
  domain: DomainNode,
  topic: TopicNode,
  subtopic: SubtopicNode,
  bridge: BridgeNode,
};

import { useLearnerState } from '../../context/LearnerStateContext';
import { deriveEdgesFromCurriculum } from '../../services/KnowledgeGraphService';

interface KnowledgeGraphViewProps {
  onClose: () => void;
}

export function KnowledgeGraphView({ onClose }: KnowledgeGraphViewProps) {
  const { nodes: ctxNodes } = useLearnerState();
  
  // Transform Context Nodes array to ReactFlow Nodes with persistent positions
  const baseNodes: Node[] = ctxNodes.map((cn, index) => {
    // Preserve the original positions we had designed for MVP radial/tree layout
    let pos = { x: 0, y: 0 };
    if (cn.id === 'domain-math') pos = { x: 400, y: 50 };
    if (cn.id === 'topic-arithmetic') pos = { x: 100, y: 160 };
    if (cn.id === 'topic-algebra') pos = { x: 400, y: 160 };
    if (cn.id === 'topic-calculus') pos = { x: 700, y: 160 };
    if (cn.id === 'sub-addition') pos = { x: 20, y: 280 };
    if (cn.id === 'sub-multiplication') pos = { x: 180, y: 280 };
    if (cn.id === 'sub-linear') pos = { x: 320, y: 280 };
    if (cn.id === 'sub-quadratics') pos = { x: 480, y: 280 };
    if (cn.id === 'sub-limits') pos = { x: 620, y: 280 };
    if (cn.id === 'sub-derivatives') pos = { x: 780, y: 280 };

    // Dynamic positioning for auto-generated bridge nodes
    if (cn.type === 'bridge' && pos.x === 0 && pos.y === 0) {
      // Place bridge nodes between their parent and child, offset slightly
      const parentNode = ctxNodes.find(n => cn.prerequisites.includes(n.id));
      const childNode = ctxNodes.find(n => n.prerequisites.includes(cn.id));
      if (parentNode && childNode) {
        const parentPos = baseNodes.find(n => n.id === parentNode.id)?.position;
        if (parentPos) {
          pos = { x: parentPos.x + 50, y: parentPos.y + 60 };
        }
      } else {
        // Fallback: place dynamically generated nodes in a row below
        const bridgeIndex = ctxNodes.filter(n => n.type === 'bridge').indexOf(cn);
        pos = { x: 100 + bridgeIndex * 200, y: 400 };
      }
    }

    return {
      id: cn.id,
      type: cn.type,
      data: { ...cn, label: cn.label, status: cn.status, isAutoGenerated: cn.isAutoGenerated },
      position: pos
    };
  });

  const baseEdges = deriveEdgesFromCurriculum(ctxNodes);

  const [nodes, setNodes, onNodesChange] = useNodesState(baseNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(baseEdges);
  
  // Sync when ctxNodes changes
  React.useEffect(() => {
    setNodes(baseNodes);
    setEdges(baseEdges);
  }, [ctxNodes]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [layout, setLayout] = useState<'tree' | 'radial'>('tree');
  const [filter, setFilter] = useState<'all' | 'mastered' | 'learning' | 'locked'>('all');
  const [rfInstance, setRfInstance] = useState<any>(null);

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const toggleLayout = useCallback(() => {
    setLayout((prev) => {
      const nextLayout = prev === 'tree' ? 'radial' : 'tree';
      
      setNodes((nds) => {
        return nds.map((node) => {
          let newPos = { x: 0, y: 0 };
          
          if (nextLayout === 'tree') {
            const originalNode = baseNodes.find(n => n.id === node.id);
            if (originalNode) newPos = { ...originalNode.position };
          } else {
            const centerX = 400;
            const centerY = 300;
            
            if (node.id === 'domain-math') {
              newPos = { x: centerX, y: centerY };
            } else if (node.id.startsWith('topic-')) {
              const topics = ['topic-arithmetic', 'topic-algebra', 'topic-calculus'];
              const index = topics.indexOf(node.id);
              const angle = (index / topics.length) * 2 * Math.PI - Math.PI / 2;
              newPos = {
                x: centerX + Math.cos(angle) * 200 - 75,
                y: centerY + Math.sin(angle) * 200 - 20,
              };
            } else if (node.id.startsWith('sub-')) {
              let parentAngle = 0;
              let subIndex = 0;
              
              if (node.id.includes('addition') || node.id.includes('multiplication')) {
                parentAngle = (0 / 3) * 2 * Math.PI - Math.PI / 2;
                subIndex = node.id.includes('addition') ? -0.4 : 0.4;
              } else if (node.id.includes('linear') || node.id.includes('quadratics')) {
                parentAngle = (1 / 3) * 2 * Math.PI - Math.PI / 2;
                subIndex = node.id.includes('linear') ? -0.4 : 0.4;
              } else {
                parentAngle = (2 / 3) * 2 * Math.PI - Math.PI / 2;
                subIndex = node.id.includes('limits') ? -0.4 : 0.4;
              }
              
              const angle = parentAngle + subIndex;
              newPos = {
                x: centerX + Math.cos(angle) * 380 - 75,
                y: centerY + Math.sin(angle) * 380 - 20,
              };
            } else if (node.id.startsWith('bridge-')) {
              // Place bridge nodes in an outer ring
              const bridgeNodes = nds.filter(n => n.id.startsWith('bridge-'));
              const bIndex = bridgeNodes.indexOf(node);
              const angle = (bIndex / Math.max(1, bridgeNodes.length)) * 2 * Math.PI;
              newPos = {
                x: centerX + Math.cos(angle) * 300 - 50,
                y: centerY + Math.sin(angle) * 300 - 20,
              };
            }
          }
          
          return {
            ...node,
            position: newPos,
          };
        });
      });
      
      setTimeout(() => {
        if (rfInstance) {
          rfInstance.fitView({ duration: 800, padding: 0.2 });
        }
      }, 50);
      
      return nextLayout;
    });
  }, [setNodes, rfInstance]);

  // Compute derived nodes based on selection and filter
  const displayNodes = useMemo(() => {
    const filteredNodes = nodes.map(n => {
      let isVisible = true;
      if (filter !== 'all' && n.type !== 'domain') {
        isVisible = n.data.status === filter;
      }
      return { ...n, hidden: !isVisible };
    });

    if (!selectedNodeId) {
      return filteredNodes.map(n => ({
        ...n,
        data: { ...n.data, isDimmed: false, isHighlighted: false },
      }));
    }

    const connectedNodeIds = new Set<string>();
    connectedNodeIds.add(selectedNodeId);
    edges.forEach(e => {
      if (e.source === selectedNodeId) connectedNodeIds.add(e.target);
      if (e.target === selectedNodeId) connectedNodeIds.add(e.source);
    });

    return filteredNodes.map(n => {
      const isConnected = connectedNodeIds.has(n.id);
      const isSelected = n.id === selectedNodeId;
      return {
        ...n,
        data: {
          ...n.data,
          isDimmed: !isConnected,
          isHighlighted: isSelected,
        },
        style: {
          ...n.style,
          zIndex: isSelected ? 10 : (isConnected ? 5 : 1),
        }
      };
    });
  }, [nodes, edges, selectedNodeId, filter]);

  // Compute derived edges based on selection and filter
  const displayEdges = useMemo(() => {
    const visibleNodeIds = new Set(displayNodes.filter(n => !n.hidden).map(n => n.id));
    const visibleEdges = edges.map(e => ({
      ...e,
      hidden: !visibleNodeIds.has(e.source) || !visibleNodeIds.has(e.target)
    }));

    if (!selectedNodeId) {
      return visibleEdges.map(e => ({
        ...e,
        style: { ...e.style, opacity: 0.5, strokeWidth: 2, stroke: '#9ca3af' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#9ca3af' },
        animated: true,
      }));
    }

    return visibleEdges.map(e => {
      const isConnected = e.source === selectedNodeId || e.target === selectedNodeId;
      return {
        ...e,
        style: {
          ...e.style,
          opacity: isConnected ? 1 : 0.1,
          strokeWidth: isConnected ? 3 : 1,
          stroke: isConnected ? '#3b82f6' : '#9ca3af',
          filter: isConnected ? 'drop-shadow(0 0 6px rgba(59, 130, 246, 0.6))' : 'none',
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isConnected ? '#3b82f6' : '#9ca3af',
        },
        animated: isConnected,
      };
    });
  }, [edges, selectedNodeId, displayNodes]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="flex flex-col w-full h-full bg-background z-50"
    >
      <style>{`
        .react-flow__node {
          transition: transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
        }
        .react-flow__node.dragging {
          transition: none !important;
        }
        .react-flow__edge-path {
          transition: stroke 0.4s ease, stroke-width 0.4s ease, opacity 0.4s ease, d 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
        }
      `}</style>
      
      <div className="p-4 border-b border-border flex items-center justify-between bg-card relative z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-muted"
          >
            <ArrowLeft size={18} />
            <span className="font-medium text-sm">Back to Workspace</span>
          </button>
          <div className="w-px h-6 bg-border" />
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-500">
              <Network size={18} />
            </div>
            <h2 className="font-semibold">Knowledge Graph</h2>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border">
            <Filter size={14} className="text-muted-foreground ml-2 mr-1" />
            {(['all', 'mastered', 'learning', 'locked'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                  filter === f 
                    ? 'bg-background text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={toggleLayout}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-muted bg-muted/50 border border-border"
          >
            <Sparkles size={16} className="text-blue-500" />
            <span className="font-medium text-sm">Toggle Layout ({layout === 'tree' ? 'Radial' : 'Tree'})</span>
          </button>
        </div>
      </div>

      <div className="flex-1 w-full h-full bg-muted/5 relative">
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onInit={setRfInstance}
          fitView
          attributionPosition="bottom-right"
          minZoom={0.2}
          maxZoom={2}
        >
          <Controls className="bg-card border-border shadow-md rounded-lg overflow-hidden" />
          <MiniMap 
            nodeStrokeColor="transparent"
            nodeColor={(n) => {
              if (n.type === 'domain') return '#3b82f6';
              if (n.type === 'topic') return '#10b981';
              if (n.type === 'bridge') return '#f97316';
              return '#e5e7eb';
            }}
            nodeBorderRadius={8}
            className="bg-card border-border shadow-md rounded-xl overflow-hidden"
            maskColor="rgba(0, 0, 0, 0.1)"
          />
          <Background variant={BackgroundVariant.Dots} color="currentColor" className="text-muted-foreground/20" gap={24} size={2} />
        </ReactFlow>
      </div>
    </motion.div>
  );
}
