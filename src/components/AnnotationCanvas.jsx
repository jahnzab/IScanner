import { useEffect, useRef, useState } from "react";

export function AnnotationCanvas({ preview, filterStyle, annotations, setAnnotations }) {
  const rootRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const handleMove = (event) => {
      if (!rootRef.current) {
        return;
      }

      const rect = rootRef.current.getBoundingClientRect();

      if (dragging) {
        const x = Math.min(0.92, Math.max(0.02, (event.clientX - rect.left) / rect.width));
        const y = Math.min(0.92, Math.max(0.02, (event.clientY - rect.top) / rect.height));

        setAnnotations((current) =>
          current.map((item) => (item.id === dragging ? { ...item, x, y } : item))
        );
      }

      if (resizing) {
        const pointerX = Math.max(0.02, (event.clientX - rect.left) / rect.width);
        const pointerY = Math.max(0.02, (event.clientY - rect.top) / rect.height);

        setAnnotations((current) =>
          current.map((item) => {
            if (item.id !== resizing) {
              return item;
            }

            if (item.type === "text") {
              const sizeFromX = (pointerX - item.x) * rect.width * 0.35;
              const sizeFromY = (pointerY - item.y) * rect.height * 0.5;
              const nextFontSize = Math.max(12, Math.min(120, Math.max(sizeFromX, sizeFromY)));
              return {
                ...item,
                fontSize: nextFontSize
              };
            }

            return {
              ...item,
              width: Math.max(0.1, Math.min(0.75, (pointerX - item.x) * 2)),
              height: Math.max(0.05, Math.min(0.45, (pointerY - item.y) * 2))
            };
          })
        );
      }
    };

    const handleUp = () => {
      setDragging(null);
      setResizing(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [dragging, resizing, setAnnotations]);

  useEffect(() => {
    if (!annotations.some((item) => item.id === selected)) {
      setSelected(annotations[annotations.length - 1]?.id || null);
    }
  }, [annotations, selected]);

  if (!preview) {
    return null;
  }

  const selectedItem = annotations.find((item) => item.id === selected) || null;

  const resizeSelectedByStep = (delta) => {
    if (!selectedItem) {
      return;
    }

    setAnnotations((current) =>
      current.map((item) => {
        if (item.id !== selectedItem.id) {
          return item;
        }

        if (item.type === "text") {
          return {
            ...item,
            fontSize: Math.max(12, Math.min(120, (item.fontSize || 28) + delta))
          };
        }

        return {
          ...item,
          width: Math.max(0.1, Math.min(0.75, (item.width || 0.25) + delta / 200)),
          height: Math.max(0.05, Math.min(0.45, (item.height || 0.1) + delta / 400))
        };
      })
    );
  };

  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white">Editing and Adding In Image</div>
        {selectedItem ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => resizeSelectedByStep(-12)}
              className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white"
            >
              --
            </button>
            <button
              type="button"
              onClick={() => resizeSelectedByStep(-6)}
              className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white"
            >
              -
            </button>
            <button
              type="button"
              onClick={() => resizeSelectedByStep(6)}
              className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => resizeSelectedByStep(12)}
              className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white"
            >
              ++
            </button>
            <button
              type="button"
              onClick={() => setAnnotations((current) => current.filter((item) => item.id !== selectedItem.id))}
              className="rounded-full border border-rose-300/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-100"
            >
              Remove
            </button>
            <div className="text-xs text-slate-300">Drag to move. Use --, -, +, ++ or drag the orange handle to resize.</div>
          </div>
        ) : (
          <div className="text-xs text-slate-400">Select text or signature to move, resize, or remove</div>
        )}
      </div>
      <div ref={rootRef} className="relative overflow-hidden rounded-[1.25rem]">
        <img src={preview} alt="Editable preview" className="w-full" style={{ filter: filterStyle }} />
        {annotations.map((item) => (
          <div
            key={item.id}
            onPointerDown={() => {
              setSelected(item.id);
              setDragging(item.id);
            }}
            className={`absolute cursor-move select-none rounded-lg ${
              selected === item.id ? "ring-2 ring-accent/80" : ""
            }`}
            style={{
              left: `${item.x * 100}%`,
              top: `${item.y * 100}%`,
              transform: "translate(-50%, -50%)"
            }}
          >
            {item.type === "text" ? (
              <div
                className="rounded-lg bg-black/35 px-2 py-1 text-white"
                style={{ fontSize: item.fontSize, fontFamily: item.fontFamily }}
              >
                {item.value}
              </div>
            ) : (
              <img
                src={item.image}
                alt="Signature"
                className="max-w-[180px] rounded-md bg-black/20 p-1"
                style={{ width: `${(item.width || 0.25) * 100}%` }}
              />
            )}
            {selected === item.id ? (
              <button
                type="button"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setResizing(item.id);
                }}
                className="absolute -bottom-2 -right-2 h-5 w-5 rounded-full border border-white bg-accent shadow-glow"
                aria-label="Resize annotation"
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
