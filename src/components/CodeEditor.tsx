"use client";

import { cpp } from "@codemirror/lang-cpp";
import { bracketMatching, indentOnInput, indentUnit, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { history, historyKeymap, defaultKeymap, indentWithTab } from "@codemirror/commands";
import { lintGutter, setDiagnostics, type Diagnostic as CmDiagnostic } from "@codemirror/lint";
import { EditorState, Prec } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, placeholder } from "@codemirror/view";
import { useEffect, useRef } from "react";
import type { Diagnostic } from "@/lib/grader/types";

// Deliberately no autocompletion: recalling the syntax is the exercise.

interface Props {
  value: string;
  onChange?: (v: string) => void;
  onSubmit?: () => void;
  readOnly?: boolean;
  diagnostics?: Diagnostic[];
  autoFocus?: boolean;
  placeholderText?: string;
  ariaLabel: string;
  /** Fill the parent's height, as the main editor panel. */
  fill?: boolean;
}

export function CodeEditor({ value, onChange, onSubmit, readOnly, diagnostics, autoFocus, placeholderText, ariaLabel, fill }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const handlers = useRef({ onChange, onSubmit });
  useEffect(() => {
    handlers.current = { onChange, onSubmit };
  }, [onChange, onSubmit]);

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          readOnly ? EditorView.lineWrapping : [lineNumbers(), highlightActiveLineGutter(), highlightActiveLine(), lintGutter()],
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          indentUnit.of("  "),
          cpp(),
          oneDark,
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          EditorState.readOnly.of(!!readOnly),
          EditorView.editable.of(!readOnly),
          EditorView.contentAttributes.of({ "aria-label": ariaLabel, autocapitalize: "off", autocorrect: "off", spellcheck: "false" }),
          placeholderText ? placeholder(placeholderText) : [],
          Prec.highest(
            keymap.of([
              {
                key: "Mod-Enter",
                run: () => {
                  handlers.current.onSubmit?.();
                  return true;
                },
              },
            ]),
          ),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) handlers.current.onChange?.(u.state.doc.toString());
          }),
          EditorView.theme({
            "&": { fontSize: "14px", borderRadius: fill ? "0" : "8px", height: fill ? "100%" : "auto" },
            ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.6" },
            ".cm-content": { padding: "10px 0" },
            "&.cm-focused": { outline: "none" },
          }),
        ],
      }),
    });
    view.current = v;
    if (autoFocus) v.focus();
    return () => v.destroy();
    // The editor is created once; later value changes are pushed in below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, fill]);

  // Replace the document when the parent swaps problems.
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
      if (autoFocus) v.focus();
    }
  }, [value, autoFocus]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const doc = v.state.doc;
    const cm: CmDiagnostic[] = (diagnostics ?? [])
      .filter((d) => d.severity !== "note" && d.line >= 1)
      .map((d) => {
        // An error just past the end (a missing ';') belongs on the last line.
        const line = doc.line(Math.min(d.line, doc.lines));
        const from = Math.min(line.from + Math.max(d.col - 1, 0), line.to);
        return { from, to: Math.max(from, line.to), severity: d.severity === "error" ? "error" : "warning", message: d.message };
      });
    v.dispatch(setDiagnostics(v.state, cm));
  }, [diagnostics]);

  return (
    <div ref={host} className={fill ? "h-full [&_.cm-editor]:h-full" : "overflow-hidden rounded-lg border border-[var(--line)]"} />
  );
}
