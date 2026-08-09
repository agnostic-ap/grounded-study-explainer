import { DIAGNOSIS_TYPES, OPTION_VERDICTS } from './types.js'
import type {
  DiagnosisType,
  OptionVerdict,
  ParseStudyExplanationResult,
  StudyExplanation,
} from './types.js'
import { extractFirstJsonObject } from './json.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function boundedString(
  value: unknown,
  path: string,
  min: number,
  max: number,
  issues: string[],
): string {
  if (typeof value !== 'string') {
    issues.push(`${path} must be a string`)
    return ''
  }
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length < min || normalized.length > max) {
    issues.push(`${path} must contain ${min}-${max} characters`)
  }
  return normalized
}

function boundedStringArray(
  value: unknown,
  path: string,
  minItems: number,
  maxItems: number,
  itemMax: number,
  issues: string[],
): string[] {
  if (!Array.isArray(value)) {
    issues.push(`${path} must be an array`)
    return []
  }
  if (value.length < minItems || value.length > maxItems) {
    issues.push(`${path} must contain ${minItems}-${maxItems} items`)
  }
  const result: string[] = []
  value.forEach((item, index) => {
    const normalized = boundedString(item, `${path}[${index}]`, 1, itemMax, issues)
    if (normalized && !result.includes(normalized)) result.push(normalized)
  })
  return result
}

export function parseStudyExplanation(
  text: string,
  allowedEvidenceIds: Iterable<string>,
): ParseStudyExplanationResult {
  if (!text.trim()) return { ok: false, reason: 'empty_output', issues: ['model output is empty'] }
  const jsonText = extractFirstJsonObject(text)
  if (!jsonText) return { ok: false, reason: 'invalid_json', issues: ['no complete JSON object found'] }

  let raw: unknown
  try {
    raw = JSON.parse(jsonText)
  } catch {
    return { ok: false, reason: 'invalid_json', issues: ['JSON parsing failed'] }
  }
  if (!isRecord(raw)) return { ok: false, reason: 'invalid_structure', issues: ['output must be an object'] }

  const issues: string[] = []
  const summary = boundedString(raw.summary, 'summary', 1, 500, issues)

  let diagnosisType: DiagnosisType = 'unknown'
  let diagnosisDetail = ''
  if (!isRecord(raw.diagnosis)) {
    issues.push('diagnosis must be an object')
  } else {
    if (typeof raw.diagnosis.type !== 'string' || !DIAGNOSIS_TYPES.includes(raw.diagnosis.type as DiagnosisType)) {
      issues.push('diagnosis.type is invalid')
    } else {
      diagnosisType = raw.diagnosis.type as DiagnosisType
    }
    diagnosisDetail = boundedString(raw.diagnosis.detail, 'diagnosis.detail', 1, 500, issues)
  }

  const keyPoints = boundedStringArray(raw.keyPoints, 'keyPoints', 1, 6, 200, issues)
  const nextActions = boundedStringArray(raw.nextActions, 'nextActions', 1, 5, 200, issues)
  const evidenceIds = boundedStringArray(raw.evidenceIds, 'evidenceIds', 0, 10, 160, issues)

  const optionAnalysis: StudyExplanation['optionAnalysis'] = []
  if (!Array.isArray(raw.optionAnalysis)) {
    issues.push('optionAnalysis must be an array')
  } else {
    if (raw.optionAnalysis.length > 10) issues.push('optionAnalysis must contain 0-10 items')
    raw.optionAnalysis.forEach((item, index) => {
      if (!isRecord(item)) {
        issues.push(`optionAnalysis[${index}] must be an object`)
        return
      }
      const option = boundedString(item.option, `optionAnalysis[${index}].option`, 1, 20, issues)
      let verdict: OptionVerdict = 'not_applicable'
      if (typeof item.verdict !== 'string' || !OPTION_VERDICTS.includes(item.verdict as OptionVerdict)) {
        issues.push(`optionAnalysis[${index}].verdict is invalid`)
      } else {
        verdict = item.verdict as OptionVerdict
      }
      const reason = boundedString(item.reason, `optionAnalysis[${index}].reason`, 1, 300, issues)
      if (option && reason) optionAnalysis.push({ option, verdict, reason })
    })
  }

  let uncertainty: string | null = null
  if (raw.uncertainty !== null && raw.uncertainty !== undefined) {
    if (typeof raw.uncertainty !== 'string') issues.push('uncertainty must be a string or null')
    else {
      const normalized = raw.uncertainty.replace(/\s+/g, ' ').trim()
      if (normalized.length > 300) issues.push('uncertainty must contain 0-300 characters')
      uncertainty = normalized || null
    }
  }

  if (issues.length > 0) return { ok: false, reason: 'invalid_structure', issues }

  const allowed = new Set(allowedEvidenceIds)
  const invalidEvidenceIds = evidenceIds.filter(id => !allowed.has(id))
  if (invalidEvidenceIds.length > 0) {
    return {
      ok: false,
      reason: 'invalid_evidence',
      issues: ['evidenceIds contains IDs outside the allowlist'],
      invalidEvidenceIds,
    }
  }

  return {
    ok: true,
    value: {
      summary,
      diagnosis: { type: diagnosisType, detail: diagnosisDetail },
      keyPoints,
      optionAnalysis,
      nextActions,
      evidenceIds,
      uncertainty,
    },
  }
}
