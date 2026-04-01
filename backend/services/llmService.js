const fs = require('fs');
const path = require('path');
const config = require('../config/system.config');
const { validateExam } = require('./examValidator');

// TODO: Replace mock with real LLM (OpenAI/Ollama)

/**
 * Generate a concept mindmap from material chunks. (MOCKED)
 */
const generateMindmap = async (materialTitle, chunks) => {
    console.log(`[LLM Mock] Generating mindmap for material: ${materialTitle}`);
    
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
        title: materialTitle || "Concept Map",
        concepts: [
            {
                name: "Introduction",
                children: [
                    { name: "Basic Principles", children: [] },
                    { name: "Core Ideas", children: [] }
                ]
            },
            {
                name: "Advanced Topics",
                children: [
                    { name: "Methodologies", children: [] },
                    { name: "Applications", children: [] }
                ]
            }
        ]
    };
};

/**
 * Generate a full exam from a blueprint. (MOCKED)
 */
const generateExamFromBlueprint = async (blueprint, materialChunks) => {
    console.log(`[LLM Mock] Generating mock exam for blueprint ID: ${blueprint._id}`);
    
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    const mockExamJson = {
        examTitle: `${blueprint.title || 'Generated Exam'} - Mocked`,
        questions: [
            {
                type: "single_choice",
                difficulty: "recall",
                question: "What is 2 + 2?",
                options: ["3", "4", "5", "6"],
                correctAnswers: ["4"],
                explanation: "Basic arithmetic."
            },
            {
                type: "multiple_choice",
                difficulty: "understanding",
                question: "Which of the following are colors?",
                options: ["Red", "Square", "Blue", "Loud"],
                correctAnswers: ["Red", "Blue"],
                explanation: "Red and Blue are colors."
            },
            {
                type: "true_false",
                difficulty: "application",
                question: "The Earth is generally considered to be flat.",
                trueFalseAnswer: false,
                explanation: "The Earth is an oblate spheroid."
            }
        ]
    };

    // Validate
    const validation = validateExam(mockExamJson);
    if (!validation.valid) {
        throw new Error(`LLM MOCK returned invalid exam JSON: ${JSON.stringify(validation.errors)}`);
    }

    return mockExamJson;
};

module.exports = { generateExamFromBlueprint, generateMindmap };
