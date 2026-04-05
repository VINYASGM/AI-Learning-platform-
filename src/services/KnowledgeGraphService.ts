import { Node, Edge } from '@xyflow/react';

export type MasteryStatus = 'mastered' | 'learning' | 'locked';

export interface CurriculumNode {
  id: string;
  label: string;
  type: 'domain' | 'topic' | 'subtopic';
  status: MasteryStatus;
  color?: string;
  ringColor?: string;
  prerequisites: string[]; // Node IDs required to unlock this one
  description?: string;
}

export const curriculumNodes: CurriculumNode[] = [
  { id: 'domain-math', type: 'domain', label: 'Mathematics', status: 'mastered', prerequisites: [] },
  
  // Arithmetic
  { id: 'topic-arithmetic', type: 'topic', label: 'Basic Arithmetic', status: 'mastered', color: 'linear-gradient(135deg, #10b981 0%, #047857 100%)', ringColor: '#34d399', prerequisites: ['domain-math'] },
  { id: 'sub-addition', type: 'subtopic', label: 'Addition & Subtraction', status: 'mastered', prerequisites: ['topic-arithmetic'] },
  { id: 'sub-multiplication', type: 'subtopic', label: 'Multiplication & Division', status: 'mastered', prerequisites: ['sub-addition'] },
  
  // Algebra
  { id: 'topic-algebra', type: 'topic', label: 'Algebra', status: 'learning', color: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', ringColor: '#a78bfa', prerequisites: ['sub-multiplication'] },
  { id: 'sub-linear', type: 'subtopic', label: 'Linear Equations', status: 'learning', prerequisites: ['topic-algebra'] },
  { id: 'sub-quadratics', type: 'subtopic', label: 'Quadratics', status: 'locked', prerequisites: ['sub-linear'] },
  
  // Calculus
  { id: 'topic-calculus', type: 'topic', label: 'Calculus', status: 'locked', color: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)', ringColor: '#fbbf24', prerequisites: ['sub-quadratics'] },
  { id: 'sub-limits', type: 'subtopic', label: 'Limits', status: 'locked', prerequisites: ['topic-calculus'] },
  { id: 'sub-derivatives', type: 'subtopic', label: 'Derivatives', status: 'locked', prerequisites: ['sub-limits'] },
];

// Helper to deduce edges from prerequisites
export const deriveEdgesFromCurriculum = (nodes: CurriculumNode[]): Edge[] => {
  const edges: Edge[] = [];
  nodes.forEach(node => {
    node.prerequisites.forEach(prereqId => {
       // Find the parent
       edges.push({
         id: `e-${prereqId}-${node.id}`,
         source: prereqId,
         target: node.id,
       });
    });
  });
  return edges;
};

// Adaptive Sequencing rules
// If all prerequisites are 'mastered', the topic becomes 'learning' or stays locked if the system decides otherwise. For now, automatic unlock.
export const evaluateMasteryUnlocks = (currentNodes: CurriculumNode[]): CurriculumNode[] => {
  return currentNodes.map(node => {
    if (node.status === 'locked') {
      const allPrereqsMastered = node.prerequisites.length > 0 && node.prerequisites.every(prereqId => {
        const prereq = currentNodes.find(n => n.id === prereqId);
        return prereq && prereq.status === 'mastered';
      });
      if (allPrereqsMastered) {
        return { ...node, status: 'learning' };
      }
    }
    return node;
  });
};

export const markNodeMastered = (nodes: CurriculumNode[], nodeId: string): CurriculumNode[] => {
  let updated = nodes.map(n => n.id === nodeId ? { ...n, status: 'mastered' as MasteryStatus } : n);
  // Re-evaluate what unblocks next
  return evaluateMasteryUnlocks(updated);
};
