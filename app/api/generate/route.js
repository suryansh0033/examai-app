import Groq from "groq-sdk";

// This creates a connection to the Groq API using your secret key
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(request) {
  // Read the syllabus, hours, and exam type the user sent from the front-end
  const { syllabus, hours, examType } = await request.json();

  // Safety check: make sure the user actually typed something
  if (!syllabus || syllabus.trim() === "") {
    return Response.json(
      { error: "Please paste your syllabus before generating questions." },
      { status: 400 }
    );
  }

  // Format instructions based on the exam type the user selected
  const formatInstructions = {
    "Mixed": "Generate a mix of question types: MCQs, short answer, and descriptive questions.",
    "MCQs only": "Generate ALL 20 as MCQs. Each must have 4 options labeled A, B, C, D. In the answer field, write which option is correct and why briefly. Example answer: 'B) Because...'",
    "Coding questions only": "Generate ALL 20 as coding problems. Each question should describe a problem to solve with expected input/output examples. In the answer field, provide a clean solution with a one-line explanation.",
    "Short answer": "Generate ALL 20 as short answer questions. Each answer must be 2-3 lines maximum.",
    "Subjective": "Generate ALL 20 as subjective questions requiring detailed explanations. Answers should be thorough, covering key concepts, examples, and implications.",
  };

  // Build the prompt we send to Groq
  const prompt = `
You are an expert exam question predictor for college students.

A student has ${hours} hour(s) left before their exam. Exam type: ${examType}. ${formatInstructions[examType]}

First, silently analyze the syllabus below and decide which category it falls into:

If MATHEMATICS (pure maths, numerical methods, statistics):
- All 20 questions must be numerical problems requiring calculation, derivation, or equation solving.
- No definitions or conceptual questions at all.
- Every answer must show step-by-step working with the final answer clearly stated.

If MIXED NUMERICAL + THEORY (Physics, Chemistry, Electronics, Engineering subjects):
- Analyze the syllabus topics individually. Some topics will be numerical, some will be conceptual.
- For numerical topics (formulas, laws with calculations, circuit problems, reactions with quantities): generate calculation-based problems with step-by-step answers.
- For theory topics (definitions, principles, mechanisms, explanations): generate conceptual questions with clear descriptive answers.
- Split the 20 questions proportionally — if the syllabus is 60% numerical topics, roughly 12 questions should be numerical and 8 theory. Match the balance to the syllabus content.
- Do NOT force every question to be numerical just because the subject has some maths in it.

If PURE THEORY (History, Biology concepts, Law, Literature, Management):
- All 20 questions should be conceptual, descriptive, or application-based.
- Answers should explain clearly in 2-4 sentences matching the exam type format.
- No numerical problems.

Syllabus:
${syllabus}

Return ONLY a valid JSON array. No explanation, no markdown, no backticks, no extra text. Format exactly like this:
[
  {
    "question": "Write the question here?",
    "answer": "Write the answer here with steps if numerical."
  }
]

Generate all 20 questions now.
`;

  // Call Groq and wait for the response
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 4000,
  });

  // Extract the text Groq replied with
  let rawText = completion.choices[0].message.content;

  // Strip markdown code fences if the model added them anyway
  rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

  // Find the first [ and last ] to extract only the JSON array
  const start = rawText.indexOf("[");
  const end = rawText.lastIndexOf("]");

  if (start === -1 || end === -1) {
    return Response.json(
      { error: "AI returned an unexpected format. Please try again." },
      { status: 500 }
    );
  }

  const cleanJson = rawText.slice(start, end + 1);

// Fix bad escape characters the AI puts in JSON strings
// (LaTeX like \frac, \times, or code backslashes break JSON.parse)
const sanitized = cleanJson
  .replace(/\\(?!["\\/bfnrtu])/g, "\\\\"); // escape any lone backslash

// Parse Groq's JSON reply into a JavaScript array
const questions = JSON.parse(sanitized);

  // Send the questions back to the front-end
  return Response.json({ questions });
}