import { performance } from 'node:perf_hooks'
import { writeFile } from 'node:fs/promises'
import { explainStudyAnswer } from '../index.js'
import { buildEvalInput, buildEvalOutput, OFFLINE_EVAL_SAMPLES } from '../eval/samples.js'

interface SampleResult {
  id: string
  questionType: string
  scenario: string
  expectedPass: boolean
  actualPass: boolean
  actualReason: string | null
  expectationMatched: boolean
  coreLatencyMs: number
}

const results: SampleResult[] = []
for (const sample of OFFLINE_EVAL_SAMPLES) {
  const startedAt = performance.now()
  const result = await explainStudyAnswer(buildEvalInput(sample), {
    async generate() {
      return { text: buildEvalOutput(sample), model: 'fixture-provider-v1' }
    },
  })
  const coreLatencyMs = performance.now() - startedAt
  const actualReason = result.ok ? null : result.reason
  results.push({
    id: sample.id,
    questionType: sample.questionType,
    scenario: sample.scenario,
    expectedPass: sample.expectedPass,
    actualPass: result.ok,
    actualReason,
    expectationMatched: result.ok === sample.expectedPass
      && (sample.expectedReason === undefined || actualReason === sample.expectedReason),
    coreLatencyMs: Number(coreLatencyMs.toFixed(3)),
  })
}

const validSamples = results.filter(item => item.expectedPass)
const invalidEvidenceSamples = OFFLINE_EVAL_SAMPLES.filter(item => item.expectedReason === 'invalid_evidence')
const invalidEvidenceFalseAccepts = results.filter(item => (
  invalidEvidenceSamples.some(sample => sample.id === item.id) && item.actualPass
)).length
const totalLatency = results.reduce((sum, item) => sum + item.coreLatencyMs, 0)
const report = {
  reportKind: 'deterministic_fixture_conformance',
  generatedAt: new Date().toISOString(),
  model: 'fixture-provider-v1 (no external model call)',
  privacy: '30 synthetic samples; no production questions or user data',
  sampleCount: results.length,
  validSampleCount: validSamples.length,
  adversarialSampleCount: results.length - validSamples.length,
  expectationAccuracy: Number((results.filter(item => item.expectationMatched).length / results.length).toFixed(4)),
  validOutputPassRate: Number((validSamples.filter(item => item.actualPass).length / validSamples.length).toFixed(4)),
  invalidEvidenceFalseAccepts,
  averageCoreLatencyMs: Number((totalLatency / results.length).toFixed(3)),
  failureReasons: Object.fromEntries(
    [...new Set(results.map(item => item.actualReason).filter((reason): reason is string => Boolean(reason)))]
      .map(reason => [reason, results.filter(item => item.actualReason === reason).length]),
  ),
  results,
}

const reportUrl = new URL('../eval/latest-report.json', import.meta.url)
await writeFile(reportUrl, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

process.stdout.write(`${JSON.stringify({
  report: reportUrl.pathname,
  sampleCount: report.sampleCount,
  expectationAccuracy: report.expectationAccuracy,
  validOutputPassRate: report.validOutputPassRate,
  invalidEvidenceFalseAccepts: report.invalidEvidenceFalseAccepts,
  averageCoreLatencyMs: report.averageCoreLatencyMs,
}, null, 2)}\n`)

if (results.some(item => !item.expectationMatched)) process.exitCode = 1
