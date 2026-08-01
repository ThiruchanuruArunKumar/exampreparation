# AI and Insights

## Purpose
The app uses AI to assist with exam generation and post-exam feedback.

## Main capabilities
- Generate exam questions from notes, prompts, or uploaded content
- Extract questions from uploaded material
- Generate answer explanations or answer-book content
- Produce student feedback and insight summaries

## Implementation notes
- The AI gateway is centralized in [../../src/lib/ai-gateway.server.ts](../../src/lib/ai-gateway.server.ts).
- The question source UI in [../../src/components/QuestionSource.tsx](../../src/components/QuestionSource.tsx) connects to these flows.
- LaTeX repair helpers improve content before it is displayed or evaluated.
