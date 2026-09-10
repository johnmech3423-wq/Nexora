import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal, dependency-free markdown renderer.
 * Produces React nodes only — never raw HTML, so no XSS surface.
 * Supports: headings, bold/italic/strike, inline code + fenced blocks,
 * links (external-safe), bullet & numbered lists, blockquotes, hr.
 */
const INLINE_RULES: { re: RegExp; render: (m: RegExpExecArray, i: number) => React.ReactNode }[] = [
  {
    re: /`([^`]+)`/g,
    render: (m, i) => (
      <code key={`c${i}`} className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.85em]">
        {m[1]}
      </code>
    ),
  },
  {
    re: /\*\*([^*]+)\*\*/g,
    render: (m, i) => (
      <strong key={`b${i}`} className="font-semibold">
        {m[1]}
      </strong>
    ),
  },
  {
    re: /\*([^*\n]+)\*/g,
    render: (m, i) => <em key={`i${i}`}>{m[1]}</em>,
  },
  {
    re: /~~([^~]+)~~/g,
    render: (m, i) => (
      <s key={`s${i}`} className="text-muted-foreground">
        {m[1]}
      </s>
    ),
  },
  {
    re: /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    render: (m, i) => (
      <a
        key={`a${i}`}
        href={m[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
      >
        {m[1]}
      </a>
    ),
  },
];

function renderInline(text: string): React.ReactNode[] {
  let nodes: React.ReactNode[] = [text];
  for (const rule of INLINE_RULES) {
    const next: React.ReactNode[] = [];
    for (const node of nodes) {
      if (typeof node !== "string") {
        next.push(node);
        continue;
      }
      const parts: (string | React.ReactNode)[] = [];
      let last = 0;
      let k = 0;
      rule.re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = rule.re.exec(node)) !== null) {
        parts.push(node.slice(last, m.index));
        parts.push(rule.render(m, k++));
        last = m.index + m[0].length;
        if (m.index === rule.re.lastIndex) rule.re.lastIndex += 1; // zero-width guard
      }
      parts.push(node.slice(last));
      next.push(...parts);
    }
    nodes = next;
  }
  return nodes;
}

/** Render a markdown string into safe React nodes. */
export function renderInlineText(text: string): React.ReactNode[] {
  return renderInline(text);
}

export function Markdown({ children, className }: { children: string; className?: string }) {
  const lines = children.replace(/\r\n/g, "\n").split("\n");
  const out: React.ReactNode[] = [];
  const listStack: { ordered: boolean; items: React.ReactNode[] }[] = [];
  let inCode = false;
  let codeLines: string[] = [];

  const closeList = (keyBase: string) => {
    while (listStack.length) {
      const l = listStack.pop()!;
      out.push(
        l.ordered ? (
          <ol key={`${keyBase}-ol${out.length}`} className="my-1.5 list-decimal space-y-0.5 pl-6">
            {l.items}
          </ol>
        ) : (
          <ul key={`${keyBase}-ul${out.length}`} className="my-1.5 list-disc space-y-0.5 pl-6">
            {l.items}
          </ul>
        )
      );
    }
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (inCode) {
      if (line.trim().startsWith("```")) {
        inCode = false;
        out.push(
          <pre key={`pre${idx}`} className="my-1.5 overflow-x-auto rounded-md bg-muted p-2.5 text-[12.5px] leading-relaxed">
            <code>{codeLines.join("\n")}</code>
          </pre>
        );
        codeLines = [];
      } else codeLines.push(line);
      continue;
    }
    if (line.trim().startsWith("```")) {
      closeList(`c${idx}`);
      inCode = true;
      codeLines = [];
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      closeList(`hr${idx}`);
      out.push(<hr key={`hr${idx}`} className="my-2 border-t" />);
      continue;
    }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      closeList(`q${idx}`);
      out.push(
        <blockquote key={`q${idx}`} className="my-1.5 border-l-2 border-primary/40 pl-3 text-muted-foreground">
          {renderInlineText(quote[1])}
        </blockquote>
      );
      continue;
    }
    const head = line.match(/^(#{1,4})\s+(.*)$/);
    if (head) {
      closeList(`h${idx}`);
      const lvl = head[1].length;
      const cls = lvl === 1 ? "text-base font-bold" : lvl === 2 ? "text-[15px] font-bold" : "text-sm font-semibold";
      out.push(
        <p key={`h${idx}`} className={cn("mt-2 mb-1", cls)}>
          {renderInlineText(head[2])}
        </p>
      );
      continue;
    }
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ol) {
      if (!listStack.length || !listStack[listStack.length - 1].ordered) {
        closeList(`l${idx}`);
        listStack.push({ ordered: true, items: [] });
      }
      listStack[listStack.length - 1].items.push(<li key={`${idx}`}>{renderInlineText(ol[1])}</li>);
      continue;
    }
    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    if (ul) {
      if (!listStack.length || listStack[listStack.length - 1].ordered) {
        closeList(`l${idx}`);
        listStack.push({ ordered: false, items: [] });
      }
      listStack[listStack.length - 1].items.push(<li key={`${idx}`}>{renderInlineText(ul[1])}</li>);
      continue;
    }
    closeList(`c${idx}`);
    if (line.trim() === "") continue;
    out.push(<p key={`p${idx}`}>{renderInlineText(line)}</p>);
  }
  closeList("end");
  if (inCode && codeLines.length) {
    out.push(
      <pre key="codeTail" className="rounded-md bg-muted p-2.5 text-[12.5px]">
        <code>{codeLines.join("\n")}</code>
      </pre>
    );
  }
  return <div className={cn("break-words", className)}>{out}</div>;
}
