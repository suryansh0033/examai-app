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

  const allWords = syllabus.trim().match(/\b[a-zA-Z]{3,}\b/g) || [];
  const realWords = allWords.filter((w) => {
    const lower = w.toLowerCase();
    const hasVowel = /[aeiou]/.test(lower);
    const hasConsonant = /[bcdfghjklmnpqrstvwxyz]/.test(lower);
    const notRepeated = !/^(.)\1+$/.test(lower);
    return hasVowel && hasConsonant && notRepeated;
  });
  if (realWords.length < 5) {
    return Response.json(
      { error: "⚠️ Please enter a valid syllabus with real topics. We couldn't detect any recognizable subject matter." },
      { status: 400 }
    );
  }

  const nonLatinCount = (syllabus.match(/[^\x00-\x7F]/g) || []).length;
  const nonLatinRatio = nonLatinCount / syllabus.trim().length;
  if (nonLatinRatio > 0.3) {
    return Response.json(
      { error: "⚠️ Please paste your syllabus in English. Non-English text isn't supported yet — we're working on it!" },
      { status: 400 }
    );
  }

  let prompt = "";

  if (mode === "paper") {
    if (!sections || sections.length === 0) {
      return Response.json(
        { error: "Please add at least one section to generate a question paper." },
        { status: 400 }
      );
    }

    const sectionDescriptions = sections.map((sec, i) => {
      const sectionLabel = String.fromCharCode(65 + i);
      return `Section ${sectionLabel}: ${sec.count} ${sec.type} question(s) of ${sec.marks} mark(s) each`;
    }).join("\n");

    const totalQuestions = sections.reduce((sum, sec) => sum + Number(sec.count), 0);

    prompt = `You are an exam paper setter. Syllabus: ${syllabus}

If syllabus is gibberish, reply only: INVALID_SYLLABUS

Generate exactly ${totalQuestions} questions for this paper structure:
${sectionDescriptions}

Rules:
- Add [Unit - Topic] before each question
- MCQ: include 4 options labeled A) B) C) D) separated by \\n inside the question string (use the literal characters backslash-n, NOT actual line breaks)
- Short Answer: clear concise question only
- Long Answer: detailed question only
- Numerical: include all required values/data in the question
- Coding: problem statement with sample input/output in the question
- Spread questions across all syllabus units
- Every question must be completely unique — do NOT repeat the same concept, topic, or problem type twice, even in different wording or phrasing
- Before finalizing, scan all questions and remove any duplicates or near-duplicates
- Do NOT ask "Draw", "Sketch", or "Show the diagram of" anything — this is a text-based app. Replace any such question with "Explain" or "Describe" instead
- NEVER include the answer to a question within the question itself
- Use ONLY the exact topics and technologies mentioned in the syllabus. Do NOT substitute similar alternatives
- Do NOT include any answers

Return ONLY a JSON array, no markdown:
[{"section":"A","type":"MCQ","marks":1,"question":"[Unit 1 - Topic] Question?\\nA) ...\\nB) ...\\nC) ...\\nD) ..."}]

Generate all ${totalQuestions} objects now.`;

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
      "Mixed": "Generate a smart mix of MCQs, short answer, and descriptive questions based on the topic type. For every MCQ you generate, you MUST include exactly 4 options labeled A) B) C) D) on separate lines — a MCQ without options is INVALID. Never ask the student to draw or sketch anything. Never ask the same concept twice in different wording.",
      "MCQs only": `ALL ${questionCount} questions MUST be MCQs. This is NON-NEGOTIABLE and overrides everything else including subject type.
Every single question must have exactly 4 options on separate lines labeled A) B) C) D).
Format EVERY question exactly like this example:
[Unit 1 - Topic] What is the unit of force?
A) Joule
B) Newton
C) Watt
D) Pascal
Do NOT generate numericals, coding problems, or plain questions without options. ONLY MCQs with 4 labeled options. A question without A) B) C) D) options is INVALID.`,
      "Coding questions only": `ALL ${questionCount} must be coding problems. Each question describes a problem with sample input/output. No other question type is allowed.`,
      "Short answer": `ALL ${questionCount} must be short answer questions. No MCQs, no coding, no numericals.`,
      "Subjective": `ALL ${questionCount} must be subjective questions requiring detailed explanation. No MCQs, no coding, no numericals.`,
      "Numericals only": `ALL ${questionCount} must be numerical problems with all required values provided in the question. No MCQs, no coding, no theory questions.`,
    };

    prompt = `You are an expert exam question predictor for college students.

IMPORTANT: If the syllabus is gibberish or nonsense, respond with only: INVALID_SYLLABUS

SYLLABUS:
${syllabus}

Generate EXACTLY ${questionCount} predicted exam questions. No answers — questions only.

STEP 1 — UNIT ANALYSIS:
Identify all units/topics. Give more questions to heavier units. Every unit gets at least 1 question.
Every question must be completely unique — no two questions can ask the same thing, even in different wording. Before finalizing, scan all questions and remove any duplicates or near-duplicates.

STEP 2 — DIFFICULTY:
${difficultyGuide}

STEP 3 — SUBJECT TYPE (applies ONLY when Format is Mixed):
If MATHEMATICS: all numerical problems.
If MIXED (Physics, Chemistry, Electronics, Engineering): split numerical and conceptual proportionally.
If PURE THEORY: all conceptual and descriptive questions.

⚠️ OVERRIDE RULE: If the FORMAT in STEP 4 is anything other than Mixed, STEP 3 is completely ignored. The FORMAT in STEP 4 takes ABSOLUTE PRIORITY.

STEP 4 — FORMAT (THIS OVERRIDES STEP 3 IF NOT MIXED):
${formatInstructions[examType] || formatInstructions["Mixed"]}

STEP 5 — QUESTION FORMAT RULES:
- Always start each question with the unit label like: [Unit 2 - Fluid Mechanics]
- For MCQs include all 4 options A) B) C) D) each on a separate line inside the question field
- For Numericals include all required values in the question
- Do NOT include any answers
- Every question must be completely unique — do NOT repeat the same concept, topic, formula, or problem type twice, even in different wording or phrasing
- Do NOT ask "Draw", "Sketch", or "Show the diagram of" anything — this is a text-based app. Replace any such question with "Explain" or "Describe" instead
- Use ONLY the exact topics and technologies mentioned in the syllabus. Do NOT substitute similar alternatives

Return ONLY a valid JSON array. No explanation, no markdown, no backticks:
[
  {
    "question": "[Unit 1 - Topic Name] Write the full question here?"
  }
]

CRITICAL COUNT RULE: The array MUST contain EXACTLY ${questionCount} objects — no more, no less.
Number each question mentally as you write it: 1, 2, 3... up to ${questionCount}.
Do NOT stop early. Do NOT summarize. Write every single question out in full.
After writing, count the array. If it has fewer than ${questionCount} objects, add more before returning.
Generate all ${questionCount} questions now.`;
  }

  let lastError = null;

  for (let i = 0; i < API_KEYS.length; i++) {
    const apiKey = API_KEYS[i];

    if (!apiKey) {
      console.warn(`GROQ_API_KEY_${i + 1} is not set — skipping.`);
      lastError = new Error("API key not set");
      continue;
    }

    try {
      console.log(`Trying GROQ_API_KEY_${i + 1}...`);

      const groq = new Groq({ apiKey });

      const questionCount =
        hours === "1" ? 10 :
        hours === "8" ? 30 :
        20;

      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.75,
        max_tokens: mode === "paper"
          ? Math.min(sections.reduce((sum, sec) => sum + Number(sec.count), 0) * 300 + 500, 6000)
          : questionCount === 30 ? 6000 : 4000,
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
        console.warn(`GROQ_API_KEY_${i + 1} returned unexpected format. Trying next key...`);
        lastError = new Error("Unexpected format");
        continue;
      }

      const cleanJson = rawText.slice(start, end + 1);
      const sanitized = cleanJson.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");

      let questions;
      try {
        questions = JSON.parse(sanitized);
      } catch (e) {
        const aggressive = sanitized
          .replace(/[\r\n\t]/g, " ")
          .replace(/\s{2,}/g, " ");
        try {
          questions = JSON.parse(aggressive);
        } catch (e2) {
          console.warn(`Key ${i + 1} JSON parse failed. Trying next key...`);
          lastError = new Error("JSON parse failed");
          continue;
        }
      }

      if (mode === "paper") {
        const totalNeeded = sections.reduce((sum, sec) => sum + Number(sec.count), 0);
        console.log(`Success with GROQ_API_KEY_${i + 1} — got ${questions.length} questions`);
        return Response.json({ questions: questions.slice(0, totalNeeded) });
      }

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
          temperature: 0.75,
          max_tokens: questionCount === 30 ? 6000 : 4000,
        });

        let retryRaw = retryCompletion.choices[0].message.content;
        retryRaw = retryRaw.replace(/```json/g, "").replace(/```/g, "").trim();

        const s = retryRaw.indexOf("[");
        const e = retryRaw.lastIndexOf("]");

        if (s !== -1 && e !== -1) {
          const retryJson = retryRaw.slice(s, e + 1).replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
          try {
            const retryParsed = JSON.parse(retryJson);
            if (retryParsed.length >= questionCount) {
              console.log(`Retry ${retry + 1} succeeded.`);
              return Response.json({ questions: retryParsed.slice(0, questionCount) });
            }
            retryQuestions = retryParsed;
          } catch (retryParseErr) {
            console.warn(`Retry ${retry + 1} JSON parse failed. Continuing...`);
          }
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
        error?.message?.toLowerCase().includes("too long") ||
        error?.message?.toLowerCase().includes("context_length") ||
        error?.message?.toLowerCase().includes("request_too_large") ||
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
      lastError = error;
      continue;
    }
  }

  const allRateLimited = lastError && (
    lastError?.status === 429 ||
    JSON.stringify(lastError).toLowerCase().includes("rate limit")
  );

  if (allRateLimited) {
    console.error("All Groq API keys are rate limited.");
    return Response.json(
      { error: "⚡ Too many requests right now — try again in a few minutes!" },
      { status: 429 }
    );
  }

  console.error("All Groq API keys failed.", lastError?.message);
  return Response.json(
    { error: "Something went wrong on our end. Please try again." },
    { status: 500 }
  );
}