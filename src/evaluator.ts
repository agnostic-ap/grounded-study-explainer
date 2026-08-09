import { DIAGNOSIS_TYPES, OPTION_VERDICTS } from './types.js'
import type { StudyExplanation, StudyExplanationEvaluation } from './types.js'

export function evaluateStudyExplanation(
  explanation: StudyExplanation,
  options: { allowedEvidenceIds: Iterable<string>; requireUncertainty: boolean },
): StudyExplanationEvaluation {
  const allowed = new Set(options.allowedEvidenceIds)
  const structure = Boolean(
    explanation.summary.trim()
    && explanation.diagnosis.detail.trim()
    && DIAGNOSIS_TYPES.includes(explanation.diagnosis.type)
    && explanation.optionAnalysis.every(item => (
      item.option.trim()
      && item.reason.trim()
      && OPTION_VERDICTS.includes(item.verdict)
    )),
  )
  const validEvidence = explanation.evidenceIds.every(id => allowed.has(id))
    && (allowed.size === 0 || explanation.evidenceIds.length > 0)
  const hasKeyPoints = explanation.keyPoints.some(point => point.trim().length > 0)
  const hasActionableNextActions = explanation.nextActions.some(action => action.trim().length >= 4)
  const uncertaintyBoundary = !options.requireUncertainty || Boolean(explanation.uncertainty?.trim())

  const checks = {
    structure,
    validEvidence,
    hasKeyPoints,
    hasActionableNextActions,
    uncertaintyBoundary,
  }
  const failureReasons: string[] = []
  if (!structure) failureReasons.push('invalid_structure')
  if (!validEvidence) failureReasons.push('invalid_evidence')
  if (!hasKeyPoints) failureReasons.push('missing_key_points')
  if (!hasActionableNextActions) failureReasons.push('missing_actionable_next_actions')
  if (!uncertaintyBoundary) failureReasons.push('missing_uncertainty')

  const passedChecks = Object.values(checks).filter(Boolean).length
  return {
    passed: passedChecks === Object.keys(checks).length,
    score: passedChecks * 20,
    checks,
    failureReasons,
  }
}
