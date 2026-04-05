import { CurriculumNode } from './KnowledgeGraphService';

export const REVIEW_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

export function getNextAdaptiveTopic(
  nodes: CurriculumNode[],
  masteryProbabilities: Record<string, number>,
  lastReviewed: Record<string, number>
): string | null {
  const now = Date.now();

  // 1. Check for Spaced Repetition Candidates
  // Find mastered nodes that haven't been reviewed recently.
  const spacedReviewCandidates = nodes.filter(node => 
    node.status === 'mastered' && 
    lastReviewed[node.id] &&
    (now - lastReviewed[node.id]) > REVIEW_THRESHOLD_MS
  );

  if (spacedReviewCandidates.length > 0) {
    // Return the oldest reviewed candidate
    spacedReviewCandidates.sort((a, b) => lastReviewed[a.id] - lastReviewed[b.id]);
    return spacedReviewCandidates[0].id;
  }

  // 2. Select Weakest Active/Unlocked Topic (Zone of Proximal Development)
  // Find unlocked nodes
  const unlockedCandidates = nodes.filter(node => node.status === 'learning' && node.type !== 'domain');
  
  if (unlockedCandidates.length > 0) {
    // Sort by lowest mastery probability
    unlockedCandidates.sort((a, b) => {
      const pA = masteryProbabilities[a.id] ?? 0;
      const pB = masteryProbabilities[b.id] ?? 0;
      return pA - pB;
    });
    return unlockedCandidates[0].id;
  }

  // Fallback to whichever is available, or null if everything is mastered and recently tested
  return null;
}
