import { BlockNoteEditor, Block } from "@blocknote/core";
import { BlockNoteViewRaw, useCreateBlockNote } from "@blocknote/react";
import "@blocknote/core/style.css";
import { parseHTMLToBlocks } from "../utils/blocknote-converters";

interface BlockNoteEditorProps {
  initialContent?: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export const BlockNoteEditorComponent = ({
  initialContent,
  onChange,
  placeholder
}: BlockNoteEditorProps) => {
  const editor = useCreateBlockNote({
    onEditorContentChange: (editor) => {
      // Convert blocks to HTML and call onChange
      const blocks = editor.topLevelBlocks;
      const html = blocks.map(block => blockToHTML(block)).join('\n');
      onChange(html);
    },
    initialContent: initialContent
      ? parseHTMLToBlocks(initialContent)
      : undefined,
  });

  return (
    <BlockNoteViewRaw
      editor={editor}
      theme="dark"
    />
  );
};

// Helper function to convert a single block to HTML
function blockToHTML(block: Block): string {
  const { type, content, props } = block;

  switch (type) {
    case "paragraph":
      const paragraphContent = content?.map(inlineToHTML).join('') || '';
      return `<p>${paragraphContent}</p>`;

    case "heading":
      const level = props?.level || 2;
      const headingContent = content?.map(inlineToHTML).join('') || '';
      return `<h${level}>${headingContent}</h${level}>`;

    case "bulletListItem":
      const bulletContent = content?.map(inlineToHTML).join('') || '';
      return `<li>${bulletContent}</li>`;

    case "numberedListItem":
      const numberedContent = content?.map(inlineToHTML).join('') || '';
      return `<li>${numberedContent}</li>`;

    case "codeBlock":
      const codeContent = content?.map(inlineToHTML).join('') || '';
      return `<pre><code>${codeContent}</code></pre>`;

    default:
      return '';
  }
}

// Helper function to convert inline content to HTML
function inlineToHTML(inline: any): string {
  if (typeof inline === 'string') {
    return inline;
  }

  if (inline.type === 'text') {
    let text = inline.text || '';
    const styles = inline.styles || {};

    if (styles.bold) {
      text = `<strong>${text}</strong>`;
    }
    if (styles.italic) {
      text = `<em>${text}</em>`;
    }
    if (styles.underline) {
      text = `<u>${text}</u>`;
    }
    if (styles.strikethrough) {
      text = `<s>${text}</s>`;
    }

    return text;
  }

  if (inline.type === 'link') {
    const href = inline.href || '#';
    const linkText = inline.content?.[0]?.text || '';
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-[#FF5252] underline">${linkText}</a>`;
  }

  return '';
}
