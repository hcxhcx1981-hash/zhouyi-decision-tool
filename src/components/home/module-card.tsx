interface ModuleCardProps {
  title: string;
  description: string;
  status: string;
  action: string;
  href: string;
  tone: "available" | "warning";
}

export function ModuleCard({
  title,
  description,
  status,
  action,
  href,
  tone,
}: ModuleCardProps) {
  return (
    <article className="module-card panel">
      <div className="module-card-heading">
        <h2>{title}</h2>
        <span className={`module-status ${tone}`}>{status}</span>
      </div>
      <p>{description}</p>
      <a className="module-link" href={href}>{action}<span aria-hidden="true">→</span></a>
    </article>
  );
}
