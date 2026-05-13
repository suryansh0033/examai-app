"use client";

type Question = {
  question: string;
  section?: string;
  type?: string;
  marks?: number;
};

type Section = {
  id: number;
  type: string;
  count: number;
  marks: number;
};

import { useState } from "react";

const MARKS_OPTIONS: Record<string, number[]> = {
  "MCQ": [0.5, 1, 2],
  "Short Answer": [2, 3, 5],
  "Long Answer": [5, 10, 20],
  "Numerical": [2, 5, 10],
  "Coding": [5, 10, 20],
};

export default function Home() {
  const [syllabus, setSyllabus] = useState("");
  const [hours, setHours] = useState("2");
  const [examType, setExamType] = useState("Mixed");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [paperText, setPaperText] = useState(""); // ✅ plain text for paper mode
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [mode, setMode] = useState<"important" | "paper">("important");

  const [sections, setSections] = useState<Section[]>([
    { id: 1, type: "MCQ", count: 10, marks: 1 },
  ]);
  const [nextId, setNextId] = useState(2);

  const totalMarks = sections.reduce(
    (sum, sec) => sum + sec.count * sec.marks,
    0
  );

  function addSection() {
    setSections((prev) => [
      ...prev,
      { id: nextId, type: "MCQ", count: 5, marks: 1 },
    ]);
    setNextId((n) => n + 1);
  }

  function removeSection(id: number) {
    setSections((prev) => prev.filter((s) => s.id !== id));
  }

  function updateSection(id: number, field: keyof Section, value: string | number) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        if (field === "type") {
          const newMarks = MARKS_OPTIONS[value as string][0];
          return { ...s, type: value as string, marks: newMarks };
        }
        return { ...s, [field]: Number(value) };
      })
    );
  }

  async function handleGenerate() {
    setLoading(true);
    setError("");
    setQuestions([]);
    setPaperText(""); // ✅ reset paper text too

    if (syllabus.length > 2000) return;

    if (mode === "paper" && sections.length === 0) {
      setError("Please add at least one section before generating.");
      setLoading(false);
      return;
    }

    try {
      const body =
        mode === "paper"
          ? { syllabus, mode: "paper", sections }
          : { syllabus, hours, examType, mode: "important" };

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      const rawContent = JSON.stringify(data);
      if (rawContent.includes("INVALID_SYLLABUS")) {
        setError(
          "⚠️ Please enter a valid syllabus with real topics. We couldn't detect any recognizable subject matter."
        );
        return;
      }

      if (!response.ok) {
        if (response.status === 429) {
          setError("⚡ Too many requests right now — try again in a few minutes!");
        } else {
          setError(data.error || "Something went wrong. Please try again.");
        }
        return;
      }

      // ✅ Paper mode: use plain text. Important mode: use questions array.
      if (mode === "paper") {
        setPaperText(data.paperText || "");
      } else {
        setQuestions(data.questions);
      }
    } catch (err) {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const questionCount =
    hours === "1" ? 10 : hours === "8" ? 30 : 20;

  return (
    <main className="min-h-screen bg-[#0f0f0f] text-white px-4 py-10 font-sans">

      {/* ── Header ── */}
      <div className="text-center mb-10">
        <h1 className="text-5xl font-black tracking-tight text-amber-400">
          CramAI
        </h1>
        <p className="text-gray-400 mt-2 text-sm max-w-md mx-auto">
          Built for college students — paste your syllabus, get the most important exam questions instantly. Stop studying everything, study what matters.
        </p>
      </div>

      {/* ── Mode Toggle ── */}
      <div className="max-w-xl mx-auto mb-6 flex gap-3">
        <button
          onClick={() => { setMode("important"); setQuestions([]); setPaperText(""); setError(""); }}
          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all duration-200 border ${
            mode === "important"
              ? "bg-amber-400 text-black border-amber-400"
              : "bg-transparent text-gray-400 border-white/10 hover:border-amber-400/50 hover:text-white"
          }`}
        >
          ⭐ Important Questions
        </button>
        <button
          onClick={() => { setMode("paper"); setQuestions([]); setPaperText(""); setError(""); }}
          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all duration-200 border ${
            mode === "paper"
              ? "bg-amber-400 text-black border-amber-400"
              : "bg-transparent text-gray-400 border-white/10 hover:border-amber-400/50 hover:text-white"
          }`}
        >
          📄 Question Paper
        </button>
      </div>

      {/* ── Input Card ── */}
      <div className="max-w-xl mx-auto bg-[#1a1a1a] rounded-2xl p-6 shadow-xl border border-white/10">

        {/* Syllabus textarea */}
        <label className="block text-sm font-semibold text-gray-300 mb-2">
          Your Syllabus
        </label>
        <textarea
          className="w-full bg-[#0f0f0f] text-white border border-white/10 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-600 transition"
          rows={8}
          placeholder="Paste your syllabus here… e.g. Unit 1: Thermodynamics, Unit 2: Fluid Mechanics…"
          value={syllabus}
          onChange={(e) => setSyllabus(e.target.value)}
        />
        <p className={`text-right text-xs mt-1 ${syllabus.length > 2000 ? "text-red-400" : "text-gray-500"}`}>
          {syllabus.length} / 2000 characters
        </p>

        {/* ── IMPORTANT QUESTIONS OPTIONS ── */}
        {mode === "important" && (
          <>
            <label className="block text-sm font-semibold text-gray-300 mt-5 mb-2">
              Hours Left Before Exam
            </label>
            <select
              className="w-full bg-[#0f0f0f] text-white border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            >
              <option value="1">1 Hour — Focus on only the most likely questions</option>
              <option value="2">2 Hours — Key topics covered</option>
              <option value="4">4 Hours — Broad coverage</option>
              <option value="6">6 Hours — Detailed preparation</option>
              <option value="8">8 Hours — Full exam prep</option>
            </select>

            <label className="block text-sm font-semibold text-gray-300 mt-5 mb-2">
              Exam Type
            </label>
            <select
              className="w-full bg-[#0f0f0f] text-white border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
              value={examType}
              onChange={(e) => setExamType(e.target.value)}
            >
              <option value="Mixed">Mixed — variety of question types</option>
              <option value="MCQs only">MCQs only — 4 options with correct answer</option>
              <option value="Coding questions only">Coding questions only — problem + expected output</option>
              <option value="Short answer">Short answer — 2 to 3 lines</option>
              <option value="Subjective">Subjective — detailed answers</option>
              <option value="Numericals only">Numericals only — step by step calculations</option>
            </select>
          </>
        )}

        {/* ── QUESTION PAPER BUILDER ── */}
        {mode === "paper" && (
          <div className="mt-5">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-300">
                Paper Sections
              </label>
              <span className="text-xs text-amber-400 font-bold bg-amber-400/10 px-3 py-1 rounded-full">
                Total: {totalMarks} Marks
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {sections.map((sec, i) => {
                const sectionLabel = String.fromCharCode(65 + i);
                const marksOptions = MARKS_OPTIONS[sec.type];
                return (
                  <div
                    key={sec.id}
                    className="bg-[#0f0f0f] border border-white/10 rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md">
                        SECTION {sectionLabel}
                      </span>
                      {sections.length > 1 && (
                        <button
                          onClick={() => removeSection(sec.id)}
                          className="text-xs text-red-400 hover:text-red-300 transition"
                        >
                          ✕ Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Type</p>
                        <select
                          className="w-full bg-[#1a1a1a] text-white border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 transition"
                          value={sec.type}
                          onChange={(e) => updateSection(sec.id, "type", e.target.value)}
                        >
                          <option value="MCQ">MCQ</option>
                          <option value="Short Answer">Short Answer</option>
                          <option value="Long Answer">Long Answer</option>
                          <option value="Numerical">Numerical</option>
                          <option value="Coding">Coding</option>
                        </select>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 mb-1">Questions</p>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          className="w-full bg-[#1a1a1a] text-white border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 transition"
                          value={sec.count}
                          onChange={(e) => updateSection(sec.id, "count", e.target.value)}
                        />
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 mb-1">Marks each</p>
                        <select
                          className="w-full bg-[#1a1a1a] text-white border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 transition"
                          value={sec.marks}
                          onChange={(e) => updateSection(sec.id, "marks", e.target.value)}
                        >
                          {marksOptions.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <p className="text-right text-xs text-gray-600 mt-2">
                      {sec.count} × {sec.marks} = <span className="text-gray-400">{sec.count * sec.marks} marks</span>
                    </p>
                  </div>
                );
              })}
            </div>

            <button
              onClick={addSection}
              disabled={sections.length >= 6}
              className="mt-3 w-full py-2.5 rounded-xl border border-dashed border-white/20 text-gray-400 text-sm hover:border-amber-400/50 hover:text-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              + Add Section
            </button>

            <div className="mt-4 flex justify-between items-center bg-amber-400/5 border border-amber-400/20 rounded-xl px-4 py-3">
              <span className="text-sm text-gray-300">Total Marks</span>
              <span className="text-xl font-black text-amber-400">{totalMarks}</span>
            </div>

            {sections.reduce((s, sec) => s + sec.count, 0) > 20 && (
              <p className="mt-3 text-xs text-amber-400 text-center">
                ⚠️ Large papers may generate slowly. Keep total questions under 20 for best results.
              </p>
            )}
          </div>
        )}

        {/* ── Generate Button ── */}
        <button
          onClick={handleGenerate}
          disabled={loading || syllabus.trim() === "" || syllabus.length > 2000}
          className="mt-6 w-full bg-amber-400 hover:bg-amber-300 disabled:bg-amber-400/30 disabled:cursor-not-allowed text-black font-bold py-4 rounded-xl text-base transition-all duration-200 active:scale-95"
        >
          {loading
            ? "Generating…"
            : mode === "paper"
            ? "Generate Question Paper"
            : "Generate Exam Questions"}
        </button>

        {/* Error message */}
        {error && (
          <p className={`mt-4 text-sm text-center font-medium ${
            error.startsWith("⚡") ? "text-amber-400" : "text-red-400"
          }`}>
            {error}
          </p>
        )}
      </div>

      {/* ── Loading Spinner ── */}
      {loading && (
        <div className="max-w-xl mx-auto mt-10 flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">
            {mode === "paper"
              ? "CramAI is building your question paper..."
              : "CramAI is predicting your questions..."}
          </p>
        </div>
      )}

      {/* ── IMPORTANT QUESTIONS OUTPUT ── */}
      {questions.length > 0 && mode === "important" && (
        <div className="max-w-xl mx-auto mt-10">
          <h2 className="text-xl font-bold text-amber-400 mb-5">
            📋 {questionCount} Predicted Exam Questions
          </h2>

          <div className="flex flex-col gap-4">
            {questions.map((item, index) => (
              <div
                key={index}
                className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-5 shadow-md"
              >
                <p className="text-sm font-bold text-amber-400 mb-1">
                  Q{index + 1}.
                </p>
                <p className="text-white text-sm font-medium leading-relaxed whitespace-pre-line">
                  {item.question}
                </p>
              </div>
            ))}
          </div>

          <p className="text-center text-gray-600 text-xs mt-8 mb-4">
            Generated by CramAI · Good luck on your exam! 🍀
          </p>
        </div>
      )}

      {/* ── QUESTION PAPER OUTPUT ── */}
      {/* ✅ Renders plain text from AI — no JSON parsing, no answer buttons, no section slicing */}
      {paperText && mode === "paper" && (
        <div className="max-w-xl mx-auto mt-10">

          {/* Paper header */}
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 text-center mb-6">
            <h2 className="text-2xl font-black text-amber-400 tracking-wide">
              QUESTION PAPER
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Total Marks: <span className="text-white font-bold">{totalMarks}</span>
              &nbsp;·&nbsp;
              Total Questions:{" "}
              <span className="text-white font-bold">
                {sections.reduce((s, sec) => s + sec.count, 0)}
              </span>
            </p>
            <div className="border-t border-white/10 mt-4 pt-4 flex flex-wrap justify-center gap-4 text-xs text-gray-500">
              {sections.map((sec, i) => (
                <span key={sec.id}>
                  Section {String.fromCharCode(65 + i)}: {sec.count} × {sec.type} ({sec.count * sec.marks} marks)
                </span>
              ))}
            </div>
          </div>

          {/* ✅ Plain text paper — whitespace-pre-wrap preserves section headings and numbering */}
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 shadow-md">
            <pre className="text-white text-sm font-sans leading-relaxed whitespace-pre-wrap">
              {paperText}
            </pre>
          </div>

          <p className="text-center text-gray-600 text-xs mt-6 mb-4">
            Generated by CramAI · Good luck on your exam! 🍀
          </p>
        </div>
      )}
    </main>
  );
}