'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Check, Copy } from 'lucide-react';

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [html, setHtml] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import('shiki')
      .then(({ codeToHtml }) => codeToHtml(code, { lang: lang || 'text', theme: 'vitesse-black' }))
      .catch(async () => {
        const { codeToHtml } = await import('shiki');
        return codeToHtml(code, { lang: 'text', theme: 'vitesse-black' });
      })
      .then((h) => {
        if (!cancelled) setHtml(h);
      });
    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-line bg-[#101010]">
      <div className="flex items-center justify-between border-b border-line px-3.5 py-2 text-xs text-muted">
        <span className="font-mono">{lang || 'text'}</span>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="flex items-center gap-1 transition hover:text-white"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {html ? (
        <div
          className="overflow-x-auto p-3.5 font-mono text-[13px] [&_pre]:!bg-transparent"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="overflow-x-auto p-3.5 font-mono text-[13px] text-[#d4d4d4]">{code}</pre>
      )}
    </div>
  );
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="max-w-none space-y-3 break-words leading-relaxed text-[#ececec] [overflow-wrap:anywhere] [&_a]:text-[#60a5fa] [&_a]:underline [&_a]:decoration-[#60a5fa]/50 [&_a]:underline-offset-2 hover:[&_a]:text-[#93c5fd] hover:[&_a]:decoration-[#93c5fd] [&_blockquote]:border-l-2 [&_blockquote]:border-white/20 [&_blockquote]:pl-3.5 [&_blockquote]:text-muted [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_strong]:font-semibold [&_strong]:text-white [&_table]:w-full [&_table]:text-sm [&_td]:border [&_td]:border-line [&_td]:px-2.5 [&_td]:py-1.5 [&_th]:border [&_th]:border-line [&_th]:bg-surface [&_th]:px-2.5 [&_th]:py-1.5 [&_ul]:list-disc">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto">
              <table>{children}</table>
            </div>
          ),
          pre: ({ children }) => <>{children}</>,
          code({ className, children }) {
            const text = String(children ?? '');
            const match = /language-(\w+)/.exec(className ?? '');
            if (match || text.includes('\n')) {
              return <CodeBlock code={text.replace(/\n$/, '')} lang={match?.[1] ?? ''} />;
            }
            return <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[0.88em] text-white">{children}</code>;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
