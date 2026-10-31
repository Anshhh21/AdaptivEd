"use client";

import React, { useState } from "react";

interface MarkdownCodeRendererProps {
  content: string;
}

export const MarkdownCodeRenderer: React.FC<MarkdownCodeRendererProps> = ({ content }) => {
  // Split content by code blocks: ```[lang]\n[code]\n```
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const textBefore = content.substring(lastIndex, match.index);
    if (textBefore.trim()) {
      parts.push(
        <div key={`text-${lastIndex}`} className="space-y-3">
          {renderFormattedText(textBefore)}
        </div>
      );
    }

    const language = match[1] || "code";
    const codeBody = match[2];
    parts.push(
      <CodeWindow
        key={`code-${match.index}`}
        language={language}
        code={codeBody}
      />
    );

    lastIndex = match.index + match[0].length;
  }

  // Trailing text after the last code block
  if (lastIndex < content.length) {
    const remainingText = content.substring(lastIndex);
    if (remainingText.trim()) {
      parts.push(
        <div key={`text-${lastIndex}`} className="space-y-3">
          {renderFormattedText(remainingText)}
        </div>
      );
    }
  }

  // If no code blocks were found, render formatted text directly
  if (parts.length === 0) {
    return <div className="space-y-3">{renderFormattedText(content)}</div>;
  }

  return <div className="space-y-5 text-slate-200 text-sm sm:text-base leading-relaxed">{parts}</div>;
};

// ChatGPT / Gemini Style Code Window Component
interface CodeWindowProps {
  language: string;
  code: string;
}

const CodeWindow: React.FC<CodeWindowProps> = ({ language, code }) => {
  const [copied, setCopied] = useState<boolean>(false);

  const cleanCode = code.trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(cleanCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-5 rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
      {/* Code Window Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
          </div>
          <span className="font-mono uppercase font-bold text-[11px] text-slate-400 pl-2">
            {language || "CODE"}
          </span>
        </div>

        <button
          onClick={handleCopy}
          type="button"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer text-[11px] font-medium"
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <span className="text-emerald-400">✓</span>
              <span className="text-emerald-400 font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body */}
      <pre className="p-4 overflow-x-auto font-mono text-xs sm:text-sm text-slate-200 leading-relaxed selection:bg-indigo-500/30">
        <code>{highlightSyntax(cleanCode, language)}</code>
      </pre>
    </div>
  );
};

// Syntax high-lighter utility for JSX, JavaScript, and CSS
function highlightSyntax(code: string, language: string): React.ReactNode[] {
  const lines = code.split("\n");

  return lines.map((line, lineIdx) => {
    // Highlight keywords
    const tokens = line.split(/(\b(?:import|export|from|function|return|const|let|var|if|else|new|class|async|await|try|catch|default)\b|"[^"]*"|'[^']*'|`[^`]*`|<\/?[a-zA-Z0-9_.-]+|\/\/.*$)/g);

    const renderedLine = tokens.map((token, tokIdx) => {
      if (/^(import|export|from|function|return|const|let|var|if|else|new|class|async|await|try|catch|default)$/.test(token)) {
        return (
          <span key={tokIdx} className="text-purple-400 font-semibold">
            {token}
          </span>
        );
      }
      if (/^["'`].*["'`]$/.test(token)) {
        return (
          <span key={tokIdx} className="text-emerald-300">
            {token}
          </span>
        );
      }
      if (/^<\/?/.test(token)) {
        return (
          <span key={tokIdx} className="text-sky-400 font-medium">
            {token}
          </span>
        );
      }
      if (/^\/\//.test(token)) {
        return (
          <span key={tokIdx} className="text-slate-500 italic">
            {token}
          </span>
        );
      }
      return <span key={tokIdx}>{token}</span>;
    });

    return (
      <div key={lineIdx} className="leading-6">
        {renderedLine.length > 0 ? renderedLine : " "}
      </div>
    );
  });
}

// Parses paragraphs, headings, bullet lists, bold text, and inline code
function renderFormattedText(rawText: string): React.ReactNode[] {
  const paragraphs = rawText.split(/\n\s*\n/);

  return paragraphs.map((para, pIdx) => {
    const trimmed = para.trim();
    if (!trimmed) return null;

    // Heading 3
    if (trimmed.startsWith("### ")) {
      return (
        <h3 key={pIdx} className="text-lg font-bold text-white tracking-tight pt-2">
          {parseInlineFormatting(trimmed.replace(/^###\s+/, ""))}
        </h3>
      );
    }

    // Heading 2
    if (trimmed.startsWith("## ")) {
      return (
        <h2 key={pIdx} className="text-xl font-bold text-white tracking-tight pt-3 border-b border-slate-900 pb-2">
          {parseInlineFormatting(trimmed.replace(/^##\s+/, ""))}
        </h2>
      );
    }

    // Bullet List
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const items = trimmed.split(/\n[-*]\s+/);
      return (
        <ul key={pIdx} className="list-disc list-inside space-y-1.5 pl-2 text-slate-300">
          {items.map((item, iIdx) => (
            <li key={iIdx}>{parseInlineFormatting(item.replace(/^[-*]\s+/, ""))}</li>
          ))}
        </ul>
      );
    }

    return (
      <p key={pIdx} className="text-slate-200 leading-relaxed text-sm sm:text-base">
        {parseInlineFormatting(trimmed)}
      </p>
    );
  });
}

// Handles inline `code` and **bold**
function parseInlineFormatting(text: string): React.ReactNode[] {
  // Regex splitting by inline `code` and **bold**
  const regex = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  const parts = text.split(regex);

  return parts.map((part, idx) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 mx-0.5 rounded-md bg-slate-900 border border-slate-800 text-indigo-300 font-mono text-[12px] font-semibold"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="font-bold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}
