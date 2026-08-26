import { useState, useMemo, useRef, useEffect } from 'react';
import { LocationDto } from '@nest/shared-types';

interface LocationTypeaheadProps {
  locations: LocationDto[];
  value: string | null;
  onChange: (locationId: string | null) => void;
  excludeId?: string; // Exclude current node when reparenting to prevent immediate self-parenting
  placeholder?: string;
  disabled?: boolean;
}

export function LocationTypeahead({
  locations,
  value,
  onChange,
  excludeId,
  placeholder = 'Select a parent location...',
  disabled = false,
}: LocationTypeaheadProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const availableLocations = useMemo(() => {
    return locations.filter((loc) => loc.id !== excludeId);
  }, [locations, excludeId]);

  const selectedLocation = useMemo(() => {
    return availableLocations.find((loc) => loc.id === value) ?? null;
  }, [availableLocations, value]);

  const filteredLocations = useMemo(() => {
    if (!query.trim()) return availableLocations;
    const q = query.toLowerCase();
    return availableLocations.filter(
      (loc) =>
        loc.name.toLowerCase().includes(q) ||
        loc.type.toLowerCase().includes(q) ||
        (loc.breadcrumb && loc.breadcrumb.join(' / ').toLowerCase().includes(q)),
    );
  }, [availableLocations, query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          disabled={disabled}
          placeholder={selectedLocation ? selectedLocation.name : placeholder}
          value={isOpen ? query : selectedLocation ? selectedLocation.name : ''}
          onFocus={() => {
            if (!disabled) {
              setIsOpen(true);
              setQuery('');
            }
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          className="w-full neu-inset px-4 py-3 text-sm outline-none font-medium text-gray-700 disabled:opacity-60"
          style={{ borderRadius: 'var(--nest-radius)' }}
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
              setQuery('');
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold px-1"
          >
            Clear
          </button>
        )}
      </div>

      {isOpen && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto neu-flat py-1 shadow-lg text-sm rounded-xl">
          <li
            onClick={() => {
              onChange(null);
              setIsOpen(false);
            }}
            className={`cursor-pointer px-4 py-2 hover:text-blue-600 transition-colors ${
              value === null ? 'neu-inset text-blue-600 font-bold' : 'text-gray-500'
            }`}
          >
            <em>None (Top Level)</em>
          </li>
          {filteredLocations.length === 0 ? (
            <li className="px-4 py-2 text-gray-400">No locations found</li>
          ) : (
            filteredLocations.map((loc) => {
              const isSelected = loc.id === value;
              return (
                <li
                  key={loc.id}
                  onClick={() => {
                    onChange(loc.id);
                    setIsOpen(false);
                  }}
                  className={`cursor-pointer px-4 py-2 transition-colors hover:text-blue-600 ${
                    isSelected ? 'neu-inset text-blue-600 font-bold' : 'text-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{loc.name}</span>
                    <span className="text-xs rounded-md neu-inset px-2 py-1 text-gray-500 font-mono font-medium">
                      {loc.type}
                    </span>
                  </div>
                  {loc.breadcrumb && loc.breadcrumb.length > 1 && (
                    <div className="text-xs text-gray-400 truncate">
                      {loc.breadcrumb.slice(0, -1).join(' / ')}
                    </div>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
