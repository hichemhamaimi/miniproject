const fs = require('fs');
const path = require('path');
const config = require('../config/system.config');
const { validateExam } = require('./examValidator');
require('dotenv').config();

const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");

/**
 * Helper function to call the appropriate provider
 */
async function callLLM(prompt, isJsonMode = true, modelOverride = null) {
    const provider = process.env.LLM_PROVIDER || 'gemini';

    if (provider === 'gemini') {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

        const genAI = new GoogleGenerativeAI(apiKey);
        const modelName = modelOverride || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
        
        const modelConfig = {
            model: modelName,
            generationConfig: {
                temperature: config.llm.temperature || 0.3,
            }
        };

        if (isJsonMode) {
             modelConfig.generationConfig.responseMimeType = "application/json";
        }
        
        const model = genAI.getGenerativeModel(modelConfig);
        const result = await model.generateContent(prompt);
        let text = result.response.text();
        
        if (isJsonMode) {
             // Gemini might wrap JSON in markdown block even with application/json
             text = text.replace(/```json/g, '').replace(/```/g, '').trim();
             return JSON.parse(text);
        }
        return text;

    } else if (provider === 'ollama') {
        const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        const ollamaModel = modelOverride || process.env.OLLAMA_MODEL || 'llama3';
        
        const body = {
            model: ollamaModel,
            prompt: prompt,
            stream: false,
            options: {
                temperature: config.llm.temperature || 0.3
            }
        };
        
        if (isJsonMode) {
            body.format = "json";
        }

        const response = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Ollama API error: ${response.status} ${errBody}`);
        }

        const data = await response.json();
        const text = data.response.trim();
        
        if (isJsonMode) {
             return JSON.parse(text);
        }
        return text;
    } else {
        throw new Error(`Unsupported LLM_PROVIDER: ${provider}`);
    }
}

/**
 * Generate a concept mindmap from material chunks.
 */
const generateMindmap = async (materialTitle, chunks) => {
    console.log(`[LLM Service] Generating mindmap for material: ${materialTitle}`);
    
    // Concatenate chunks for context (truncated to avoid token bounds if needed)
    // Simple truncation for now: take first 10 chunks
    const contextContent = chunks.slice(0, 10).map(c => typeof c === 'string' ? c : c.text).join("\n\n---\n\n");
    
    // We want a JSON structure with { title: string, concepts: [ { name, children: [...] } ] }
    const prompt = `
You are an expert educator. Extract a hierarchical mindmap of concepts from the following study material.

Material Title: ${materialTitle}
Context Material:
${contextContent}

Output format must be strictly a JSON object with this exact schema:
{
  "title": "A summary title for the core topic",
  "concepts": [
    {
       "name": "Main Concept 1",
       "children": [
         { "name": "Subconcept 1.1", "children": [] },
         { "name": "Subconcept 1.2", "children": [] }
       ]
    }
  ]
}

Return ONLY the raw JSON object, no markdown formatting.
`;

    try {
        const responseJson = await callLLM(prompt, true);
        return responseJson;
    } catch (error) {
        console.error("Error generating mindmap via LLM:", error);
        throw error;
    }
};

/**
 * Generate a full exam from a blueprint.
 */
const generateExamFromBlueprint = async (blueprint, materialChunks) => {
    console.log(`[LLM Service] Generating exam for blueprint ID: ${blueprint._id}`);
    
    const contextContent = materialChunks.map(c => typeof c === 'string' ? c : c.text).join("\n\n---\n\n");

    // Constructing the exact conditions and requirements based on blueprint
    const examQuestionsSpec = blueprint.configuration.questions.map((q, idx) => {
        return `- Type: ${q.type}, Count: ${q.count}, Difficulty: ${q.difficulty}`;
    }).join("\n");

    const prompt = `
You are an expert professor writing an exam based ONLY on the provided study material.
You must strictly follow the blueprint specification and create the exam in a highly structured JSON format.

Exam Blueprint Title: ${blueprint.title}
Requested Questions Specification:
${examQuestionsSpec}

Study Material Context:
${contextContent}

Your job is to generate exactly the requested number and types of questions.
All questions MUST be answerable using only the provided context.
Include an 'explanation' field for every question that explains why the answer is correct based on the text.

Output format must be strictly a JSON object with this exact schema:
{
  "examTitle": "${blueprint.title}",
  "questions": [
    {
      "type": "single_choice | multiple_choice | true_false | matching | ordering | negative_qcm",
      "difficulty": "recall | understanding | application | analysis | evaluation",
      "question": "The question text",
      "options": ["Option A", "Option B", "Option C", "Option D"], // Required for choice types
      "correctAnswers": ["Option B"], // Required for choice types. Must exactly match one or more of the 'options'.
      "trueFalseAnswer": true, // Required for true_false type
      "matchingPairs": [{"left": "Term 1", "right": "Definition 1"}, {"left": "Term 2", "right": "Definition 2"}], // Required for matching type
      "orderedItems": ["First step", "Second step", "Third step"], // Required for ordering type
      "explanation": "Detailed explanation."
    }
  ]
}

Very Important Constraints:
- For 'single_choice', 'multiple_choice', and 'negative_qcm', you MUST provide an array of exactly 4 strings for 'options'. 'correctAnswers' MUST be an array of strings that exactly match items in the 'options' array.
- For 'true_false', provide a boolean value for 'trueFalseAnswer'.
- For 'matching', provide an array of objects for 'matchingPairs'.
- For 'ordering', provide an array of strings in the correct sequence for 'orderedItems'.

Return ONLY the raw JSON object. Do not include markdown code blocks.
`;

    try {
        let attempt = 0;
        let lastError = null;
        let responseJson = null;

        while (attempt < 3) {
            try {
                responseJson = await callLLM(prompt, true);
                
                // Validate
                const validation = validateExam(responseJson);
                if (!validation.valid) {
                    throw new Error(`Generated JSON invalid: ${JSON.stringify(validation.errors)}`);
                }
                
                return responseJson;
            } catch (validationErr) {
                console.warn(`[LLM Service] Validation failed on attempt ${attempt+1}:`, validationErr.message);
                lastError = validationErr;
                attempt++;
            }
        }

        throw new Error(`Failed to generate a valid exam after 3 attempts. Last error: ${lastError.message}`);
        
    } catch (error) {
        console.error("Error generating exam via LLM:", error);
        throw error;
    }
};

module.exports = { generateExamFromBlueprint, generateMindmap };
