import {
  explainStudyAnswer,
  type StudyExplainerProvider,
} from '@agnostic-ap/grounded-study-explainer'

const provider: StudyExplainerProvider = {
  async generate({ systemPrompt, userPrompt, maxTokens }) {
    // Call any model provider here. Never place API keys in this package.
    void systemPrompt
    void userPrompt
    void maxTokens
    return {
      model: 'your-model',
      text: JSON.stringify({
        summary: 'The learner confused two nearby concepts.',
        diagnosis: { type: 'concept_gap', detail: 'Review the exact definition.' },
        keyPoints: ['Concept A differs from concept B in the reviewed evidence.'],
        optionAnalysis: [],
        nextActions: ['Write both definitions and solve one comparison question.'],
        evidenceIds: ['question:demo-1'],
        uncertainty: null,
      }),
    }
  },
}

const result = await explainStudyAnswer({
  question: {
    type: 'short_answer',
    content: 'Explain the difference between concept A and concept B.',
    correctAnswer: 'Use the reviewed definition.',
    existingExplanation: 'Concept A and concept B have distinct reviewed definitions.',
  },
  learner: { userAnswer: 'They are the same.' },
  evidence: [{
    id: 'question:demo-1',
    kind: 'question',
    title: 'Reviewed demo evidence',
    content: 'Synthetic evidence only.',
  }],
  evidenceSufficiency: 'adequate',
}, provider)

console.log(result)
