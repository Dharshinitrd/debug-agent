import { useState } from "react";
import "./App.css";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://debug-agent-5.onrender.com";

const LANGUAGES = [
  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
  { id: "cpp", label: "C++" },
  { id: "javascript", label: "JavaScript" },
];

const TRACE_STEPS = [
  "reading source",
  "running static checks",
  "reasoning about root cause",
  "drafting fix",
];

const SAMPLE = `def average(nums):
    total = 0
    for n in nums:
        total += n
    return total / len(nums)

print(average([]))`;

export default function App() {
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(SAMPLE);
  const [loading, setLoading] = useState(false);
  const [traceIndex, setTraceIndex] = useState(-1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    setResult(null);
    setTraceIndex(0);

    const tick = setInterval(() => {
      setTraceIndex((i) => (i < TRACE_STEPS.length - 1 ? i + 1 : i));
    }, 550);

    try {
      const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          language,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed (${res.status})`);
      }

      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      clearInterval(tick);
      setLoading(false);
      setTraceIndex(-1);
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          <span className="brand-name">Debugging Agent</span>
        </div>
        <span className="brand-tag">
          root-cause analysis · 4 languages
        </span>
      </header>

      <main className="layout">
        <section className="panel input-panel">
          <div className="panel-head">
            <select
              className="lang-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>

            <button
              className="run-btn"
              onClick={handleAnalyze}
              disabled={loading || !code.trim()}
            >
              {loading ? "Analyzing..." : "Analyze code"}
            </button>
          </div>

          <textarea
            className="code-input"
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste code to debug..."
          />

          {loading && (
            <ul className="trace">
              {TRACE_STEPS.map((step, i) => (
                <li
                  key={step}
                  className={
                    i < traceIndex
                      ? "done"
                      : i === traceIndex
                      ? "active"
                      : "pending"
                  }
                >
                  <span className="trace-marker" />
                  {step}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel output-panel">
          {!result && !error && !loading && (
            <div className="empty-state">
              Paste code on the left and click Analyze code.
            </div>
          )}

          {error && (
            <div className="error-banner">
              Analysis failed: {error}
            </div>
          )}

          {result && (
            <div className="result">
              <div
                className={`status-row ${
                  result.error_detected ? "bad" : "good"
                }`}
              >
                <span className="status-dot" />
                {result.error_detected
                  ? `${result.error_type || "Error"} detected`
                  : "No error detected"}
              </div>

              {result.explanation && (
                <Block title="Explanation">
                  {result.explanation}
                </Block>
              )}

              {result.root_cause && (
                <Block title="Root cause">
                  {result.root_cause}
                </Block>
              )}

              {result.corrected_code && (
                <div className="block">
                  <h3>Corrected code</h3>
                  <pre className="code-block">
                    {result.corrected_code}
                  </pre>
                </div>
              )}

              {result.debug_steps?.length > 0 && (
                <div className="block">
                  <h3>Debugging steps</h3>
                  <ol className="step-list">
                    {result.debug_steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </div>
              )}

              {result.best_practices?.length > 0 && (
                <div className="block">
                  <h3>Best practices</h3>
                  <ul className="practice-list">
                    {result.best_practices.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.static_analysis_raw && (
                <div className="block">
                  <h3>Static analysis output</h3>
                  <pre className="code-block dim">
                    {result.static_analysis_raw}
                  </pre>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Block({ title, children }) {
  return (
    <div className="block">
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}