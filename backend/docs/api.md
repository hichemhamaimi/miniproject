# API Documentation

## Authentication

### `POST /auth/login`
Request body:
```json
{
  "username": "teacher1",
  "password": "secret"
}
```

Response:
```json
{
  "accessToken": "jwt",
  "role": "teacher",
  "userId": 12,
  "username": "teacher1"
}
```

Behavior:
- Returns a short-lived JWT access token in the JSON body.
- Also sets an `HttpOnly` refresh-token cookie used by `/auth/refresh`.

### `POST /auth/refresh`
Uses the `HttpOnly` refresh-token cookie to rotate the refresh session and return a new access token.

Response:
```json
{
  "accessToken": "jwt",
  "role": "teacher",
  "userId": 12,
  "username": "teacher1"
}
```

### `POST /auth/logout`
Revokes the current refresh-token session and clears the refresh-token cookie.

### `POST /auth/seb-exchange`
Used only by the Safe Exam Browser flow. Exchanges a short-lived SEB session-transfer token for a normal authenticated student session inside SEB.

## Student

### `GET /student/results`
Returns exam history, grade metrics, and correction document links for the authenticated student.

### `GET /student/results/:id`
Returns the corrected exam detail with per-question answers, expected answers, grading status, and score.

### `GET /student/results/:id/document`
Returns the stored correction document payload from MongoDB for a submitted exam.

### `GET /student/results/:id/document/view`
Returns an HTML rendering of the stored correction document for printable viewing.

### `POST /student/exams/:id/submit`
Request body:
```json
{
  "answers": [
    { "questionId": "q1", "answer": "A" },
    { "questionId": "q2", "answer": ["B", "D"] }
  ]
}
```

Response:
```json
{
  "message": "Exam submitted successfully.",
  "score": 14.5,
  "maxScore": 20,
  "passStatus": "PASS",
  "correctionDocument": {
    "id": 9,
    "mongoDocumentId": "662b0c1f7d0e4f0aa91f8a42",
    "fileName": "exam-result-44.json",
    "fileType": "application/json"
  }
}
```

## Teacher Statistics

### `GET /teacher/statistics/:id`
Available only after the exam due date.

Response sections:
- `exam`: metadata
- `global`: average, median, standard deviation, pass/fail rate, score distribution
- `students`: per-student performance summary
- `questions`: difficulty, discrimination, distractor analysis, ambiguity flags
- `rankings`: hardest-to-easiest question order
- `correlations`: top inter-question correlations

## Teacher LLM Providers

### `GET /teacher/llm-providers`
List provider configurations for the authenticated teacher.

### `POST /teacher/llm-providers`
Create a provider configuration.

Request body:
```json
{
  "provider_name": "openai",
  "label": "OpenAI Production",
  "model_name": "gpt-4o-mini",
  "base_url": "https://api.openai.com/v1",
  "api_key": "sk-...",
  "is_default": true
}
```

### `PUT /teacher/llm-providers/:id/default`
Promote a provider configuration to the teacher default.

### `PUT /teacher/llm-providers/assign/exams/:examId`
Assign a specific provider configuration to one exam.

Request body:
```json
{
  "provider_config_id": 5
}
```

## Teacher Exam Workflow

### `GET /teacher/modules/:moduleId/workflow`
Returns the module metadata, eligible groups, and all shared materials for the module, including processing status and generated mind maps.

### `POST /teacher/materials/upload`
Uploads study material for a module and starts background processing.

Request body (`multipart/form-data`):
- `file`
- `module_id`
- `title` (optional)

Material statuses now move through:
- `uploading`
- `parsing`
- `embedding`
- `generating_mindmap`
- `ready`
- `error`

### `POST /teacher/blueprints`
Creates an exam-generation blueprint from selected materials and selected topics.

Request body:
```json
{
  "moduleId": 3,
  "title": "Algorithms AI Exam Blueprint",
  "materials": ["661234abcd..."],
  "selectedConcepts": ["Sorting", "Merge Sort"],
  "selectedMaterialTitles": ["Algorithms Week 3.pdf"],
  "questionTypes": {
    "single_choice": { "count": 6, "options": 4 },
    "true_false": { "count": 4, "options": 4 }
  },
  "difficultyDistribution": {
    "recall": 4,
    "understanding": 3,
    "application": 3,
    "analysis": 0,
    "evaluation": 0
  },
  "instructions": "Focus on algorithmic complexity.",
  "totalQuestions": 10
}
```

### `POST /teacher/ai-exams/generate`
Queues AI generation from a blueprint.

### `GET /teacher/ai-exams/job/:jobId`
Polls generation status.

### `POST /teacher/ai-exams/:id/publish`
Publishes a reviewed generated exam into the live exam delivery system.

Request body:
```json
{
  "groupIds": [1, 2],
  "start_time": "2026-04-20 09:00:00",
  "end_time": "2026-04-20 11:00:00",
  "require_seb": true
}
```

Response:
```json
{
  "message": "Exam published successfully.",
  "publishedExamId": 42
}
```

When `require_seb` is `true`, students must launch the exam from a downloaded `.seb` file. The SEB launch URL now carries:
- a signed SEB launch token for exam entry validation
- a short-lived SEB session-transfer token so the student can be logged into the isolated SEB browser context automatically

## Teacher Result Export

### `GET /teacher/exams/:id/export-results`
Downloads a CSV with:
- `student_id`
- `exam_id`
- `final_grade`
