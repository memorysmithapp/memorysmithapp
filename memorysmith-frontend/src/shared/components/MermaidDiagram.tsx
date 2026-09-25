import { useEffect, useId, useState } from 'react';
import { usePreferences, resolveTheme } from '../store/preferences';

interface MermaidDiagramProps {
  code: string;
}

// Renders a mermaid code block as an SVG diagram. The library is heavy, so it
// is imported lazily; on any render error the raw code block is shown instead.
export function MermaidDiagram({ code }: MermaidDiagramProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const theme = usePreferences((s) => s.theme);
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let renderId: string | null = null;
    setSvg(null);
    setFailed(false);
    void (async () => {
      try {
        const { default: mermaid } = await import('mermaid');
        // Text metrics depend on the webfont; rendering before it loads
        // truncates node labels.
        await document.fonts.ready;
        mermaid.initialize({
          startOnLoad: false,
          theme: resolveTheme(theme) === 'dark' ? 'dark' : 'neutral',
          fontFamily: 'Inter, sans-serif',
          // SVG text labels measure reliably; HTML labels clip inside nodes
          // when the webfont metrics differ from the fallback.
          htmlLabels: false,
          flowchart: { htmlLabels: false },
        });
        /**
         * A diagram Mermaid cannot read is shown as its code without drawing
         * it (#234). Drawing it anyway failed in the right place, the code,
         * and left the scratch container Mermaid draws into — its error
         * bomb included — at the end of <body>, under the whole application.
         */
        if ((await mermaid.parse(code, { suppressErrors: true })) === false) {
          if (alive) setFailed(true);
          return;
        }
        renderId = `mmd-${id}-${Date.now()}`;
        const rendered = await mermaid.render(renderId, code);
        if (alive) setSvg(rendered.svg);
      } catch {
        // And should drawing still fail, what it left behind goes with it.
        if (renderId) document.getElementById(`d${renderId}`)?.remove();
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [code, id, theme]);

  if (failed) {
    return (
      <pre>
        <code>{code}</code>
      </pre>
    );
  }
  if (!svg) return <div className="mermaid-diagram mermaid-loading" />;
  return <div className="mermaid-diagram" dangerouslySetInnerHTML={{ __html: svg }} />;
}
