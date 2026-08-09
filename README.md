# grounded-study-explainer

Provider-neutral TypeScript primitives for generating, parsing, validating, and deterministically evaluating evidence-grounded study explanations.

The package solves a narrow problem: an application supplies reviewed evidence with stable IDs, a model returns a structured learning diagnosis, and the package rejects malformed output or citations outside the supplied allowlist. It has no dependency on a web framework, ORM, UI library, database, or model vendor.

## What it includes

- Typed inputs for questions, learner state, evidence, and structured explanations.
- A prompt builder that treats question text, learner answers, and evidence as untrusted data.
- JSON extraction that handles Markdown fences, nested objects, escapes, and braces inside strings.
- Runtime field, enum, length, and collection validation without external dependencies.
- Hard evidence-ID allowlisting: unknown citations fail instead of being silently removed.
- A deterministic five-check evaluator for structure, citations, key points, actionable next steps, and uncertainty boundaries.
- A small provider interface that works with any text-generation API.
- Synthetic offline fixtures and a repeatable CLI report.

## Non-goals

This package does not retrieve data, authenticate users, enforce quotas, call a specific model vendor, store logs, render UI, or claim that a model answer is factually correct. Those responsibilities belong to the host application. It also does not require vector search, agents, fine-tuning, or MCP.

## Install and build

```bash
npm install
npm test
npm run build
```

When published, install it as:

```bash
npm install @agnostic-ap/grounded-study-explainer
```

The package is currently prepared as a standalone module but is not claimed to be published until a public registry or repository URL exists.

## Basic use

```ts
import {
  explainStudyAnswer,
  type StudyExplainerProvider,
} from '@agnostic-ap/grounded-study-explainer'

const provider: StudyExplainerProvider = {
  async generate({ systemPrompt, userPrompt, maxTokens }) {
    const text = await yourModelCall({ systemPrompt, userPrompt, maxTokens })
    return { text, model: 'provider-model-version' }
  },
}

const result = await explainStudyAnswer({
  question: {
    type: 'single_choice',
    content: 'Synthetic question text',
    options: [
      { key: 'A', value: 'First option' },
      { key: 'B', value: 'Second option' },
    ],
    correctAnswer: 'A',
    existingExplanation: 'Synthetic reviewed explanation.',
  },
  learner: {
    userAnswer: 'B',
    historicalWrongCount: 2,
    recentSubjectAccuracy: 0.64,
  },
  evidence: [{
    id: 'question:demo-1',
    kind: 'question',
    title: 'Reviewed demo question',
    content: 'Synthetic evidence only.',
  }],
  evidenceSufficiency: 'adequate',
}, provider)

if (result.ok) {
  console.log(result.explanation, result.evaluation)
} else {
  console.log(result.reason) // invalid_json, invalid_evidence, model_error, ...
}
```

See [`examples/basic.ts`](./examples/basic.ts) for a complete provider stub.

## Output contract

```ts
interface StudyExplanation {
  summary: string
  diagnosis: {
    type:
      | 'concept_gap'
      | 'misread'
      | 'memory_gap'
      | 'calculation_error'
      | 'expression_gap'
      | 'unknown'
    detail: string
  }
  keyPoints: string[]
  optionAnalysis: Array<{
    option: string
    verdict: 'correct' | 'incorrect' | 'not_applicable'
    reason: string
  }>
  nextActions: string[]
  evidenceIds: string[]
  uncertainty: string | null
}
```

Validation is intentionally strict. A citation outside the host-provided allowlist returns `invalid_evidence`; it is never dropped and the remaining model output is never presented as trusted.

## Architecture

```text
Host application
  ├─ retrieves reviewed evidence and learner state
  ├─ assigns stable evidence IDs
  └─ supplies a model provider
          │
          ▼
buildStudyExplanationPrompt
  -> provider.generate
  -> extractFirstJsonObject
  -> parseStudyExplanation
  -> evidence allowlist
  -> evaluateStudyExplanation
          │
          ├─ ok: structured explanation + deterministic score
          └─ fail: typed reason, no untrusted explanation
```

The host remains responsible for showing an explicit fallback, logging latency/model/failure reason, and deciding whether the evidence is sufficient.

## Deterministic evaluation

```bash
npm run eval
```

The command writes `eval/latest-report.json`. The checked-in fixture set contains 30 synthetic samples across single choice, multiple choice, true/false, fill-in-the-blank, and short answer, including correct-answer extension, wrong-answer diagnosis, limited evidence, prompt injection, invalid JSON, invalid evidence, and missing uncertainty.

Latest local fixture run (2026-08-09):

- 30 synthetic samples: 27 expected-valid and 3 expected-rejected.
- Expected outcome accuracy: 100%.
- Expected-valid output pass rate: 100%.
- Invalid-evidence false accepts: 0.

These are deterministic core conformance results from `fixture-provider-v1`, not model quality, production success rate, or network latency. The JSON report records core-only runtime separately. Real model metrics must come from a separately executed model evaluation and must name the model and run time.

## Security and privacy

- Treat every question, answer, and evidence string as untrusted input.
- Assign evidence IDs in trusted host code; do not accept an allowlist from the browser.
- Do not expose invalid model output after a validation failure.
- Do not include private question banks, learner records, API keys, internal domains, or production configuration in public fixtures.
- Store only the operational metadata necessary for observability; raw prompts and learner content should not be copied into logs by default.

## License

MIT
