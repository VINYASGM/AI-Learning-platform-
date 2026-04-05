import { GoogleGenAI, Type, Schema } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Script usage: 
 * npx tsx src/scripts/ingestCurriculum.ts path/to/syllabus.txt
 */

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Please set GEMINI_API_KEY environment variable.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function ingest() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx ingestCurriculum.ts <path-to-syllabus>");
    process.exit(1);
  }

  const absolutePath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');

  console.log("Analyzing syllabus and building Knowledge Graph...");

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Extract a structural curriculum ontology from the following syllabus text.
    Return a list of CurriculumNodes. Each node MUST have 'id' (string, e.g. domain-math, topic-algebra, sub-linear), 
    'label' (string), 'type' (domain, topic, or subtopic), and 'prerequisites' (array of ids).
    
    SYLLABUS TEXT:
    ${content}`,
    config: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            label: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['domain', 'topic', 'subtopic'] },
            prerequisites: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ['id', 'label', 'type', 'prerequisites']
        }
      } as Schema
    }
  });

  const parsedGraph = response.text;
  
  if (parsedGraph) {
    const outPath = path.resolve(process.cwd(), 'src/services/GeneratedCurriculum.json');
    fs.writeFileSync(outPath, parsedGraph);
    console.log(`Knowledge Graph successfully generated and saved to ${outPath}`);
  } else {
    console.error("Failed to generate content.");
  }
}

ingest().catch(console.error);
