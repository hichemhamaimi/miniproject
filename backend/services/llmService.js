const fs = require('fs');
const path = require('path');
const config = require('../config/system.config');
const promptConfig = require('../config/prompts');
const devLogger = require('../utils/devLogger');
const { validateExam } = require('./examValidator');
const { resolveProviderConfig } = require('./llmProviderService');
require('dotenv').config();

const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Helper function to call the appropriate provider
 */
const parseJsonResponse = (text) => JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
const normalizeLine = (value = '') => value.replace(/[ \t]+/g, ' ').trim();
const safeJsonParse = (text) => {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
};

const dedupeStrings = (values = []) => [...new Set(values.map((value) => normalizeLine(value)).filter(Boolean))];
const isLikelyNoiseLine = (line = '') => /^slide\s+\d+$/i.test(line) || /^speaker notes:\s*$/i.test(line);
const cognitiveLevelLabels = {
    recall: 'Recall',
    understanding: 'Understand',
    application: 'Apply',
    analysis: 'Analyze',
    evaluation: 'Evaluate',
    create: 'Create',
};
const academicDifficultyLabels = {
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
};
const difficultyAliases = new Map([
    ['recall', 'recall'],
    ['remember', 'recall'],
    ['remembering', 'recall'],
    ['knowledge', 'recall'],
    ['understanding', 'understanding'],
    ['understand', 'understanding'],
    ['comprehension', 'understanding'],
    ['application', 'application'],
    ['apply', 'application'],
    ['applied', 'application'],
    ['analysis', 'analysis'],
    ['analyze', 'analysis'],
    ['analytical', 'analysis'],
    ['evaluation', 'evaluation'],
    ['evaluate', 'evaluation'],
    ['creation', 'create'],
    ['create', 'create'],
    ['creating', 'create'],
]);
const questionTypeAliases = new Map([
    ['single_choice', 'single_choice'],
    ['single choice', 'single_choice'],
    ['single-choice', 'single_choice'],
    ['multiple_choice', 'multiple_choice'],
    ['multiple choice', 'multiple_choice'],
    ['multiple-choice', 'multiple_choice'],
    ['true_false', 'true_false'],
    ['true false', 'true_false'],
    ['true-false', 'true_false'],
    ['matching', 'matching'],
    ['match', 'matching'],
    ['ordering', 'ordering'],
    ['order', 'ordering'],
    ['negative_qcm', 'negative_qcm'],
    ['negative qcm', 'negative_qcm'],
    ['negative-qcm', 'negative_qcm'],
]);
const getChunkText = (chunk) => {
    if (typeof chunk === 'string') return chunk;
    if (!chunk || typeof chunk !== 'object') return '';
    if (typeof chunk.text === 'string') return chunk.text;
    if (typeof chunk.payload?.text === 'string') return chunk.payload.text;
    return '';
};

const normalizeMindmapNode = (node) => {
    if (!node || typeof node !== 'object') return null;
    const name = normalizeLine(node.name || '');
    if (!name) return null;

    const children = Array.isArray(node.children)
        ? node.children.map((child) => normalizeMindmapNode(child)).filter(Boolean)
        : [];

    return {
        name,
        children,
    };
};

const normalizeMindmap = (mindmap, fallbackTitle = 'Generated Mind Map') => {
    const concepts = Array.isArray(mindmap?.concepts)
        ? mindmap.concepts.map((node) => normalizeMindmapNode(node)).filter(Boolean)
        : [];

    return {
        title: normalizeLine(mindmap?.title || fallbackTitle) || fallbackTitle,
        concepts,
    };
};

const hasUsableMindmap = (mindmap) => Array.isArray(mindmap?.concepts) && mindmap.concepts.length > 0;

