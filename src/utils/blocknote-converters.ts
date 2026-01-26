import { Block } from "@blocknote/core";

/**
 * Convert existing TipTap/HTML content to BlockNote blocks
 * This handles the most common HTML tags from TipTap output
 */
export function parseHTMLToBlocks(html: string): Block[] {
  if (!html) return [];

  // Simple HTML parser for common tags
  const blocks: Block[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Process each child node of the body
  const processNode = (node: Node): Block | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        return {
          type: "paragraph",
          content: [{ type: "text", text, styles: {} }]
        } as Block;
      }
      return null;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();

      switch (tagName) {
        case 'p':
          return {
            type: "paragraph",
            content: parseInlineContent(element)
          } as Block;

        case 'h2':
          return {
            type: "heading",
            props: { level: 2 },
            content: parseInlineContent(element)
          } as Block;

        case 'h3':
          return {
            type: "heading",
            props: { level: 3 },
            content: parseInlineContent(element)
          } as Block;

        case 'h4':
          return {
            type: "heading",
            props: { level: 4 },
            content: parseInlineContent(element)
          } as Block;

        case 'ul':
          return Array.from(element.children).map(li => ({
            type: "bulletListItem",
            content: parseInlineContent(li)
          })) as any;

        case 'ol':
          return Array.from(element.children).map(li => ({
            type: "numberedListItem",
            content: parseInlineContent(li)
          })) as any;

        case 'pre':
          const codeElement = element.querySelector('code');
          return {
            type: "codeBlock",
            content: [{
              type: "text",
              text: codeElement?.textContent || element.textContent || '',
              styles: {}
            }]
          } as Block;

        case 'blockquote':
          return {
            type: "paragraph",
            content: parseInlineContent(element)
          } as Block;

        default:
          // For unknown tags, try to extract text content
          const text = element.textContent?.trim();
          if (text) {
            return {
              type: "paragraph",
              content: [{ type: "text", text, styles: {} }]
            } as Block;
          }
          return null;
      }
    }

    return null;
  };

  // Process all child nodes
  Array.from(doc.body.childNodes).forEach(node => {
    const block = processNode(node);
    if (block) {
      if (Array.isArray(block)) {
        blocks.push(...block);
      } else {
        blocks.push(block);
      }
    }
  });

  return blocks.length > 0 ? blocks : [
    {
      type: "paragraph",
      content: [{ type: "text", text: "", styles: {} }]
    } as Block
  ];
}

/**
 * Parse inline content (bold, italic, links, etc.) from HTML element
 */
function parseInlineContent(element: Element): any[] {
  const content: any[] = [];

  const processInlineNode = (node: Node, styles: any = {}) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text) {
        content.push({
          type: "text",
          text,
          styles
        });
      }
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tagName = el.tagName.toLowerCase();
      const newStyles = { ...styles };

      switch (tagName) {
        case 'strong':
        case 'b':
          newStyles.bold = true;
          break;
        case 'em':
        case 'i':
          newStyles.italic = true;
          break;
        case 'u':
          newStyles.underline = true;
          break;
        case 's':
        case 'strike':
          newStyles.strikethrough = true;
          break;
        case 'a':
          const href = el.getAttribute('href');
          if (href) {
            content.push({
              type: "link",
              href,
              content: [{ type: "text", text: el.textContent || '', styles: {} }]
            });
          }
          return;
        case 'code':
          newStyles.code = true;
          break;
        case 'mark':
          newStyles.backgroundColor = 'yellow';
          break;
      }

      // Process child nodes with updated styles
      Array.from(el.childNodes).forEach(child => {
        processInlineNode(child, newStyles);
      });
    }
  };

  Array.from(element.childNodes).forEach(child => {
    processInlineNode(child);
  });

  return content.length > 0 ? content : [{ type: "text", text: "", styles: {} }];
}

/**
 * Convert BlockNote blocks to clean HTML
 */
export function blocksToHTML(blocks: Block[]): string {
  return blocks.map(block => {
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
  }).join('\n');
}

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
    if (styles.code) {
      text = `<code>${text}</code>`;
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
