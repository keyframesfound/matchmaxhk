import * as React from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { Bold, Italic, List } from "lucide-react";
import { cn } from "@/lib/utils";
import "./rich-text-editor.css";

type MarkdownStorage = { getMarkdown: () => string };

function getMarkdown(editor: Editor): string {
  const storage = (editor.storage as unknown as Record<string, MarkdownStorage | undefined>)
    .markdown;
  return storage?.getMarkdown() ?? "";
}

export interface RichTextEditorProps {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  className?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  maxLength,
  disabled = false,
  className,
}: RichTextEditorProps) {
  const normalizedValue = value ?? "";
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const lastValueRef = React.useRef(normalizedValue);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        link: false,
        orderedList: false,
        strike: false,
        underline: false,
      }),
      Markdown.configure({
        html: false,
        linkify: false,
        breaks: true,
      }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: normalizedValue || "",
    editable: !disabled,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor }) => {
      const markdown = getMarkdown(editor);
      lastValueRef.current = markdown;
      onChangeRef.current(markdown);
    },
  });

  React.useEffect(() => {
    if (!editor) return;
    if (normalizedValue !== lastValueRef.current) {
      lastValueRef.current = normalizedValue;
      editor.commands.setContent(normalizedValue);
    }
  }, [normalizedValue, editor]);

  React.useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  const overLimit = maxLength != null && normalizedValue.length > maxLength;

  const tools = [
    {
      label: "Bold",
      shortcut: "⌘B",
      icon: Bold,
      active: editor?.isActive("bold") ?? false,
      run: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      shortcut: "⌘I",
      icon: Italic,
      active: editor?.isActive("italic") ?? false,
      run: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      label: "Bullet list",
      shortcut: "⌘⇧8",
      icon: List,
      active: editor?.isActive("bulletList") ?? false,
      run: () => editor?.chain().focus().toggleBulletList().run(),
    },
  ];

  return (
    <div
      className={cn(
        "rich-text-editor overflow-hidden rounded-md border border-input bg-transparent shadow-sm focus-within:ring-1 focus-within:ring-ring",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <div
        role="toolbar"
        aria-label="Text formatting"
        className="flex items-center gap-0.5 border-b border-input px-1.5 py-1"
      >
        {tools.map((tool) => (
          <button
            key={tool.label}
            type="button"
            title={`${tool.label} (${tool.shortcut})`}
            aria-label={tool.label}
            aria-pressed={tool.active}
            disabled={disabled || !editor}
            onMouseDown={(e) => e.preventDefault()}
            onClick={tool.run}
            className={cn(
              "inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-muted-foreground transition-colors",
              "hover:bg-muted hover:text-foreground",
              "disabled:pointer-events-none disabled:opacity-50",
              tool.active && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
            )}
          >
            <tool.icon className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        ))}
        {maxLength != null ? (
          <span
            className={cn(
              "ml-auto pr-1.5 text-[10px] tabular-nums text-muted-foreground",
              overLimit && "font-semibold text-destructive",
            )}
          >
            {normalizedValue.length}/{maxLength}
          </span>
        ) : null}
      </div>
      <EditorContent
        editor={editor}
        className={cn(
          "px-3 py-2 [&_.ProseMirror]:min-h-[96px]",
          "[&_p]:my-1.5 [&_p]:text-sm [&_p]:leading-relaxed [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
          "[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul:first-child]:mt-0 [&_ul:last-child]:mb-0",
          "[&_li]:text-sm [&_li]:leading-relaxed",
        )}
      />
    </div>
  );
}
