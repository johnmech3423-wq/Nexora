"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Cloud, Mail, Radio, Save, Server, ShieldCheck, Sparkles, TestTube2 } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/state";
import { toast } from "sonner";

type ConfigStatus = {
  admins: { emails: string[] };
  storage: { driver: "local" | "cloudinary"; configured: boolean };
  smtp: { configured: boolean; host: string | null; port: number; secure: boolean; user: string | null; pass: string; mailFrom: string };
  cloudinary: { configured: boolean; cloudName: string | null; apiKey: string | null; apiSecret: string };
  ai: { configured: boolean; provider: string; apiKey: string; baseUrl: string | null; model: string | null };
  realtime: { configured: boolean; driver: string; appId: string | null; key: string | null; secret: string; cluster: string };
  platform: { name: string; supportEmail: string; maintenanceMode: boolean; allowRegistration: boolean };
};

type FormState = {
  adminEmails: string;
  storageDriver: "local" | "cloudinary";
  smtpHost: string; smtpPort: string; smtpSecure: boolean; smtpUser: string; smtpPass: string; smtpMailFrom: string;
  cloudName: string; cloudApiKey: string; cloudApiSecret: string;
  aiProvider: "none" | "openai-compatible" | "anthropic"; aiApiKey: string; aiBaseUrl: string; aiModel: string;
  realtimeDriver: "none" | "pusher"; pusherAppId: string; pusherKey: string; pusherSecret: string; pusherCluster: string;
  allowRegistration: boolean;
};

const emptyForm: FormState = {
  adminEmails: "",
  storageDriver: "local", smtpHost: "", smtpPort: "587", smtpSecure: false, smtpUser: "", smtpPass: "", smtpMailFrom: "",
  cloudName: "", cloudApiKey: "", cloudApiSecret: "", aiProvider: "none", aiApiKey: "", aiBaseUrl: "", aiModel: "",
  realtimeDriver: "none", pusherAppId: "", pusherKey: "", pusherSecret: "", pusherCluster: "mt1", allowRegistration: true,
};

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="block space-y-1.5"><span className="text-sm font-medium">{label}</span>{children}{hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}</label>;
}

function Status({ ok }: { ok: boolean }) {
  return <span className={ok ? "inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400" : "inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"}>{ok ? <CheckCircle2 className="size-3.5" /> : null}{ok ? "Configured" : "Not configured"}</span>;
}

