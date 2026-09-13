"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Braces,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Lock,
  Minus,
  Network,
  ShieldCheck,
  Terminal,
  Webhook,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useOrgStore } from "@/lib/org-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { OrgDTO } from "@/types";

/* ------------------------------ Content ----------------------------- */

/** Deployed origin (inlined at build) used for API snippets. */
const API_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? "https://<your-nexora-host>";

function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="relative overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-1.5">
        <span className="font-mono text-[11px] text-muted-foreground">{label}</span>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Copy ${label}`}
          onClick={() => {
            void navigator.clipboard.writeText(code);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

interface CapabilityRow {
  name: string;
  example: string;
  description: string;
}

const AVAILABLE_AREAS: CapabilityRow[] = [
  { name: "Organizations, members & invitations", example: "GET /api/organizations · PATCH /api/organizations/{orgId}", description: "Workspace settings, roles, invites, plan." },
  { name: "Projects & boards", example: "GET /api/projects?orgId=… · GET /api/projects/{id}/board", description: "Projects, columns/statuses, favorites, archives." },
  { name: "Tasks & comments", example: "GET /api/projects/{id}/tasks · POST …/tasks/{taskId}/comments", description: "Full task lifecycle, watchers, reactions, comments." },
  { name: "Sprints & milestones", example: "POST …/sprints/{sprintId}/start · GET …/sprints/{id}/burndown", description: "Sprint planning, start/complete/cancel, burndown." },
  { name: "Calendar & analytics", example: "GET /api/calendar?orgId=… · GET /api/analytics/summary?orgId=…", description: "Schedules, workload, trends, distributions." },
  { name: "Chat & notifications", example: "GET /api/chat/conversations · GET /api/notifications?orgId=…", description: "Conversations, messages, reactions, notifications." },
  { name: "Files & time tracking", example: "POST /api/files · POST /api/time-entries/running", description: "Uploads, storage quota, time entries." },
  { name: "Webhooks", example: "GET /api/organizations/{orgId}/webhooks", description: "Signed event delivery with retries and a delivery log." },
  { name: "AI assistant", example: "POST /api/ai/chat", description: "Workspace AI chat with per-plan daily quotas." },
  { name: "Account security", example: "POST /api/auth/two-factor/enable · GET /api/auth/sessions", description: "Sessions, 2FA, password." },
];

const UNAVAILABLE_CAPABILITIES: { name: string; note: string }[] = [
  { name: "Personal access tokens", note: "No endpoint or model exists in the backend (probes return 404). The API authenticates exclusively through the interactive session cookie." },
  { name: "Scoped / workspace API keys", note: "Not implemented server-side — keys cannot be created, listed, rotated or revoked anywhere in the product today." },
  { name: "OAuth apps & machine-to-machine credentials", note: "No OAuth or service-account flow exists yet." },
  { name: "Per-key usage dashboards", note: "Usage is only visible per feature (AI quotas, webhook deliveries, sessions) inside the app." },
];

const ERROR_TABLE: { status: string; code: string; meaning: string }[] = [
  { status: "400", code: "validation_error", meaning: "Malformed request body or invalid field value." },
  { status: "401", code: "unauthorized", meaning: "No valid session. Sign in and retry with your session cookie." },
  { status: "402", code: "plan_required", meaning: "The workspace plan doesn't include this feature or limit." },
  { status: "403", code: "forbidden", meaning: "Signed in, but your role can't perform this action." },
  { status: "404", code: "not_found", meaning: "Resource missing — or exists in another organization you can't see." },
  { status: "409", code: "conflict", meaning: "State conflict (already accepted, already resolved…)." },
  { status: "422", code: "validation_error", meaning: "Zod field validation failed; fieldErrors carries per-field messages." },
  { status: "429", code: "rate_limited", meaning: "Slow down — a per-route limit was hit (e.g. 60s between invite resends)." },
  { status: "500", code: "internal", meaning: "Server error — details are never exposed to clients." },
];

export default function ApiSettingsPage() {
  const sp = useSearchParams();
  const { activeOrgId, setActiveOrgId } = useOrgStore();
  const requestedOrg = sp.get("org");
  const orgId = requestedOrg ?? activeOrgId;

  React.useEffect(() => {
    if (requestedOrg && requestedOrg !== activeOrgId) setActiveOrgId(requestedOrg);
  }, [requestedOrg, activeOrgId, setActiveOrgId]);

  const orgQuery = useQuery({
    queryKey: qk.orgDetail(orgId ?? "_"),
    queryFn: () => apiFetch<{ organization: OrgDTO }>(`/api/organizations/${orgId}`),
    enabled: Boolean(orgId),
  });
  const org = orgQuery.data?.organization;
  const origin = API_ORIGIN;

  if (!orgId) {
    return (
      <div className="space-y-4 rounded-xl border bg-muted/20 p-6 text-center">
        <Terminal className="mx-auto size-8 text-muted-foreground" />
        <p className="text-sm font-medium">No workspace selected</p>
        <p className="mx-auto max-w-sm text-[13px] text-muted-foreground">
          Pick a workspace from the switcher in the top bar, then open API again.
        </p>
      </div>
    );
  }

  if (orgQuery.isLoading || (org && org.id !== orgId)) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (orgQuery.isError || !org) {
    return (
      <div className="space-y-4 rounded-xl border bg-muted/20 p-6 text-center">
        <AlertTriangle className="mx-auto size-8 text-destructive" />
        <p className="text-sm font-medium">Couldn&apos;t load this workspace</p>
        <p className="mx-auto max-w-sm text-[13px] text-muted-foreground">
          {orgQuery.error instanceof Error ? orgQuery.error.message : "It may have been deleted or you no longer have access."}
        </p>
        <Button size="sm" variant="outline" onClick={() => orgQuery.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const exampleRequest = `# List projects in ${org.name}
