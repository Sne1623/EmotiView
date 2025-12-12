
import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle } from './Icons';

interface ApiKeyModalProps {
  isOpen: boolean;
  onSave: (key: string) => void;
  onClose: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onSave, onClose }) => {
  const [key, setKey] = useState('');
  const [isValidFormat, setIsValidFormat] = useState(true);

  // Validate format on change
  useEffect(() => {
    if (key.length > 0 && !key.startsWith('AIza')) {
        setIsValidFormat(false);
    } else {
        setIsValidFormat(true);
    }
  }, [key]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sky-900/50 backdrop-blur-sm p-4">
      <div className="bg-sky-50 rounded-xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border-2 border-black">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6 border-b-2 border-black pb-4">
            <h2 className="text-xl font-black text-black">Set API Key</h2>
            <button onClick={onClose} className="text-black hover:bg-sky-200 p-1 rounded transition-colors border-2 border-transparent hover:border-black">
              <X size={24} />
            </button>
          </div>
          
          <p className="text-sm text-slate-800 font-medium mb-6">
            To use the Gemini 2.5 Flash model for sentiment analysis, please provide your Google GenAI API Key.
          </p>

          <label className="block text-sm font-bold text-black mb-2">
            Gemini API Key
          </label>
          <div className="relative">
             <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="AIzaSy..."
                className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 outline-none transition-all mb-2 font-mono text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] focus:shadow-none bg-white ${!isValidFormat ? 'border-red-500 text-red-600 focus:ring-red-500' : 'border-black'}`}
              />
              {!isValidFormat && (
                <div className="flex items-center gap-1 text-xs font-bold text-red-600 mb-6 animate-in slide-in-from-top-1">
                    <AlertCircle size={12} />
                    <span>Key usually starts with "AIza"</span>
                </div>
              )}
          </div>
          
          {isValidFormat && <div className="mb-6"></div>}

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 text-black border-2 border-transparent hover:border-black hover:bg-sky-100 rounded-lg font-bold transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (key.trim()) {
                  onSave(key.trim());
                  onClose();
                }
              }}
              disabled={!key.trim() || !isValidFormat}
              className="flex items-center gap-2 px-6 py-2 bg-white hover:bg-sky-100 text-black border-2 border-black rounded-lg font-bold transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0"
            >
              <CheckCircle size={18} />
              Save Key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
