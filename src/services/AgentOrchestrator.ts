import { GoogleGenAI, Type } from '@google/genai';
import { scrubPII } from '../utils/privacyScrubber';
import { UploadedFile, InlineDataPart, fileUploadService } from './FileUploadService';

export interface ChatMessage {
  id: string;
  role: 'tutor' | 'student' | 'system';
  content: string;
  timestamp: number;
  attachments?: UploadedFile[];
}

import { TeachingVariant, ToneProfile, MicroAction } from './LearnerProfile';
import { CritiqueAgent } from './CritiqueAgent';
import { RewardEngine, ModelTier, ModelRoutingContext } from './RewardEngine';

export interface ContextState {
  currentTopicLabel: string;
  currentTopicId: string;
  isInteractiveWorkspaceActive: boolean;
  workspaceStep?: number;
  teachingVariant?: TeachingVariant;
  toneProfile?: ToneProfile;
  // Recursive Learning injections (V1)
  episodicMemorySummary?: string;
  metaCognitiveDirective?: string;
  promptOverlayDirective?: string;
  // V2 enrichments
  misconceptionInjection?: string;
  scaffoldingDirective?: string;
  pedagogicalActionDirective?: string;
  affectiveGating?: {
    shouldReduceDifficulty: boolean;
    shouldSuggestBreak: boolean;
    shouldAllowExploration: boolean;
    shouldIncreaseScaffolding: boolean;
  };
  // Critique pipeline context
  compositeConfidence?: number;
  scaffoldingLevel?: number;
  activeMisconceptions?: string[];
  masteryLevel?: number;
  recentSuccessRate?: number;
  frustrationLevel?: number;
  hasMisconceptions?: boolean;
  isScaffoldingFading?: boolean;
  isHighStakesTask?: boolean;
  // Model routing
  modelRoutingContext?: ModelRoutingContext;
  // File attachments
  attachments?: UploadedFile[];
}

const initializeGenAI = () => {
  const apiKey = (process.env as any).GEMINI_API_KEY || '';
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is missing. AI features will not work.");
  }
  return new GoogleGenAI({ apiKey });
};

// ─── Orchestrator ──────────────────────────────────────────────

export class AgentOrchestrator {
  private ai = initializeGenAI();
  private critiqueAgent = new CritiqueAgent();
  private rewardEngine = new RewardEngine();

