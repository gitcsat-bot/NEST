interface LocationBreadcrumbProps {
  breadcrumb?: string[];
  className?: string;
  onItemClick?: (index: number, name: string) => void;
}

export function LocationBreadcrumb({
  breadcrumb = [],
  className = '',
  onItemClick,
}: LocationBreadcrumbProps) {
  if (!breadcrumb || breadcrumb.length === 0) {
    return <span className={`text-gray-400 text-sm ${className}`}>No location set</span>;
  }

  return (
    <nav aria-label="Location hierarchy" className={`flex flex-wrap items-center gap-1 text-sm ${className}`}>
      {breadcrumb.map((item, idx) => {
        const isLast = idx === breadcrumb.length - 1;
        return (
          <span key={`${item}-${idx}`} className="flex items-center gap-1">
            {idx > 0 && <span className="text-gray-400 select-none">/</span>}
            {isLast ? (
              <span className="font-medium text-gray-900" aria-current="location">
                {item}
              </span>
            ) : onItemClick ? (
              <button
                type="button"
                onClick={() => onItemClick(idx, item)}
                className="text-blue-600 hover:underline focus:outline-none"
              >
                {item}
              </button>
            ) : (
              <span className="text-gray-600">{item}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
