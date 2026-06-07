import { plainTextFromContent, previewFromContent } from '../notes-editor/contentMetrics'
import type { NoteRelation } from '../../store/types'
import type { Note } from '../../types/note'
import type { AppNode } from '../../types/workspace'

export interface ConnectionSuggestion {
  note: Note
  fragment: string
  score: number
  scorePercent: number
}

const MIN_SCORE = 0.08
const MAX_SUGGESTIONS = 5

export function suggestConnections(
  source: Note,
  nodes: AppNode[],
  relations: NoteRelation[],
  ignoredPairs: Set<string> = new Set(),
): ConnectionSuggestion[] {
  const notes = nodes.filter((node): node is Note => (
    node.type === 'note'
    && typeof node.content === 'string'
    && !node.inbox
    && node.id !== source.id
    && !isConnected(source.id, node.id, relations)
    && !ignoredPairs.has(pairKey(source.id, node.id))
  ))

  if (notes.length === 0) {
    return []
  }

  const corpus = [source, ...notes]
  const documentTokens = corpus.map((note) => tokenize(noteText(note)))
  const idf = computeIdf(documentTokens)
  const sourceVector = vectorize(documentTokens[0] ?? [], idf)
  const sourceTokenSet = new Set(documentTokens[0] ?? [])
  const sourceText = normalizeText(noteText(source))

  return notes
    .map((note, index) => {
      const tokens = documentTokens[index + 1] ?? []
      const score = scoreCandidate({
        candidateTitle: note.title,
        candidateVector: vectorize(tokens, idf),
        candidateTokens: tokens,
        sourceText,
        sourceTokenSet,
        sourceVector,
      })

      return {
        note,
        fragment: relevantFragment(note, sourceTokenSet),
        score,
        scorePercent: Math.max(10, Math.min(100, Math.round(score * 120))),
      } satisfies ConnectionSuggestion
    })
    .filter((suggestion) => suggestion.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SUGGESTIONS)
}

export function pairKey(sourceId: string, targetId: string): string {
  return `${sourceId}->${targetId}`
}

function isConnected(sourceId: string, targetId: string, relations: NoteRelation[]): boolean {
  return relations.some((relation) => (
    (relation.sourceId === sourceId && relation.targetId === targetId)
    || (relation.sourceId === targetId && relation.targetId === sourceId)
  ))
}

function scoreCandidate({
  candidateTitle,
  candidateTokens,
  candidateVector,
  sourceText,
  sourceTokenSet,
  sourceVector,
}: {
  candidateTitle: string
  candidateTokens: string[]
  candidateVector: Map<string, number>
  sourceText: string
  sourceTokenSet: Set<string>
  sourceVector: Map<string, number>
}): number {
  const cosine = cosineSimilarity(sourceVector, candidateVector)
  const overlap = overlapScore(sourceTokenSet, candidateTokens)
  const titleMentionBoost = sourceText.includes(normalizeText(candidateTitle)) ? 0.22 : 0

  return cosine + overlap + titleMentionBoost
}

function computeIdf(documents: string[][]): Map<string, number> {
  const documentFrequency = new Map<string, number>()
  for (const tokens of documents) {
    for (const token of new Set(tokens)) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1)
    }
  }

  const idf = new Map<string, number>()
  const total = documents.length
  for (const [token, frequency] of documentFrequency) {
    idf.set(token, Math.log((total + 1) / (frequency + 1)) + 1)
  }
  return idf
}

function vectorize(tokens: string[], idf: Map<string, number>): Map<string, number> {
  const counts = new Map<string, number>()
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1)
  }

  const vector = new Map<string, number>()
  const total = Math.max(tokens.length, 1)
  for (const [token, count] of counts) {
    vector.set(token, (count / total) * (idf.get(token) ?? 1))
  }
  return vector
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0
  let aMagnitude = 0
  let bMagnitude = 0

  for (const value of a.values()) {
    aMagnitude += value * value
  }
  for (const value of b.values()) {
    bMagnitude += value * value
  }
  for (const [token, value] of a) {
    dot += value * (b.get(token) ?? 0)
  }

  if (aMagnitude === 0 || bMagnitude === 0) {
    return 0
  }
  return dot / (Math.sqrt(aMagnitude) * Math.sqrt(bMagnitude))
}

function overlapScore(sourceTokens: Set<string>, candidateTokens: string[]): number {
  const uniqueCandidateTokens = new Set(candidateTokens)
  let overlap = 0
  for (const token of uniqueCandidateTokens) {
    if (sourceTokens.has(token)) {
      overlap += 1
    }
  }
  return Math.min(0.24, overlap * 0.035)
}

function relevantFragment(note: Note, sourceTokens: Set<string>): string {
  const lines = plainTextFromContent(note.content)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const matching = lines.find((line) => tokenize(line).some((token) => sourceTokens.has(token)))
  return matching ? matching.slice(0, 150) : previewFromContent(note.content)
}

function noteText(note: Note): string {
  return `${note.title}\n${plainTextFromContent(note.content)}`
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