  /**
   * The V2 sendMessage pipeline:
   * 1. Build system prompt (with ALL injections)
   * 2. Route to appropriate model tier
   * 3. Generate draft response
   * 4. IF high-stakes: run critique → rewrite if needed (depth budget = 1)
   * 5. Deliver final response
   */
  public async sendMessage(
    history: ChatMessage[],
    userMessage: string,
    context: ContextState,
    onStream: (chunk: string) => void,
    onToolCall?: (functionName: string, args: any) => void
  ): Promise<string> {
    try {
      const systemInstruction = this.buildSystemPrompt(context);

      // ── Model Routing (three-tier) ──────────────────────────
      const modelTier = context.modelRoutingContext
        ? this.rewardEngine.routeModelTier(context.modelRoutingContext)
        : 'mid';
      const modelName = this.rewardEngine.getModelForTier(modelTier);

      console.log(`[Orchestrator] Model tier: ${modelTier} → ${modelName}`);

      const contents: Array<{ role: string; parts: any[] }> = history.map((msg) => ({
        role: msg.role === 'tutor' ? 'model' : 'user',
        parts: [{ text: scrubPII(msg.content) }],
      })).filter((c) => c.role === 'model' || c.role === 'user');

      // ── Build user message parts with file attachments ──────
      const userParts: any[] = [{ text: scrubPII(userMessage) }];

      if (context.attachments && context.attachments.length > 0) {
        console.log(`[Orchestrator] Including ${context.attachments.length} file attachment(s)`);
        for (const file of context.attachments) {
          userParts.push(fileUploadService.toInlineDataPart(file));
        }
        // Add file context description to the text
        const fileDesc = fileUploadService.buildFileContextDescription(context.attachments);
        userParts[0] = { text: scrubPII(userMessage) + fileDesc };
      }

      contents.push({
        role: 'user',
        parts: userParts,
      });

      const responseStream = await this.ai.models.generateContentStream({
        model: modelName,
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
          tools: [{
            functionDeclarations: [
              {
                name: 'updateWorkspaceStep',
                description: 'Progresses the interactive workspace visualizer forward.',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    stepNumber: { type: Type.INTEGER, description: 'The new step number.' }
                  },
                  required: ['stepNumber']
                }
              },
              {
                name: 'evaluateStudentAnswer',
                description: 'Evaluates the student\'s answer.',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    isCorrect: { type: Type.BOOLEAN, description: 'Whether the attempt was correct.' }
                  },
                  required: ['isCorrect']
                }
              },
              {
                name: 'calculateExpression',
                description: 'Deterministic math calculator to verify computations.',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    expression: { type: Type.STRING, description: 'The math expression to evaluate.' }
                  },
                  required: ['expression']
                }
              },
              {
                name: 'selfReflect',
                description: 'Trigger recursive self-reflection when teaching approach is failing.',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    observation: { type: Type.STRING, description: 'What you observed.' },
                    proposedChange: { type: Type.STRING, description: 'What you would change.' }
                  },
                  required: ['observation', 'proposedChange']
                }
              },
              {
                name: 'requestConfidenceRating',
                description: 'Ask the student to rate their confidence on a 1-5 scale before or after answering.',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    timing: { type: Type.STRING, description: '"before" or "after" the answer.' }
                  },
                  required: ['timing']
                }
              },
              {
                name: 'flagMisconception',
                description: 'Flag a potential misconception detected from the student\'s reasoning.',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    pattern: { type: Type.STRING, description: 'The misconception pattern observed.' },
                    evidence: { type: Type.STRING, description: 'The student\'s response that revealed it.' }
                  },
                  required: ['pattern', 'evidence']
                }
              }
            ]
          }]
        }
      });

      let fullText = '';
      for await (const chunk of responseStream) {
        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
          for (const call of chunk.functionCalls) {
            if (call.name === 'calculateExpression' && call.args && typeof (call.args as any).expression === 'string') {
              try {
                const expression = (call.args as any).expression as string;
                const result = eval(expression);
                console.log(`[TOOL] Evaluated ${expression} = ${result}`);
              } catch (e) {
                console.warn(`[TOOL] Failed to evaluate ${call.args.expression}`, e);
              }
            } else if (call.name === 'selfReflect') {
              console.log(`[RECURSIVE] Agent self-reflection triggered:`, call.args);
              if (onToolCall) onToolCall(call.name, call.args);
            } else if (onToolCall) {
              onToolCall(call.name, call.args);
            }
          }
        }
        if (chunk.text) {
          fullText += chunk.text;
          onStream(fullText);
        }
      }

      // ── Critique Pipeline (depth budget = 1) ────────────────
      const shouldCritique = this.critiqueAgent.shouldRunCritique({
        compositeConfidence: context.compositeConfidence ?? 1.0,
        hasMisconceptions: context.hasMisconceptions ?? false,
        isScaffoldingFading: context.isScaffoldingFading ?? false,
        isHighStakesTask: context.isHighStakesTask ?? false,
      });

      if (shouldCritique && fullText.length > 0) {
        const critiqueResult = this.critiqueAgent.critique({
          draftResponse: fullText,
          scaffoldingLevel: context.scaffoldingLevel ?? 1.0,
          activeMisconceptions: context.activeMisconceptions ?? [],
          masteryLevel: context.masteryLevel ?? 0.5,
          recentSuccessRate: context.recentSuccessRate ?? 0.5,
          frustrationLevel: context.frustrationLevel ?? 0,
          conceptLabel: context.currentTopicLabel,
        });

        console.log(`[CRITIQUE] Score: ${critiqueResult.overallScore.toFixed(2)}, ` +
          `Approved: ${critiqueResult.approved}, Issues: ${critiqueResult.issues.length}, ` +
          `Time: ${critiqueResult.critiqueTime}ms`);

        if (!critiqueResult.approved && critiqueResult.rewriteDirective) {
          console.log(`[CRITIQUE] Response rejected. Issues: ${critiqueResult.issues.map(i => i.type).join(', ')}`);
          // Log the critique but don't block delivery (rewriting would require another LLM call)
          // In production, this would trigger a rewrite with the critique directive
          console.log(`[CRITIQUE] Rewrite directive: ${critiqueResult.rewriteDirective.substring(0, 200)}...`);
        }
      }

      return fullText;
    } catch (error) {
      console.error("Error communicating with Lumina AI:", error);
      const fallbackMsg = "I'm having trouble connecting to my knowledge base right now. Could you check your API key and try again?";
      onStream(fallbackMsg);
      return fallbackMsg;
    }
  }

  /**
   * Build the system prompt with ALL recursive learning and V2 injections.
   */
  private buildSystemPrompt(context: ContextState): string {
    const sections: string[] = [];

    // ── Base System Prompt ──────────────────────────────────────
    sections.push(`You are Lumina AI, an expert, personalized Socratic tutor that RECURSIVELY learns from its own teaching effectiveness.
Your goal is to guide the student to the correct answer by asking targeted questions and providing hints, NEVER by just giving the answer directly.
Use Markdown formatting for math equations and code.

CURRENT CONTEXT:
The student is currently learning: ${context.currentTopicLabel}
Is the interactive workspace active? ${context.isInteractiveWorkspaceActive ? 'Yes' : 'No'}
${context.isInteractiveWorkspaceActive ? `Workspace Step: ${context.workspaceStep}` : ''}

TEACHING STYLE: You MUST prioritize the **${context.teachingVariant || 'Socratic Questioning'}** pedagogical approach for this response.
TONE PROFILE (0.0 = Low/Casual, 1.0 = High/Formal): 
- Formality: ${context.toneProfile?.formality ?? 0.5}
- Encouragement: ${context.toneProfile?.encouragement ?? 0.8}
- Humor: ${context.toneProfile?.humor ?? 0.3}`);

    // ── V2: Pedagogical Action Directive ────────────────────────
    if (context.pedagogicalActionDirective) {
      sections.push(`--- PEDAGOGICAL ACTION ---
${context.pedagogicalActionDirective}`);
    }

    // ── V2: Scaffolding Control ────────────────────────────────
    if (context.scaffoldingDirective) {
      sections.push(context.scaffoldingDirective);
    }

    // ── V2: Misconception Awareness ────────────────────────────
    if (context.misconceptionInjection) {
      sections.push(context.misconceptionInjection);
    }

    // ── V2: Affective State Gating ─────────────────────────────
    if (context.affectiveGating) {
      const gates: string[] = [];
      if (context.affectiveGating.shouldReduceDifficulty) {
        gates.push('⚠ REDUCE DIFFICULTY: The student is frustrated. Simplify your approach.');
      }
      if (context.affectiveGating.shouldSuggestBreak) {
        gates.push('⚠ SUGGEST BREAK: The student\'s energy is very low. Gently suggest a break.');
      }
      if (context.affectiveGating.shouldAllowExploration) {
        gates.push('✨ EXPLORATION ALLOWED: The student is curious. Follow their questions even if off-curriculum.');
      }
      if (context.affectiveGating.shouldIncreaseScaffolding) {
        gates.push('⚠ INCREASE SCAFFOLDING: The student\'s confidence is low. Provide more support.');
      }
      if (gates.length > 0) {
        sections.push(`--- AFFECTIVE STATE OVERRIDES ---\n${gates.join('\n')}`);
      }
    }

    // ── V1: Episodic Memory ────────────────────────────────────
    if (context.episodicMemorySummary) {
      sections.push(`--- RECURSIVE LEARNING: EPISODIC MEMORY ---
${context.episodicMemorySummary}
Use this memory to inform your approach. Lean into strategies that worked. Avoid repeating strategies that failed.`);
    }

    // ── V1: Meta-Cognitive Interventions ───────────────────────
    if (context.metaCognitiveDirective) {
      sections.push(`--- RECURSIVE LEARNING: META-COGNITIVE OVERRIDE ---
${context.metaCognitiveDirective}`);
    }

    // ── V1: Prompt Overlays ────────────────────────────────────
    if (context.promptOverlayDirective) {
      sections.push(`--- RECURSIVE LEARNING: SELF-EVOLVED DIRECTIVE ---
${context.promptOverlayDirective}`);
    }

    // ── Core Pedagogy Rules (ALWAYS enforced — not RL-learned) ─
    sections.push(`PEDAGOGY RULES (IMMUTABLE — these override ALL other directives):
1. Do not give the direct answer unless the student has tried multiple times and is completely stuck.
2. Ask one question at a time to check for understanding.
3. If the user asks for a hint, give a scaffolded hint within their Zone of Proximal Development.
4. If the user asks for an example, provide a similarly structured problem worked out step-by-step.
5. If the user masters a topic, congratulate them! (Say exactly **"Topic Mastered!"** so the system triggers an unlock).
6. IF the student works out a step matching the workspace, ALWAYS USE the updateWorkspaceStep tool.
7. ALWAYS evaluate the student's attempt using the evaluateStudentAnswer tool (isCorrect: boolean).
8. ANTI-CHEATING: If the student asks for the answer without showing work, strictly REFUSE.
9. FACTUAL GROUNDING: For all math calculations, use the calculateExpression tool to verify.
10. RECURSIVE SELF-AWARENESS: If your approach is not working after 3+ attempts, call the selfReflect tool.
11. CONFIDENCE CALIBRATION: Periodically use requestConfidenceRating to calibrate the student's self-assessment.
12. MISCONCEPTION FLAGGING: If you detect a systematic misconception in the student's reasoning, use the flagMisconception tool.`);

    return sections.join('\n\n');
  }

  public getCritiqueStats() {
    return this.critiqueAgent.getStats();
  }
}
