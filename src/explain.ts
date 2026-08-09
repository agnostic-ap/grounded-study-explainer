import { evaluateStudyExplanation } from './evaluator.js'
import { buildStudyExplanationPrompt } from './prompt.js'
import type {
  ExplainStudyAnswerResult,
  StudyExplanationInput,
  StudyExplainerProvider,
} from './types.js'
import { parseStudyExplanation } from './validation.js'

export async function explainStudyAnswer(
  input: StudyExplanationInput,
  provider: StudyExplainerProvider,
  options: { maxTokens?: number } = {},
): Promise<ExplainStudyAnswerResult> {
  const prompts = buildStudyExplanationPrompt(input)
  let response: Awaited<ReturnType<StudyExplainerProvider['generate']>>
  try {
    response = await provider.generate({ ...prompts, maxTokens: options.maxTokens })
  } catch (error) {
    return {
      ok: false,
      reason: 'model_error',
      issues: ['provider generation failed'],
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  }

  const allowedEvidenceIds = input.evidence.map(item => item.id)
  const parsed = parseStudyExplanation(response.text, allowedEvidenceIds)
  if (!parsed.ok) {
    return {
      ...parsed,
      model: response.model,
      rawTextLength: response.text.length,
    }
  }

  const evaluation = evaluateStudyExplanation(parsed.value, {
    allowedEvidenceIds,
    requireUncertainty: input.evidenceSufficiency === 'limited',
  })
  if (!evaluation.passed) {
    return {
      ok: false,
      reason: 'insufficient_grounding',
      model: response.model,
      issues: evaluation.failureReasons,
      evaluation,
      rawTextLength: response.text.length,
    }
  }

  return {
    ok: true,
    explanation: parsed.value,
    evaluation,
    model: response.model,
    rawTextLength: response.text.length,
  }
}
