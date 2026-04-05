export type TeachingVariant = 
  | 'Visual Analogy' 
  | 'Socratic Questioning' 
  | 'Direct Instruction' 
  | 'Real-world Application';

export const TEACHING_VARIANTS: TeachingVariant[] = [
  'Visual Analogy',
  'Socratic Questioning',
  'Direct Instruction',
  'Real-world Application'
];

export interface ToneProfile {
  formality: number; // 0 (casual) to 1 (formal)
  encouragement: number; // 0 (neutral) to 1 (highly encouraging)
  humor: number; // 0 (none) to 1 (funny)
}

export const DEFAULT_TONE_PROFILE: ToneProfile = {
  formality: 0.3, // Fairly casual but academic
  encouragement: 0.9, // Very encouraging
  humor: 0.5 // Occasional jokes/analogies
};

export function getVariantHeuristic(banditScores: Record<string, number>): TeachingVariant {
  // Epsilon-Greedy selection
  const EPSILON = 0.2; // 20% exploration
  
  if (Math.random() < EPSILON || Object.keys(banditScores).length === 0) {
    // Explore: Pick random
    return TEACHING_VARIANTS[Math.floor(Math.random() * TEACHING_VARIANTS.length)];
  }

  // Exploit: Pick highest scored
  let bestVariant = TEACHING_VARIANTS[0];
  let maxScore = -Infinity;

  for (const variant of TEACHING_VARIANTS) {
    const score = banditScores[variant] || 0;
    if (score > maxScore) {
      maxScore = score;
      bestVariant = variant;
    }
  }

  return bestVariant;
}
