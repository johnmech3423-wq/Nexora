import { describe, expect, it } from "vitest";
import { AiToolSchemas, parseToolCalls } from "@/server/services/ai-tools.service";

describe("AI mutation proposal safety", () => {
  it("parses only allowlisted tools from fenced JSON", () => {
    const text = [
      "```json",
      JSON.stringify({ tool: "create_task", args: { projectId: "p1", title: "Ship release" } }),
      "```",
      "```json",
      JSON.stringify({ tool: "delete_project", args: { projectId: "p1" } }),
      "```",
    ].join("\n");

    const calls = parseToolCalls(text);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.tool).toBe("create_task");
  });

  it("ignores malformed and unknown tool payloads", () => {
    const text = [
      "```json",
      "{not valid json}",
      "```",
      "```json",
      JSON.stringify({ tool: "run_shell", args: { command: "rm -rf /" } }),
      "```",
    ].join("\n");

    expect(parseToolCalls(text)).toEqual([]);
  });

  it("bounds parsed calls to five", () => {
    const payload = Array.from({ length: 8 }, (_, i) => ({
      tool: "create_task",
      args: { projectId: "p1", title: `Task ${i + 1}` },
    }));

    expect(parseToolCalls("```json\n" + JSON.stringify(payload) + "\n```")).toHaveLength(5);
  });

  it("enforces strict argument schemas for each mutation", () => {
    expect(AiToolSchemas.create_task.safeParse({ projectId: "p1", title: "ok" }).success).toBe(true);
    expect(AiToolSchemas.create_task.safeParse({ projectId: "p1", title: "x" }).success).toBe(false);
    expect(AiToolSchemas.create_task.safeParse({ projectId: "p1", title: "ok", priority: "critical" }).success).toBe(false);

    expect(
      AiToolSchemas.create_subtasks.safeParse({
        projectId: "p1",
        parentTaskId: "t1",
        subtasks: [{ title: "child" }],
      }).success,
    ).toBe(true);
    expect(
      AiToolSchemas.create_subtasks.safeParse({
        projectId: "p1",
        parentTaskId: "t1",
        subtasks: [],
      }).success,
    ).toBe(false);

    expect(
      AiToolSchemas.update_task.safeParse({ projectId: "p1", taskId: "t1", status: "done" }).success,
    ).toBe(true);
    expect(
      AiToolSchemas.update_task.safeParse({ projectId: "p1", taskId: "t1", status: "completed" }).success,
    ).toBe(false);
  });

  it("does not accept arbitrary fields through the mutation schemas", () => {
    const parsed = AiToolSchemas.create_task.safeParse({
      projectId: "p1",
      title: "Safe task",
      unexpectedCommand: "do something dangerous",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("unexpectedCommand");
    }
  });
});
