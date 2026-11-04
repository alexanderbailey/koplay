const EXPLANATION_MAX = 300;

/**
 * Normalize and validate optional explanation on a question in place.
 * Omits empty strings. Returns an error message string, or null if ok.
 */
function normalizeQuestionExplanation(q, pathLabel) {
  if (q.explanation == null) return null;
  if (typeof q.explanation !== 'string') {
    return `${pathLabel}.explanation must be a string`;
  }
  const trimmed = q.explanation.trim();
  if (!trimmed) {
    delete q.explanation;
    return null;
  }
  if (trimmed.length > EXPLANATION_MAX) {
    return `${pathLabel}.explanation must be at most ${EXPLANATION_MAX} characters`;
  }
  q.explanation = trimmed;
  return null;
}

function normalizeRoundsExplanations(rounds) {
  for (let ri = 0; ri < rounds.length; ri++) {
    const questions = rounds[ri].questions || [];
    for (let qi = 0; qi < questions.length; qi++) {
      const err = normalizeQuestionExplanation(
        questions[qi],
        `rounds[${ri}].questions[${qi}]`
      );
      if (err) return err;
    }
  }
  return null;
}

module.exports = {
  EXPLANATION_MAX,
  normalizeQuestionExplanation,
  normalizeRoundsExplanations,
};
