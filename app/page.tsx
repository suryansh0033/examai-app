"use client"; // This tells Next.js this page runs in the browser
type Question = {
  question: string;
  answer: string;
};

import { useState } from "react";

export default function Home() {
  // These variables store what the user types and what Claude returns
  const [syllabus, setSyllabus] = useState("");
  const [hours, setHours] = useState("2");
  const [examType, setExamType] = useState("Mixed");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // This function runs when the user clicks "Generate Exam Questions"
  async function handleGenerate() {
    setLoading(true);   // Show the loading spinner
    setError("");       // Clear any old error
    setQuestions([]);   // Clear old questions

    try {
      // Send the syllabus and hours to our API route
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syllabus, hours, examType }),
      });

      const data = await response.json();

      // If the server returned an error message, show it
      if (!response.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      // Store the questions so they appear on screen
      setQuestions(data.questions);
    } catch (err) {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false); // Hide the loading spinner no matter what
    }
  }

  return (
    <main className="min-h-screen bg-[#0f0f0f] text-white px-4 py-10 font-sans">

      {/* ── App Header ── */}
      <div className="text-center mb-10">
        <h1 className="text-5xl font-black tracking-tight text-amber-400">
          CramAI
        </h1>
        <p className="text-gray-400 mt-2 text-sm">
          Paste your syllabus → get 20 predicted exam questions instantly
        </p>
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

        {/* Hours dropdown */}
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
        {/* Exam Type dropdown */}
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

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={loading || syllabus.trim() === ""}
          className="mt-6 w-full bg-amber-400 hover:bg-amber-300 disabled:bg-amber-400/30 disabled:cursor-not-allowed text-black font-bold py-4 rounded-xl text-base transition-all duration-200 active:scale-95"
        >
          {loading ? "Generating…" : "Generate Exam Questions"}
        </button>

        {/* Error message */}
        {error && (
          <p className="mt-4 text-red-400 text-sm text-center">{error}</p>
        )}
      </div>

      {/* ── Loading Spinner ── */}
      {loading && (
        <div className="max-w-xl mx-auto mt-10 flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">CramAI is predicting your questions...</p>
        </div>
      )}

      {/* ── Questions Cards ── */}
      {questions.length > 0 && (
        <div className="max-w-xl mx-auto mt-10">
          <h2 className="text-xl font-bold text-amber-400 mb-5">
            📋 20 Predicted Exam Questions
          </h2>

          <div className="flex flex-col gap-4">
            {questions.map((item, index) => (
              <div
                key={index}
                className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-5 shadow-md"
              >
                {/* Question number + text */}
                <p className="text-sm font-bold text-amber-400 mb-1">
                  Q{index + 1}.
                </p>
                <p className="text-white text-sm font-medium leading-relaxed">
                  {item.question}
                </p>

                {/* Divider */}
                <div className="border-t border-white/10 my-3" />

                {/* Answer */}
                <p className="text-gray-300 text-sm leading-relaxed">
                  <span className="text-green-400 font-semibold">Answer: </span>
                  {item.answer}
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