import { useEffect, useState } from 'react'

/**
 * Renders one of the system's HTML fields. Foundry's enricher resolves
 * document links and inline rolls, and sanitises the markup — which is why the
 * result is safe to inject rather than being escaped and shown as source.
 */
export default function RichText({ content, placeholder = '' }) {
  const [html, setHtml] = useState('')

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      if (!content) {
        if (!cancelled) setHtml('')
        return
      }
      const enriched = await foundry.applications.ux.TextEditor.implementation.enrichHTML(content)
      if (!cancelled) setHtml(enriched)
    }

    run()
    return () => {
      cancelled = true
    }
  }, [content])

  if (!content) {
    return placeholder ? <p className="bo-value is-empty">{placeholder}</p> : null
  }

  return <div className="bo-prose bo-rich" dangerouslySetInnerHTML={{ __html: html }} />
}
