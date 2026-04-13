import { useState } from "react";

export function TextTool({ onAdd }) {
  const [value, setValue] = useState("");

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-semibold text-white">Text tool</div>
      <div className="mt-3 space-y-3">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Add a note, date, or label"
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400"
        />
        <button
          type="button"
          onClick={() => {
            if (!value.trim()) {
              return;
            }

            onAdd(value.trim());
            setValue("");
          }}
          className="w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white"
        >
          Place Text
        </button>
      </div>
    </div>
  );
}
