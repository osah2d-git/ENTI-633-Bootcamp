import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Table as TableIcon,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  FileSpreadsheet,
  Info,
  Clock,
  ArrowRight,
  Calculator,
  Download,
} from 'lucide-react';
import { TEST_CASES, TestCase } from './utils/testCases.ts';
import { AnalysisResponse, ParsedSalesData, VarianceItem } from './types/retail.ts';
import { formatMoney, formatPercent, getVerdict, parseWeeklySalesTable } from './utils/salesParser.ts';
import { countWords, generateDeterministicCommentary } from './utils/commentaryGenerator.ts';

export default function App() {
  const [inputText, setInputText] = useState<string>(TEST_CASES[0].rawText);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('week-38');
  const [loading, setLoading] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<{ [id: string]: { passed: boolean; message: string } } | null>(null);
  const [isRunningAllTests, setIsRunningAllTests] = useState<boolean>(false);

  // Automatically analyze the initial case on mount
  useEffect(() => {
    handleAnalyze(TEST_CASES[0].rawText);
  }, []);

  const handleTrySample = () => {
    const week38Case = TEST_CASES[0];
    setSelectedCaseId(week38Case.id);
    setInputText(week38Case.rawText);
    handleAnalyze(week38Case.rawText);
  };

  const handleSelectCase = (testCase: TestCase) => {
    setSelectedCaseId(testCase.id);
    setInputText(testCase.rawText);
    handleAnalyze(testCase.rawText);
  };

  const handleAnalyze = async (textToAnalyze?: string) => {
    const raw = textToAnalyze !== undefined ? textToAnalyze : inputText;
    if (!raw.trim()) {
      setAnalysisResult({
        success: false,
        error: 'Please paste a weekly sales table.',
      });
      return;
    }

    // Step 1: Calculate the variances in code first
    const parsedLocally = parseWeeklySalesTable(raw);

    // Step 2: If no plan column found, show a clear message and do NOT call Gemini!
    if (!parsedLocally.hasPlan || parsedLocally.missingError?.type === 'MISSING_PLAN') {
      setAnalysisResult({
        success: false,
        parsedData: parsedLocally,
        missingMessage:
          parsedLocally.missingError?.message ||
          'Plan column missing: Please provide the Plan figures in your table to calculate variances and generate the commentary.',
      });
      return;
    }

    // If week identifier is missing, prompt without calling Gemini
    if (!parsedLocally.hasWeek || parsedLocally.missingError?.type === 'MISSING_WEEK') {
      setAnalysisResult({
        success: false,
        parsedData: parsedLocally,
        missingMessage: parsedLocally.missingError?.message || 'Please specify the week number (e.g., Week 38).',
      });
      return;
    }

    setLoading(true);
    setCopied(false);

    try {
      // Send to server: server will pass ONLY the code-calculated numbers and store notes to Gemini
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: raw }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const data: AnalysisResponse = await response.json();
      setAnalysisResult(data);
    } catch (err: any) {
      console.warn('Backend request failed or offline, generating locally from code-calculated numbers:', err);
      const commentary = generateDeterministicCommentary(parsedLocally);
      setAnalysisResult({
        success: true,
        parsedData: parsedLocally,
        commentary,
        wordCount: countWords(commentary),
        paragraphCount: 1,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!analysisResult?.commentary) return;
    navigator.clipboard.writeText(analysisResult.commentary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRunAllAcceptanceTests = async () => {
    setIsRunningAllTests(true);
    const results: { [id: string]: { passed: boolean; message: string } } = {};

    for (const tc of TEST_CASES) {
      try {
        const parsed = parseWeeklySalesTable(tc.rawText);

        if (tc.isMissingPlan) {
          const passed = !parsed.hasPlan && parsed.missingError?.type === 'MISSING_PLAN';
          results[tc.id] = {
            passed,
            message: passed
              ? 'PASS: Correctly detected missing Plan column and asked for Plan figures without calling Gemini.'
              : 'FAIL: Did not flag missing plan column.',
          };
          continue;
        }

        const verdict = getVerdict(parsed.total.percentVariance);
        const verdictMatches = tc.expectedVerdict ? verdict === tc.expectedVerdict : true;
        const swingsMatches = tc.expectedSwingsCancelled !== undefined
          ? parsed.swingsCancelledOut === tc.expectedSwingsCancelled
          : true;

        const commentary = generateDeterministicCommentary(parsed);
        const words = countWords(commentary);
        const wordCountPass = words >= 80 && words <= 120;

        const missingLYPass =
          tc.id === 'week-41'
            ? commentary.includes('+1.4% vs last year excluding Red Deer')
            : true;

        const allPass = verdictMatches && swingsMatches && wordCountPass && missingLYPass;
        results[tc.id] = {
          passed: allPass,
          message: allPass
            ? `PASS: ${verdict.toUpperCase()} verdict, ${words} words${tc.id === 'week-41' ? ', +1.4% vs LY excl. Red Deer' : ''}, swings check: ${parsed.swingsCancelledOut ? 'Triggered' : 'N/A'}`
            : `FAIL: Check criteria (Verdict: ${verdict}, Words: ${words}, Excl Red Deer: ${missingLYPass})`,
        };
      } catch (err: any) {
        results[tc.id] = {
          passed: false,
          message: `ERROR: ${err.message}`,
        };
      }
    }

    setTestResults(results);
    setIsRunningAllTests(false);
  };

  const parsed = analysisResult?.parsedData;
  const isMissing = !analysisResult?.success && analysisResult?.missingMessage;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <FileSpreadsheet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
              Retail Sales Commentary Engine
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Regional RM Standard
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              One-paragraph Monday commentary • Variances calculated in code • Gemini receives only calculated numbers & notes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-md">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Ephemeral • Never Stored or Shared</span>
          </div>

          <a
            href="/api/download-zip"
            download="retail-sales-commentary.zip"
            className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-sm transition cursor-pointer"
            title="Download full application source code as a ZIP file"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download ZIP</span>
          </a>

          <button
            onClick={handleRunAllAcceptanceTests}
            disabled={isRunningAllTests}
            className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isRunningAllTests ? 'Testing...' : 'Run 5 Acceptance Tests'}</span>
          </button>
        </div>
      </header>

      {/* Acceptance Tests Bar (if executed) */}
      {testResults && (
        <div className="bg-slate-800/90 border-b border-slate-700 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-300">Acceptance Test Results:</span>
              <div className="flex flex-wrap gap-2">
                {TEST_CASES.map((tc) => {
                  const r = testResults[tc.id];
                  return (
                    <button
                      key={tc.id}
                      onClick={() => handleSelectCase(tc)}
                      className={`text-xs px-2.5 py-1 rounded border flex items-center gap-1.5 transition ${
                        r?.passed
                          ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/60'
                          : 'bg-rose-950/60 border-rose-700/60 text-rose-300 hover:bg-rose-900/60'
                      }`}
                      title={r?.message}
                    >
                      {r?.passed ? <Check className="w-3 h-3 text-emerald-400" /> : <AlertTriangle className="w-3 h-3 text-rose-400" />}
                      <span className="font-medium">{tc.weekName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              onClick={() => setTestResults(null)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input and Presets (5 cols) */}
        <section className="lg:col-span-5 flex flex-col gap-4">
          {/* Prominent "Try a sample" Banner */}
          <div className="bg-gradient-to-r from-indigo-950/80 via-slate-800 to-indigo-950/80 border border-indigo-500/40 rounded-xl p-4 shadow-lg flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Quick Start Sample
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Fill input with the <strong className="text-indigo-300">Week 38 sales table</strong> (stores, categories, plan & notes).
              </p>
            </div>
            <button
              onClick={handleTrySample}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition active:scale-95 shrink-0 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Try a sample</span>
            </button>
          </div>

          {/* Test Cases Quick Bar */}
          <div className="bg-slate-800/60 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                Acceptance Test Cases:
              </span>
              <span className="text-[11px] text-slate-400">Weeks 38–42</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {TEST_CASES.map((tc) => (
                <button
                  key={tc.id}
                  onClick={() => handleSelectCase(tc)}
                  className={`text-left px-2.5 py-2 rounded-lg text-xs transition border flex flex-col justify-between cursor-pointer ${
                    selectedCaseId === tc.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200'
                      : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-800/80'
                  }`}
                >
                  <span className="font-semibold block truncate">{tc.weekName}</span>
                  <span className="text-[10px] text-slate-400 block truncate mt-0.5">{tc.tag}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Paste Raw Table Textarea */}
          <div className="bg-slate-800/60 border border-slate-800 rounded-xl p-4 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                <span>Pasted Weekly Sales Table</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  (Net Sales, Plan, LY, Store Notes)
                </span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTrySample}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                  title="Fill with Week 38 sample"
                >
                  <span>+ Week 38 table</span>
                </button>
                <span className="text-slate-600">•</span>
                <button
                  onClick={() => {
                    setInputText('');
                    setSelectedCaseId('');
                    setAnalysisResult(null);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                  title="Clear input"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            <textarea
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                setSelectedCaseId('');
              }}
              placeholder={`Paste your weekly sales table here, e.g.:

Week 38 Sales Report
Store | Net Sales | Plan | Last Year
Store 101 - Downtown | $430,000 | $400,000 | $390,000
Store 102 - Westside | $310,000 | $330,000 | $305,000
...

Category | Net Sales | Plan
Apparel | $610,000 | $580,000
...

Store notes: Downtown had sidewalk festival; Westside elevator maintenance.`}
              className="w-full flex-1 min-h-[300px] font-mono text-xs bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none leading-relaxed"
            />

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-indigo-400" />
                <span>Variances calculated in code</span>
              </div>
              <button
                onClick={() => handleAnalyze()}
                disabled={loading || !inputText.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-semibold rounded-lg flex items-center gap-2 shadow-md shadow-indigo-600/20 transition active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-indigo-200" />
                <span>{loading ? 'Calculating & Writing...' : 'Generate Commentary'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Right Column: Commentary (with Copy button under) and Variances Table Under (7 cols) */}
        <section className="lg:col-span-7 flex flex-col gap-5">
          {/* Missing Plan Alert Box (Do not call Gemini!) */}
          {isMissing && (
            <div className="bg-amber-950/40 border-2 border-amber-500/50 rounded-xl p-5 shadow-xl flex gap-3.5 items-start">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-amber-200 uppercase tracking-wide">
                  {parsed?.missingError?.type === 'MISSING_PLAN' ? 'Plan Figures Missing' : 'Week Identifier Required'}
                </h3>
                <p className="text-xs text-amber-100 mt-1 leading-relaxed">
                  {analysisResult.missingMessage}
                </p>
                <div className="mt-3 text-xs bg-amber-950/80 border border-amber-700/50 rounded-lg p-3 text-amber-200/90 flex flex-col gap-2">
                  <div>
                    <span className="font-semibold block mb-0.5 text-amber-300">Rule Enforcement:</span>
                    Variances cannot be calculated without plan numbers. As per instructions, Gemini was not called.
                  </div>
                  <div className="pt-1">
                    <button
                      onClick={handleTrySample}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-md shadow transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-slate-900" />
                      <span>Load Sample with Plan (Week 38)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {analysisResult?.error && (
            <div className="bg-rose-950/30 border border-rose-600/40 rounded-xl p-4 text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{analysisResult.error}</span>
            </div>
          )}

          {/* Generated Commentary Output Card */}
          {analysisResult?.success && analysisResult.commentary && (
            <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-5 shadow-xl">
              {/* Header of Commentary */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-700/60">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">
                    Executive Commentary
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                    {parsed?.week || 'Weekly'}
                  </span>
                  {parsed?.total && (
                    <VerdictBadge verdict={getVerdict(parsed.total.percentVariance)} />
                  )}
                  {parsed?.swingsCancelledOut && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                      Swings Cancelled Out
                    </span>
                  )}
                </div>

                <span
                  className={`text-xs px-2.5 py-0.5 rounded-md font-mono ${
                    analysisResult.wordCount && analysisResult.wordCount >= 80 && analysisResult.wordCount <= 120
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {analysisResult.wordCount} words (Target: 80–120)
                </span>
              </div>

              {/* The Single Paragraph */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 shadow-inner">
                <p className="text-sm text-slate-100 leading-relaxed font-sans">
                  {analysisResult.commentary}
                </p>
              </div>

              {/* Copy Button DIRECTLY UNDER THE PARAGRAPH */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-700/50">
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Check className="w-3.5 h-3.5" /> 1 paragraph
                  </span>
                  <span>•</span>
                  <span>First sentence = week, total, $, %, vs LY, verdict</span>
                  <span>•</span>
                  <span>Last sentence = confirm</span>
                </div>

                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition active:scale-95 cursor-pointer"
                  title="Copy commentary to clipboard"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-200" />
                      <span className="text-emerald-100">Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Commentary</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Variances Table DIRECTLY UNDER THE PARAGRAPH */}
          {parsed && parsed.hasPlan && (
            <div className="bg-slate-800/60 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TableIcon className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                    Calculated Variances (Audited in Code)
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Calculator className="w-3 h-3 text-indigo-400" />
                  <span>Calculated in code • Gemini received only numbers & notes</span>
                </div>
              </div>

              {/* Total KPI Highlight Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block font-medium">Net Sales</span>
                  <span className="text-sm font-bold text-white font-mono mt-0.5 block">
                    {formatMoney(parsed.total.netSales)}
                  </span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block font-medium">Plan</span>
                  <span className="text-sm font-bold text-white font-mono mt-0.5 block">
                    {formatMoney(parsed.total.plan)}
                  </span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block font-medium">Var vs Plan ($ / %)</span>
                  <span
                    className={`text-sm font-bold font-mono mt-0.5 block ${
                      parsed.total.dollarVariance > 0
                        ? 'text-emerald-400'
                        : parsed.total.dollarVariance < 0
                        ? 'text-rose-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {formatMoney(parsed.total.dollarVariance, true)} ({formatPercent(parsed.total.percentVariance)})
                  </span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block font-medium">vs Last Year</span>
                  <span className="text-sm font-bold text-slate-200 font-mono mt-0.5 block">
                    {parsed.total.lyPercentVariance !== undefined
                      ? formatPercent(parsed.total.lyPercentVariance)
                      : 'N/A'}
                  </span>
                  {parsed.storesMissingLY && parsed.storesMissingLY.length > 0 && (
                    <span className="text-[10px] text-amber-300 block font-sans mt-0.5">
                      Excl. {parsed.storesMissingLY.join(', ')}
                    </span>
                  )}
                </div>
              </div>

              {/* Tabular Breakdown */}
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-left text-xs text-slate-300 font-mono">
                  <thead className="bg-slate-900/90 text-[11px] text-slate-400 font-sans border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-3 font-medium">Store / Category</th>
                      <th className="py-2 px-3 font-medium text-right">Net Sales</th>
                      <th className="py-2 px-3 font-medium text-right">Plan</th>
                      <th className="py-2 px-3 font-medium text-right">Var ($)</th>
                      <th className="py-2 px-3 font-medium text-right">Var (%)</th>
                      <th className="py-2 px-3 font-medium text-right">vs LY (%)</th>
                      <th className="py-2 px-3 font-medium text-center">Beyond ±2%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                    {/* Stores Header */}
                    {parsed.stores.length > 0 && (
                      <tr className="bg-slate-900/60">
                        <td colSpan={7} className="py-1.5 px-3 font-sans font-semibold text-[11px] text-slate-400">
                          Stores Breakdown ({parsed.stores.length})
                        </td>
                      </tr>
                    )}
                    {parsed.stores.map((s, idx) => (
                      <tr key={`store-${idx}`} className="hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-sans text-slate-200 flex items-center gap-1.5">
                          {s.name}
                          {s.isSwingStore && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-sans">
                              &gt;5% swing
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">{formatMoney(s.netSales)}</td>
                        <td className="py-2 px-3 text-right text-slate-400">{formatMoney(s.plan)}</td>
                        <td
                          className={`py-2 px-3 text-right font-semibold ${
                            s.dollarVariance > 0
                              ? 'text-emerald-400'
                              : s.dollarVariance < 0
                              ? 'text-rose-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {formatMoney(s.dollarVariance, true)}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-semibold ${
                            s.percentVariance > 2
                              ? 'text-emerald-400'
                              : s.percentVariance < -2
                              ? 'text-rose-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {formatPercent(s.percentVariance)}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-400">
                          {s.lyPercentVariance !== undefined ? formatPercent(s.lyPercentVariance) : '—'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {s.isBeyondThreshold ? (
                            <span className="inline-block w-2 h-2 rounded-full bg-indigo-400" title="Included in largest variance selection" />
                          ) : (
                            <span className="inline-block w-2 h-2 rounded-full bg-slate-700" />
                          )}
                        </td>
                      </tr>
                    ))}

                    {/* Categories Header */}
                    {parsed.categories.length > 0 && (
                      <tr className="bg-slate-900/60">
                        <td colSpan={7} className="py-1.5 px-3 font-sans font-semibold text-[11px] text-slate-400">
                          Categories Breakdown ({parsed.categories.length})
                        </td>
                      </tr>
                    )}
                    {parsed.categories.map((c, idx) => (
                      <tr key={`cat-${idx}`} className="hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-sans text-slate-200">{c.name}</td>
                        <td className="py-2 px-3 text-right">{formatMoney(c.netSales)}</td>
                        <td className="py-2 px-3 text-right text-slate-400">{formatMoney(c.plan)}</td>
                        <td
                          className={`py-2 px-3 text-right font-semibold ${
                            c.dollarVariance > 0
                              ? 'text-emerald-400'
                              : c.dollarVariance < 0
                              ? 'text-rose-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {formatMoney(c.dollarVariance, true)}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-semibold ${
                            c.percentVariance > 2
                              ? 'text-emerald-400'
                              : c.percentVariance < -2
                              ? 'text-rose-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {formatPercent(c.percentVariance)}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-400">
                          {c.lyPercentVariance !== undefined ? formatPercent(c.lyPercentVariance) : '—'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {c.isBeyondThreshold ? (
                            <span className="inline-block w-2 h-2 rounded-full bg-indigo-400" title="Included in largest variance selection" />
                          ) : (
                            <span className="inline-block w-2 h-2 rounded-full bg-slate-700" />
                          )}
                        </td>
                      </tr>
                    ))}

                    {/* Total Row */}
                    <tr className="bg-slate-900 font-bold border-t-2 border-slate-700">
                      <td className="py-2.5 px-3 font-sans text-white">Chain Total</td>
                      <td className="py-2.5 px-3 text-right text-white">{formatMoney(parsed.total.netSales)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-300">{formatMoney(parsed.total.plan)}</td>
                      <td
                        className={`py-2.5 px-3 text-right ${
                          parsed.total.dollarVariance > 0
                            ? 'text-emerald-400'
                            : parsed.total.dollarVariance < 0
                            ? 'text-rose-400'
                            : 'text-slate-200'
                        }`}
                      >
                        {formatMoney(parsed.total.dollarVariance, true)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right ${
                          parsed.total.percentVariance > 2
                            ? 'text-emerald-400'
                            : parsed.total.percentVariance < -2
                            ? 'text-rose-400'
                            : 'text-slate-200'
                        }`}
                      >
                        {formatPercent(parsed.total.percentVariance)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-200">
                        {parsed.total.lyPercentVariance !== undefined
                          ? formatPercent(parsed.total.lyPercentVariance)
                          : '—'}
                        {parsed.storesMissingLY && parsed.storesMissingLY.length > 0 && (
                          <span className="text-[10px] text-amber-300 block font-sans font-normal">
                            *excl. {parsed.storesMissingLY.join(', ')}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-400">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {parsed.storesMissingLY && parsed.storesMissingLY.length > 0 && (
                <div className="mt-2 text-[11px] text-amber-300/90 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    *Prior year comparison calculated using only stores with reported figures, excluding {parsed.storesMissingLY.join(', ')} (figure missing from extract).
                  </span>
                </div>
              )}

              {/* Extracted Notes Verification */}
              {parsed.storeNotes && (
                <div className="mt-3.5 p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1 flex items-center gap-1.5">
                    <Info className="w-3 h-3 text-indigo-400" />
                    Store Notes Pulled For Causes:
                  </span>
                  <p className="text-slate-300 italic font-sans leading-relaxed">
                    &ldquo;{parsed.storeNotes}&rdquo;
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: 'ahead' | 'on plan' | 'behind' }) {
  if (verdict === 'ahead') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
        <TrendingUp className="w-3 h-3 text-emerald-400" />
        Ahead of Plan (&gt; +2%)
      </span>
    );
  }
  if (verdict === 'behind') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
        <TrendingDown className="w-3 h-3 text-rose-400" />
        Behind Plan (&lt; -2%)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
      <Minus className="w-3 h-3 text-blue-400" />
      On Plan (±2%)
    </span>
  );
}
