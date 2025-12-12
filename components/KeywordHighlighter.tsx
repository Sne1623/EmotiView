import React from 'react';
import { SentimentType } from '../types';

interface Props {
  text: string;
  keywords: string[];
  sentiment: SentimentType;
}

export const KeywordHighlighter: React.FC<Props> = ({ text, keywords, sentiment }) => {
  if (!keywords || keywords.length === 0) {
    return <span className="text-black font-medium">{text}</span>;
  }

  // Create a regex pattern to match keywords (case-insensitive)
  // We escape special characters to prevent regex errors
  const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${sortedKeywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');

  const parts = text.split(pattern);

  const getHighlightStyle = () => {
    switch (sentiment) {
      case SentimentType.POSITIVE: 
        return 'bg-green-300 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]';
      case SentimentType.NEGATIVE: 
        return 'bg-red-300 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]';
      default: 
        return 'bg-gray-200 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]';
    }
  };

  return (
    <div className="leading-[2.5rem] text-black">
      {parts.map((part, index) => {
        const isKeyword = sortedKeywords.some(k => k.toLowerCase() === part.toLowerCase());
        if (isKeyword) {
          return (
            <span
              key={index}
              className={`inline-block px-1.5 py-0.5 mx-1 text-sm font-bold rounded-md transition-transform hover:-translate-y-0.5 ${getHighlightStyle()}`}
              title="Influential factor"
            >
              {part}
            </span>
          );
        }
        return <span key={index} className="text-black font-medium">{part}</span>;
      })}
    </div>
  );
};