curl "${origin}/api/projects?orgId=${org.id}" \\
  -H "Cookie: <your-session-cookie>"  # or use curl -b/-c to keep the session`;

  const exampleResponse = `{
  "success": true,
  "data": {
    "items": [
      { "id": "…", "name": "…", "key": "…", "settings": { "private": false } }
    ],
    "total": 1,
    "hasMore": false
  }
}`;

  const exampleError = `{
  "success": false,
  "error": {
    "code": "plan_required",
    "message": "This feature requires the Pro or Business plan.",
    "status": 402
  }
}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">API</h1>
          <p className="text-[13px] text-muted-foreground">
            Programmatic access to {org.name} — reference, conventions and capability status.
          </p>
        </div>
        <Badge variant="outline" className="capitalize">
          <ShieldCheck className="mr-1 size-3.5" /> {org.myRole}
        </Badge>
      </div>

      {/* Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Braces className="size-4 text-muted-foreground" /> Overview
          </CardTitle>
          <CardDescription>
            Nexora ships a JSON REST API at <code className="font-mono text-xs">{origin}/api</code>. Every feature in the app —
            projects, tasks, sprints, calendar, analytics, chat, notifications, files, time, members and webhooks — is backed by a
            real endpoint you can call programmatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <CodeBlock label="Request" code={exampleRequest} />
          <CodeBlock label="Success response" code={exampleResponse} />
          <CodeBlock label="Error response" code={exampleError} />
          <p className="text-[13px] text-muted-foreground">
            Responses are wrapped in a <code className="font-mono text-xs">{"{ success, data }"}</code> envelope; failures return{" "}
            <code className="font-mono text-xs">{"{ success:false, error:{ code, message } }"}</code> with a human-readable message —
            never a stack trace. All timestamps are ISO-8601 UTC. Lists paginate with{" "}
            <code className="font-mono text-xs">page</code>/<code className="font-mono text-xs">pageSize</code> and report{" "}
            <code className="font-mono text-xs">hasMore</code>.
          </p>
        </CardContent>
      </Card>

      {/* Authentication */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Lock className="size-4 text-muted-foreground" /> Authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            The API authenticates with the same <span className="font-medium text-foreground">session cookie</span> the web app
            uses: <span className="font-mono text-xs">httpOnly</span>, <span className="font-mono text-xs">SameSite=Lax</span>,
            TLS-only in production. Scripts authenticate by signing in once and preserving the cookie jar (
            <span className="font-mono text-xs">curl -c cookies.txt -b cookies.txt</span> or a fetch client with{" "}
            <span className="font-mono text-xs">credentials: &quot;include&quot;</span>). Without a valid session every endpoint answers{" "}
            <span className="font-mono text-xs">401 unauthorized</span>. Resource access is tenant-isolated and role-checked
            server-side per organization — an org id alone never grants access.
          </p>
          <div className="rounded-lg border border-dashed border-amber-300/60 bg-amber-50/60 p-3 dark:border-amber-500/30 dark:bg-amber-500/5">
            <p className="flex items-start gap-2 text-[13px] text-amber-800 dark:text-amber-200">
              <KeyRound className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="font-medium">API keys are not available yet.</span> The backend currently exposes no endpoint or
                storage for personal access tokens or API keys — every plausible key route returns 404. Nothing in this UI
                fabricates them. Until credential management ships server-side, scripts must authenticate with an interactive
                session cookie.
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Status codes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Network className="size-4 text-muted-foreground" /> Status codes &amp; errors
          </CardTitle>
          <CardDescription>Every error carries a stable machine-readable code alongside the HTTP status.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 pr-4 font-medium">HTTP</th>
                <th className="py-2 pr-4 font-medium">Code</th>
                <th className="py-2 font-medium">Meaning</th>
              </tr>
            </thead>
            <tbody>
              {ERROR_TABLE.map((row) => (
                <tr key={row.code} className="border-b border-muted/50 last:border-0">
                  <td className="py-2 pr-4 font-mono text-xs">{row.status}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-primary">{row.code}</td>
                  <td className="py-2 text-muted-foreground">{row.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Capabilities */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 text-muted-foreground" /> Capability status
          </CardTitle>
          <CardDescription>
            What the backend exposes today — and what it doesn&apos;t. This page only reports capabilities that exist server-side.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-1.5 text-[13px] font-medium">Available now</p>
            <ul role="list" className="grid gap-x-6 gap-y-1.5 lg:grid-cols-2">
              {AVAILABLE_AREAS.map((area) => (
                <li key={area.name} className="flex items-start gap-2 rounded-lg border bg-muted/20 px-3 py-2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium">{area.name}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">{area.example}</p>
                    <p className="text-xs text-muted-foreground">{area.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-1.5 text-[13px] font-medium">Not available — backend limitation</p>
            <ul role="list" className="space-y-1.5">
              {UNAVAILABLE_CAPABILITIES.map((cap) => (
                <li key={cap.name} className="flex items-start gap-2 rounded-lg border border-dashed px-3 py-2">
                  <Minus className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
                  <div>
                    <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
                      {cap.name}
                      <Badge variant="muted">Backend limitation</Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">{cap.note}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              When the backend ships credential management, the matching create / list / revoke / rotate UI will appear here —
              nothing on this page invents endpoints or stores credentials client-side.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Neighboring secrets */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Webhook className="size-4 text-muted-foreground" /> Secrets in this workspace
          </CardTitle>
          <CardDescription>The only generated credential in the product today.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[13px] text-muted-foreground">
            <p className="font-medium text-foreground">Webhook signing secrets</p>
            <p>
              Managed under <span className="font-medium">Settings → Webhooks</span>. Shown once on create/rotate; lists never
              include them. HMAC-SHA256 over <code className="font-mono text-xs">timestamp.body</code>.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={`/settings/webhooks?org=${org.id}`}>Open Webhooks</a>
          </Button>
        </CardContent>
      </Card>

      <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0" />
        Authorization notes: every read above is org-scoped via your session ({org.name}, role{" "}
        <span className="font-medium capitalize">{org.myRole}</span>). If this workspace disappears from the switcher, your
        access was removed and the API will answer 404 for its resources.
      </p>
    </div>
  );
}
