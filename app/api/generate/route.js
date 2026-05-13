import Groq from "groq-sdk";

const API_KEYS = [
  process.env.GROQ_API_KEY_1,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
];

export async function POST(request) {
  const { syllabus, hours, examType, mode, sections } = await request.json();

  if (!syllabus || syllabus.trim() === "") {
    return Response.json(
      { error: "Please paste your syllabus before generating questions." },
      { status: 400 }
    );
  }

  if (syllabus.length > 2000) {
    return Response.json(
      { error: "⚠️ Your syllabus is too long! Please paste only the key topics — keep it under 2000 characters for best results." },
      { status: 400 }
    );
  }

  const realWords = syllabus.trim().match(/\b[a-zA-Z]{3,}\b/g);
  if (!realWords || realWords.length < 3) {
    return Response.json(
      { error: "⚠️ Please enter a valid syllabus with real topics. We couldn't detect any recognizable subject matter." },
      { status: 400 }
    );
  }

  let prompt = "";

  // ── QUESTION PAPER MODE ──
  if (mode === "paper") {
    if (!sections || sections.length === 0) {
      return Response.json(
        { error: "Please add at least one section to generate a question paper." },
        { status: 400 }
      );
    }

    const sectionDescriptions = sections.map((sec, i) => {
      const sectionLabel = String.fromCharCode(65 + i); // A, B, C...
      return `Section ${sectionLabel}: ${sec.count} ${sec.type} question(s) of ${sec.marks} mark(s) each`;
    }).join("\n");

    const totalQuestions = sections.reduce((sum, sec) => sum + Number(sec.count), 0);
    const totalMarks = sections.reduce((sum, sec) => sum + Number(sec.count) * Number(sec.marks), 0);

    prompt = `
You are an expert university exam paper setter.

IMPORTANT: First check if the syllabus contains real academic topics. If it is gibberish or nonsense, respond with only: INVALID_SYLLABUS

Generate a formal university question paper based on this syllabus:
${syllabus}

The question paper must follow this exact structure:
${sectionDescriptions}

Total Questions: ${totalQuestions}
Total Marks: ${totalMarks}

STRICT FORMATTING RULES:
- Start with a header: "QUESTION PAPER" then "Total Marks: ${totalMarks}"
- Label each section clearly: "SECTION A", "SECTION B", etc.
- Number questions sequentially within each section: Q1, Q2, Q3...
- Always mention the unit/topic name before each question in brackets like [Unit 2 - Thermodynamics]
- For MCQs: provide 4 options labeled A, B, C, D. At the end of each MCQ write "Answer: X) ..." on a new line
- For Short Answer: questions must be answerable in 3-5 lines. Provide a model answer.
- For Long Answer: questions require detailed explanation. Provide a thorough answer with examples.
- For Numerical: show the formula used, then step-by-step working, then box the final answer.
- For Coding: describe a programming problem clearly with sample input/output. Provide a clean working solution with brief explanation.
- Distribute questions across all units in the syllabus. Do not repeat topics.
- Match difficulty to the question type and marks — higher marks = harder, more detailed question.

Return ONLY a valid JSON array. No markdown, no backticks, no extra text. Format:
[
  {
    "section": "A",
    "type": "MCQ",
    "marks": 1,
    "question": "[Unit 1 - Topic Name] Full question here?\nA) Option\nB) Option\nC) Option\nD) Option",
    "answer": "Answer: B) Because..."
  }
]

Generate all ${totalQuestions} questions now. Count them before finalizing — the array MUST have exactly ${totalQuestions} objects.
`;

  // ── IMPORTANT QUESTIONS MODE ──
  } else {
    const questionCount =
      hours === "1" ? 10 :
      hours === "8" ? 30 :
      20;

    const difficultyGuide =
      hours === "1"
        ? "Focus ONLY on the easiest, most frequently asked, most important questions. No hard or tricky questions."
        : hours === "2" || hours === "4"
        ? "Mix of easy (60%) and medium (40%) difficulty questions. Cover all important topics."
        : "Mix of easy (30%), medium (40%), and hard (30%) questions. Cover everything in depth.";

    const formatInstructions = {
      "Mixed": "Generate a smart mix of MCQs, short answer, and descriptive questions based on the topic type.",
      "MCQs only": `ALL ${questionCount} must be MCQs. Each must have 4 options labeled A, B, C, D. Answer field: state which option is correct and briefly why.`,
      "Coding questions only": `ALL ${questionCount} must be coding problems. Each question describes a problem with sample input/output. Answer field: provide clean working code with a one-line explanation.`,
      "Short answer": `ALL ${questionCount} must be short answer questions. Each answer must be 2-4 lines maximum — no long paragraphs.`,
      "Subjective": `ALL ${questionCount} must be subjective questions. Answers should be full paragraphs covering key concepts, examples, and implications.`,
      "Numericals only": `ALL ${questionCount} must be numerical problems. Every question must require calculation. Answer must show: formula used → step-by-step working → final answer clearly stated.`,
    };

    prompt = `
You are an expert exam question predictor for college students.

IMPORTANT: First check if the syllabus contains real academic topics. If it is gibberish or nonsense, respond with only: INVALID_SYLLABUS and nothing else.

SYLLABUS TO ANALYZE:
${syllabus}

YOUR TASK: Generate EXACTLY ${questionCount} predicted exam questions. Count before responding — not one more, not one less.

STEP 1 — UNIT ANALYSIS:
Silently identify all units and topics in the syllabus. Assign weightage to each unit based on number of topics and complexity. Heavier units get more questions. Every unit must get at least 1 question.

STEP 2 — DIFFICULTY:
${difficultyGuide}

STEP 3 — SUBJECT TYPE DETECTION:
If MATHEMATICS or pure numerical subject: all questions must be numerical problems with step-by-step solutions.
If MIXED (Physics, Chemistry, Electronics, Engineering): split numerical and conceptual questions proportionally to the syllabus content.
If PURE THEORY (History, Biology, Management, Law, Literature): all questions conceptual and descriptive.

STEP 4 — EXAM TYPE FORMAT:
${formatInstructions[examType] || formatInstructions["Mixed"]}

STEP 5 — ANSWER LENGTH RULES:
- MCQ → one line answer stating correct option and why (e.g. "B) Because Newton's third law states...")
- Short Answer → 2-4 lines
- Subjective → full paragraph with explanation, examples, and implications
- Numerical → formula → step-by-step working → final answer clearly boxed/stated
- Coding → clean working code with one-line explanation

STEP 6 — QUESTION FORMAT:
Always start each question with the unit label like: "[Unit 2 - Fluid Mechanics]"
This helps students know which unit the question is from.

Return ONLY a valid JSON array. No explanation, no markdown, no backticks. Format:
[
  {
    "question": "[Unit 1 - Topic Name] Write the full question here?",
    "answer": "Write the full answer here with steps if numerical."
  }
]

IMPORTANT: The JSON array MUST contain exactly ${questionCount} objects. Count them before finalizing.
Generate all ${questionCount} questions now.
`;
  }

  let lastError = null;

  for (let i = 0; i < API_KEYS.length; i++) {
    const apiKey = API_KEYS[i];

    if (!apiKey) {
      console.warn(`GROQ_API_KEY_${i + 1} is not set — skipping.`);
      continue;
    }

    try {
      console.log(`Trying GROQ_API_KEY_${i + 1}...`);

      const groq = new Groq({ apiKey });

      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.85,
        max_tokens: mode === "paper" ? 8000 : 4000,
      });

      let rawText = completion.choices[0].message.content;
      rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

      if (rawText.includes("INVALID_SYLLABUS")) {
        return Response.json(
          { error: "⚠️ Please enter a valid syllabus with real topics. We couldn't detect any recognizable subject matter." },
          { status: 400 }
        );
      }

      const start = rawText.indexOf("[");
      const end = rawText.lastIndexOf("]");

      if (start === -1 || end === -1) {
        return Response.json(
          { error: "AI returned an unexpected format. Please try again." },
          { status: 500 }
        );
      }

      const cleanJson = rawText.slice(start, end + 1);
      const sanitized = cleanJson.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
      const questions = JSON.parse(sanitized);

      if (mode === "paper") {
        const totalNeeded = sections.reduce((sum, sec) => sum + Number(sec.count), 0);
        console.log(`Success with GROQ_API_KEY_${i + 1} — got ${questions.length} questions`);
        return Response.json({ questions: questions.slice(0, totalNeeded) });
      }

      const questionCount =
        hours === "1" ? 10 :
        hours === "8" ? 30 :
        20;

      if (questions.length >= questionCount) {
        console.log(`Success with GROQ_API_KEY_${i + 1}`);
        return Response.json({ questions: questions.slice(0, questionCount) });
      }

      console.warn(`Got ${questions.length} questions, expected ${questionCount}. Retrying...`);

      let retryQuestions = questions;
      for (let retry = 0; retry < 2; retry++) {
        const retryCompletion = await groq.chat.completions.create({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.9,
          max_tokens: 4000,
        });

        let retryRaw = retryCompletion.choices[0].message.content;
        retryRaw = retryRaw.replace(/```json/g, "").replace(/```/g, "").trim();

        const s = retryRaw.indexOf("[");
        const e = retryRaw.lastIndexOf("]");

        if (s !== -1 && e !== -1) {
          const retryJson = retryRaw.slice(s, e + 1).replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
          const retryParsed = JSON.parse(retryJson);
          if (retryParsed.length >= questionCount) {
            console.log(`Retry ${retry + 1} succeeded.`);
            return Response.json({ questions: retryParsed.slice(0, questionCount) });
          }
          retryQuestions = retryParsed;
        }
      }

      console.warn(`Returning best attempt: ${retryQuestions.length} questions.`);
      return Response.json({ questions: retryQuestions });

    } catch (error) {
      console.error(`Key ${i + 1} error:`, JSON.stringify(error));

      const isRateLimit =
        error?.status === 429 ||
        error?.status === "429" ||
        error?.message?.includes("429") ||
        error?.message?.toLowerCase().includes("rate limit") ||
        error?.error?.message?.toLowerCase().includes("rate limit") ||
        JSON.stringify(error).toLowerCase().includes("rate limit");

      if (isRateLimit) {
        console.warn(`GROQ_API_KEY_${i + 1} hit rate limit. Trying next key...`);
        lastError = error;
        continue;
      }

      const isTooLong =
        error?.status === 413 ||
        error?.message?.toLowerCase().includes("context") ||
        error?.message?.toLowerCase().includes("too long") ||
        error?.message?.toLowerCase().includes("token") ||
        JSON.stringify(error).toLowerCase().includes("context_length") ||
        JSON.stringify(error).toLowerCase().includes("request_too_large");

      if (isTooLong) {
        return Response.json(
          {
            error: mode === "paper"
              ? "⚠️ Your question paper is too large to generate at once. Try reducing the number of questions per section."
              : "⚠️ Your syllabus is too long! Please paste only the key topics — keep it under 2000 characters for best results."
          },
          { status: 400 }
        );
      }

      console.error(`GROQ_API_KEY_${i + 1} failed:`, error.message);
      return Response.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 }
      );
    }
  }

  console.error("All Groq API keys are rate limited.");
  return Response.json(
    { error: "⚡ Too many requests right now — try again in a few minutes!" },
    { status: 429 }
  );
}