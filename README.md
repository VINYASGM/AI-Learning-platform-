# Lumina AI Tutor

Lumina is a research-grade, highly adaptive lifelong AI tutoring platform. It moves beyond conventional scripted bots by integrating Bayesian Knowledge Tracing, Reinforcement Learning (Bandits), Spaced Repetition, and deterministic tool architectures to model student cognition and optimize long-term skill acquisition.

## 🚀 Core Features

- **Bayesian Knowledge Tracing (BKT)**: The system mathematically maps your mastery probability over a Curriculum Graph. It continually adjusts $P(L)$ based on how accurately you answer the LLM's Socratic questions.
- **Epsilon-Greedy Pedagogy Bandits**: Lumina doesn't just teach one way. It cycles through `Visual Analogies`, `Socratic Questioning`, and `Direct Instruction`. By scoring which variant yields the highest conceptual success rate, it actively morphs its teaching structure to fit your unique brain.
- **Adaptive Spaced Repetition Scheduler**: Sequential learning is dead. When topics decay past semantic retention thresholds (e.g., 24 hours), Lumina pauses linear progress to explicitly detour into review checkpoints.
- **Deterministic Hallucination Guardrails**: Math equations are explicitly evaluated using sandboxed JavaScript context injection via LLM Tool calling, guaranteeing empirical factual grounding.
- **Teacher Syllabus Ingestion Pipeline**: Contains a Node script capable of scraping unstructured `.txt` syllabuses and turning them into mapped JSON `CurriculumNode` trees via Gemini.

## ⚙️ Tech Stack

- **React + TypeScript + Vite**: Lightning-fast local development and strict state typings.
- **@google/genai**: Integration with Gemini 2.5 Flash for state-of-the-art context distillation, streaming, and deterministic function calling.
- **Tailwind CSS + motion/react**: Highly polished, modern premium UX featuring seamless DOM transitions.
- **@xyflow/react**: Interactive curriculum tree visualizations mapping node states securely to BKT probabilities.

## 📦 Local Installation

To run Lumina locally, you will need Node.js and a Gemini API key.

1. Clone or download the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set your environment variables by creating `.env.local`:
   ```bash
   VITE_GEMINI_API_KEY="your-gemini-key-here"
   GEMINI_API_KEY="your-gemini-key-here"
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## 🛠 Script Tooling
Teachers can automatically ingest text documents and convert them into curriculum trees.
```bash
npx tsx src/scripts/ingestCurriculum.ts /path/to/syllabus.txt
```

---
*Built with React, Gemini, and Learning Sciences.*
