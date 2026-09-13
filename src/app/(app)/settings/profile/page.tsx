"use client";

import * as React from "react";
import { Camera, CheckCircle2, Loader2, Mail, Save, User as UserIcon } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import { useActiveOrgId, useMe } from "@/lib/hooks/use-session";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/controls";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { NOTIFICATION_PREF_KEYS, type NotificationPrefKey } from "@/lib/constants";
import type { UserDTO } from "@/types";

const TOPIC_LABELS: Record<NotificationPrefKey, string> = {
  mentions: "@ Mentions",
  task_assignments: "Task assignments",
  comments: "Comments and replies",
  project_updates: "Project updates",
  sprint_events: "Sprint events",
  chat_messages: "Chat messages",
  deadline_reminders: "Deadline reminders",
  invitations: "Invitations",
};

const TOPIC_DESCRIPTIONS: Partial<Record<NotificationPrefKey, string>> = {
  mentions: "When someone mentions you",
  task_assignments: "When a task is assigned to you",
  chat_messages: "New direct or group messages",
  deadline_reminders: "Upcoming and overdue due dates",
};

function formatMemberSince(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long" });
}

export default function ProfileSettingsPage() {
  const me = useMe();
  const user = me.data?.user;
  const orgId = useActiveOrgId();
  const qc = useQueryClient();

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Profile</h1>
          <p className="text-[13px] text-muted-foreground">Your identity and notification preferences.</p>
        </div>
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const refreshUser = () => qc.invalidateQueries({ queryKey: qk.me });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Profile</h1>
        <p className="text-[13px] text-muted-foreground">Your identity and notification preferences.</p>
      </div>

      <IdentityCard user={user} orgId={orgId} onChanged={refreshUser} />
      <PrefsCard user={user} onSaved={refreshUser} />
    </div>
  );
}