export default function AdminSettingsPage() {
  const qc = useQueryClient();
  const config = useQuery({ queryKey: ["admin", "settings"], queryFn: () => apiFetch<ConfigStatus>("/api/admin/settings") });
  const [form, setForm] = React.useState<FormState>(emptyForm);

  // Sync the editable draft from the server after the async settings query resolves.
  // This is intentional: the form is a local draft, not derived render state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
React.useEffect(() => {
  if (!config.data) return;

  const c = config.data;

  queueMicrotask(() => {
    setForm({
      adminEmails: c.admins.emails.join(", "),
      storageDriver: c.storage.driver,

      smtpHost: c.smtp.host ?? "",
      smtpPort: String(c.smtp.port),
      smtpSecure: c.smtp.secure,
      smtpUser: c.smtp.user ?? "",
      smtpPass: "",
      smtpMailFrom: c.smtp.mailFrom,

      cloudName: c.cloudinary.cloudName ?? "",
      cloudApiKey: c.cloudinary.apiKey ?? "",
      cloudApiSecret: "",

      aiProvider: c.ai.provider as FormState["aiProvider"],
      aiApiKey: "",
      aiBaseUrl: c.ai.baseUrl ?? "",
      aiModel: c.ai.model ?? "",

      realtimeDriver: c.realtime.driver as FormState["realtimeDriver"],
      pusherAppId: c.realtime.appId ?? "",
      pusherKey: c.realtime.key ?? "",
      pusherSecret: "",
      pusherCluster: c.realtime.cluster,

      allowRegistration: c.platform.allowRegistration,
    });
  });
}, [config.data]);

  const save = useMutation({
    mutationFn: async () => apiFetch<ConfigStatus>("/api/admin/settings", {
      method: "PUT",
      body: {
        admins: { emails: form.adminEmails.split(",").map((e) => e.trim()).filter(Boolean) },
        storage: { driver: form.storageDriver },
        smtp: { host: form.smtpHost, port: Number(form.smtpPort), secure: form.smtpSecure, user: form.smtpUser, ...(form.smtpPass ? { pass: form.smtpPass } : {}), mailFrom: form.smtpMailFrom },
        cloudinary: { cloudName: form.cloudName, apiKey: form.cloudApiKey, ...(form.cloudApiSecret ? { apiSecret: form.cloudApiSecret } : {}) },
        ai: { provider: form.aiProvider, baseUrl: form.aiBaseUrl, model: form.aiModel, ...(form.aiApiKey ? { apiKey: form.aiApiKey } : {}) },
        realtime: { driver: form.realtimeDriver, appId: form.pusherAppId, key: form.pusherKey, cluster: form.pusherCluster, ...(form.pusherSecret ? { secret: form.pusherSecret } : {}) },
        platform: { allowRegistration: form.allowRegistration },
      },
    }),
    onSuccess: (data) => { qc.setQueryData(["admin", "settings"], data); toast.success("Platform settings saved"); setForm((f) => ({ ...f, smtpPass: "", cloudApiSecret: "", aiApiKey: "", pusherSecret: "" })); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save settings"),
  });

  const test = useMutation({
    mutationFn: (target: "smtp" | "cloudinary" | "ai") => apiFetch<{ ok: boolean }>("/api/admin/settings/test", { method: "POST", body: { target } }),
    onSuccess: (_, target) => toast.success(`${target === "smtp" ? "SMTP" : target === "cloudinary" ? "Cloudinary" : "AI provider"} connection is working`),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Connection test failed"),
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  if (config.isLoading) return <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted-foreground">Loading platform configuration…</div>;
  if (config.isError || !config.data) return <div className="mx-auto max-w-6xl px-4 py-10"><ErrorState title="Couldn't load platform settings" message="Refresh and try again." onRetry={() => void config.refetch()} /></div>;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="flex items-center gap-1.5 text-sm font-semibold text-primary"><ShieldCheck className="size-4" /> Control plane</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Platform settings</h1><p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">Configure runtime integrations without editing Vercel environment variables. Secrets are encrypted before they are stored in MongoDB and are never returned to the browser.</p></div>
        <Button onClick={() => void save.mutate()} disabled={save.isPending}><Save />{save.isPending ? "Saving…" : "Save all settings"}</Button>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card className="lg:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4" /> Platform administrators</CardTitle><CardDescription>Comma-separated admin emails. Your current email is always required in the saved database list; the deployment-level ADMIN_EMAILS remains a bootstrap backstop.</CardDescription></CardHeader><CardContent><Field label="Admin emails" hint="Add trusted platform operators only."><Input value={form.adminEmails} onChange={(e) => set("adminEmails", e.target.value)} placeholder="you@example.com, ops@example.com" /></Field></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Mail className="size-4" /> SMTP email</CardTitle><CardDescription><Status ok={config.data.smtp.configured} /> Verification, invitation and notification emails.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="SMTP host"><Input value={form.smtpHost} onChange={(e) => set("smtpHost", e.target.value)} placeholder="smtp.example.com" /></Field>
          <Field label="Port"><Input type="number" value={form.smtpPort} onChange={(e) => set("smtpPort", e.target.value)} /></Field>
          <Field label="Username"><Input value={form.smtpUser} onChange={(e) => set("smtpUser", e.target.value)} /></Field>
          <Field label="Password" hint="Leave blank to keep the current secret."><Input type="password" value={form.smtpPass} onChange={(e) => set("smtpPass", e.target.value)} placeholder="••••••••" autoComplete="new-password" /></Field>
          <Field label="From address" ><Input value={form.smtpMailFrom} onChange={(e) => set("smtpMailFrom", e.target.value)} placeholder="Nexora <no-reply@example.com>" /></Field>
          <label className="flex items-center gap-2 pt-7 text-sm"><input type="checkbox" checked={form.smtpSecure} onChange={(e) => set("smtpSecure", e.target.checked)} /> Use TLS/SSL</label>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" disabled={test.isPending || !form.smtpHost} onClick={() => test.mutate("smtp")}><TestTube2 /> Test SMTP</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, smtpHost: "smtp-relay.brevo.com", smtpPort: "587", smtpSecure: false }))}>Use Brevo free SMTP preset</Button>
          </div>
        </CardContent></Card>

        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Cloud className="size-4" /> File storage</CardTitle><CardDescription><Status ok={config.data.storage.configured} /> Vercel production should use Cloudinary instead of local disk.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Storage driver"><select className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm" value={form.storageDriver} onChange={(e) => set("storageDriver", e.target.value as FormState["storageDriver"])}><option value="local">Local filesystem</option><option value="cloudinary">Cloudinary</option></select></Field>
          <Field label="Cloud name"><Input value={form.cloudName} onChange={(e) => set("cloudName", e.target.value)} /></Field>
          <Field label="API key"><Input value={form.cloudApiKey} onChange={(e) => set("cloudApiKey", e.target.value)} /></Field>
          <Field label="API secret" hint="Leave blank to keep the current secret."><Input type="password" value={form.cloudApiSecret} onChange={(e) => set("cloudApiSecret", e.target.value)} autoComplete="new-password" /></Field>
          <div className="sm:col-span-2"><Button variant="outline" size="sm" disabled={test.isPending || form.storageDriver !== "cloudinary"} onClick={() => test.mutate("cloudinary")}><TestTube2 /> Test Cloudinary</Button></div>
        </CardContent></Card>

        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="size-4" /> AI provider</CardTitle><CardDescription><Status ok={config.data.ai.configured} /> OpenAI-compatible supports Gemini/Groq/OpenRouter/OpenAI-style endpoints; Anthropic is also supported. Nexora still works with AI off.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Provider"><select className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm" value={form.aiProvider} onChange={(e) => set("aiProvider", e.target.value as FormState["aiProvider"])}><option value="none">Off</option><option value="openai-compatible">OpenAI-compatible</option><option value="anthropic">Anthropic</option></select></Field>
          <Field label="Model"><Input value={form.aiModel} onChange={(e) => set("aiModel", e.target.value)} placeholder="gpt-4o-mini / claude-sonnet-4-5" /></Field>
          <Field label="API key" hint="Leave blank to keep the current secret."><Input type="password" value={form.aiApiKey} onChange={(e) => set("aiApiKey", e.target.value)} autoComplete="new-password" /></Field>
          <Field label="Base URL"><Input value={form.aiBaseUrl} onChange={(e) => set("aiBaseUrl", e.target.value)} placeholder="https://api.openai.com/v1" /></Field>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" disabled={test.isPending || form.aiProvider === "none" || (!form.aiApiKey && !form.aiBaseUrl)} onClick={() => test.mutate("ai")}><TestTube2 /> Test AI</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, aiProvider: "openai-compatible", aiBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/", aiModel: "gemini-2.5-flash-lite" }))}>Use Gemini free preset</Button>
          </div>
        </CardContent></Card>

        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Radio className="size-4" /> Realtime</CardTitle><CardDescription><Status ok={config.data.realtime.configured} /> Optional Pusher fan-out for live updates.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Driver"><select className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm" value={form.realtimeDriver} onChange={(e) => set("realtimeDriver", e.target.value as FormState["realtimeDriver"])}><option value="none">Off</option><option value="pusher">Pusher</option></select></Field>
          <Field label="Cluster"><Input value={form.pusherCluster} onChange={(e) => set("pusherCluster", e.target.value)} /></Field>
          <Field label="App ID"><Input value={form.pusherAppId} onChange={(e) => set("pusherAppId", e.target.value)} /></Field>
          <Field label="Key"><Input value={form.pusherKey} onChange={(e) => set("pusherKey", e.target.value)} /></Field>
          <Field label="Secret" hint="Leave blank to keep the current secret."><Input type="password" value={form.pusherSecret} onChange={(e) => set("pusherSecret", e.target.value)} autoComplete="new-password" /></Field>
        </CardContent></Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="size-4" /> Free-first production stack</CardTitle><CardDescription>Recommended no-cost defaults for a portfolio/demo deployment. Provider quotas still apply.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
            <div><strong className="text-foreground">Database:</strong> MongoDB Atlas Free cluster.</div>
            <div><strong className="text-foreground">Email:</strong> Brevo Free SMTP.</div>
            <div><strong className="text-foreground">Files:</strong> Cloudinary Free.</div>
            <div><strong className="text-foreground">AI:</strong> Gemini API free-tier model via OpenAI compatibility.</div>
            <div><strong className="text-foreground">Realtime:</strong> keep disabled; Nexora falls back to polling.</div>
            <div><strong className="text-foreground">Billing:</strong> keep disabled until Stripe is needed.</div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2"><Server className="size-4" /> Platform controls</CardTitle><CardDescription>Safe application-level controls. Database URL, AUTH_SECRET and the bootstrap admin allowlist intentionally remain deployment-level settings.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.allowRegistration} onChange={(e) => set("allowRegistration", e.target.checked)} /> Allow new registrations</label>
        </CardContent></Card>
      </div>

      <div className="mt-6 rounded-lg border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground"><strong className="text-foreground">Security boundary:</strong> the admin console can manage runtime integrations, but it cannot rewrite <code>DATABASE_URL</code>, <code>AUTH_SECRET</code> or <code>WEBHOOK_SECRET</code>. Those bootstrap values must remain in Vercel because changing them at runtime can invalidate sessions or disconnect the database. The initial platform-admin access is also bootstrapped from <code>ADMIN_EMAILS</code>.</div>
    </div>
  );
}
