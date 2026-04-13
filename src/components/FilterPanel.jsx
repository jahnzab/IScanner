import { FILTERS } from "../lib/image";

export function FilterPanel({ activeFilter, onChange }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-semibold text-white">Filters</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => onChange(filter)}
            className={`rounded-2xl px-4 py-3 text-sm transition ${
              activeFilter.id === filter.id
                ? "bg-accent text-white"
                : "bg-black/20 text-slate-200 hover:bg-white/10"
            }`}
          >
            {filter.name}
          </button>
        ))}
      </div>
    </div>
  );
}
