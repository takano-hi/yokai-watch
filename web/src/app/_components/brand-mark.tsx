export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <header className={`page-heading${compact ? " page-heading-compact" : ""}`}>
      <svg className="title-flame title-flame-left" aria-hidden="true" viewBox="0 0 100 160">
        <path d="M50 5c4 28 38 39 38 72 0 24-17 43-39 43S10 103 10 80c0-16 9-28 25-38-2 15 4 24 14 30C64 55 56 32 50 5Z" />
        <path className="title-flame-cutout" d="M48 87c-10 4-15 11-15 20 0 9 7 15 16 15s17-7 17-16c0-7-5-12-12-16 2 8 0 13-5 16-5-5-4-12-1-19Z" />
      </svg>
      <h1 id="page-title"><span>なかま妖怪</span><span>大図鑑</span></h1>
      <svg className="title-flame title-flame-right" aria-hidden="true" viewBox="0 0 100 160">
        <path d="M50 5c4 28 38 39 38 72 0 24-17 43-39 43S10 103 10 80c0-16 9-28 25-38-2 15 4 24 14 30C64 55 56 32 50 5Z" />
        <path className="title-flame-cutout" d="M48 87c-10 4-15 11-15 20 0 9 7 15 16 15s17-7 17-16c0-7-5-12-12-16 2 8 0 13-5 16-5-5-4-12-1-19Z" />
      </svg>
    </header>
  );
}
