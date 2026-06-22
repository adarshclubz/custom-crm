"use client";

import * as React from "react";
import Papa from "papaparse";
import { UploadCloud, FileText, X } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ParsedContact {
  email: string;
  name: string | null;
  company: string | null;
  tags: string[];
}

export interface CsvParseResult {
  file: File;
  rows: ParsedContact[];
  erroredCount: number;
}

function normalizeRow(raw: Record<string, string>): ParsedContact | null {
  const lower: Record<string, string> = {};
  for (const k of Object.keys(raw)) lower[k.trim().toLowerCase()] = raw[k];
  const email = (lower.email ?? "").trim().toLowerCase();
  if (!email) return null; // email is required
  const tags = (lower.tags ?? "")
    .split(";")
    .map((t) => t.trim())
    .filter(Boolean);
  return {
    email,
    name: (lower.name ?? "").trim() || null,
    company: (lower.company ?? "").trim() || null,
    tags,
  };
}

export function CsvDropzone({
  onParsed,
  onClear,
  result,
}: {
  onParsed: (result: CsvParseResult) => void;
  onClear?: () => void;
  result?: CsvParseResult | null;
}) {
  const [dragging, setDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please choose a .csv file.");
      return;
    }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows: ParsedContact[] = [];
        let errored = 0;
        for (const raw of res.data) {
          const norm = normalizeRow(raw);
          if (norm) rows.push(norm);
          else errored++;
        }
        if (rows.length === 0) {
          setError("No valid rows found. A header row with an 'email' column is required.");
          return;
        }
        onParsed({ file, rows, erroredCount: errored });
      },
      error: (err) => setError(err.message),
    });
  }

  if (result) {
    return (
      <div className="border-border bg-card flex items-center justify-between gap-3 rounded-xl border p-4">
        <div className="flex items-center gap-3">
          <div className="bg-accent text-primary flex size-10 items-center justify-center rounded-lg">
            <FileText className="size-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{result.file.name}</span>
            <span className="text-muted-foreground text-xs">
              {result.rows.length.toLocaleString()} valid contact
              {result.rows.length === 1 ? "" : "s"}
              {result.erroredCount > 0 &&
                ` · ${result.erroredCount} skipped (missing email)`}
            </span>
          </div>
        </div>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Remove file"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center transition-colors",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-accent/40"
        )}
      >
        <div className="bg-accent text-primary flex size-11 items-center justify-center rounded-full">
          <UploadCloud className="size-5" />
        </div>
        <span className="text-sm font-medium">
          Drop a CSV here, or click to browse
        </span>
        <span className="text-muted-foreground text-xs">
          Columns: <code>name, email, company, tags</code> — email required, tags
          separated by <code>;</code>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
