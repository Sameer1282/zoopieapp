import React, { useState, useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { X, Plus, Sparkles } from 'lucide-react';

export interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  maxTags?: number;
  className?: string;
}

export function TagInput({
  tags,
  onChange,
  suggestions = [
    'Gaming',
    'Music',
    'Tech & Coding',
    'Movies & Shows',
    'Design',
    'Anime',
    'Science',
    'Languages',
  ],
  placeholder = 'Type an interest and press Enter...',
  maxTags = 8,
  className,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (rawTag: string) => {
    const trimmed = rawTag.trim().toLowerCase().replace(/^#/, '');
    if (!trimmed) return;
    if (tags.some(t => t.toLowerCase() === trimmed)) return;
    if (tags.length >= maxTags) return;

    // Capitalize first letter of each word for clean display
    const formatted = trimmed
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    onChange([...tags, formatted]);
    setInputValue('');
  };

  const removeTag = (indexToRemove: number) => {
    onChange(tags.filter((_, i) => i !== indexToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const toggleSuggestion = (suggestion: string) => {
    const exists = tags.some(t => t.toLowerCase() === suggestion.toLowerCase());
    if (exists) {
      onChange(tags.filter(t => t.toLowerCase() !== suggestion.toLowerCase()));
    } else {
      addTag(suggestion);
    }
  };

  return (
    <div className={cn('w-full space-y-3', className)}>
      <div
        onClick={() => inputRef.current?.focus()}
        className="min-h-[52px] w-full rounded-xl border border-surface-700/80 bg-surface-950/80 p-2 text-sm transition-colors cursor-text flex flex-wrap items-center gap-2 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-400 focus-within:ring-offset-2 focus-within:ring-offset-surface-950"
      >
        {tags.map((tag, idx) => (
          <span
            key={tag + idx}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500/15 border border-brand-500/30 px-2.5 py-1 text-xs font-medium text-brand-200 animate-in fade-in zoom-in-95 duration-150"
          >
            <span>#{tag}</span>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                removeTag(idx);
              }}
              className="rounded p-0.5 text-brand-300 hover:bg-brand-500/20 hover:text-white transition-colors focus:outline-none focus:ring-1 focus:ring-brand-400"
              aria-label={`Remove interest ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {tags.length < maxTags ? (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (inputValue.trim()) addTag(inputValue);
            }}
            placeholder={tags.length === 0 ? placeholder : 'Add another...'}
            className="flex-1 min-w-[140px] bg-transparent text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none py-1 px-1"
            aria-label="Add interest tag"
          />
        ) : (
          <span className="text-xs text-surface-400 italic py-1 px-1">
            Maximum {maxTags} interests added
          </span>
        )}
      </div>

      {/* Suggested Topic Tags */}
      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-surface-400">
            <Sparkles className="h-3 w-3 text-brand-400" />
            <span>Popular topics (click to add):</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map(s => {
              const isSelected = tags.some(t => t.toLowerCase() === s.toLowerCase());
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSuggestion(s)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-all select-none',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
                    isSelected
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                      : 'bg-surface-850 text-surface-300 border border-surface-700/60 hover:border-surface-600 hover:text-white hover:bg-surface-800'
                  )}
                  aria-pressed={isSelected}
                >
                  {isSelected ? (
                    <X className="h-2.5 w-2.5 text-teal-400" />
                  ) : (
                    <Plus className="h-2.5 w-2.5 text-surface-400" />
                  )}
                  <span>{s}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
