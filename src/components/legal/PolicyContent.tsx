import ReactMarkdown from "react-markdown";
import { cleanPolicyContent } from "@/lib/policyUtils";

export function PolicyContent({ content }: { content: string }) {
  return (
    <div className="policy-content space-y-6 text-foreground/90 leading-relaxed">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mt-8 mb-4 text-foreground">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold mt-6 mb-3 text-foreground">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mt-4 mb-2 text-foreground">{children}</h3>
          ),
          p: ({ children }) => <p className="mb-4 text-base leading-7">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-2 mb-4 ml-4">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-2 mb-4 ml-4">{children}</ol>
          ),
          li: ({ children }) => <li className="text-base leading-7 ml-2">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => <em className="italic text-foreground/80">{children}</em>,
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-gold hover:underline font-medium"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gold pl-4 italic text-muted-foreground my-4">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="bg-secondary px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
          ),
        }}
      >
        {cleanPolicyContent(content)}
      </ReactMarkdown>
    </div>
  );
}