const createHeuristicMindmapFromChunks = (materialTitle, chunks) => {
    const rawText = chunks
        .map((chunk) => getChunkText(chunk))
        .join('\n\n');

    const slideSections = rawText
        .split(/(?=^Slide\s+\d+\s*$)/gim)
        .map((section) => section.trim())
        .filter(Boolean);

    if (slideSections.length > 0) {
        const slideConcepts = slideSections.map((section) => {
            const lines = section
                .split('\n')
                .map((line) => normalizeLine(line.replace(/^[-*â€¢]\s*/, '')))
                .filter((line) => line && !isLikelyNoiseLine(line))
                .map((line) => line.replace(/^speaker notes:\s*/i, ''));

            if (lines.length === 0) return null;

            const [mainConcept, ...childLines] = lines;
            return {
                name: mainConcept,
                children: dedupeStrings(childLines).slice(0, 8).map((name) => ({ name, children: [] })),
            };
        }).filter(Boolean);

        if (slideConcepts.length > 0) {
            return {
                title: materialTitle,
                concepts: slideConcepts,
            };
        }
    }

    const blocks = rawText
        .split(/\n{2,}/)
        .map((block) => block.split('\n').map((line) => normalizeLine(line)).filter(Boolean))
        .filter((lines) => lines.length > 0);

    const concepts = [];
    const seenConcepts = new Set();

    blocks.forEach((lines) => {
        const contentLines = lines
            .filter((line) => !isLikelyNoiseLine(line))
            .map((line) => line.replace(/^speaker notes:\s*/i, ''))
            .filter(Boolean);

        if (contentLines.length === 0) return;

        const mainConcept = normalizeLine(contentLines[0]);
        if (!mainConcept || seenConcepts.has(mainConcept.toLowerCase())) return;

        seenConcepts.add(mainConcept.toLowerCase());

        const childCandidates = dedupeStrings(contentLines.slice(1))
            .slice(0, 6)
            .map((name) => ({ name, children: [] }));

        concepts.push({
            name: mainConcept,
            children: childCandidates,
        });
    });

    if (concepts.length === 0) {
        const fallbackLines = dedupeStrings(
            rawText
                .split('\n')
                .map((line) => line.replace(/^[-*•]\s*/, ''))
                .filter((line) => line.length >= 4)
        ).slice(0, 6);

        return {
            title: materialTitle,
            concepts: fallbackLines.map((line) => ({ name: line, children: [] })),
        };
    }

    return {
        title: materialTitle,
        concepts,
    };
};

const shouldRetryWithoutStrictJsonMode = (provider, responseStatus, errorText, isJsonMode) => {
    if (!isJsonMode || provider !== 'groq' || responseStatus !== 400) return false;
    const parsed = safeJsonParse(errorText);
    return parsed?.error?.code === 'json_validate_failed';
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toCanonicalQuestionType = (value) => {
    if (typeof value !== 'string') return value;
    const normalized = normalizeLine(value).toLowerCase();
    return questionTypeAliases.get(normalized) || normalized.replace(/\s+/g, '_');
};

const toCanonicalDifficulty = (value) => {
    if (typeof value !== 'string') return null;
    const normalized = normalizeLine(value).toLowerCase();
    return difficultyAliases.get(normalized) || null;
};

const toStringArray = (value) => {
    if (Array.isArray(value)) {
        return value
            .map((item) => (typeof item === 'string' ? normalizeLine(item) : ''))
            .filter(Boolean);
    }

    if (typeof value === 'string') {
        const normalized = normalizeLine(value);
        return normalized ? [normalized] : [];
    }

    return [];
};

const toIntegerArray = (value) => {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => Number.parseInt(item, 10))
        .filter((item) => Number.isInteger(item));
};

const toBooleanOrUndefined = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = normalizeLine(value).toLowerCase();
        if (normalized === 'true') return true;
        if (normalized === 'false') return false;
    }
    return undefined;
};

