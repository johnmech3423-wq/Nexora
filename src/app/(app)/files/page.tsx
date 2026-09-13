"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  File as FileIcon,
  FileArchive,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  Film,
  FolderOpen,
  Loader2,
  Trash2,
  Upload,
  UploadCloud,
} from "lucide-react";
import { apiFetch, qs } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useActiveOrgId } from "@/lib/hooks/use-session";
import { apiErrorMessage } from "@/components/features/error-handling";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/controls";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmDialog, ConfirmDialogContent } from "@/components/ui/confirm-dialog";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import type { FileMetaDTO, ProjectSummaryDTO } from "@/types";

const PAGE_SIZE = 24;

export default function FilesPage() {
  const orgId = useActiveOrgId();
  const qc = useQueryClient();
  const [projectId, setProjectId] = React.useState("__all");
  const [kind, setKind] = React.useState("__all");
  const [page, setPage] = React.useState(1);
  const [dragOver, setDragOver] = React.useState(false);
  const [uploads, setUploads] = React.useState<{ name: string; progress: number; done: boolean; error?: string }[]>([]);
  const [toDelete, setToDelete] = React.useState<FileMetaDTO | null>(null);
  const fileInput = React.useRef<HTMLInputElement | null>(null);

  const files = useQuery({
    queryKey: qk.files(orgId ?? "x", `${projectId}|${kind}|${page}`),
    queryFn: () =>
      apiFetch<{ items: FileMetaDTO[]; total: number; hasMore: boolean }>(
        `/api/files${qs({
          orgId,
          projectId: projectId === "__all" ? undefined : projectId,
          kind: kind === "__all" ? undefined : kind,
          page,
          pageSize: PAGE_SIZE,
        })}`
      ),
    enabled: Boolean(orgId),
  });
  const projects = useQuery({
    queryKey: qk.projects(orgId ?? "x", "files"),
    queryFn: () => apiFetch<{ items: ProjectSummaryDTO[] }>(`/api/projects${qs({ orgId, pageSize: 100, status: "all" })}`),
    enabled: Boolean(orgId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["files"] });
  const remove = useMutation({
    mutationFn: (fileId: string) => apiFetch(`/api/files/${fileId}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      toast.success("File deleted");
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Couldn't delete the file.")),
  });

  // ---------- uploads with progress (XHR) ----------
  const doUpload = (list: FileList | File[]) => {
    const targetProject = projectId === "__all" ? undefined : projectId;
    Array.from(list).forEach((file) => {
      const row = { name: file.name, progress: 0, done: false };
      setUploads((u) => [...u, row]);
      const fd = new FormData();
      fd.append("kind", "project_file");
      fd.append("file", file);
      if (orgId) fd.append("orgId", orgId);
      if (targetProject) fd.append("projectId", targetProject);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/files");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setUploads((us) => us.map((u) => (u.name === file.name ? { ...u, progress: pct } : u)));
        }
      };
      xhr.onload = () => {
        let ok = false;
        try {
          const parsed = JSON.parse(xhr.responseText) as { success?: boolean; error?: { message?: string } };
          ok = parsed.success === true;
          if (!ok) toast.error(parsed.error?.message ?? "Upload failed.");
        } catch {
          toast.error("Upload failed.");
        }
        setUploads((us) => us.map((u) => (u.name === file.name ? { ...u, done: true, progress: ok ? 100 : 0, error: ok ? undefined : "failed" } : u)));
        if (ok) invalidate();
        window.setTimeout(() => setUploads((us) => us.filter((u) => u.name !== file.name)), 6000);
      };
      xhr.onerror = () => {
        setUploads((us) => us.map((u) => (u.name === file.name ? { ...u, done: true, error: "network" } : u)));
        toast.error(`Upload of ${file.name} failed.`);
      };
      xhr.send(fd);
    });
  };

  if (!orgId) return null;
  const list = files.data?.items ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Files</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {files.data ? `${files.data.total} file${files.data.total === 1 ? "" : "s"} in this workspace` : "Shared project files"}
          </p>
        </div>
        <Button onClick={() => fileInput.current?.click()}>
          <Upload /> Upload files
        </Button>
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          aria-hidden
          onChange={(e) => {
            if (e.target.files?.length) doUpload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) doUpload(e.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
        aria-label="Upload files (drag & drop supported)"
        onClick={() => fileInput.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInput.current?.click();
          }
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed py-7 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/20"
        )}
      >
        <UploadCloud className={cn("size-7", dragOver ? "text-primary" : "text-muted-foreground")} aria-hidden />
        <p className="text-sm font-medium">Drop files here or click to upload</p>
        <p className="text-xs text-muted-foreground">
          Images, PDFs, documents, spreadsheets, archives & code — up to 10 MB each
        </p>
      </div>

      {/* Upload progress rows */}
      {uploads.length > 0 ? (
        <ul className="space-y-1.5">
          {uploads.map((u) => (
            <li key={u.name} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
              <FileIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-[13px]">{u.name}</span>
              {u.error ? (
                <span className="text-xs text-destructive">{u.error === "network" ? "Network error" : "Upload failed"}</span>
              ) : u.done ? (
                <Badge variant="secondary" className="gap-1"><UploadCloud className="size-3" /> done</Badge>
              ) : (
                <span className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                  <Loader2 className="size-3.5 animate-spin" /> {u.progress}%
                </span>
              )}
              {!u.done && !u.error ? (
                <div className="w-28">
                  <Progress value={u.progress} className="h-1" />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={projectId} onValueChange={(v) => { setProjectId(v); setPage(1); }}>
          <SelectTrigger aria-label="Filter by project" className="w-52 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All projects</SelectItem>
            {(projects.data?.items ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={(v) => { setKind(v); setPage(1); }}>
          <SelectTrigger aria-label="Filter by source" className="w-44 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All sources</SelectItem>
            <SelectItem value="project_file">Uploaded files</SelectItem>
            <SelectItem value="task_attachment">Task attachments</SelectItem>
            <SelectItem value="comment_attachment">Comment attachments</SelectItem>
            <SelectItem value="message_attachment">Chat attachments</SelectItem>
            <SelectItem value="avatar">Avatars</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {files.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <CardSkeleton key={i} className="h-40" />
          ))}
        </div>
      ) : files.isError ? (
        <ErrorState title="Couldn't load files" message={apiErrorMessage(files.error)} onRetry={() => void files.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={projectId !== "__all" || kind !== "__all" ? "No files match" : "No files yet"}
          description={
            projectId !== "__all" || kind !== "__all"
              ? "Try different filters."
              : "Upload screenshots, specs, exports — anything your team needs, shared at the workspace or project level."
          }
        />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" role="list">
            {list.map((f) => (
              <FileCard key={f.id} file={f} onDelete={() => setToDelete(f)} />
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={files.data?.total ?? 0} onPageChange={setPage} />
        </>
      )}

      <ConfirmDialog open={Boolean(toDelete)} onOpenChange={(o) => !o && setToDelete(null)}>
        <ConfirmDialogContent
          title="Delete file?"
          description={toDelete ? `“${toDelete.name}” is removed from the workspace. This cannot be undone.` : ""}
          confirmLabel="Delete file"
          destructive
          loading={remove.isPending}
          onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        />
      </ConfirmDialog>
    </div>
  );
}

function FileCard({ file, onDelete }: { file: FileMetaDTO; onDelete: () => void }) {
  const [failed, setFailed] = React.useState(false);
  const downloadUrl = `${file.url}${file.url.includes("?") ? "&" : "?"}download=1`;
  const preview = file.isImage && !failed ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={file.url}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
    />
  ) : null;
  return (
    <li className="group overflow-hidden rounded-lg border bg-card shadow-xs transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted/40">
        {preview ?? <FileGlyph mime={file.mime} name={file.name} />}
        <div className="absolute inset-x-0 bottom-0 flex justify-end gap-0.5 bg-gradient-to-t from-black/50 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          <a
            href={downloadUrl}
            download
            aria-label={`Download ${file.name}`}
            className="rounded-md bg-white/90 p-1 text-black hover:bg-white"
          >
            <Download className="size-3.5" />
          </a>
          {file.canDelete ? (
            <button
              type="button"
              aria-label={`Delete ${file.name}`}
              onClick={onDelete}
              className="rounded-md bg-white/90 p-1 text-red-600 hover:bg-white"
            >
              <Trash2 className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>
      <div className="p-2.5">
        <p className="truncate text-[12.5px] font-medium" title={file.name}>{file.name}</p>
        <p className="mt-0.5 flex items-center justify-between text-[10.5px] text-muted-foreground">
          <span>{formatBytes(file.size)} · {timeAgo(file.createdAt)}</span>
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-muted-foreground">
          <Avatar name={file.uploadedByName} src={null} size="xs" /> {file.uploadedByName}
        </p>
      </div>
    </li>
  );
}

function FileGlyph({ mime, name }: { mime: string; name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const Icon =
    mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)
      ? FileImage
      : mime.startsWith("video/") || mime.startsWith("audio/") || ["mp4", "mov", "mp3"].includes(ext)
        ? Film
        : mime === "application/pdf" || ext === "pdf"
          ? FileText
          : mime.includes("spreadsheet") || ["xlsx", "xls", "csv"].includes(ext)
            ? FileSpreadsheet
            : mime.includes("zip") || ["zip", "rar", "7z", "tar", "gz"].includes(ext)
              ? FileArchive
              : mime.startsWith("text/") || ["js", "ts", "tsx", "py", "json", "md", "html", "css"].includes(ext)
                ? FileCode
                : FileIcon;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
      <Icon className="size-9" aria-hidden />
      <span className="max-w-[90%] truncate text-[10px] uppercase">{ext || "file"}</span>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
