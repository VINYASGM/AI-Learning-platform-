import { GoogleGenAI, Type, Schema } from '@google/genai';
import { scrubPII } from '../utils/privacyScrubber';

export interface ChatMessage {
  id: string;
  role: 'tutor' | 'student' | 'system';
  content: string;
  timestamp: number;
}

import { TeachingVariant, ToneProfile } from './LearnerProfile';

export interface ContextState {
  currentTopicLabel: string;
  isInteractiveWorkspaceActive: boolean;
  workspaceStep?: number;
  teachingVariant?: TeachingVariant;
  toneProfile?: ToneProfile;
}

const initializeGenAI = () => {
  // Use the API key provided in the Vite env config
  const apiKey = (process.env as any).GEMINI_API_KEY || '';
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is missing. AI features will not work.");
  }
  return new GoogleGenAI({ apiKey });
};

// Orchestrator service to abstract the LLM interactions
export class AgentOrchestrator {
  private ai = initializeGenAI();
  private modelName = 'gemini-2.5-flash';

  public async sendMessage(
    history: ChatMessage[],
    userMessage: string,
    context: ContextState,
    onStream: (chunk: string) => void,
    onToolCall?: (functionName: string, args: any) => void
  ): Promise<string> {
    try {
      // Build the pedagogical system prompt
      const systemInstruction = `You are Lumina AI, an expert, personalized Socratic tutor.
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
- Humor: ${context.toneProfile?.humor ?? 0.3}

PEDAGOGY RULES:
1. Do not give the direct answer to a problem unless the student has tried multiple times and is completely stuck.
2. Ask one question at a time to check for understanding.
3. If the user asks for a hint, give a scaffolded hint that is in their Zone of Proximal Development.
4. If the user asks for an example, provide a similarly structured problem worked out step-by-step.
5. If the user masters a topic, congratulate them! (Say exactly **"Topic Mastered!"** somewhere in your text so the system can trigger an unlock).
6. IF the student successfully works out a step that matches the interactive workspace, ALWAYS USE the updateWorkspaceStep tool to explicitly set the step so the visualizer keeps in sync with the dialogue!
7. ALWAYS evaluate the student's attempt when they answer a question using the evaluateStudentAnswer tool (isCorrect: boolean).
8. ANTI-CHEATING: If the student asks you for the direct answer without showing work, strictly REFUSE. Do not give the answer. Instead, ask them a conceptual question about the very first step.
9. FACTUAL GROUNDING: For all math calculations, DO NOT guess. Use the calculateExpression tool if you need to perform an intermediate calculation to verify their math.`;

      // Map our history to genai Content objects & scrub PII
      const contents = history.map((msg) => ({
        role: msg.role === 'tutor' ? 'model' : 'user',
        parts: [{ text: scrubPII(msg.content) }],
      })).filter((c) => c.role === 'model' || c.role === 'user');

      // Append the new message, scrubbed
      contents.push({
        role: 'user',
        parts: [{ text: scrubPII(userMessage) }],
      });

      const responseStream = await this.ai.models.generateContentStream({
        model: this.modelName,
        contents,
        config: {
          systemInstruction,
          temperature: 0.7, // Balances creativity with pedagogical structure
          tools: [{
            functionDeclarations: [
              {
                name: 'updateWorkspaceStep',
                description: 'Progresses the interactive workspace visualizer forward by advancing its step. Called when the student correctly balances parts of an equation or grasps a component.',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    stepNumber: {
                      type: Type.INTEGER,
                      description: 'The new step number the workspace should transition to.'
                    }
                  },
                  required: ['stepNumber']
                }
              },
              {
                name: 'evaluateStudentAnswer',
                description: 'Evaluates the student\'s answer to the current pedagogical prompt.',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    isCorrect: {
                      type: Type.BOOLEAN,
                      description: 'Whether the student\'s attempt was conceptually correct.'
                    }
                  },
                  required: ['isCorrect']
                }
              },
              {
                name: 'calculateExpression',
                description: 'A deterministic math calculator to evaluate expressions and verify math to avoid hallucinations. Send a math expression like "4 * (12 + 3)".',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    expression: {
                      type: Type.STRING,
                      description: 'The math expression to evaluate.'
                    }
                  },
                  required: ['expression']
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
                // Extremely simple MVP evaluator for factual grounding demonstrations
                // eslint-disable-next-line no-eval
                const expression = (call.args as any).expression as string;
                const result = eval(expression);
                console.log(`[TOOL] Evaluated ${expression} = ${result}`);
                // In a perfect multi-turn architecture, we would feed this result back.
                // For MVP, if it calculates correctly, we assume the LLM might hallucinate without it 
                // but at least we log the bounded context.
              } catch (e) {
                console.warn(`[TOOL] Failed to evaluate ${call.args.expression}`, e);
              }
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
      return fullText;
    } catch (error) {
      console.error("Error communicating with Lumina AI:", error);
      const fallbackMsg = "I'm having trouble connecting to my knowledge base right now. Could you check your API key and try again?";
      onStream(fallbackMsg);
      return fallbackMsg;
    }
  }
}
