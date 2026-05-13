/**
 * Central prompt configuration for the LLM-backed features.
 *
 * Teachers or maintainers can edit this file to tune:
 * - mind map extraction
 * - exam generation
 *
 * Template placeholders use the form {{variableName}}.
 */

const renderTemplate = (template, variables = {}) => template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = variables[key];
    return value === undefined || value === null ? '' : String(value);
});

const templates = {
    mindmapGeneration: `
You are an expert academic curriculum designer.

Your task is to extract a clean hierarchical concept map from the provided study material.

Material title:
{{materialTitle}}

Study material:
{{materials}}

Rules:
1. Use ONLY concepts explicitly supported by the provided material.
2. Do NOT add outside knowledge, background facts, or inferred topics.
3. Prefer a compact, useful hierarchy over a large noisy tree.
4. Merge duplicates and normalize wording when the same concept appears multiple times.
5. If the material is sparse, return the smallest useful concept map you can justify from the text.
6. Output valid JSON only. No markdown, no commentary, no code fences.

Return exactly this schema:
{
  "title": "Short title for the material",
  "concepts": [
    {
      "name": "Main concept",
      "children": [
        { "name": "Subconcept", "children": [] }
      ]
    }
  ]
}
`.trim(),

    examGeneration: `
You are an expert university exam designer.

Generate an exam draft using ONLY the provided study material and the blueprint requirements.

Exam blueprint title:
{{blueprintTitle}}

Question specification:
{{questionTypes}}

Difficulty distribution:
{{difficulty}}

Difficulty and Bloom profile:
{{questionProfiles}}

Selected topics to prioritize:
{{concepts}}

Special instructions:
{{instructions}}

Study material context:
{{materials}}

Critical rules:
1. Every question MUST be answerable from the provided material alone.
2. Do NOT use outside knowledge, unstated assumptions, or hallucinated facts.
3. Generate exactly the requested counts and question types.
4. Keep questions academically clear, unambiguous, and aligned with the requested topics and difficulty mix.
5. Every question MUST include an explanation grounded in the provided material.
6. Output valid JSON only. No markdown, no commentary, no code fences.
7. Treat the "difficulty" output field as the Bloom cognitive level, and use the difficulty/Bloom profile to balance both academic difficulty and cognition across the full exam.
8. Use the exact allowed enum values only. Do not shorten or paraphrase them.
9. Never return null for any field. Use empty arrays for unused array fields, omit unused boolean fields, and keep strings as strings.
10. Never invent placeholder fields such as "options_placeholder", "notes", "metadata", or similar. Only output the allowed keys.
11. For choice questions, NEVER return the full correct answer text in any answer key field. Return indexes only.
12. Every question object must be internally complete and valid on its own. Do not leave required enum fields empty or undefined.

Question format rules:
- Allowed types: single_choice, multiple_choice, true_false, matching, ordering, negative_qcm
- Allowed difficulties: recall, understanding, application, analysis, evaluation, create
- Do not use aliases such as "apply" or "analyze". Use "application" and "analysis" exactly.
- For single_choice, multiple_choice, and negative_qcm:
  - provide exactly 4 options
  - provide correctAnswerIndexes as zero-based indexes into the options array
  - for single_choice and negative_qcm, correctAnswerIndexes must contain exactly 1 index
  - for multiple_choice, correctAnswerIndexes must contain 1 or more unique indexes
  - set matchingPairs to []
  - set orderedItems to []
  - do not include correctAnswers
- For true_false:
  - provide trueFalseAnswer as true or false
  - set correctAnswerIndexes to []
  - set matchingPairs to []
  - set orderedItems to []
- For matching:
  - provide matchingPairs as [{"left":"...","right":"..."}]
  - set correctAnswerIndexes to []
  - set orderedItems to []
- For ordering:
  - provide orderedItems in the correct logical order
  - set correctAnswerIndexes to []
  - set matchingPairs to []

Output constraints:
- Return exactly one top-level object with exactly 2 keys: examTitle, questions
- Each question must contain only these keys:
  type, difficulty, question, options, correctAnswerIndexes, trueFalseAnswer, matchingPairs, orderedItems, explanation
- If a key is not applicable, use an empty array for array fields and omit trueFalseAnswer when not applicable
- Never repeat a key in the same object
- Never return undefined
- Never return trailing prose after the JSON

Return exactly this schema:
{
  "examTitle": "{{blueprintTitle}}",
  "questions": [
    {
      "type": "single_choice | multiple_choice | true_false | matching | ordering | negative_qcm",
      "difficulty": "recall | understanding | application | analysis | evaluation | create",
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswerIndexes": [1],
      "trueFalseAnswer": true,
      "matchingPairs": [{"left": "Term 1", "right": "Definition 1"}],
      "orderedItems": ["Step 1", "Step 2", "Step 3"],
      "explanation": "Why the answer is correct based on the material"
    }
  ]
}
`.trim(),

    examGenerationRepairSuffix: `

The previous attempt was rejected by validation.
Fix every issue below and regenerate the ENTIRE JSON object from scratch.

Validation errors:
{{validationErrors}}

Important:
- Do not explain the fixes
- Do not wrap the JSON in markdown
- Return a fresh, fully valid JSON object only
`.trim(),
};

const buildMindmapPrompt = ({ materialTitle, materials }) => renderTemplate(templates.mindmapGeneration, {
    materialTitle,
    materials,
});

const buildExamGenerationPrompt = ({
    blueprintTitle,
    questionTypes,
    difficulty,
    questionProfiles,
    concepts,
    instructions,
    materials,
    validationErrors,
}) => renderTemplate(templates.examGeneration, {
    blueprintTitle,
    questionTypes,
    difficulty,
    questionProfiles,
    concepts,
    instructions,
    materials,
}) + (validationErrors ? `\n\n${renderTemplate(templates.examGenerationRepairSuffix, { validationErrors })}` : '');

module.exports = {
    templates,
    renderTemplate,
    buildMindmapPrompt,
    buildExamGenerationPrompt,
};
