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

import { useState, useEffect, useRef } from "react";

const LOADING_MESSAGES = [
  "Analyzing your syllabus...",
  "Identifying important topics...",
  "Generating questions...",
  "Almost ready...",
];

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
  const [paperText, setPaperText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);

  const [mode, setMode] = useState<"important" | "paper">("important");

  const [sections, setSections] = useState<Section[]>([
    { id: 1, type: "MCQ", count: 10, marks: 1 },
  ]);
  const [nextId, setNextId] = useState(2);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (loading) {
      setLoadingMsgIndex(0);
      intervalRef.current = setInterval(() => {
        setLoadingMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length);
      }, 2000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loading]);

  function stopWithError(msg: string) {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setLoading(false);
    setError(msg);
  }

  const totalMarks = sections.reduce((sum, sec) => sum + sec.count * sec.marks, 0);

  function addSection() {
    setSections((prev) => [...prev, { id: nextId, type: "MCQ", count: 5, marks: 1 }]);
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
    setPaperText("");

    if (syllabus.length > 2000) { setLoading(false); return; }

    if (mode === "paper" && sections.length === 0) {
      stopWithError("Please add at least one section before generating.");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    timeoutRef.current = setTimeout(() => {
      stopWithError("⚠️ Taking too long — servers are busy. Please try again!");
    }, 25000);

    try {
      const body =
        mode === "paper"
          ? { syllabus, mode: "paper", sections }
          : { syllabus, hours, examType, mode: "important" };

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }

      const data = await response.json();

      if (JSON.stringify(data).includes("INVALID_SYLLABUS")) {
        stopWithError("⚠️ Please enter a valid syllabus with real topics. We couldn't detect any recognizable subject matter.");
        return;
      }

      if (!response.ok) {
        stopWithError(
          response.status === 429
            ? "⚡ Too many requests right now — try again in a few minutes!"
            : data.error || "Something went wrong. Please try again."
        );
        return;
      }

      setLoading(false);
      if (mode === "paper") {
        setPaperText(data.paperText || "");
      } else {
        setQuestions(data.questions);
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        stopWithError("Network error. Please check your connection and try again.");
      }
    }
  }

  const questionCount = hours === "1" ? 10 : 20;

  return (
    <main className="min-h-screen bg-[#0f0f0f] text-white px-4 py-10 font-sans">

      {/* ── Header ── */}
      <div className="text-center mb-10">
  <img
    src="/logo.png"
    alt="CramAI Logo"
    className="mx-auto mb-4 h-20 w-auto"
  />
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
        <div className="flex-1 relative">
          <button
            disabled
            className="w-full py-3 rounded-xl font-bold text-sm border bg-transparent text-gray-600 border-white/10 cursor-not-allowed"
          >
            📄 Question Paper
          </button>
          <span className="absolute -top-2 -right-2 bg-amber-400 text-black text-xs font-black px-2 py-0.5 rounded-full">
            Soon
          </span>
        </div>
      </div>

      {/* ── Input Card ── */}
      <div className="max-w-xl mx-auto bg-[#1a1a1a] rounded-2xl p-6 shadow-xl border border-white/10">

        <label className="block text-sm font-semibold text-gray-300 mb-2">Your Syllabus</label>
        <textarea
          className="w-full bg-[#0f0f0f] text-white border border-white/10 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-600 transition"
          rows={8}
          placeholder="Paste your syllabus here… e.g. Unit 1: Thermodynamics, Unit 2: Fluid Mechanics…"
          value={syllabus}
          onChange={(e) => { setSyllabus(e.target.value); setError(""); }}
        />
        <p className={`text-right text-xs mt-1 ${syllabus.length > 2000 ? "text-red-400" : "text-gray-500"}`}>
          {syllabus.length} / 2000 characters
        </p>

        {/* ── IMPORTANT QUESTIONS OPTIONS ── */}
        {mode === "important" && (
          <>
            <label className="block text-sm font-semibold text-gray-300 mt-5 mb-2">Hours Left Before Exam</label>
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

            <label className="block text-sm font-semibold text-gray-300 mt-5 mb-2">Exam Type</label>
            <select
              className="w-full bg-[#0f0f0f] text-white border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
              value={examType}
              onChange={(e) => setExamType(e.target.value)}
            >
              <option value="Mixed">Mixed — variety of question types</option>
              <option value="Coding questions only">Coding questions only — problem + expected output</option>
              <option value="Short answer">Short answer — 2 to 3 lines</option>
              <option value="Subjective">Subjective — detailed answers</option>
              <option value="Numericals only">Numericals only — step by step calculations</option>
            </select>
          </>
        )}

        {/* ── Generate Button ── */}
        <button
          onClick={handleGenerate}
          disabled={loading || syllabus.trim() === "" || syllabus.length > 2000}
          className="mt-6 w-full bg-amber-400 hover:bg-amber-300 disabled:bg-amber-400/30 disabled:cursor-not-allowed text-black font-bold py-4 rounded-xl text-base transition-all duration-200 active:scale-95"
        >
          {loading ? "Generating…" : "Generate Exam Questions"}
        </button>

        {/* ── Error message ── */}
        {error && (
          <p className={`mt-4 text-sm text-center font-medium ${
            error.startsWith("⚡") ? "text-amber-400" : "text-red-400"
          }`}>
            {error}
          </p>
        )}
      </div>

      {/* ── Loading State ── */}
      {loading && (
        <div className="max-w-xl mx-auto mt-10">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl px-6 py-8 flex flex-col items-center gap-5">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-4 border-white/10" />
              <div className="absolute inset-0 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
            </div>
            <div className="text-center">
              <p
                key={loadingMsgIndex}
                className="text-white font-semibold text-sm animate-pulse"
              >
                {LOADING_MESSAGES[loadingMsgIndex]}
              </p>
              <p className="text-gray-600 text-xs mt-2">This usually takes 5–10 seconds</p>
            </div>
            <div className="flex gap-2">
              {LOADING_MESSAGES.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all duration-500 ${
                    i === loadingMsgIndex
                      ? "bg-amber-400 scale-125"
                      : i < loadingMsgIndex
                      ? "bg-amber-400/40"
                      : "bg-white/15"
                  }`}
                />
              ))}
            </div>
          </div>
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
              <div key={index} className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-5 shadow-md">
                <p className="text-sm font-bold text-amber-400 mb-1">Q{index + 1}.</p>
                <p className="text-white text-sm font-medium leading-relaxed whitespace-pre-line">
                  {item.question.replace(/\\n/g, "\n")}
                </p>
              </div>
            ))}
          </div>
          <p className="text-center text-gray-600 text-xs mt-8 mb-4">
            Generated by CramAI · Good luck on your exam! 🍀
          </p>
        </div>
      )}

    </main>
  );
}