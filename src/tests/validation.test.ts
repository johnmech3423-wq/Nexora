import { describe, expect, it } from "vitest";
import { emailSchema, passwordSchema, registerSchema } from "@/validations/auth.schema";
import { createTaskSchema, updateTaskSchema } from "@/validations/task.schema";
import { createProjectSchema, projectKeySchema } from "@/validations/project.schema";
import { createConversationSchema, sendMessageSchema } from "@/validations/chat.schema";

describe("auth validation", () => {
  it("normalizes valid email addresses", () => {
    expect(emailSchema.parse("  User@Example.COM ")).toBe("user@example.com");
  });

  it("rejects weak passwords", () => {
    expect(passwordSchema.safeParse("abcdefgh").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(false);
    expect(passwordSchema.safeParse("Abc12345").success).toBe(true);
  });

  it("validates registration as a single contract", () => {
    expect(registerSchema.safeParse({ name: "A", email: "a@example.com", password: "Abc12345" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "Alice", email: "a@example.com", password: "Abc12345" }).success).toBe(true);
  });
});

describe("project and task validation", () => {
  it("normalizes project keys", () => {
    expect(projectKeySchema.parse(" nex ")).toBe("NEX");
    expect(projectKeySchema.safeParse("1BAD").success).toBe(false);
    expect(projectKeySchema.safeParse("A").success).toBe(false);
  });

  it("enforces task title and estimate bounds", () => {
    expect(createTaskSchema.safeParse({ title: "  Ship it  " }).success).toBe(true);
    expect(createTaskSchema.safeParse({ title: "" }).success).toBe(false);
    expect(createTaskSchema.safeParse({ title: "Task", estimateMin: -1 }).success).toBe(false);
    expect(createTaskSchema.safeParse({ title: "Task", estimateMin: 525600 }).success).toBe(true);
    expect(createTaskSchema.safeParse({ title: "Task", estimateMin: 525601 }).success).toBe(false);
  });

  it("rejects empty task updates and invalid date order", () => {
    expect(updateTaskSchema.safeParse({}).success).toBe(false);
    expect(updateTaskSchema.safeParse({ title: "Updated" }).success).toBe(true);
    expect(updateTaskSchema.safeParse({ startDate: "2026-09-10", dueDate: "2026-09-01" }).success).toBe(false);
  });
});

describe("chat validation", () => {
  it("requires the correct fields for each conversation type", () => {
    expect(createConversationSchema.safeParse({ type: "dm", peerId: "u1" }).success).toBe(true);
    expect(createConversationSchema.safeParse({ type: "group", name: "Team", memberIds: ["u1"] }).success).toBe(true);
    expect(createConversationSchema.safeParse({ type: "project_channel", projectId: "p1" }).success).toBe(true);
    expect(createConversationSchema.safeParse({ type: "dm", projectId: "p1" }).success).toBe(false);
  });

  it("bounds message size", () => {
    expect(sendMessageSchema.safeParse({ body: "hello" }).success).toBe(true);
    expect(sendMessageSchema.safeParse({ body: "" }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ body: "x".repeat(10_001) }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ body: "ok", attachmentFileIds: Array(9).fill("f") }).success).toBe(false);
  });
});