function IdentityCard({
  user,
  orgId,
  onChanged,
}: {
  user: UserDTO;
  orgId: string | null;
  onChanged: () => void;
}) {
  const [name, setName] = React.useState(user.name);
  const [avatarBusy, setAvatarBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  const saveName = useMutation({
    mutationFn: (value: string) => apiFetch("/api/user/profile", { method: "PATCH", body: JSON.stringify({ name: value }) }),
    onSuccess: () => {
      onChanged();
      toast.success("Name updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't update your name."),
  });

  const applyAvatar = async (url: string) => {
    await apiFetch("/api/user/profile", { method: "PATCH", body: JSON.stringify({ avatarUrl: url }) });
    onChanged();
    toast.success("Profile photo updated");
  };

  const uploadAvatar = async (file: File) => {
    setAvatarBusy(true);
    try {
      const fd = new FormData();
      fd.append("kind", "avatar");
      if (orgId) fd.append("orgId", orgId);
      fd.append("file", file);
      const res = await fetch("/api/files", { method: "POST", body: fd });
      const body = (await res.json()) as {
        success: boolean;
        data?: { file?: { url: string } };
        error?: { message?: string };
      };
      if (!res.ok || !body.success || !body.data?.file) throw new Error(body.error?.message ?? "Upload failed.");
      await applyAvatar(body.data.file.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't upload the photo.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const nameDirty = name.trim() !== user.name;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <UserIcon className="size-4 text-muted-foreground" /> Identity
        </CardTitle>
        <CardDescription>How you appear across the workspace.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="relative shrink-0">
            <Avatar name={user.name} src={user.avatarUrl} size="xl" className="size-20 text-lg" />
            <button
              type="button"
              disabled={avatarBusy}
              aria-label="Change profile photo"
              onClick={() => fileRef.current?.click()}
              className="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground disabled:opacity-60"
            >
              {avatarBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              aria-hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void uploadAvatar(f);
              }}
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{user.name}</p>
            <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Mail className="size-3.5" /> {user.email}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {user.emailVerified ? (
                <Badge variant="muted" className="gap-1 normal-case">
                  <CheckCircle2 className="size-3 text-success" /> Verified email
                </Badge>
              ) : (
                <Badge variant="muted">Email unverified</Badge>
              )}
              <Badge variant="muted" className="normal-case">
                {user.provider === "email" ? "Password sign-in" : `Signed in with ${user.provider}`}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="profile-name" className="text-xs font-medium">
              Display name
            </label>
            <Input
              id="profile-name"
              value={name}
              maxLength={80}
              disabled={saveName.isPending}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button
            onClick={() => {
              const v = name.trim();
              if (v.length < 2) {
                toast.error("Name must be at least 2 characters.");
                return;
              }
              saveName.mutate(v);
            }}
            disabled={!nameDirty || saveName.isPending}
          >
            <Save /> Save name
          </Button>
        </div>

        <div className="grid gap-1.5 border-t pt-4 text-[13px] sm:grid-cols-2">
          <p className="text-muted-foreground">
            Member since <span className="text-foreground">{formatMemberSince(user.createdAt)}</span>
          </p>
          <p className="text-muted-foreground sm:text-right">
            Password sign-in: <span className="text-foreground">{user.hasPassword ? "Enabled" : "Not set"}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function PrefsCard({ user, onSaved }: { user: UserDTO; onSaved: () => void }) {
  const n = user.prefs?.notifications;
  const [emailEnabled, setEmailEnabled] = React.useState(n?.emailEnabled ?? true);
  const [inAppEnabled, setInAppEnabled] = React.useState(n?.inAppEnabled ?? true);
  const [topics, setTopics] = React.useState<Record<string, boolean>>(() => {
    const t: Record<string, boolean> = {};
    for (const key of NOTIFICATION_PREF_KEYS) t[key] = n?.topics?.[key] !== false;
    return t;
  });

  const prefsDirty =
    emailEnabled !== (n?.emailEnabled ?? true) ||
    inAppEnabled !== (n?.inAppEnabled ?? true) ||
    NOTIFICATION_PREF_KEYS.some((k) => topics[k] !== (n?.topics?.[k] !== false));

  const savePrefs = useMutation({
    mutationFn: () =>
      apiFetch("/api/user/prefs", {
        method: "PUT",
        body: JSON.stringify({ emailEnabled, inAppEnabled, topics }),
      }),
    onSuccess: () => {
      onSaved();
      toast.success("Notification preferences saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save preferences."),
  });

  const anyChannel = inAppEnabled || emailEnabled;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Mail className="size-4 text-muted-foreground" /> Notification preferences
        </CardTitle>
        <CardDescription>Choose which channels and topics you want to hear about.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
            <span>
              <span className="block text-[13px] font-medium">In-app</span>
              <span className="block text-xs text-muted-foreground">Bell notifications while signed in</span>
            </span>
            <Switch checked={inAppEnabled} onCheckedChange={setInAppEnabled} aria-label="Toggle in-app notifications" />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
            <span>
              <span className="block text-[13px] font-medium">Email</span>
              <span className="block text-xs text-muted-foreground">Digests for important activity</span>
            </span>
            <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} aria-label="Toggle email notifications" />
          </label>
        </div>

        <div className="space-y-0.5">
          <p className="text-xs font-medium text-muted-foreground">Topics</p>
          {NOTIFICATION_PREF_KEYS.map((key) => (
            <div key={key} className="flex items-center justify-between gap-3 rounded-lg px-1 py-1.5">
              <span className="min-w-0">
                <span className="block text-[13px]">{TOPIC_LABELS[key]}</span>
                {TOPIC_DESCRIPTIONS[key] ? (
                  <span className="block truncate text-xs text-muted-foreground">{TOPIC_DESCRIPTIONS[key]}</span>
                ) : null}
              </span>
              <Switch
                checked={topics[key] !== false}
                disabled={!anyChannel}
                onCheckedChange={(v) => setTopics((t) => ({ ...t, [key]: v }))}
                aria-label={`Toggle ${TOPIC_LABELS[key]}`}
                className="shrink-0"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end border-t pt-3">
          <Button onClick={() => savePrefs.mutate()} disabled={!prefsDirty || savePrefs.isPending}>
            <Save /> Save preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
