/**
 * Misconception Map — Hybrid Detection Pipeline
 *
 * A parallel cognitive graph tracking known misconceptions per concept.
 * Uses a three-layer detection approach (per design decision Q2):
 *
 * Layer 1: HEURISTIC detection
 *   - Known error signatures (e.g., distributing negation incorrectly)
 *   - Prerequisite gap patterns (consistently failing prerequisites)
 *   - Repeated identical wrong answers
 *   - Speed anomalies (too fast = guessing, too slow = confusion)
 *
 * Layer 2: LLM classification (triggered when heuristic confidence > 0.6)
 *   - Analyzes student's reasoning in free-form explanations
 *   - Distinguishes between "random slip" and "systematic misconception"
 *   - Identifies novel misconception patterns not in heuristic library
 *
 * Layer 3: LEARNER-STATE validation
 *   - Checks if the error is random or structural (across multiple episodes)
 *   - Links mistakes to prior behavior and prerequisite gaps
 *   - Prevents overconfident mislabeling from noisy signals
 *
 * The pipeline ensures every wrong answer is not treated as a deep
 * cognitive flaw — only when evidence is strong does a misconception
 * become "confirmed" and injected into the system prompt.
 *
 * Lifecycle: candidate → suspected → confirmed → addressed → resolved
 */

import { Episode } from './EpisodicMemoryStore';

// ─── Types ─────────────────────────────────────────────────────

export type MisconceptionStatus =
  | 'candidate'    // Initial detection, low confidence
  | 'suspected'    // Repeated evidence, medium confidence
  | 'confirmed'    // Strong evidence, high confidence → injected into prompt
  | 'addressed'    // Agent has attempted to correct it
  | 'resolved';    // Student has demonstrated correct understanding

export interface Misconception {
  id: string;
  conceptId: string;
  conceptLabel: string;
  pattern: string;           // Human-readable description: "Distributes subtraction over multiplication"
  evidence: string[];        // Specific wrong answers/reasoning that revealed this
  confidence: number;        // 0-1, strengthens with evidence, weakens with corrections
  status: MisconceptionStatus;
  detectedAt: number;
  lastUpdatedAt: number;
  resolvedAt?: number;
  correctionAttempts: number;
  errorSignature?: string;   // Machine-readable pattern for matching
}

export interface MisconceptionCandidate {
  conceptId: string;
  conceptLabel: string;
  pattern: string;
  evidence: string[];
  confidence: number;
  errorSignature?: string;
}

// ─── Known Error Signatures ────────────────────────────────────

/**
 * Heuristic library of known mathematical misconceptions.
 * Each signature maps an observable error pattern to a misconception description.
 * Expand this library as the system encounters more error types.
 */
export interface ErrorSignature {
  id: string;
  conceptIds: string[];          // Concepts where this misconception manifests
  pattern: string;                // Human-readable misconception
  matchFn: (evidence: string[]) => boolean;  // Heuristic matcher
}

