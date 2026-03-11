// Using native fetch

async function testCreateExam() {
    try {
        const payload = {
            title: "Midterm Exam - Software Engineering",
            module_id: 101,
            examData: {
                questions: [
                    { q: "What is Agile?", options: ["A methodology", "A programming language"], answer: 0 }
                ]
            }
        };

        const response = await fetch('http://localhost:3500/teacher/exams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log('Response status:', response.status);
        console.log('Response body:', data);
    } catch (err) {
        console.error('Test failed:', err);
    }
}

testCreateExam();
