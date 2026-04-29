import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MessageContentProps {
  text: string;
  asMarkdown: boolean;
  baseStyle: React.CSSProperties;
}

const markdownComponents = {
  p: ({children}: any) => <p style={{margin: '0 0 8px 0'}}>{children}</p>,
  h1: ({children}: any) => <h3 style={{margin: '8px 0 6px 0', fontSize: 16, fontWeight: 700}}>{children}</h3>,
  h2: ({children}: any) => <h4 style={{margin: '8px 0 6px 0', fontSize: 15, fontWeight: 700}}>{children}</h4>,
  h3: ({children}: any) => <h5 style={{margin: '6px 0 4px 0', fontSize: 14, fontWeight: 700}}>{children}</h5>,
  h4: ({children}: any) => <h6 style={{margin: '6px 0 4px 0', fontSize: 14, fontWeight: 600}}>{children}</h6>,
  ul: ({children}: any) => <ul style={{margin: '4px 0 8px 0', paddingLeft: 20}}>{children}</ul>,
  ol: ({children}: any) => <ol style={{margin: '4px 0 8px 0', paddingLeft: 20}}>{children}</ol>,
  li: ({children}: any) => <li style={{marginBottom: 2}}>{children}</li>,
  a: ({children, href}: any) => (
    <a href={href} target="_blank" rel="noreferrer" style={{color: '#7dd3fc', textDecoration: 'underline'}}>
      {children}
    </a>
  ),
  strong: ({children}: any) => <strong style={{fontWeight: 700, color: '#fff'}}>{children}</strong>,
  em: ({children}: any) => <em style={{fontStyle: 'italic'}}>{children}</em>,
  code: ({inline, children}: any) =>
    inline ? (
      <code
        style={{
          background: 'rgba(255,255,255,0.08)',
          padding: '1px 5px',
          borderRadius: 4,
          fontFamily: '"SF Mono", Menlo, Consolas, monospace',
          fontSize: '0.9em',
        }}
      >
        {children}
      </code>
    ) : (
      <code style={{fontFamily: '"SF Mono", Menlo, Consolas, monospace', fontSize: '0.9em'}}>
        {children}
      </code>
    ),
  pre: ({children}: any) => (
    <pre
      style={{
        background: 'rgba(0,0,0,0.35)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        padding: '8px 10px',
        margin: '6px 0',
        overflowX: 'auto',
        fontSize: 12.5,
        lineHeight: 1.45,
      }}
    >
      {children}
    </pre>
  ),
  blockquote: ({children}: any) => (
    <blockquote
      style={{
        borderLeft: '3px solid rgba(255,255,255,0.2)',
        margin: '6px 0',
        padding: '2px 10px',
        color: '#c8c8d0',
      }}
    >
      {children}
    </blockquote>
  ),
  hr: () => <hr style={{border: 0, borderTop: '1px solid rgba(255,255,255,0.1)', margin: '8px 0'}} />,
  table: ({children}: any) => (
    <div style={{overflowX: 'auto', margin: '6px 0'}}>
      <table style={{borderCollapse: 'collapse', fontSize: 13}}>{children}</table>
    </div>
  ),
  th: ({children}: any) => (
    <th style={{border: '1px solid rgba(255,255,255,0.12)', padding: '4px 8px', textAlign: 'left', background: 'rgba(255,255,255,0.04)'}}>
      {children}
    </th>
  ),
  td: ({children}: any) => (
    <td style={{border: '1px solid rgba(255,255,255,0.12)', padding: '4px 8px'}}>{children}</td>
  ),
};

const MARKDOWN_PATTERN =
  /(^|\n)\s*(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```)|(\*\*[^*\n]+\*\*)|(`[^`\n]+`)|(\[[^\]\n]+\]\([^)\n]+\))|(\|.+\|)/;

export const looksLikeMarkdown = (text: string): boolean => MARKDOWN_PATTERN.test(text);

export const MessageContent: React.FC<MessageContentProps> = ({text, asMarkdown, baseStyle}) => {
  if (!asMarkdown || !looksLikeMarkdown(text)) {
    return <p style={{...baseStyle, whiteSpace: 'pre-wrap'}}>{text}</p>;
  }
  return (
    <div style={baseStyle}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {text}
      </ReactMarkdown>
    </div>
  );
};
