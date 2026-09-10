"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Flag, Rocket, SquareCheck } from "lucide-react";
import { apiFetch, qs } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useActiveOrgId } from "@/lib/hooks/use-session";
import { apiErrorMessage } from "@/components/features/error-handling";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/state";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  type: "task" | "milestone" | "sprint";
  title: string;
  start: string | null;
  end: string | null;
  allDay?: boolean;
  status?: string;
  projectId: string;
  projectName: string;
  projectKey: string;
  assignee?: { name: string } | null;
  url?: string;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function CalendarPage() {
  const orgId = useActiveOrgId();
  const [cursor, setCursor] = React.useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  from.setDate(from.getDate() - from.getDay()); // week start (Sunday)
  const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 41);

  const events = useQuery({
    queryKey: qk.calendar(orgId ?? "x", from.toISOString().slice(0, 10), to.toISOString().slice(0, 10)),
    queryFn: () =>
      apiFetch<{ items: CalendarEvent[] }>(
        `/api/calendar${qs({ orgId, from: from.toISOString(), to: to.toISOString() })}`
      ),
    enabled: Boolean(orgId),
  });

  if (!orgId) return null;

  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events.data?.items ?? []) {
    const key = e.start?.slice(0, 10) ?? "";
    const list = byDay.get(key);
    if (list) list.push(e);
    else byDay.set(key, [e]);
  }

  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) cells.push(new Date(from.getFullYear(), from.getMonth(), from.getDate() + i));
  const todayISO = new Date().toISOString().slice(0, 10);
  const inMonth = (d: Date) => d.getMonth() === cursor.getMonth();

  const move = (delta: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));

  const monthEvents = events.data?.items ?? [];

  const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Calendar</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Task due dates, milestones and sprint windows.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
            Today
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => move(-1)}>
            <ChevronLeft />
          </Button>
          <span className="w-44 text-center text-sm font-semibold">
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </span>
          <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => move(1)}>
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div>
          {events.isLoading ? (
            <CardSkeleton className="h-[520px]" />
          ) : events.isError ? (
            <ErrorState title="Couldn't load the calendar" message={apiErrorMessage(events.error)} onRetry={() => void events.refetch()} />
          ) : (
            <Card className="overflow-hidden">
              <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-[11px] font-semibold text-muted-foreground uppercase">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="py-2">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((d) => {
                  const dk = dayKey(d);
                  const dayEvents = byDay.get(dk) ?? [];
                  const isToday = dk === todayISO;
                  return (
                    <div
                      key={dk}
                      className={cn(
                        "min-h-[86px] border-b border-r p-1 last:border-r-0",
                        !inMonth(d) && "bg-muted/20",
                        isToday && "bg-primary/[0.05]"
                      )}
                    >
                      <div className="flex items-center justify-between px-0.5">
                        <span
                          className={cn(
                            "flex size-5 items-center justify-center rounded-full text-[11px] tabular-nums",
                            isToday ? "bg-primary font-bold text-primary-foreground" : inMonth(d) ? "text-foreground" : "text-muted-foreground/50"
                          )}
                        >
                          {d.getDate()}
                        </span>
                        {isToday ? <span className="sr-only">today</span> : null}
                      </div>
                      <div className="mt-0.5 space-y-0.5">
                        {dayEvents.slice(0, 3).map((e) => (
                          <EventChip key={e.id} e={e} />
                        ))}
                        {dayEvents.length > 3 ? (
                          <p className="px-1 text-[10px] text-muted-foreground">+{dayEvents.length - 3} more</p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Today</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <DayList events={(byDay.get(todayISO) ?? []).sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))} empty="Nothing due today." />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Next 7 days</CardTitle>
            </CardHeader>
            <CardContent>
              {monthEvents.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">No events in this range.</p>
              ) : (
                <ul className="space-y-1.5">
                  {monthEvents
                    .filter((e) => e.start && e.start.slice(0, 10) >= todayISO)
                    .slice(0, 8)
                    .map((e) => (
                      <li key={e.id} className="flex items-center gap-2 text-xs">
                        <EventGlyph type={e.type} />
                        <Link href={linkFor(e)} className="min-w-0 flex-1 truncate text-[13px] hover:text-primary">
                          {e.title}
                        </Link>
                        <span className="shrink-0 text-muted-foreground tabular-nums">{formatDate(e.start!)}</span>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Legend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-[13px]">
              <p className="flex items-center gap-2"><EventGlyph type="task" /> Task due date</p>
              <p className="flex items-center gap-2"><EventGlyph type="milestone" /> Milestone due date</p>
              <p className="flex items-center gap-2"><EventGlyph type="sprint" /> Sprint window</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function linkFor(e: CalendarEvent): string {
  if (e.type === "milestone") return `/projects/${e.projectId}/milestones`;
  return e.url ?? `/projects/${e.projectId}`;
}

function EventGlyph({ type }: { type: CalendarEvent["type"] }) {
  if (type === "task") return <SquareCheck className="size-3.5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />;
  if (type === "milestone") return <Flag className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />;
  return <Rocket className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />;
}

function EventChip({ e }: { e: CalendarEvent }) {
  return (
    <Link
      href={linkFor(e)}
      className={cn(
        "flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight hover:brightness-95",
        e.type === "task" && "bg-sky-500/15 text-sky-700 dark:text-sky-300",
        e.type === "milestone" && "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        e.type === "sprint" && "bg-violet-500/15 text-violet-700 dark:text-violet-300"
      )}
      title={`${e.title} · ${e.projectName}${e.type === "task" && e.assignee ? ` · ${e.assignee.name}` : ""}`}
    >
      {e.type === "sprint" ? (
        <span aria-hidden className="truncate">
          {e.title}
        </span>
      ) : (
        <span className="truncate">{e.title}</span>
      )}
    </Link>
  );
}

function DayList({ events, empty }: { events: CalendarEvent[]; empty: string }) {
  if (events.length === 0) return <p className="flex items-center gap-2 py-1 text-[13px] text-muted-foreground"><CalendarDays className="size-3.5" /> {empty}</p>;
  return (
    <ul className="space-y-1">
      {events.map((e) => (
        <li key={e.id}>
          <Link href={linkFor(e)} className="flex items-start gap-2 rounded-md p-1 text-[13px] hover:bg-accent">
            <EventGlyph type={e.type} />
            <span className="min-w-0 flex-1 truncate">{e.title}</span>
            <span className="shrink-0 text-muted-foreground">{e.type === "task" ? "due" : e.type === "sprint" ? "starts/ends" : "due"}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