const toMatchingPairs = (value) => {
    if (!Array.isArray(value)) return [];
    return value
        .map((pair) => {
            if (!pair || typeof pair !== 'object') return null;
            const left = normalizeLine(pair.left || '');
            const right = normalizeLine(pair.right || '');
            if (!left || !right) return null;
            return { left, right };
        })
        .filter(Boolean);
};

const normalizeExamQuestion = (question = {}) => {
    const type = toCanonicalQuestionType(question.type);
    const difficulty = toCanonicalDifficulty(
        question.cognitiveLevel
        || question.cognitive_level
        || question.bloomLevel
        || question.bloom_level
        || question.difficulty
    );
    const options = toStringArray(question.options);
    const correctAnswerIndexes = toIntegerArray(
        question.correctAnswerIndexes
        || question.correct_answer_indexes
        || question.correctOptionIndexes
        || question.correct_option_indexes
    );
    const derivedCorrectAnswers = correctAnswerIndexes
        .map((index) => options[index])
        .filter((value) => typeof value === 'string' && value.length > 0);
    const fallbackCorrectAnswers = toStringArray(question.correctAnswers || question.correctAnswer);
    const derivedCorrectAnswerIndexes = correctAnswerIndexes.length > 0
        ? correctAnswerIndexes
        : fallbackCorrectAnswers
            .map((answer) => options.findIndex((option) => option === answer))
            .filter((index) => index >= 0);

    const normalizedQuestion = {
        type,
        difficulty: difficulty || question.difficulty,
        question: typeof question.question === 'string'
            ? normalizeLine(question.question)
            : normalizeLine(question.text || ''),
        options,
        correctAnswerIndexes: derivedCorrectAnswerIndexes,
        correctAnswers: derivedCorrectAnswers.length > 0 ? derivedCorrectAnswers : fallbackCorrectAnswers,
        matchingPairs: toMatchingPairs(question.matchingPairs),
        orderedItems: toStringArray(question.orderedItems),
        explanation: typeof question.explanation === 'string' ? normalizeLine(question.explanation) : '',
    };

    const normalizedTrueFalse = toBooleanOrUndefined(question.trueFalseAnswer ?? question.answer);
    if (normalizedTrueFalse !== undefined) {
        normalizedQuestion.trueFalseAnswer = normalizedTrueFalse;
    } else {
        delete normalizedQuestion.trueFalseAnswer;
    }

    return normalizedQuestion;
};

const normalizeExamResponse = (responseJson = {}) => ({
    examTitle: typeof responseJson.examTitle === 'string'
        ? normalizeLine(responseJson.examTitle)
        : normalizeLine(responseJson.title || ''),
    questions: Array.isArray(responseJson.questions)
        ? responseJson.questions.map((question) => normalizeExamQuestion(question))
        : [],
});

const logProviderError = ({ provider, model, isJsonMode, responseStatus, errorText, usedStrictJsonMode }) => {
    devLogger.log('LLM', 'Provider returned an error response', {
        provider,
        model,
        isJsonMode,
        usedStrictJsonMode,
        responseStatus,
        errorText,
        parsedError: safeJsonParse(errorText),
    });
};

