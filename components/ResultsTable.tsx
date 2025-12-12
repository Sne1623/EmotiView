
import React from 'react';
import { AnalysisResult, SentimentType } from '../types';
import { KeywordHighlighter } from './KeywordHighlighter';
import { Trash2, Zap, Copy, FileText } from './Icons';

interface Props {
  results: AnalysisResult[];
  onDelete: (id: string) => void;
  onCopy: (text: string) => void;
}

export const ResultsTable: React.FC<Props> = ({ results, onDelete, onCopy }) => {
  const getBadgeColor = (sentiment: SentimentType) => {
    switch (sentiment) {
      case SentimentType.POSITIVE: return 'bg-green-100 text-green-900 border-green-900';
      case SentimentType.NEGATIVE: return 'bg-red-100 text-red-900 border-red-900';
      default: return 'bg-gray-100 text-gray-900 border-gray-900';
    }
  };

  const getSentimentEmoji = (sentiment: SentimentType) => {
    switch (sentiment) {
      case SentimentType.POSITIVE: return '😃';
      case SentimentType.NEGATIVE: return '😡';
      default: return '😐';
    }
  };

  const getBarColor = (sentiment: SentimentType) => {
    switch (sentiment) {
      case SentimentType.POSITIVE: return 'bg-green-500';
      case SentimentType.NEGATIVE: return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (results.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-xl border-2 border-black border-dashed">
        <p className="text-black font-bold text-lg">No results match your filter.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-black rounded-xl overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] print-break-inside">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-sky-200 text-black border-b-2 border-black text-xs uppercase font-extrabold tracking-wider">
              <th className="px-6 py-4 border-r-2 border-black w-32">Sentiment</th>
              <th className="px-6 py-4 border-r-2 border-black w-32">Emotion</th>
              <th className="px-6 py-4 border-r-2 border-black w-32">Score</th>
              <th className="px-6 py-4 w-1/2 border-r-2 border-black">Analysis & Explanation</th>
              <th className="px-6 py-4 text-right w-24 no-print">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-black">
            {results.map((result) => (
              <tr key={result.id} className="hover:bg-sky-50 transition-colors group">
                {/* Sentiment Column */}
                <td className="px-6 py-4 align-top border-r-2 border-black">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border-2 ${getBadgeColor(result.sentiment)}`}>
                    <span className="text-sm">{getSentimentEmoji(result.sentiment)}</span>
                    {result.sentiment}
                  </span>
                  {result.isSarcastic && (
                     <div className="mt-2 flex items-center gap-1 text-xs font-black text-purple-700 bg-purple-100 px-2 py-1 rounded border-2 border-purple-900 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                       <Zap size={10} /> SARCASM
                     </div>
                  )}
                </td>

                {/* Emotion Column */}
                <td className="px-6 py-4 align-top border-r-2 border-black">
                   <div className="flex flex-col items-start gap-1">
                     <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]">
                       <span className="text-lg leading-none">{result.emotionEmoji}</span>
                       {result.emotion}
                     </span>
                   </div>
                </td>

                {/* Confidence Score */}
                <td className="px-6 py-4 align-top border-r-2 border-black">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-black font-mono">
                      {(result.confidence * 100).toFixed(0)}%
                    </span>
                    <div className="w-20 h-3 bg-white rounded-full overflow-hidden border-2 border-black">
                      <div 
                        className={`h-full border-r-2 border-black ${getBarColor(result.sentiment)}`}
                        style={{ width: `${result.confidence * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </td>

                {/* Main Text Content */}
                <td className="px-6 py-4 text-sm align-top whitespace-normal border-r-2 border-black relative">
                  <div className="mb-3">
                    <KeywordHighlighter 
                      text={result.text} 
                      keywords={result.keywords} 
                      sentiment={result.sentiment} 
                    />
                  </div>
                  
                  {result.explanation && (
                    <div className="flex gap-2 items-start mt-2 p-2 bg-sky-50 rounded border-l-4 border-sky-400">
                      <FileText size={14} className="mt-0.5 text-sky-600 shrink-0" />
                      <p className="text-xs text-slate-700 font-medium italic">
                        "{result.explanation}"
                      </p>
                    </div>
                  )}
                </td>

                {/* Actions */}
                <td className="px-6 py-4 text-right align-top no-print">
                   <div className="flex gap-1 justify-end opacity-100">
                    <button 
                       onClick={() => onCopy(result.text)}
                       className="text-black hover:bg-sky-200 p-2 rounded-lg border-2 border-transparent hover:border-black transition-all"
                       title="Copy Text"
                     >
                       <Copy size={16} />
                     </button>
                     <button 
                      onClick={() => onDelete(result.id)}
                      className="text-black hover:text-red-600 hover:bg-red-50 p-2 rounded-lg border-2 border-transparent hover:border-black transition-all"
                      title="Delete result"
                     >
                       <Trash2 size={16} />
                     </button>
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
