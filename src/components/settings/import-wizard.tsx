"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { getImportStatus, runImportAction, stageImportAction } from "@/lib/actions/imports";
import { cn, formatDateTime, formatNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { NONE } from "@/components/programs/form-utils";
import { StatusBadge } from "@/components/programs/status-badge";

export type PreviousImport = {
  id: string;
  fileName: string;
  sourceLabel: string | null;
  status: "pending" | "mapping" | "processing" | "completed" | "failed";
  rowCount: number;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  createdAt: Date;
  completedAt: Date | null;
};

type Staged = { importId: string; headers: string[]; mapping: Record<string, string | null>; rowCount: number; preview: Record<string, string>[]; truncated: boolean };
type ImportProgress = { status: string; processed: number; imported: number; skipped: number; failed: number; rowCount: number; errors: { rowNumber: number; error: string | null }[] };

type Step = { kind: "upload" } | { kind: "map"; staged: Staged } | { kind: "run"; staged: Staged; progress: ImportProgress | null } | { kind: "done"; staged: Staged; progress: ImportProgress };

const MAX_BYTES = 10 * 1024 * 1024;

export type ImportField = { key: string; label: string; description?: string };

export function ImportWizard({ previous, canImport, fields }: { previous: PreviousImport[]; canImport: boolean; fields: ImportField[] }) {
  const [step, setStep] = React.useState<Step>({ kind: "upload" });

  return (
    <div className="flex flex-col gap-4">
      {canImport ? (
        <>
          <ol className="flex items-center gap-2 text-xs">
            {(["Upload", "Map columns", "Import"] as const).map((label, i) => {
              const index = step.kind === "upload" ? 0 : step.kind === "map" ? 1 : 2;
              const done = i < index;
              const active = i === index;
              return (
                <li key={label} className="flex items-center gap-2">
                  <span className={cn("flex size-5 items-center justify-center rounded-full text-[10px] font-semibold", active ? "bg-accent text-accent-foreground" : done ? "bg-success-soft text-success" : "bg-muted text-subtle")}>{done ? "✓" : i + 1}</span>
                  <span className={cn(active ? "font-medium text-foreground" : "text-muted-foreground")}>{label}</span>
                  {i < 2 ? <span className="mx-1 h-px w-6 bg-border" /> : null}
                </li>
              );
            })}
          </ol>
          {step.kind === "upload" ? <UploadStep onStaged={(staged) => setStep({ kind: "map", staged })} /> : null}
          {step.kind === "map" ? <MapStep staged={step.staged} fields={fields} onBack={() => setStep({ kind: "upload" })} onStart={() => setStep({ kind: "run", staged: step.staged, progress: null })} /> : null}
          {step.kind === "run" ? <RunStep staged={step.staged} onDone={(progress) => setStep({ kind: "done", staged: step.staged, progress })} /> : null}
          {step.kind === "done" ? <DoneStep progress={step.progress} onReset={() => setStep({ kind: "upload" })} /> : null}
        </>
      ) : (
        <p className="rounded-xl bg-muted px-4 py-2.5 text-xs text-muted-foreground">Your role cannot import fans. Ask a marketing or admin teammate.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Previous imports</CardTitle>
          <CardDescription>Imports create fans, verified merch orders and attendance from your CSV rows.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {previous.length === 0 ? (
            <EmptyState compact icon={<FileSpreadsheet />} title="No imports yet" description="Mailing lists, ticket buyers and merch customers all start here." />
          ) : (
            <ul className="divide-y divide-border">
              {previous.map((p) => (
                <li key={p.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {p.fileName}
                      {p.sourceLabel ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">· {p.sourceLabel}</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(p.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs tabular text-muted-foreground">
                    <span>{formatNumber(p.rowCount)} rows</span>
                    <span className="text-success">{formatNumber(p.importedCount)} imported</span>
                    {p.skippedCount > 0 ? <span>{formatNumber(p.skippedCount)} skipped</span> : null}
                    {p.errorCount > 0 ? <span className="text-danger">{formatNumber(p.errorCount)} failed</span> : null}
                    <StatusBadge status={p.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UploadStep({ onStaged }: { onStaged: (staged: Staged) => void }) {
  const [file, setFile] = React.useState<File | null>(null);
  const [sourceLabel, setSourceLabel] = React.useState("");
  const [dragging, setDragging] = React.useState(false);
  const [pending, start] = React.useTransition();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const pick = (f: File | null) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".csv")) {
      toast.error("Only .csv files are supported.");
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error("CSV files must be under 10 MB.");
      return;
    }
    setFile(f);
  };

  const submit = () => {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("sourceLabel", sourceLabel.trim());
    start(async () => {
      const res = await stageImportAction(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onStaged(res.data);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload a CSV</CardTitle>
        <CardDescription>Up to 10 MB / 50,000 rows. Include an email or phone column so rows can be matched to fans.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
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
            pick(e.dataTransfer.files[0] ?? null);
          }}
          className={cn("flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 py-10 text-center transition-colors", dragging ? "border-accent bg-accent-soft" : "border-border-strong hover:bg-muted/60")}
        >
          <span className="flex size-11 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <Upload className="size-5" />
          </span>
          {file ? (
            <>
              <span className="text-sm font-medium">{file.name}</span>
              <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB · click to change</span>
            </>
          ) : (
            <>
              <span className="text-sm font-medium">Drop a CSV here or click to browse</span>
              <span className="text-xs text-muted-foreground">Shopify customers, Ticketmaster buyers, mailing lists…</span>
            </>
          )}
        </button>
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        <Field label="Source label" htmlFor="import-source" hint="Optional. Shown on fan timelines, e.g. “2025 tour ticket buyers”.">
          <Input id="import-source" value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} maxLength={120} placeholder="2025 tour ticket buyers" />
        </Field>
        <div className="flex justify-end">
          <Button onClick={submit} disabled={!file} loading={pending}>
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MapStep({ staged, fields, onBack, onStart }: { staged: Staged; fields: ImportField[]; onBack: () => void; onStart: () => void }) {
  const [mapping, setMapping] = React.useState<Record<string, string | null>>(staged.mapping);
  const [pending, start] = React.useTransition();
  const fieldByKey = new Map(fields.map((f) => [f.key, f]));
  const usedFields = new Set(Object.values(mapping).filter(Boolean));
  const hasIdentifier = usedFields.has("email") || usedFields.has("phone");
  const mappedCount = usedFields.size;

  const run = () =>
    start(async () => {
      const res = await runImportAction({ importId: staged.importId, mapping });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onStart();
    });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Map columns</CardTitle>
            <CardDescription>
              {formatNumber(staged.rowCount)} rows · {staged.headers.length} columns · {mappedCount} mapped
              {staged.truncated ? " · truncated to the first 50,000 rows" : ""}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        {!hasIdentifier ? (
          <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft px-3.5 py-2.5 text-xs text-warning">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> Map at least one column to Email or Phone. Rows without an identifier are skipped.
          </p>
        ) : null}
        <div className="divide-y divide-border rounded-xl border border-border">
          {staged.headers.map((header) => {
            const value = mapping[header] ?? null;
            const samples = staged.preview.map((r) => r[header]).filter((v) => v != null && v !== "");
            return (
              <div key={header} className="grid gap-2 px-3.5 py-3 sm:grid-cols-[1fr_12rem] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm">{header}</p>
                  <p className="truncate text-xs text-subtle">{samples.length ? samples.slice(0, 3).join(" · ") : "no sample values"}</p>
                </div>
                <Select value={value ?? NONE} onValueChange={(v) => setMapping((m) => ({ ...m, [header]: v === NONE ? null : v }))}>
                  <SelectTrigger size="sm" className={cn("h-9", value ? "border-accent/40" : "text-subtle")} aria-label={`Map ${header}`}>
                    <SelectValue placeholder="Skip" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Skip column</SelectItem>
                    {fields.map((f) => (
                      <SelectItem key={f.key} value={f.key} disabled={usedFields.has(f.key) && value !== f.key}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>

        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-subtle">Preview (first {staged.preview.length} rows)</p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/60">
                <tr>
                  {staged.headers.map((h) => {
                    const mapped = mapping[h];
                    const field = mapped ? fieldByKey.get(mapped) : null;
                    return (
                      <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-medium">
                        {field ? <span className="text-accent">{field.label}</span> : <span className="text-subtle line-through">{h}</span>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {staged.preview.map((row, i) => (
                  <tr key={i}>
                    {staged.headers.map((h) => (
                      <td key={h} className={cn("max-w-[14rem] truncate whitespace-nowrap px-3 py-2", !mapping[h] && "text-subtle")}>
                        {row[h] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button onClick={run} disabled={!hasIdentifier} loading={pending}>
            Import {formatNumber(staged.rowCount)} rows
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RunStep({ staged, onDone }: { staged: Staged; onDone: (progress: ImportProgress) => void }) {
  const [progress, setProgress] = React.useState<ImportProgress | null>(null);
  const router = useRouter();

  React.useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const res = await getImportStatus({ importId: staged.importId });
      if (cancelled) return;
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setProgress(res.data);
      if (res.data.status === "completed" || res.data.status === "failed") {
        clearInterval(timer);
        router.refresh();
        onDone(res.data);
      }
    };
    const timer = setInterval(poll, 1500);
    void poll();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [staged.importId, onDone, router]);

  const pct = progress && progress.rowCount > 0 ? (progress.processed / progress.rowCount) * 100 : 0;

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <Loader2 className="size-6 animate-spin text-accent" />
        <div>
          <p className="text-sm font-medium">Importing fans…</p>
          <p className="text-xs text-muted-foreground">
            {progress ? `${formatNumber(progress.processed)} of ${formatNumber(progress.rowCount)} rows` : "Starting"} · keep this tab open
          </p>
        </div>
        <Progress value={pct} className="max-w-md" />
        {progress ? (
          <div className="flex gap-4 text-xs tabular text-muted-foreground">
            <span className="text-success">{formatNumber(progress.imported)} imported</span>
            <span>{formatNumber(progress.skipped)} skipped</span>
            <span className={progress.failed ? "text-danger" : undefined}>{formatNumber(progress.failed)} failed</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DoneStep({ progress, onReset }: { progress: ImportProgress; onReset: () => void }) {
  const failed = progress.status === "failed";
  return (
    <Card>
      <CardContent className="flex flex-col gap-5 py-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className={cn("flex size-12 items-center justify-center rounded-2xl", failed ? "bg-danger-soft text-danger" : "bg-success-soft text-success")}>{failed ? <AlertTriangle className="size-6" /> : <CheckCircle2 className="size-6" />}</span>
          <p className="text-base font-semibold tracking-tight">{failed ? "Import failed" : "Import complete"}</p>
          <p className="text-sm text-muted-foreground">
            {formatNumber(progress.imported)} fans imported · {formatNumber(progress.skipped)} skipped · {formatNumber(progress.failed)} failed
          </p>
        </div>
        <div className="mx-auto grid w-full max-w-sm grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-success-soft px-3 py-2">
            <p className="tabular text-lg font-semibold text-success">{formatNumber(progress.imported)}</p>
            <p className="text-[11px] text-success/80">Imported</p>
          </div>
          <div className="rounded-xl bg-muted px-3 py-2">
            <p className="tabular text-lg font-semibold">{formatNumber(progress.skipped)}</p>
            <p className="text-[11px] text-muted-foreground">Skipped</p>
          </div>
          <div className={cn("rounded-xl px-3 py-2", progress.failed ? "bg-danger-soft" : "bg-muted")}>
            <p className={cn("tabular text-lg font-semibold", progress.failed && "text-danger")}>{formatNumber(progress.failed)}</p>
            <p className={cn("text-[11px]", progress.failed ? "text-danger/80" : "text-muted-foreground")}>Failed</p>
          </div>
        </div>
        {progress.errors.length > 0 ? (
          <div className="rounded-xl border border-border">
            <p className="border-b border-border px-3.5 py-2 text-[11px] font-medium uppercase tracking-wide text-subtle">First {progress.errors.length} errors</p>
            <ul className="max-h-48 divide-y divide-border overflow-y-auto text-xs">
              {progress.errors.map((e) => (
                <li key={e.rowNumber} className="flex gap-3 px-3.5 py-2">
                  <Badge variant="outline" className="tabular shrink-0">
                    Row {e.rowNumber}
                  </Badge>
                  <span className="text-muted-foreground">{e.error ?? "Unknown error"}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex justify-center gap-2">
          <Button variant="secondary" onClick={onReset}>
            Import another file
          </Button>
          <Button asChild>
            <Link href="/app/fans">View fans</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
