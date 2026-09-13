import { connectDb } from "@/server/db/db";
import { Notification } from "@/server/db/models/notification.model";
import { User } from "@/server/db/models/user.model";
import { Membership } from "@/server/db/models/membership.model";
import type { NotificationType } from "@/lib/constants";
import { userChannel, publish } from "@/server/realtime/events";

/** Map notification type → preference topic key (user prefs). */
const TYPE_TOPIC: Record<NotificationType, string> = {
  mention: "mentions",
  task_assigned: "task_assignments",
  comment: "comments",
  invitation: "invitations",
  project_activity: "project_updates",
  sprint_event: "sprint_events",
  chat_message: "chat_messages",
  deadline_reminder: "deadline_reminders",
  task_update: "task_assignments",
  system: "system",
};

export interface NotifyInput {
  organizationId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  /** user who caused the event (skip notification to self) */
  actorId?: string | null;
  /** restrict recipients — otherwise all org members */
  recipientIds?: string[];
  entity?: { type: string; id: string | null; projectId?: string | null };
  link?: string | null;
}

/**
 * Create in-app notifications honoring per-user preference topics.
 * Skips the actor, and validates recipients are active org members.
 * Fire-and-forget: never throws into the primary business flow.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    await connectDb();
    let recipients: string[] = [];
    if (input.recipientIds?.length) {
      const members = await Membership.find({
        organizationId: input.organizationId,
        userId: { $in: input.recipientIds },
        status: "active",
      })
        .select("userId")
        .lean();
      recipients = members.map((m) => String(m.userId));
    } else {
      const members = await Membership.find({ organizationId: input.organizationId, status: "active" })
        .select("userId")
        .lean();
      recipients = members.map((m) => String(m.userId));
    }
    if (input.actorId) recipients = recipients.filter((id) => id !== input.actorId);
    if (recipients.length === 0) return;

    const topic = TYPE_TOPIC[input.type] ?? "system";
    const users = await User.find({ _id: { $in: recipients } })
      .select("prefs.notifications email")
      .lean();
    const prefMap = new Map<string, { emailEnabled: boolean; inAppEnabled: boolean; topics: Record<string, boolean> }>();
    for (const u of users) {
      const n = u.prefs?.notifications ?? {};
      prefMap.set(String(u._id), {
        emailEnabled: n.emailEnabled !== false,
        inAppEnabled: n.inAppEnabled !== false,
        topics: (n.topics ?? {}) as Record<string, boolean>,
      });
    }

    const docs: {
      recipientId: string;
      organizationId: string;
      type: NotificationType;
      title: string;
      body: string | null;
      actorId: string | null;
      entityType: string;
      entityId: string | null;
      projectId: string | null;
      link: string | null;
    }[] = [];

    for (const recipientId of recipients) {
      const prefs = prefMap.get(recipientId);
      if (!prefs) continue;
      if (!prefs.inAppEnabled) continue;
      if (prefs.topics[topic] === false) continue; // explicit opt-out
      docs.push({
        recipientId,
        organizationId: input.organizationId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        actorId: input.actorId ?? null,
        entityType: input.entity?.type ?? "organization",
        entityId: input.entity?.id ?? null,
        projectId: input.entity?.projectId ?? null,
        link: input.link ?? null,
      });
    }
    if (docs.length === 0) return;

    const inserted = await Notification.insertMany(docs);
    for (const doc of inserted) {
      void publish([userChannel(String(doc.recipientId))], "notification.created", {
        id: String(doc._id),
        type: doc.type,
        title: doc.title,
        body: doc.body,
        organizationId: String(doc.organizationId),
        link: doc.link,
        at: doc.createdAt.toISOString(),
      });
    }
    void notifyEmails(users, docs, input);
  } catch (error) {
    console.error("[notify] failed:", error);
  }
}

/** Best-effort email fan-out for people with email enabled (SMTP/outbox). */
async function notifyEmails(
  users: { _id: unknown; email: string }[],
  docs: { recipientId: string; title: string; body: string | null }[],
  input: NotifyInput
): Promise<void> {
  try {
    const { sendMail, appLink } = await import("@/server/email/mailer");
    const byRecipient = new Map<string, string>();
    for (const u of users) byRecipient.set(String(u._id), u.email);
    const emailTopic = TYPE_TOPIC[input.type] ?? "system";
    for (const doc of docs) {
      const email = byRecipient.get(doc.recipientId);
      if (!email) continue;
      const link = input.link ? appLink(input.link) : null;
      const { simpleTemplate } = await import("@/server/email/templates");
      const mail = simpleTemplate(
        `[Nexora] ${doc.title}`,
        [doc.body ?? "", link ? `Open in Nexora: ${link}` : ""].filter(Boolean)
      );
      await sendMail({ to: email, subject: mail.subject, html: mail.html, text: mail.text });
    }
    void emailTopic;
  } catch (error) {
    console.error("[notify] email fan-out failed:", error);
  }
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  await connectDb();
  await Notification.updateOne({ _id: notificationId, recipientId: userId }, { $set: { readAt: new Date() } });
}

export async function markAllNotificationsRead(userId: string, organizationId: string): Promise<void> {
  await connectDb();
  await Notification.updateMany(
    { recipientId: userId, organizationId, readAt: null },
    { $set: { readAt: new Date() } }
  );
}

export async function deleteNotification(userId: string, notificationId: string): Promise<void> {
  await connectDb();
  await Notification.deleteOne({ _id: notificationId, recipientId: userId });
}

export async function unreadNotificationCount(userId: string, organizationId: string): Promise<number> {
  await connectDb();
  return Notification.countDocuments({ recipientId: userId, organizationId, readAt: null });
}
