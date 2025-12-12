
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Activity, 
  Upload, 
  FileText, 
  Download, 
  Settings, 
  BrainCircuit, 
  Loader2,
  AlertCircle,
  Filter,
  RefreshCw,
  Sparkles,
  CheckCircle,
  X,
  Zap
} from './components/Icons';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ResultsTable } from './components/ResultsTable';
import { SentimentDistributionChart, EmotionBarChart, ComparativeSentimentChart } from './components/Charts';
import { analyzeSentimentBatch, GeminiError } from './services/geminiService';
import { AnalysisResult, BatchProgress, InputMode, SentimentType, FilterType, ErrorDetails } from './types';
import { v4 as uuidv4 } from 'uuid';

// --- Helper Functions ---
const generateId = () => Math.random().toString(36).substring(2, 9);

const SAMPLE_TEXTS = [
  "I absolutely loved the service! 🤩 The staff was incredibly helpful and the atmosphere was perfect.",
  "Honestly, I waited 45 minutes for a cold burger. 🍔❄️ Not coming back.",
  "The product works as described, but the shipping was a bit slower than expected. 📦",
  "Oh great, another delay. Just what I needed today! 🙄 (Sarcastic)",
  "I'm so frustrated with this software, it crashes every time I try to save. 💻💥",
  "Wow, this new update is a game changer. Efficiency has doubled! 🚀✨",
];

// --- Components ---