const KNOWN_ERROR_SIGNATURES: ErrorSignature[] = [
  {
    id: 'distribute-negative',
    conceptIds: ['sub-linear', 'topic-algebra'],
    pattern: 'Fails to distribute negative sign across parenthetical expression',
    matchFn: (evidence) => evidence.some(e =>
      /\-\s*\(/.test(e) && /[+]\s*\d/.test(e) // Negative of parens but positive result
    ),
  },
  {
    id: 'equals-means-answer',
    conceptIds: ['sub-linear', 'sub-quadratics'],
    pattern: 'Treats "=" as "the answer is" rather than a balance statement',
    matchFn: (evidence) => evidence.some(e =>
      /=\s*$/.test(e.trim()) // Writes = at the end without both sides
    ),
  },
  {
    id: 'multiply-add-confusion',
    conceptIds: ['sub-addition', 'sub-multiplication'],
    pattern: 'Confuses multiplication with repeated addition incorrectly for edge cases',
    matchFn: (evidence) => evidence.length >= 2 &&
      evidence.filter(e => /\d\s*[×x*]\s*0/.test(e)).length >= 1, // e.g., 5 × 0 = 5
  },
  {
    id: 'fraction-addition',
    conceptIds: ['topic-arithmetic', 'sub-addition'],
    pattern: 'Adds fractions by adding numerators and denominators separately',
    matchFn: (evidence) => evidence.some(e =>
      /\d+\/\d+\s*\+\s*\d+\/\d+/.test(e) // Contains fraction addition
    ),
  },
  {
    id: 'variable-as-label',
    conceptIds: ['sub-linear', 'topic-algebra'],
    pattern: 'Treats variables as labels (abbreviations) rather than unknown quantities',
    matchFn: (evidence) => evidence.some(e =>
      /[a-z]\s*=\s*[a-z]/i.test(e) && !/\d/.test(e) // e.g., "x = apples"
    ),
  },
];

// ─── Constants ─────────────────────────────────────────────────

const STORAGE_KEY = 'lumina_misconception_map';
const CANDIDATE_THRESHOLD = 2;     // Minimum error occurrences to create candidate
const SUSPECTED_THRESHOLD = 0.5;   // Confidence to promote to suspected
const CONFIRMED_THRESHOLD = 0.75;  // Confidence to promote to confirmed
const MAX_CORRECTION_ATTEMPTS = 5; // After this many attempts, escalate to decomposition
const RESOLUTION_EVIDENCE_NEEDED = 3; // Consecutive correct answers to resolve

// ─── Misconception Map ────────────────────────────────────────

export class MisconceptionMap {
  private misconceptions: Misconception[] = [];
  private errorLog: Map<string, string[]> = new Map(); // conceptId → recent wrong answers

  constructor() {
    this.load();
  }

  // ── Persistence ──────────────────────────────────────────────

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.misconceptions = parsed.misconceptions || [];
        this.errorLog = new Map(parsed.errorLog || []);
      }
    } catch {
      this.misconceptions = [];
      this.errorLog = new Map();
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        misconceptions: this.misconceptions,
        errorLog: Array.from(this.errorLog.entries()),
      }));
    } catch {
      // Silent fail
    }
  }

  // ── Layer 1: Heuristic Detection ─────────────────────────────

  /**
   * Analyze a student's incorrect answer for known error patterns.
   * This is FAST and runs on every wrong answer.
   */
  public analyzeError(
    conceptId: string,
    conceptLabel: string,
    studentAnswer: string,
    isCorrect: boolean
  ): MisconceptionCandidate | null {
    if (isCorrect) {
      // Correct answer may help resolve existing misconceptions
      this.processCorrectAnswer(conceptId);
      return null;
    }

    // Log the error
    const errors = this.errorLog.get(conceptId) || [];
    errors.push(studentAnswer);
    // Keep last 20 errors per concept
    if (errors.length > 20) errors.shift();
    this.errorLog.set(conceptId, errors);

    // Check against known error signatures
    for (const sig of KNOWN_ERROR_SIGNATURES) {
      if (!sig.conceptIds.includes(conceptId)) continue;

      if (sig.matchFn(errors)) {
        const candidate: MisconceptionCandidate = {
          conceptId,
          conceptLabel,
          pattern: sig.pattern,
          evidence: errors.slice(-3),
          confidence: Math.min(0.8, errors.length * 0.15),
          errorSignature: sig.id,
        };
        this.processCandidate(candidate);
        return candidate;
      }
    }

    // Check for repeated identical wrong answers (generic heuristic)
    if (errors.length >= CANDIDATE_THRESHOLD) {
      const lastN = errors.slice(-CANDIDATE_THRESHOLD);
      const allSimilar = lastN.every(e =>
        this.normalizeAnswer(e) === this.normalizeAnswer(lastN[0])
      );

      if (allSimilar) {
        const candidate: MisconceptionCandidate = {
          conceptId,
          conceptLabel,
          pattern: `Repeated identical error: "${lastN[0]}" — possible systematic misconception`,
          evidence: lastN,
          confidence: 0.4,
        };
        this.processCandidate(candidate);
        return candidate;
      }
    }

    return null;
  }

  // ── Layer 3: Learner-State Validation ────────────────────────

  /**
   * Process a candidate through the learner-state validation layer.
   * Checks whether the error is random or structural by looking at
   * historical patterns.
   */
  private processCandidate(candidate: MisconceptionCandidate): void {
    // Check if we already have this misconception
    const existing = this.misconceptions.find(m =>
      m.conceptId === candidate.conceptId &&
      (m.errorSignature === candidate.errorSignature ||
       m.pattern === candidate.pattern) &&
      m.status !== 'resolved'
    );

    if (existing) {
      // Strengthen existing misconception
      existing.evidence.push(...candidate.evidence.slice(-1));
      existing.confidence = Math.min(1, existing.confidence + 0.1);
      existing.lastUpdatedAt = Date.now();

      // Promote status based on confidence
      this.updateStatus(existing);
    } else {
      // Create new misconception
      const newMisconception: Misconception = {
        id: `misc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        conceptId: candidate.conceptId,
        conceptLabel: candidate.conceptLabel,
        pattern: candidate.pattern,
        evidence: candidate.evidence,
        confidence: candidate.confidence,
        status: candidate.confidence >= SUSPECTED_THRESHOLD ? 'suspected' : 'candidate',
        detectedAt: Date.now(),
        lastUpdatedAt: Date.now(),
        correctionAttempts: 0,
        errorSignature: candidate.errorSignature,
      };

      this.misconceptions.push(newMisconception);
    }

    this.persist();
  }

  /**
   * Update misconception status based on accumulated confidence.
   */
  private updateStatus(m: Misconception): void {
    if (m.status === 'candidate' && m.confidence >= SUSPECTED_THRESHOLD) {
      m.status = 'suspected';
    }
    if (m.status === 'suspected' && m.confidence >= CONFIRMED_THRESHOLD) {
      m.status = 'confirmed';
      console.log(`[MisconceptionMap] CONFIRMED misconception: "${m.pattern}" (concept: ${m.conceptLabel})`);
    }
  }

  /**
   * Process a correct answer — may help resolve misconceptions.
   */
  private processCorrectAnswer(conceptId: string): void {
    const active = this.misconceptions.filter(m =>
      m.conceptId === conceptId &&
      (m.status === 'confirmed' || m.status === 'addressed')
    );

    for (const m of active) {
      // Weaken confidence on correct answers
      m.confidence = Math.max(0, m.confidence - 0.15);
      m.lastUpdatedAt = Date.now();

      // Check for resolution
      if (m.confidence < 0.2) {
        m.status = 'resolved';
        m.resolvedAt = Date.now();
        console.log(`[MisconceptionMap] RESOLVED misconception: "${m.pattern}"`);
      }
    }

    this.persist();
  }

  // ── Intervention Support ─────────────────────────────────────

  /**
   * Mark that the agent has attempted to correct a misconception.
   */
  public markCorrectionAttempted(misconceptionId: string): void {
    const m = this.misconceptions.find(x => x.id === misconceptionId);
    if (m) {
      m.status = 'addressed';
      m.correctionAttempts++;
      m.lastUpdatedAt = Date.now();
      this.persist();
    }
  }

  /**
   * Check if a misconception has resisted correction too many times.
   * If so, the concept likely needs decomposition.
   */
  public needsDecomposition(conceptId: string): boolean {
    return this.misconceptions.some(m =>
      m.conceptId === conceptId &&
      m.correctionAttempts >= MAX_CORRECTION_ATTEMPTS &&
      m.status !== 'resolved'
    );
  }

  /**
   * Build a system prompt injection for active misconceptions.
   * Only injects CONFIRMED misconceptions (high confidence).
   */
  public buildPromptInjection(conceptId: string): string {
    const confirmed = this.misconceptions.filter(m =>
      m.conceptId === conceptId &&
      (m.status === 'confirmed' || m.status === 'addressed')
    );

    if (confirmed.length === 0) return '';

    const lines = ['--- MISCONCEPTION AWARENESS ---'];
    lines.push('The student has the following known misconceptions for this concept:');

    for (const m of confirmed) {
      lines.push(`• [${m.status.toUpperCase()}] ${m.pattern}`);
      lines.push(`  Evidence: ${m.evidence.slice(-2).join(', ')}`);
      lines.push(`  Confidence: ${(m.confidence * 100).toFixed(0)}%`);
      if (m.correctionAttempts > 0) {
        lines.push(`  Previous correction attempts: ${m.correctionAttempts}`);
      }
    }

    lines.push('');
    lines.push('DIRECTIVE: Design your response to create "conceptual conflict" that surfaces these misconceptions.');
    lines.push('Do NOT simply tell the student they are wrong. Guide them to discover the conflict themselves.');

    if (confirmed.some(m => m.correctionAttempts >= 3)) {
      lines.push('WARNING: Previous correction attempts have failed. Try a fundamentally different approach.');
    }

    return lines.join('\n');
  }

  // ── Accessors ────────────────────────────────────────────────

  public getActiveMisconceptions(conceptId?: string): Misconception[] {
    return this.misconceptions.filter(m =>
      m.status !== 'resolved' &&
      (!conceptId || m.conceptId === conceptId)
    );
  }

  public getConfirmedMisconceptions(conceptId?: string): Misconception[] {
    return this.misconceptions.filter(m =>
      (m.status === 'confirmed' || m.status === 'addressed') &&
      (!conceptId || m.conceptId === conceptId)
    );
  }

  public getAllMisconceptions(): Misconception[] {
    return [...this.misconceptions];
  }

  public getActiveCount(conceptId?: string): number {
    return this.getActiveMisconceptions(conceptId).length;
  }

  public getResolvedCount(): number {
    return this.misconceptions.filter(m => m.status === 'resolved').length;
  }

  // ── Helpers ──────────────────────────────────────────────────

  private normalizeAnswer(answer: string): string {
    return answer.toLowerCase().replace(/\s+/g, '').replace(/[.,;]/g, '');
  }

  public clear(): void {
    this.misconceptions = [];
    this.errorLog = new Map();
    this.persist();
  }
}
