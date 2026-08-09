export const DIAGNOSIS_TYPES = [
  'concept_gap',
  'misread',
  'memory_gap',
  'calculation_error',
  'expression_gap',
  'unknown',
] as const

export const OPTION_VERDICTS = ['correct', 'incorrect', 'not_applicable'] as const

export type DiagnosisType = typeof DIAGNOSIS_TYPES[number]
export type OptionVerdict = typeof OPTION_VERDICTS[number]
export type EvidenceSufficiency = 'adequate' | 'limited'
export type EvidenceKind = 'question' | 'subject' | 'chapter' | 'flashcard' | 'other'

export interface StudyEvidence {
  id: string
  kind: EvidenceKind
  title: string
  content: string
  sourceUrl?: string | null
}

export interface StudyQuestion {
  type: string
  content: string
  options?: Array<{ key: string; value: string }> | null
  correctAnswer: string
  existingExplanation?: string | null
}

export interface StudyLearnerState {
  userAnswer: string
  isCorrect?: boolean
  historicalWrongCount?: number | null
  recentSubjectAccuracy?: number | null
}

export interface StudyExplanationInput {
  question: StudyQuestion
  learner: StudyLearnerState
  evidence: StudyEvidence[]
  evidenceSufficiency: EvidenceSufficiency
  locale?: string
}

export interface StudyExplanation {
  summary: string
  diagnosis: {
    type: DiagnosisType
    detail: string
  }
  keyPoints: string[]
  optionAnalysis: Array<{
    option: string
    verdict: OptionVerdict
    reason: string
  }>
  nextActions: string[]
  evidenceIds: string[]
  uncertainty: string | null
}

export interface StudyExplanationPrompts {
  systemPrompt: string
  userPrompt: string
}

export interface StudyExplainerProviderRequest extends StudyExplanationPrompts {
  maxTokens?: number
}

export interface StudyExplainerProviderResponse {
  text: string
  model: string
}

export interface StudyExplainerProvider {
  generate(request: StudyExplainerProviderRequest): Promise<StudyExplainerProviderResponse>
}

export type ParseFailureReason =
  | 'empty_output'
  | 'invalid_json'
  | 'invalid_structure'
  | 'invalid_evidence'

export type ParseStudyExplanationResult =
  | { ok: true; value: StudyExplanation }
  | {
      ok: false
      reason: ParseFailureReason
      issues: string[]
      invalidEvidenceIds?: string[]
    }

export interface StudyExplanationEvaluation {
  passed: boolean
  score: number
  checks: {
    structure: boolean
    validEvidence: boolean
    hasKeyPoints: boolean
    hasActionableNextActions: boolean
    uncertaintyBoundary: boolean
  }
  failureReasons: string[]
}

export type ExplainStudyAnswerResult =
  | {
      ok: true
      explanation: StudyExplanation
      evaluation: StudyExplanationEvaluation
      model: string
      rawTextLength: number
    }
  | {
      ok: false
      reason: ParseFailureReason | 'model_error' | 'insufficient_grounding'
      model?: string
      issues: string[]
      invalidEvidenceIds?: string[]
      evaluation?: StudyExplanationEvaluation
      errorMessage?: string
      rawTextLength?: number
    }
