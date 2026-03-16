const fs = require('fs');
const path = require('path');
const config = require('../config/system.config');
const { validateExam } = require('./examValidator');

/**
 * Inject values into the prompt template, replacing {{key}} placeholders.
 */
const buildPrompt = (templatePath, params) => {
    let template = fs.readFileSync(templatePath, 'utf-8');
    for (const [key, value] of Object.entries(params)) {
        template = template.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return template;
};

/**
 * Retry wrapper for async functions.
 */
const withRetry = async (fn, attempts, delayMs) => {
    let lastError;
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            console.warn(`LLM attempt ${i + 1} failed: ${err.message}`);
            if (i < attempts - 1) {
                await new Promise(r => setTimeout(r, delayMs));
            }
        }
    }
    throw lastError;
};

/**
 * Call OpenAI-compatible API.
 */
const callOpenAI = async (prompt) => {
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await client.chat.completions.create({
        model: config.llm.model,
        temperature: config.llm.temperature,
        max_tokens: config.llm.maxTokens,
        messages: [
            { role: 'system', content: 'You are an expert university exam generator. Return only valid JSON.' },
            { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
    });

    return response.choices[0].message.content;
};

/**
 * Call the configured LLM provider.
 */
const callLLM = async (prompt) => {
    const provider = config.llm.provider;

    if (provider === 'openai') {
        return callOpenAI(prompt);
    }

    throw new Error(`LLM provider "${provider}" is not yet implemented. Add it in services/llmService.js`);
};

/**
 * Generate a concept mindmap from material chunks.
 */
const generateMindmap = async (materialTitle, chunks) => {
    const sampleText = chunks.slice(0, 8).map(c => c.text).join('\n\n');

    const prompt = `You are an expert academic concept mapper.

Analyze the following study material and extract a hierarchical concept mindmap.

Material: "${materialTitle}"

Content:
${sampleText}

Return ONLY valid JSON in this exact structure:
{
  "title": "string",
  "concepts": [
    {
      "name": "string",
      "children": [
        { "name": "string", "children": [] }
      ]
    }
  ]
}`;

    const raw = await withRetry(
        () => callLLM(prompt),
        config.llm.retryAttempts,
        config.llm.retryDelayMs
    );

    return JSON.parse(raw);
};

/**
 * Generate a full exam from a blueprint.
 */
const generateExamFromBlueprint = async (blueprint, materialChunks) => {
    const promptTemplate = path.join(__dirname, '..', 'config', 'prompts', 'examGeneration.prompt');

    // Format concepts
    const conceptsText = blueprint.selectedConcepts.join(', ') || 'All available concepts';

    // Format material (truncate to avoid token limits)
    const materialsText = materialChunks
        .slice(0, 20)
        .map(c => c.text)
        .join('\n\n---\n\n');

    // Format question types
    const qtLines = [];
    for (const [type, cfg] of Object.entries(blueprint.questionTypes)) {
        if (cfg && cfg.count > 0) {
            let line = `- ${type}: ${cfg.count} questions`;
            if (cfg.options) line += `, ${cfg.options} options each`;
            if (cfg.correctAnswers) line += `, ${cfg.correctAnswers} correct answers`;
            qtLines.push(line);
        }
    }
    const questionTypesText = qtLines.join('\n') || 'Mixed types';

    // Format difficulty
    const diffLines = [];
    const dist = blueprint.difficultyDistribution || {};
    for (const [level, count] of Object.entries(dist)) {
        if (count > 0) diffLines.push(`- ${level}: ${count} questions`);
    }
    const difficultyText = diffLines.join('\n') || 'Balanced distribution';

    // Format scoring
    const scoringLines = [];
    if (blueprint.scoringRules instanceof Map) {
        for (const [type, rule] of blueprint.scoringRules.entries()) {
            scoringLines.push(`- ${type}: +${rule.reward} correct, ${rule.penalty} incorrect`);
        }
    }
    const scoringText = scoringLines.join('\n') || 'Standard scoring';

    const instructionsText = blueprint.instructions || 'No special instructions.';

    const prompt = buildPrompt(promptTemplate, {
        concepts: conceptsText,
        materials: materialsText,
        questionTypes: questionTypesText,
        difficulty: difficultyText,
        scoring: scoringText,
        instructions: instructionsText
    });

    const rawResponse = await withRetry(
        () => callLLM(prompt),
        config.llm.retryAttempts,
        config.llm.retryDelayMs
    );

    const examJson = JSON.parse(rawResponse);

    // Validate
    const validation = validateExam(examJson);
    if (!validation.valid) {
        throw new Error(`LLM returned invalid exam JSON: ${JSON.stringify(validation.errors)}`);
    }

    // Enforce max questions from config
    const maxQ = config.examGeneration.maxQuestions;
    if (examJson.questions.length > maxQ) {
        examJson.questions = examJson.questions.slice(0, maxQ);
    }

    return examJson;
};

module.exports = { generateExamFromBlueprint, generateMindmap };
