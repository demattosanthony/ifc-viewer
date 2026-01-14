import { marked } from "marked"
import { memo, useId, useMemo } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import { cn } from "../lib/utils"
import { CodeBlock, CodeBlockCode } from "./code-block"

export type MarkdownProps = {
  children: string
  id?: string
  className?: string
  components?: Partial<Components>
}

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown)
  return tokens.map((token) => token.raw)
}

function extractLanguage(className?: string): string {
  if (!className) return "plaintext"
  const match = className.match(/language-(\w+)/)
  return match?.[1] ?? "plaintext"
}

const INITIAL_COMPONENTS: Partial<Components> = {
  h1: ({ children }) => (
    <h1 className="scroll-m-20 text-2xl font-extrabold tracking-tight lg:text-4xl">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="scroll-m-20 border-b pb-2 text-xl font-semibold tracking-tight">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="scroll-m-20 text-lg font-semibold tracking-tight">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="scroll-m-20 text-base font-semibold tracking-tight">{children}</h4>
  ),
  p: ({ children }) => <p className="leading-7 text-sm">{children}</p>,
  blockquote: ({ children, ...props }) => (
    <blockquote className="border-l-2 pl-6 italic text-sm" {...props}>
      {children}
    </blockquote>
  ),
  table: ({ children, ...props }) => (
    <div className="w-full overflow-x-auto" {...props}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="m-0 border-t p-0 even:bg-muted text-sm">{children}</tr>,
  th: ({ children }) => (
    <th className="border px-4 py-2 text-left font-bold text-sm">{children}</th>
  ),
  td: ({ children }) => <td className="border px-4 py-2 text-left text-sm">{children}</td>,
  ul: ({ children, ...props }) => (
    <ul className="ml-6 list-disc space-y-0.5 text-sm marker:text-foreground" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol
      className="ml-6 list-decimal space-y-0.5 text-sm marker:text-foreground"
      style={{ counterReset: "list-item" }}
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="text-sm">{children}</li>,
  code: function CodeComponent({ className, children, ...props }) {
    const isInline =
      !props.node?.position?.start.line ||
      props.node?.position?.start.line === props.node?.position?.end.line

    if (isInline) {
      return (
        <span
          className={cn("bg-secondary rounded-sm px-1 font-mono text-xs", className)}
          {...props}
        >
          {children}
        </span>
      )
    }

    const language = extractLanguage(className)

    return (
      <CodeBlock className={className}>
        <CodeBlockCode code={children as string} language={language} />
      </CodeBlock>
    )
  },
  pre: function PreComponent({ children }) {
    return <>{children}</>
  },
  em: ({ children }) => <em>{children}</em>,
  strong: ({ children }) => <strong>{children}</strong>,
  a: ({ children, ...props }) => (
    <a
      className="text-blue-500 hover:underline"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  img: ({ ...props }) => <img className="max-w-full h-auto" {...props} />,
  hr: ({ ...props }) => <hr {...props} />,
}

const MemoizedMarkdownBlock = memo(
  function MarkdownBlock({
    content,
    components = INITIAL_COMPONENTS,
  }: {
    content: string
    components?: Partial<Components>
  }) {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
        {content}
      </ReactMarkdown>
    )
  },
  function propsAreEqual(prevProps, nextProps) {
    return prevProps.content === nextProps.content
  }
)

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock"

function MarkdownComponent({
  children,
  id,
  className,
  components = INITIAL_COMPONENTS,
}: MarkdownProps) {
  const generatedId = useId()
  const blockId = id ?? generatedId
  const blocks = useMemo(() => parseMarkdownIntoBlocks(children), [children])

  return (
    <div className={cn("space-y-2.5", className)}>
      {blocks.map((block, index) => (
        <MemoizedMarkdownBlock
          key={`${blockId}-${index}-${block.slice(0, 20)}`}
          content={block}
          components={components}
        />
      ))}
    </div>
  )
}

const Markdown = memo(MarkdownComponent)
Markdown.displayName = "Markdown"

export { Markdown }
