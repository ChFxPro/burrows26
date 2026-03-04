import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { Card } from './Card';

interface JsonUploadProps {
  onLoad: (payload: { fileName: string; content: string }) => Promise<void> | void;
  isLoading?: boolean;
  error?: string | null;
}

export const JsonUpload = ({ onLoad, isLoading = false, error }: JsonUploadProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const content = await file.text();
    await onLoad({ fileName: file.name, content });

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <Card>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Upload JSON</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Load an updated dashboard JSON file at runtime and refresh charts immediately.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition hover:border-brand-500 hover:text-brand-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-brand-500">
          <span>{isLoading ? 'Loading...' : 'Choose JSON file'}</span>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Upload dashboard JSON file"
            onChange={handleFileChange}
            disabled={isLoading}
          />
        </label>
      </div>
      {isLoading ? (
        <div className="mt-4 grid gap-2">
          <div className="h-3 animate-pulseSoft rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-3 animate-pulseSoft rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-3 animate-pulseSoft rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-700 dark:text-red-400">{error}</p> : null}
    </Card>
  );
};
