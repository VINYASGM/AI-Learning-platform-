/**
 * Bayesian Knowledge Tracing (BKT) Service
 * Used to model the learner's probability of mastering a concept based on their responses.
 */

// Default statically tuned BKT parameters for MVP.
export interface BKTParams {
  pL0: number; // Initial probability of knowing the skill
  pT: number;  // Probability of learning the skill during a step
  pG: number;  // Probability of guessing correctly without knowing the skill
  pS: number;  // Probability of slipping (making a mistake despite knowing the skill)
}

const DEFAULT_PARAMS: BKTParams = {
  pL0: 0.1,  // Start with low mastery assumption
  pT: 0.25,  // Generous learning rate for MVP demonstration
  pG: 0.2,   // 20% chance to guess
  pS: 0.1,   // 10% chance to make a careless mistake
};

/**
 * Calculates the new probability of mastery given the previous probability and whether
 * the student answered the current step correctly or incorrectly.
 */
export const updateMasteryProbability = (
  prevPL: number,
  isCorrect: boolean,
  params: BKTParams = DEFAULT_PARAMS
): number => {
  const { pT, pG, pS } = params;

  let pLObserved;

  if (isCorrect) {
    // P(L | correct) = (P(L) * (1 - P(S))) / ( P(L) * (1 - P(S)) + (1 - P(L)) * P(G) )
    const numerator = prevPL * (1 - pS);
    const denominator = numerator + (1 - prevPL) * pG;
    pLObserved = numerator / denominator;
  } else {
    // P(L | incorrect) = (P(L) * P(S)) / ( P(L) * P(S) + (1 - P(L)) * (1 - P(G)) )
    const numerator = prevPL * pS;
    const denominator = numerator + (1 - prevPL) * (1 - pG);
    pLObserved = numerator / denominator;
  }

  // P(L)_next = P(L|obs) + (1 - P(L|obs)) * P(T)
  const newPL = pLObserved + (1 - pLObserved) * pT;

  return Math.min(Math.max(newPL, 0.01), 0.999); // Bound the probability safely
};