async function callOpenAIStyle(providerConfig, prompt, isJsonMode, requestOptions = {}) {
    const usedStrictJsonMode = isJsonMode && requestOptions.useStrictJsonMode !== false;

    devLogger.log('LLM', 'Dispatching OpenAI-style prompt', {
        provider: providerConfig.provider,
        model: providerConfig.modelName,
        isJsonMode,
        usedStrictJsonMode,
        prompt,
    });

    const body = {
        model: providerConfig.modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: config.llm.temperature || 0.3,
    };

    if (usedStrictJsonMode) {
        body.response_format = { type: 'json_object' };
    }

    const response = await fetch(`${providerConfig.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${providerConfig.apiKey}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        logProviderError({
            provider: providerConfig.provider,
            model: providerConfig.modelName,
            isJsonMode,
            usedStrictJsonMode,
            responseStatus: response.status,
            errorText,
        });

        if (shouldRetryWithoutStrictJsonMode(providerConfig.provider, response.status, errorText, isJsonMode) && usedStrictJsonMode) {
            devLogger.log('LLM', 'Retrying OpenAI-style prompt without strict JSON mode after provider JSON validation failure', {
                provider: providerConfig.provider,
                model: providerConfig.modelName,
                responseStatus: response.status,
            });
            return callOpenAIStyle(providerConfig, prompt, isJsonMode, { useStrictJsonMode: false });
        }

        throw new Error(`${providerConfig.provider} API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    devLogger.log('LLM', 'Received OpenAI-style response', {
        provider: providerConfig.provider,
        model: providerConfig.modelName,
        isJsonMode,
        usedStrictJsonMode,
        responseBody: data,
        responseText: text,
    });

    if (!isJsonMode) {
        return text;
    }

    try {
        return parseJsonResponse(text);
    } catch (error) {
        devLogger.log('LLM', 'Failed to parse OpenAI-style JSON response', {
            provider: providerConfig.provider,
            model: providerConfig.modelName,
            usedStrictJsonMode,
            responseText: text,
            parseError: error.message,
        });
        throw error;
    }
}

async function callAnthropic(providerConfig, prompt, isJsonMode) {
    devLogger.log('LLM', 'Dispatching Anthropic prompt', {
        provider: providerConfig.provider,
        model: providerConfig.modelName,
        isJsonMode,
        prompt,
    });

    const response = await fetch(`${providerConfig.baseUrl}/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': providerConfig.apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: providerConfig.modelName,
            max_tokens: config.llm.maxTokens || 4000,
            temperature: config.llm.temperature || 0.3,
            messages: [{ role: 'user', content: prompt }],
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        logProviderError({
            provider: providerConfig.provider,
            model: providerConfig.modelName,
            isJsonMode,
            usedStrictJsonMode: false,
            responseStatus: response.status,
            errorText,
        });
        throw new Error(`anthropic API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const text = data.content?.map((item) => item.text).join('') || '';
    devLogger.log('LLM', 'Received Anthropic response', {
        provider: providerConfig.provider,
        model: providerConfig.modelName,
        isJsonMode,
        responseBody: data,
        responseText: text,
    });
    if (!isJsonMode) {
        return text;
    }
    try {
        return parseJsonResponse(text);
    } catch (error) {
        devLogger.log('LLM', 'Failed to parse Anthropic JSON response', {
            provider: providerConfig.provider,
            model: providerConfig.modelName,
            responseText: text,
            parseError: error.message,
        });
        throw error;
    }
}

async function callLLM(prompt, isJsonMode = true, options = {}) {
    const providerConfig = await resolveProviderConfig(options);
    const provider = providerConfig.provider;

    if (provider === 'gemini') {
        if (!providerConfig.apiKey) throw new Error("Gemini API key is not configured.");

        const genAI = new GoogleGenerativeAI(providerConfig.apiKey);
        
        const modelConfig = {
            model: providerConfig.modelName,
            generationConfig: {
                temperature: config.llm.temperature || 0.3,
            }
        };

        if (isJsonMode) {
             modelConfig.generationConfig.responseMimeType = "application/json";
        }
        
        const model = genAI.getGenerativeModel(modelConfig);
        devLogger.log('LLM', 'Dispatching Gemini prompt', {
            provider,
            model: providerConfig.modelName,
            isJsonMode,
            prompt,
        });
        const result = await model.generateContent(prompt);
        let text = result.response.text();
        devLogger.log('LLM', 'Received Gemini response', {
            provider,
            model: providerConfig.modelName,
            isJsonMode,
            responseBody: result.response,
            responseText: text,
        });
        
        if (isJsonMode) {
            try {
                return parseJsonResponse(text);
            } catch (error) {
                devLogger.log('LLM', 'Failed to parse Gemini JSON response', {
                    provider,
                    model: providerConfig.modelName,
                    responseText: text,
                    parseError: error.message,
                });
                throw error;
            }
        }
        return text;

    } else if (provider === 'ollama') {
        const body = {
            model: providerConfig.modelName,
            prompt: prompt,
            stream: false,
            options: {
                temperature: config.llm.temperature || 0.3
            }
        };
        
        if (isJsonMode) {
            body.format = "json";
        }

        devLogger.log('LLM', 'Dispatching Ollama prompt', {
            provider,
            model: providerConfig.modelName,
            isJsonMode,
            prompt,
        });

        const response = await fetch(`${providerConfig.baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errBody = await response.text();
            logProviderError({
                provider,
                model: providerConfig.modelName,
                isJsonMode,
                usedStrictJsonMode: false,
                responseStatus: response.status,
                errorText: errBody,
            });
            throw new Error(`Ollama API error: ${response.status} ${errBody}`);
        }

        const data = await response.json();
        const text = data.response.trim();
        devLogger.log('LLM', 'Received Ollama response', {
            provider,
            model: providerConfig.modelName,
            isJsonMode,
            responseBody: data,
            responseText: text,
        });
        
        if (isJsonMode) {
            try {
                return JSON.parse(text);
            } catch (error) {
                devLogger.log('LLM', 'Failed to parse Ollama JSON response', {
                    provider,
                    model: providerConfig.modelName,
                    responseText: text,
                    parseError: error.message,
                });
                throw error;
            }
        }
        return text;
    } else if (provider === 'groq' || provider === 'openai' || provider === 'mistral') {
        if (!providerConfig.apiKey) throw new Error(`${provider} API key is not configured.`);
        return callOpenAIStyle(providerConfig, prompt, isJsonMode);
    } else if (provider === 'anthropic') {
        if (!providerConfig.apiKey) throw new Error('Anthropic API key is not configured.');
        return callAnthropic(providerConfig, prompt, isJsonMode);
    } else {
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
}

/**
 * Generate a concept mindmap from material chunks.
 */
const generateMindmap = async (materialTitle, chunks, options = {}) => {
    console.log(`[LLM Service] Generating mindmap for material: ${materialTitle}`);
    
    // Concatenate chunks for context (truncated to avoid token bounds if needed)
    // Simple truncation for now: take first 10 chunks
    const contextContent = chunks.slice(0, 10).map((chunk) => getChunkText(chunk)).join("\n\n---\n\n");
    
    const prompt = promptConfig.buildMindmapPrompt({
        materialTitle,
        materials: contextContent,
    });

    try {
        let lastError = null;

        for (let attempt = 1; attempt <= 3; attempt += 1) {
            try {
                const responseJson = await callLLM(prompt, true, options);
                const normalizedMindmap = normalizeMindmap(responseJson, materialTitle);
                if (!hasUsableMindmap(normalizedMindmap)) {
                    throw new Error('Mindmap response did not contain any concepts.');
                }
                return normalizedMindmap;
            } catch (error) {
                lastError = error;
                console.warn(`[LLM Service] Mindmap generation attempt ${attempt} failed: ${error.message}`);
            }
        }

        console.warn(`[LLM Service] Falling back to heuristic mindmap for "${materialTitle}" after LLM retries failed. ${lastError?.message || ''}`);
        const fallbackMindmap = normalizeMindmap(createHeuristicMindmapFromChunks(materialTitle, chunks), materialTitle);
        if (!hasUsableMindmap(fallbackMindmap)) {
            throw new Error(lastError?.message || 'Failed to generate a usable mindmap.');
        }
        return fallbackMindmap;
    } catch (error) {
        console.error("Error generating mindmap via LLM:", error);
        throw error;
    }
};

/**
 * Generate a full exam from a blueprint.
 */
const generateExamFromBlueprint = async (blueprint, materialChunks, options = {}) => {
    console.log(`[LLM Service] Generating exam for blueprint ID: ${blueprint._id}`);
    
    const contextContent = materialChunks.map((chunk) => getChunkText(chunk)).join("\n\n---\n\n");

    // Constructing the exact conditions and requirements based on blueprint
    const examQuestionsSpec = Object.entries(blueprint.questionTypes || {})
        .filter(([, definition]) => Number(definition?.count || 0) > 0)
        .map(([type, definition]) => `- Type: ${type}, Count: ${definition.count || 0}, Options: ${definition.options || 4}`)
        .join("\n");
    const blueprintTitle = blueprint.title || `Blueprint ${blueprint._id}`;
    const difficultySpec = Object.entries(blueprint.difficultyDistribution || {})
        .filter(([, count]) => Number(count || 0) > 0)
        .map(([difficulty, count]) => `- ${cognitiveLevelLabels[difficulty] || difficulty}: ${count}`)
        .join("\n");
    const questionProfileSpec = (blueprint.generationContext?.questionProfiles || [])
        .filter((profile) => Number(profile?.count || 0) > 0)
        .map((profile) => (
            `- ${profile.count} question(s): {"difficulty":"${academicDifficultyLabels[profile.difficulty] || profile.difficulty}","cognitive_level":"${cognitiveLevelLabels[profile.cognitiveLevel] || profile.cognitiveLevel}"}`
        ))
        .join("\n");
    const selectedTopics = (blueprint.selectedConcepts || []).join(', ');

    try {
        let attempt = 0;
        let lastError = null;
        let responseJson = null;
        let previousValidationErrors = null;

        while (attempt < 3) {
            try {
                const prompt = promptConfig.buildExamGenerationPrompt({
                    blueprintTitle,
                    questionTypes: examQuestionsSpec || '- No question types requested',
                    difficulty: difficultySpec || '- No explicit difficulty split provided',
                    questionProfiles: questionProfileSpec || '- No explicit difficulty/Bloom pairings provided',
                    concepts: selectedTopics || 'Use the selected material broadly',
                    instructions: blueprint.instructions || 'No extra instructions provided.',
                    materials: contextContent,
                    validationErrors: previousValidationErrors,
                });
                const rawResponseJson = await callLLM(prompt, true, {
                    teacherId: blueprint.teacherId || options.teacherId,
                    examId: options.examId || null,
                    providerConfigId: options.providerConfigId || blueprint.generationContext?.examProviderConfigId || null,
                });
                responseJson = normalizeExamResponse(rawResponseJson);
                devLogger.log('LLM', 'Received exam generation JSON candidate', {
                    blueprintId: blueprint._id?.toString?.() || String(blueprint._id),
                    attempt: attempt + 1,
                    rawResponseJson,
                    responseJson,
                });
                
                // Validate
                const validation = validateExam(responseJson);
                if (!validation.valid) {
                    devLogger.log('LLM', 'Exam generation JSON failed validation', {
                        blueprintId: blueprint._id?.toString?.() || String(blueprint._id),
                        attempt: attempt + 1,
                        validationErrors: validation.errors,
                        responseJson,
                    });
                    previousValidationErrors = JSON.stringify(validation.errors, null, 2);
                    throw new Error(`Generated JSON invalid: ${JSON.stringify(validation.errors)}`);
                }
                
                return responseJson;
            } catch (validationErr) {
                console.warn(`[LLM Service] Validation failed on attempt ${attempt+1}:`, validationErr.message);
                lastError = validationErr;
                if (!previousValidationErrors) {
                    previousValidationErrors = validationErr.message;
                }
                attempt++;
                if (attempt < 3) {
                    await sleep(config.llm.retryDelayMs * attempt);
                }
            }
        }

        throw new Error(`Failed to generate a valid exam after 3 attempts. Last error: ${lastError.message}`);
        
    } catch (error) {
        console.error("Error generating exam via LLM:", error);
        throw error;
    }
};

module.exports = { generateExamFromBlueprint, generateMindmap };
