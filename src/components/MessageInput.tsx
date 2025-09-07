import { cn } from '@/lib/utils';
import { ArrowUp } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import Attach from './MessageInputActions/Attach';

import { File } from './ChatWindow';
import AttachSmall from './MessageInputActions/AttachSmall';
import Microphone from './MessageInputActions/Microphone';
import axios from 'axios';
import { useTranslation } from '@/hooks/useTranslation';
import { useDebounce } from '@/hooks/useDebounce';

const MessageInput = ({
  sendMessage,
  loading,
  fileIds,
  setFileIds,
  files,
  setFiles,
}: {
  sendMessage: (message: string) => void;
  loading: boolean;
  fileIds: string[];
  setFileIds: (fileIds: string[]) => void;
  files: File[];
  setFiles: (files: File[]) => void;
}) => {

  const [message, setMessage] = useState('');
  const [textareaRows, setTextareaRows] = useState(1);
  const [mode, setMode] = useState<'multi' | 'single'>('single');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { t } = useTranslation();

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const url = `/api/searxng?format=json&q=${encodeURIComponent(q)}`;
      const res = await axios.get(url);
      setSuggestions(res.data.suggestions || []);
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, []);

  // Debounced version of fetchSuggestions with 300ms delay
  const debouncedFetchSuggestions = useDebounce(fetchSuggestions, 300);

  useEffect(() => {
    if (textareaRows >= 2 && message && mode === 'single') {
      setMode('multi');
    } else if (!message && mode === 'multi') {
      setMode('single');
    }
  }, [textareaRows, mode, message]);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;

      const isInputFocused =
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        activeElement?.hasAttribute('contenteditable');

      if (e.key === '/' && !isInputFocused) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Cancel any pending debounced calls when component unmounts
      debouncedFetchSuggestions.cancel();
    };
  }, [debouncedFetchSuggestions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);
    
    // Use debounced function to fetch suggestions
    debouncedFetchSuggestions(value);
  };

  return (
    <form
      onSubmit={(e) => {
        if (loading) return;
        e.preventDefault();
        sendMessage(message);
        setMessage('');
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey && !loading) {
          e.preventDefault();
          sendMessage(message);
          setMessage('');
        }
      }}
      className={cn(
        'relative bg-light-secondary dark:bg-dark-secondary p-4 flex items-center overflow-hidden border border-light-200 dark:border-dark-200',
        mode === 'multi' ? 'flex-col rounded-lg' : 'flex-row rounded-full',
      )}
    >
      {mode === 'single' && (
        <AttachSmall
          fileIds={fileIds}
          setFileIds={setFileIds}
          files={files}
          setFiles={setFiles}
        />
      )}
      <TextareaAutosize
        ref={inputRef}
        value={message}
        onChange={handleInputChange}
        onFocus={() => setShowSuggestions(!!message)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        onHeightChange={(height, props) => {
          setTextareaRows(Math.ceil(height / props.rowHeight));
        }}
        className="transition bg-transparent text-foreground placeholder:text-muted-foreground placeholder:opacity-80 dark:placeholder:opacity-60 text-sm dark:text-foreground resize-none focus:outline-none w-full px-2 max-h-24 lg:max-h-36 xl:max-h-48 flex-grow flex-shrink"
        placeholder={t('chat.typeMessage')}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-2 w-full rounded-md bg-popover text-popover-foreground shadow-md border border-popover/50 overflow-hidden">
          <div className="w-full divide-y">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={() => {
                  // use onMouseDown to prevent losing focus before click
                  setMessage(s);
                  setShowSuggestions(false);
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors duration-150"
              >
                <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="truncate">{s}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {mode === 'single' && (
        <div className="flex flex-row items-center space-x-4">
          <Microphone
            onDictate={(text) => setMessage((prev) => prev + (prev ? ' ' : '') + text)}
            disabled={loading}
          />
          <button
            disabled={message.trim().length === 0 || loading}
            className="bg-[#24A0ED] text-white hover:bg-opacity-85 transition duration-100 rounded-full p-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <ArrowUp className="bg-background" size={17} />
          </button>
        </div>
      )}
      {mode === 'multi' && (
        <div className="flex flex-row items-center justify-between w-full pt-2">
          <AttachSmall
            fileIds={fileIds}
            setFileIds={setFileIds}
            files={files}
            setFiles={setFiles}
          />
          <div className="flex flex-row items-center space-x-4">
            <Microphone
              onDictate={(text) => setMessage((prev) => prev + (prev ? ' ' : '') + text)}
              disabled={loading}
            />
            <button
              disabled={message.trim().length === 0 || loading}
              className="bg-[#24A0ED] text-white hover:bg-opacity-85 transition duration-100 rounded-full p-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <ArrowUp className="bg-background" size={17} />
            </button>
          </div>
        </div>
      )}
    </form>
  );
};

export default MessageInput;
