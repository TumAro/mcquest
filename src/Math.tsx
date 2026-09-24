import { useEffect, useRef } from 'react'
import 'katex/dist/katex.min.css'
import renderMathInElement from 'katex/contrib/auto-render'

export interface MathProps {
  text: string
}

export default function Math({ text }: MathProps) {
  const elRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (elRef.current) {
      elRef.current.textContent = text
      renderMathInElement(elRef.current, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false,
        trust: false,
      })
    }
  }, [text])

  return <div ref={elRef} />
}
