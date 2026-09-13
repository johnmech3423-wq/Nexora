"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CornerDownLeft, MessagesSquare, User as UserIcon } from "lucide-react";
import { apiFetch, qs } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useActiveOrgId } from "@/lib/hooks/use-session";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type SearchPayload = {
  projects: { id: string; name: string; key: string }[];
  tasks: { id: string; key: string; title: string; status: string; priority: string; projectId: string }[];
  comments: { id: string; body: string; taskId: string; taskKey: string; projectId: string }[];
  messages: { id: string; body: string; conversationId: string; conversationName: string; projectId: string | null }[];
  members: { userId: string; name: string; email: string; avatarUrl: string | null }[];
  total: number;
};

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const orgId = useActiveOrgId();
  const router = useRouter();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const trimmed = q.trim();
  const results = useQuery<SearchPayload>({
    queryKey: qk.search(orgId ?? "x", trimmed),
    queryFn: () => apiFetch<SearchPayload>(`/api/search${qs({ orgId, q: trimmed })}`),
    enabled: Boolean(orgId) && trimmed.length >= 2,
  });

  const go = (path: string) => {
    setOpen(false);
    setQ("");
    router.push(path);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-xs text-muted-foreground shadow-xs transition-colors hover:text-foreground sm:flex lg:w-56"
        aria-label="Open search"
      >
        <span className="flex-1 text-left">Search anything…</span>
        <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">⌘K</kbd>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex size-9 items-center justify-center rounded-md text-foreground/80 hover:bg-accent sm:hidden"
        aria-label="Open search"
      >
        <SearchGlyph />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent hideClose className="top-[12vh] w-[min(680px,calc(100vw-2rem)] -translate-y-0 translate-x-[-50%] gap-0 overflow-hidden p-0 sm:w-[680px]">
          <DialogTitle className="sr-only">Search Nexora</DialogTitle>
          <Command className="rounded-lg" shouldFilter={false}>
            <CommandInput
              placeholder="Search projects, tasks, comments, chat, people…"
              value={q}
              onValueChange={setQ}
              autoFocus
            />
            <CommandList className="max-h-[420px]">
              <CommandEmpty>
                {trimmed.length < 2
                  ? "Type at least 2 characters to search."
                  : results.isLoading
                    ? "Searching…"
                    : results.isError
                      ? "Search is unavailable right now."
                      : `No results for “${trimmed}”.`}
              </CommandEmpty>

              {results.data && trimmed.length >= 2 ? (
                <>
                  {results.data.projects.length ? (
                    <CommandGroup heading="Projects">
                      {results.data.projects.map((p) => (
                        <CommandItem key={`p${p.id}`} onSelect={() => go(`/projects/${p.id}`)}>
                          <ProjectGlyph />
                          <span className="font-medium">{p.name}</span>
                          <span className="text-xs text-muted-foreground">{p.key}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}
                  {results.data.tasks.length ? (
                    <CommandGroup heading="Tasks">
                      {results.data.tasks.map((t) => (
                        <CommandItem key={`t${t.id}`} onSelect={() => go(`/projects/${t.projectId}/board?task=${t.id}`)}>
                          <TaskGlyph />
                          <span className="font-mono text-xs text-muted-foreground">{t.key}</span>
                          <span className="flex-1 truncate">{t.title}</span>
                          <span className="ml-auto text-xs capitalize text-muted-foreground">
                            {t.status.replace(/_/g, " ")}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}
                  {results.data.comments.length ? (
                    <CommandGroup heading="Comments">
                      {results.data.comments.map((c) => (
                        <CommandItem key={`c${c.id}`} onSelect={() => go(`/projects/${c.projectId}/board?task=${c.taskId}`)}>
                          <CornerDownLeft className="text-muted-foreground" />
                          <span className="flex-1 truncate">{c.body}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}
                  {results.data.messages.length ? (
                    <CommandGroup heading="Chat">
                      {results.data.messages.map((m) => (
                        <CommandItem key={`m${m.id}`} onSelect={() => go(`/chat/${m.conversationId}`)}>
                          <MessagesSquare className="text-muted-foreground" />
                          <span className="flex-1 truncate">{m.body}</span>
                          <span className="text-xs text-muted-foreground">{m.conversationName}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}
                  {results.data.members.length ? (
                    <CommandGroup heading="People">
                      {results.data.members.map((m) => (
                        <CommandItem key={`u${m.userId}`} onSelect={() => go(`/settings/members?org=${orgId}`)}>
                          <UserIcon className="text-muted-foreground" />
                          <span>{m.name}</span>
                          <span className="ml-auto text-xs text-muted-foreground">{m.email}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}
                </>
              ) : null}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-[18px]">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}
function ProjectGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 text-muted-foreground">
      <path d="M15.5 7.5 19 4l1.5 1.5L17.5 9" />
      <path d="M19 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />
    </svg>
  );
}
function TaskGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-4 text-muted-foreground">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="m9 11 2 2 4-4" />
      <path d="M8 3v2M16 3v2" />
    </svg>
  );
}
