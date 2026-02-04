/**
 * Content Validator - Trigram-based Similarity Detection
 *
 * Ensures every regenerated letter is genuinely unique by comparing
 * content at the trigram level (3-word sequences).
 *
 * Uses Jaccard similarity coefficient to measure overlap between texts.
 * Threshold: reject if >30% overlap with any previous letter.
 */

/**
 * Extract trigrams (3-word sequences) from text
 */
function extractTrigrams(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0);

  const trigrams = new Set<string>();
  for (let i = 0; i <= words.length - 3; i++) {
    trigrams.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }
  return trigrams;
}

/**
 * Compute Jaccard similarity between two sets of trigrams
 * Returns a score from 0 (completely different) to 100 (identical)
 */
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 100;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union > 0 ? Math.round((intersection / union) * 100) : 0;
}

export interface ValidationResult {
  isUnique: boolean;
  similarityScore: number; // 0-100, higher = more similar
  uniquenessScore: number; // 0-100, higher = more unique (inverse)
  mostSimilarIndex: number; // Index of the most similar previous letter (-1 if none)
  maxOverlap: number; // Highest overlap found with any previous letter
}

/**
 * Validate that new content is sufficiently unique compared to previous content.
 *
 * Uses trigram comparison with Jaccard coefficient.
 * Threshold: reject if >30% overlap with any previous letter.
 *
 * @param newContent - The newly generated letter content
 * @param previousContents - Array of previously generated letter contents
 * @param threshold - Maximum allowed similarity (default 30)
 * @returns ValidationResult with similarity metrics
 */
export function validateUniqueness(
  newContent: string,
  previousContents: string[],
  threshold: number = 30
): ValidationResult {
  if (previousContents.length === 0) {
    return {
      isUnique: true,
      similarityScore: 0,
      uniquenessScore: 100,
      mostSimilarIndex: -1,
      maxOverlap: 0,
    };
  }

  const newTrigrams = extractTrigrams(newContent);

  let maxSimilarity = 0;
  let mostSimilarIndex = -1;

  for (let i = 0; i < previousContents.length; i++) {
    const prevTrigrams = extractTrigrams(previousContents[i]);
    const similarity = jaccardSimilarity(newTrigrams, prevTrigrams);

    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      mostSimilarIndex = i;
    }
  }

  return {
    isUnique: maxSimilarity <= threshold,
    similarityScore: maxSimilarity,
    uniquenessScore: Math.max(0, 100 - maxSimilarity),
    mostSimilarIndex,
    maxOverlap: maxSimilarity,
  };
}

/**
 * Build a rejection feedback message for the AI when content is too similar.
 * Used in retry loops to instruct the AI to be more creative.
 */
export function buildRejectionFeedback(
  attemptNumber: number,
  similarityScore: number
): string {
  const feedback = [
    `REJECTED (attempt ${attemptNumber}/3): Your output was ${similarityScore}% similar to a previous letter. `,
    `You MUST create COMPLETELY different content. Change: `,
  ];

  if (attemptNumber === 1) {
    feedback.push(
      "1) Use a DIFFERENT personal scenario/story, " +
        "2) Restructure ALL paragraphs, " +
        "3) Use different legal framing and word choices."
    );
  } else if (attemptNumber === 2) {
    feedback.push(
      "1) Start the letter with an ENTIRELY different approach, " +
        "2) Use a scenario from a DIFFERENT category (denial/suffering/embarrassment/opportunity), " +
        "3) Change sentence structure, transitions, and legal argument order."
    );
  } else {
    feedback.push(
      "FINAL ATTEMPT. The letter must share ZERO recognizable patterns with previous letters. " +
        "Write as if this is a completely different person with a completely different life experience. " +
        "Every paragraph, every sentence, every legal argument must be rewritten from scratch."
    );
  }

  return feedback.join("");
}