// Toast Component for Notifications
const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => (
  <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-6 py-4 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-in slide-in-from-bottom-5 fade-in duration-300 ${type === 'success' ? 'bg-green-100 text-black' : 'bg-red-100 text-black'} no-print`}>
    {type === 'success' ? <CheckCircle size={20} className="text-green-600" /> : <AlertCircle size={20} className="text-red-600" />}
    <span className="font-bold">{message}</span>
    <button onClick={onClose} className="ml-2 hover:bg-black/10 rounded p-1"><X size={16} /></button>
  </div>
);

// Stat Card Component
const StatCard = ({ title, value, subtitle, icon: Icon, colorClass }: any) => (
  <div className={`bg-white p-5 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all print-break-inside`}>
    <div className="flex justify-between items-start mb-2">
      <span className="text-xs font-black uppercase tracking-wider text-gray-500">{title}</span>
      <div className={`p-2 rounded-lg border-2 border-black ${colorClass}`}>
        <Icon size={18} className="text-black" />
      </div>
    </div>
    <div className="text-3xl font-black text-black">{value}</div>
    {subtitle && <div className="text-xs font-bold text-gray-600 mt-1">{subtitle}</div>}
  </div>
);

export default function App() {
  // State
  const [apiKey, setApiKey] = useState<string>(process.env.API_KEY || '');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('single');
  const [textInput, setTextInput] = useState('');
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Replaced simple string error with detailed object
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  
  const [batchProgress, setBatchProgress] = useState<BatchProgress>({ total: 0, processed: 0, errors: 0, isProcessing: false });
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived State
  const filteredResults = filter === 'ALL' 
    ? results 
    : results.filter(r => r.sentiment === filter);

  const totalAnalyzed = results.length;
  const sarcasticCount = results.filter(r => r.isSarcastic).length;
  const averageConfidence = totalAnalyzed > 0 
    ? (results.reduce((acc, curr) => acc + curr.confidence, 0) / totalAnalyzed * 100).toFixed(0)
    : '0';

  // Toast Timer
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
  };

  // Logic: Process Data
  const processBatch = useCallback(async (texts: string[]) => {
    if (!apiKey) {
      setIsApiKeyModalOpen(true);
      return;
    }

    setIsProcessing(true);
    setErrorDetails(null);
    setBatchProgress({ total: texts.length, processed: 0, errors: 0, isProcessing: true });

    const CHUNK_SIZE = 8; // Small batch size for better reliability
    let authErrorOccurred = false;
    let criticalError = null;
    
    try {
      for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
        if (authErrorOccurred) break;

        const chunk = texts.slice(i, i + CHUNK_SIZE);
        
        try {
          const chunkResults = await analyzeSentimentBatch(chunk, apiKey);
          
          const newResults: AnalysisResult[] = chunkResults.map((r, idx) => ({
            ...r,
            id: generateId(),
            text: chunk[idx],
            timestamp: Date.now()
          }));

          setResults(prev => [...newResults, ...prev]); 
          setBatchProgress(prev => ({
            ...prev,
            processed: Math.min(prev.processed + chunk.length, prev.total)
          }));

        } catch (err: any) {
          console.error("Batch chunk failed", err);
          
          // Handle Critical Auth Errors
          if (err instanceof GeminiError && err.code === 'AUTH_ERROR') {
             authErrorOccurred = true;
             setApiKey(''); // Clear invalid key
             setIsApiKeyModalOpen(true);
             criticalError = err;
             break; // Stop processing
          }

          setBatchProgress(prev => ({ ...prev, errors: prev.errors + chunk.length }));
          if (!authErrorOccurred) {
             showToast(`Batch ${Math.floor(i/CHUNK_SIZE) + 1} failed.`, "error");
          }
        }
      }
      
      // Post-loop error handling
      if (criticalError) {
         setErrorDetails({
             title: "Authentication Failed",
             message: criticalError.message,
             code: criticalError.code,
             solution: criticalError.solution,
             status: criticalError.status
         });
         showToast("Authentication Failed", "error");
      } else if (authErrorOccurred) {
         setErrorDetails({ title: "Auth Error", message: "Invalid API Key", solution: "Check settings." });
      } else {
        const successCount = texts.length - batchProgress.errors;
        if (successCount === 0 && texts.length > 0) {
            setErrorDetails({
                title: "Processing Failed",
                message: "All items failed to process.",
                solution: "Check your internet connection or API quota.",
                code: "ALL_FAILED"
            });
        } else if (successCount > 0) {
            showToast("Analysis Cycle Complete!", "success");
        }
      }

    } catch (err: any) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      const code = err instanceof GeminiError ? err.code : "UNKNOWN";
      const solution = err instanceof GeminiError ? err.solution : "Please try again later.";
      const status = err instanceof GeminiError ? err.status : undefined;
      
      setErrorDetails({
          title: "System Error",
          message,
          code,
          solution,
          status
      });
      showToast("System Error", "error");
    } finally {
      setIsProcessing(false);
      setBatchProgress(prev => ({ ...prev, isProcessing: false }));
    }
  }, [apiKey, batchProgress.errors]);

  const handleSingleAnalyze = () => {
    if (!textInput.trim()) return;
    processBatch([textInput.trim()]);
    setTextInput('');
  };

  const handleLoadSample = () => {
    processBatch(SAMPLE_TEXTS);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
       showToast("File is too large. Max size is 2MB.", "error");
       if (fileInputRef.current) fileInputRef.current.value = '';
       return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      let texts: string[] = [];
      
      try {
        if (file.name.endsWith('.csv')) {
            texts = content.split(/\r?\n/).filter(line => line.trim().length > 0);
            if (texts.length > 0 && (texts[0].toLowerCase().startsWith('text') || texts[0].toLowerCase().includes('content'))) {
               texts.shift(); 
            }
        } else if (file.name.endsWith('.txt')) {
            texts = content.split(/\r?\n/).filter(line => line.trim().length > 0);
        } else {
            showToast("Invalid file type. Please upload .csv or .txt", "error");
            return;
        }

        if (texts.length > 100) {
            showToast(`Too many rows (${texts.length}). Limit is 100 for this demo.`, "error");
            texts = texts.slice(0, 100);
        }

        if (texts.length > 0) {
            processBatch(texts);
        } else {
            showToast("File appears to be empty.", "error");
        }
      } catch (parseError) {
         showToast("Failed to parse file content.", "error");
      }
    };
    reader.onerror = () => showToast("Error reading file.", "error");
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Text copied to clipboard", "success");
  };

  const handlePrintPDF = () => {
    window.print();
  };

  // Logic: Export
  const downloadJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(results, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "emotiview_results.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    showToast("JSON Exported", "success");
  };

  const downloadCSV = () => {
    const headers = ["ID", "Text", "Sentiment", "Emotion", "Is Sarcastic", "Confidence", "Keywords", "Explanation"];
    const rows = results.map(r => [
      r.id,
      `"${r.text.replace(/"/g, '""')}"`,
      r.sentiment,
      r.emotion,
      r.isSarcastic ? "Yes" : "No",
      r.confidence,
      `"${r.keywords.join('; ')}"`,
      `"${r.explanation.replace(/"/g, '""')}"`
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "emotiview_results.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast("CSV Exported", "success");
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-sky-50 font-sans text-slate-900">
      <ApiKeyModal 
        isOpen={isApiKeyModalOpen} 
        onClose={() => setIsApiKeyModalOpen(false)} 
        onSave={(key) => {
          setApiKey(key);
          setIsApiKeyModalOpen(false);
          showToast("API Key saved", "success");
          setErrorDetails(null);
        }} 
      />
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-sky-100 border-b md:border-b-0 md:border-r-2 border-black flex flex-col md:fixed md:h-full z-10 shadow-[2px_0px_0px_0px_rgba(0,0,0,0.05)] no-print">
        <div className="p-6 border-b-2 border-black flex items-center gap-3 bg-sky-100">
          <div className="p-2 bg-white border-2 border-black rounded-lg text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <BrainCircuit size={24} />
          </div>
          <div>
            <h1 className="font-extrabold text-black text-lg tracking-tight">EmotiView</h1>
            <p className="text-xs text-sky-800 font-bold">AI Analytics</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
          <div>
            <h3 className="text-xs font-black text-sky-900 uppercase tracking-wider mb-3 px-2">Analysis Mode</h3>
            <div className="space-y-2">
              <button 
                onClick={() => setInputMode('single')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all border-2 ${inputMode === 'single' ? 'bg-sky-300 text-black border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[-2px] translate-y-[-2px]' : 'bg-transparent text-sky-700 border-transparent hover:border-black hover:bg-white hover:text-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'}`}
              >
                <FileText size={18} />
                Single Text
              </button>
              <button 
                onClick={() => setInputMode('batch')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all border-2 ${inputMode === 'batch' ? 'bg-sky-300 text-black border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[-2px] translate-y-[-2px]' : 'bg-transparent text-sky-700 border-transparent hover:border-black hover:bg-white hover:text-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'}`}
              >
                <Upload size={18} />
                Batch / File
              </button>
            </div>
          </div>

          <div>
             <h3 className="text-xs font-black text-sky-900 uppercase tracking-wider mb-3 px-2">Quick Actions</h3>
             <button 
                onClick={handleLoadSample}
                disabled={isProcessing}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all border-2 bg-transparent text-sky-700 border-transparent hover:border-black hover:bg-white hover:text-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                <Sparkles size={18} />
                Load Sample Data
              </button>
          </div>
        </nav>

        <div className="p-4 border-t-2 border-black bg-sky-100">
          <button 
            onClick={() => setIsApiKeyModalOpen(true)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold transition-all border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] ${!apiKey ? 'border-red-500 bg-red-50 text-red-600' : 'border-black text-sky-900 bg-white hover:bg-sky-50'}`}
          >
            <Settings size={18} />
            {apiKey ? 'API Configured' : 'Configure API Key'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* Header Area */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-4xl font-black text-black tracking-tight mb-2">Dashboard</h2>
              <div className="flex gap-2 text-sm font-bold text-sky-800">
                <span className="bg-sky-200 px-2 py-0.5 rounded border border-sky-400">Gemini 2.5 Flash</span>
                <span className="bg-sky-200 px-2 py-0.5 rounded border border-sky-400">Advanced NLP</span>
              </div>
            </div>
            
            {(results.length > 0) && (
              <div className="flex gap-3 no-print">
                <button onClick={handlePrintPDF} className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-black hover:bg-sky-100 text-black rounded-lg text-sm font-bold transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none">
                   <FileText size={16} />
                   PDF Report
                </button>
                <button onClick={downloadCSV} className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-black hover:bg-sky-100 text-black rounded-lg text-sm font-bold transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none">
                  <Download size={16} />
                  CSV
                </button>
                <button onClick={downloadJSON} className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-black hover:bg-sky-100 text-black rounded-lg text-sm font-bold transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none">
                  <Download size={16} />
                  JSON
                </button>
              </div>
            )}
          </div>

          {/* Key Metrics Scorecards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
              title="Total Analyzed" 
              value={totalAnalyzed} 
              subtitle="Text segments"
              icon={FileText}
              colorClass="bg-blue-200"
            />
             <StatCard 
              title="Avg. Confidence" 
              value={`${averageConfidence}%`} 
              subtitle="Model certainty"
              icon={Activity}
              colorClass="bg-green-200"
            />
            <StatCard 
              title="Sarcasm Detected" 
              value={sarcasticCount} 
              subtitle="Potential irony"
              icon={Sparkles}
              colorClass="bg-purple-200"
            />
            <StatCard 
              title="Negative Rate" 
              value={totalAnalyzed > 0 ? `${(results.filter(r => r.sentiment === SentimentType.NEGATIVE).length / totalAnalyzed * 100).toFixed(0)}%` : '0%'} 
              subtitle="Critical feedback"
              icon={AlertCircle}
              colorClass="bg-red-200"
            />
          </div>

          {/* Input Section */}
          <section className="bg-white rounded-xl border-2 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] no-print">
            <h3 className="text-xl font-extrabold text-black mb-6 flex items-center gap-2">
              {inputMode === 'single' ? <FileText size={24} className="text-sky-600" /> : <Upload size={24} className="text-sky-600" />}
              {inputMode === 'single' ? 'Analyze Text' : 'Batch Upload'}
            </h3>

            {inputMode === 'single' ? (
              <div className="space-y-4">
                <div className="relative">
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Type or paste text here to analyze sentiment, emotion, and sarcasm..."
                    className="w-full h-32 px-4 py-3 border-2 border-black rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 outline-none resize-none text-black placeholder:text-gray-400 transition-all font-medium bg-sky-50"
                  />
                  <div className="absolute bottom-3 right-3 text-xs font-bold text-gray-400">
                    {textInput.length} chars
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleSingleAnalyze}
                    disabled={isProcessing || !textInput.trim()}
                    className="flex items-center gap-2 px-8 py-3 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed text-white border-2 border-black rounded-lg font-bold transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none"
                  >
                    {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <BrainCircuit size={20} />}
                    Analyze Now
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-black rounded-lg p-10 text-center hover:bg-sky-50 transition-all cursor-pointer bg-gray-50 group" onClick={() => fileInputRef.current?.click()}>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload}
                  accept=".txt,.csv" 
                  className="hidden" 
                />
                <div className="w-16 h-16 bg-white text-sky-600 border-2 border-black rounded-xl flex items-center justify-center mx-auto mb-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group-hover:scale-110 transition-transform">
                  <Upload size={28} />
                </div>
                <h4 className="text-black font-bold text-lg mb-1">Click to upload CSV or TXT</h4>
                <p className="text-gray-500 font-medium">Batch process multiple lines at once (Max 100 rows)</p>
              </div>
            )}

            {/* Detailed Error Display */}
            {errorDetails && (
              <div className="mt-6 p-5 bg-red-50 border-2 border-red-500 text-red-900 rounded-xl shadow-[4px_4px_0px_0px_rgba(220,38,38,0.2)] animate-in slide-in-from-top-2">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-red-100 rounded-full border-2 border-red-200 shrink-0">
                        <AlertCircle size={24} className="text-red-600" />
                    </div>
                    <div className="flex-1">
                        <h4 className="text-xl font-black text-red-700 mb-2">{errorDetails.title}</h4>
                        <p className="font-bold mb-3 leading-relaxed">{errorDetails.message}</p>
                        
                        {errorDetails.solution && (
                            <div className="mb-3 text-sm bg-white/60 p-3 rounded-lg border border-red-200">
                                <span className="font-extrabold mr-1.5 text-red-800">💡 Suggestion:</span> 
                                <span className="text-red-900 font-medium">{errorDetails.solution}</span>
                            </div>
                        )}
                        
                        <div className="flex items-center gap-2 mt-2">
                             {errorDetails.code && (
                                <span className="text-xs font-mono font-bold bg-red-200 text-red-800 px-2 py-1 rounded border border-red-300">
                                    Code: {errorDetails.code}
                                </span>
                             )}
                             {errorDetails.status && (
                                <span className="text-xs font-mono font-bold bg-red-200 text-red-800 px-2 py-1 rounded border border-red-300">
                                    Status: {errorDetails.status}
                                </span>
                             )}
                        </div>
                    </div>
                    <button onClick={() => setErrorDetails(null)} className="text-red-400 hover:text-red-700 hover:bg-red-100 rounded-lg p-2 transition-colors">
                        <X size={20} />
                    </button>
                </div>
              </div>
            )}

            {/* Batch Progress */}
            {batchProgress.isProcessing && (
              <div className="mt-6 space-y-2">
                <div className="flex justify-between text-sm font-bold text-black">
                  <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={14} /> Processing...</span>
                  <div className="flex gap-3">
                     <span className="text-green-700">{batchProgress.processed - batchProgress.errors} Success</span>
                     {batchProgress.errors > 0 && <span className="text-red-600">{batchProgress.errors} Failed</span>}
                     <span>Total: {batchProgress.total}</span>
                  </div>
                </div>
                <div className="h-5 bg-white rounded-full overflow-hidden border-2 border-black">
                  <div 
                    className={`h-full border-r-2 border-black transition-all duration-300 ease-out ${batchProgress.errors > 0 ? 'bg-orange-400' : 'bg-sky-500'}`}
                    style={{ width: `${(batchProgress.processed / batchProgress.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
          </section>

          {/* Charts Row */}
          {results.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 print-break-inside">
              <div className="bg-white rounded-xl border-2 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="text-lg font-extrabold text-black mb-4 flex items-center gap-2">
                  <Activity size={20} /> Sentiment Distribution
                </h3>
                <SentimentDistributionChart results={results} />
              </div>
              <div className="bg-white rounded-xl border-2 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="text-lg font-extrabold text-black mb-4 flex items-center gap-2">
                   <BrainCircuit size={20} /> Specific Emotions
                </h3>
                <EmotionBarChart results={results} />
              </div>
               <div className="bg-white rounded-xl border-2 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] lg:col-span-2">
                <h3 className="text-lg font-extrabold text-black mb-4 flex items-center gap-2">
                   <Activity size={20} /> Comparative Confidence Analysis
                </h3>
                <ComparativeSentimentChart results={results} />
              </div>
            </div>
          )}

          {/* Results Table Section */}
          <section className="space-y-4">
             {/* Filter & Actions Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-sky-100 p-4 rounded-xl border-2 border-black no-print">
               <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
                  <Filter size={20} className="text-black mr-2" />
                  {(['ALL', SentimentType.POSITIVE, SentimentType.NEGATIVE, SentimentType.NEUTRAL] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setFilter(type)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-bold border-2 transition-all whitespace-nowrap ${
                        filter === type 
                          ? 'bg-black text-white border-black shadow-[2px_2px_0px_0px_rgba(255,255,255,0.5)]' 
                          : 'bg-white text-black border-black hover:bg-sky-200'
                      }`}
                    >
                      {type === 'ALL' ? 'All Results' : type}
                    </button>
                  ))}
               </div>
               
               {results.length > 0 && (
                 <button 
                   onClick={() => setResults([])} 
                   className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 font-bold border-2 border-red-600 px-4 py-2 rounded-lg bg-white hover:bg-red-50 shadow-[2px_2px_0px_0px_rgba(220,38,38,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all whitespace-nowrap"
                 >
                   <RefreshCw size={16} /> Reset
                 </button>
               )}
            </div>

            <ResultsTable 
              results={filteredResults} 
              onDelete={(id) => setResults(prev => prev.filter(r => r.id !== id))} 
              onCopy={handleCopy}
            />
          </section>

        </div>
      </main>
    </div>
  );
}