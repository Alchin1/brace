/** Numbered section head with a hairline that draws across on reveal. */
export function SectionHead({
  index,
  kicker,
  title,
  id,
  aside,
}: {
  index: string;
  kicker: string;
  title: React.ReactNode;
  id: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="shead" data-reveal>
      <div className="shead-rule" aria-hidden>
        <span className="shead-i">{index}</span>
        <span className="shead-k">{kicker}</span>
        <span className="shead-line" />
      </div>
      <div className="shead-row">
        <h2 id={id}>{title}</h2>
        {aside && <div className="shead-aside">{aside}</div>}
      </div>
    </div>
  );
}
