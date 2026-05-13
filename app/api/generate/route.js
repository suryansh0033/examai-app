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
      const label = String.fromCharCode(65 + i);
      return `Section ${label}: ${sec.count} ${sec.type} question(s), ${sec.marks} mark(s) each`;
    }).join("\n");

    const totalQuestions = sections.reduce((sum, sec) => sum + Number(sec.count), 0);
    const totalMarks = sections.reduce((sum, sec) => sum + Number(sec.count) * Number(sec.marks), 0);

    // ✅ Lean prompt — plain numbered questions, no answers, no JSON schema
    prompt = `You are an exam paper setter. Generate a university exam paper based on this syllabus:
${syllabus}

Paper structure (Total: ${totalQuestions} questions, ${totalMarks} marks):
${sectionDescriptions}

Rules:
- Output ONLY section headings and numbered questions. No answers, no explanations, no extra text.
- Format each section as: "SECTION A" then numbered questions like "1. Question text"
- For MCQs: include options (a) (b) (c) (d) inside the question
- For Numericals: include all required values in the question
- Spread questions across syllabus topics. No repeats.
- Do NOT include any answers or hints.`;

  // ── IMPORTANT QUESTIONS MODE ──
  } else {
    const questionCount =
      hours === "1" ? 10 :
      hours === "8" ? 30 :
      20;

    const difficultyGuide =
      hours === "1"
        ? "Focus ONLY on the easiest, most frequently asked, most important questions."
        : hours === "2" || hours === "4"
        ? "Mix of easy (60%) and medium (40%) difficulty questions. Cover all important topics."
        : "Mix of easy (30%), medium (40%), and hard (30%) questions. Cover everything in depth.";

    const formatInstructions = {
      "Mixed": "Generate a smart mix of MCQs, short answer, and descriptive questions based on the topic type.",
      "MCQs only": `ALL ${questionCount} must be MCQs. Each must have 4 options labeled A) B) C) D) inside the question text.`,
      "Coding questions only": `ALL ${questionCount} must be coding problems. Each question describes a problem with sample input/output.`,
      "Short answer": `ALL ${questionCount} must be short answer questions.`,
      "Subjective": `ALL ${questionCount} must be subjective questions requiring detailed explanation.`,
      "Numericals only": `ALL ${questionCount} must be numerical problems with all required values provided in the question.`,
    };

    prompt = `You are an expert exam question predictor for college students.

IMPORTANT: If the syllabus is gibberish or nonsense, respond with only: INVALID_SYLLABUS

SYLLABUS:
${syllabus}

Generate EXACTLY ${questionCount} predicted exam questions. No answers — questions only.

STEP 1 — UNIT ANALYSIS:
Identify all units/topics. Give more questions to heavier units. Every unit gets at least 1 question.

STEP 2 — DIFFICULTY:
${difficultyGuide}

STEP 3 — SUBJECT TYPE:
If MATHEMATICS: all numerical problems.
If MIXED (Physics, Chemistry, Electronics, Engineering): split numerical and conceptual proportionally.
If PURE THEORY: all conceptual and descriptive questions.

STEP 4 — FORMAT:
${formatInstructions[examType] || formatInstructions["Mixed"]}

STEP 5 — QUESTION FORMAT:
Always start each question with the unit label like: [Unit 2 - Fluid Mechanics]
For MCQs include all 4 options A) B) C) D) inside the question field.
For Numericals include all required values in the question.
Do NOT include any answers.

Return ONLY a valid JSON array. No explanation, no markdown, no backticks:
[
  {
    "question": "[Unit 1 - Topic Name] Write the full question here?"
  }
]

The array MUST contain exactly ${questionCount} objects. Count before finalizing.
Generate all ${questionCount} questions now.`;
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
        // ✅ Paper mode returns plain text, so 3000 tokens is plenty
        max_tokens: mode === "paper" ? 3000 : 4000,
      });

      const rawText = completion.choices[0].message.content?.trim() ?? "";

      // ── PAPER MODE: return plain text directly ──
      if (mode === "paper") {
        if (rawText.includes("INVALID_SYLLABUS")) {
          return Response.json(
            { error: "⚠️ Please enter a valid syllabus with real topics. We couldn't detect any recognizable subject matter." },
            { status: 400 }
          );
        }
        console.log(`Success with GROQ_API_KEY_${i + 1} — paper mode`);
        // Return as { paperText: "..." } so the frontend can render it directly
        return Response.json({ paperText: rawText });
      }

      // ── IMPORTANT QUESTIONS MODE: parse JSON as before ──
      let cleaned = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

      if (cleaned.includes("INVALID_SYLLABUS")) {
        return Response.json(
          { error: "⚠️ Please enter a valid syllabus with real topics. We couldn't detect any recognizable subject matter." },
          { status: 400 }
        );
      }

      const start = cleaned.indexOf("[");
      const end = cleaned.lastIndexOf("]");

      if (start === -1 || end === -1) {
        return Response.json(
          { error: "AI returned an unexpected format. Please try again." },
          { status: 500 }
        );
      }

      const cleanJson = cleaned.slice(start, end + 1);
      const sanitized = cleanJson.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
      const questions = JSON.parse(sanitized);

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

      // ✅ Only match genuine context-length errors — NOT generic "token" mentions
      //    which appear in unrelated Groq errors and cause false positives.
      const errorStr = JSON.stringify(error).toLowerCase();
      const isTooLong =
        error?.status === 413 ||
        errorStr.includes("context_length_exceeded") ||
        errorStr.includes("request_too_large") ||
        errorStr.includes("maximum context length") ||
        errorStr.includes("reduce the length") ||
        (errorStr.includes("too long") && !errorStr.includes("rate limit"));

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