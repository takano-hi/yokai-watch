export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <header className={`page-heading${compact ? " page-heading-compact" : ""}`}>
      <h1 id="page-title" className="brand-logo-heading">
        <img className="brand-logo" src="/youkai-title-logo.png" alt="なかま妖怪 大図鑑" />
      </h1>
    </header>
  );
}
