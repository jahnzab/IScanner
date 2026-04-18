const DEFAULT_CORNERS = [
  { x: 0.06, y: 0.04 },
  { x: 0.94, y: 0.04 },
  { x: 0.94, y: 0.96 },
  { x: 0.06, y: 0.96 }
];

export function CropTool({ preview, corners, onChange, onInitialize }) {
  const orderedCorners = corners?.length === 4 ? corners : [];

  const updateRectangle = (index, x, y) => {
    if (orderedCorners.length !== 4) {
      return;
    }

    const [topLeft, topRight, bottomRight, bottomLeft] = orderedCorners;

    if (index === 0) {
      onChange([
        { x, y },
        { x: topRight.x, y },
        bottomRight,
        { x, y: bottomLeft.y }
      ]);
      return;
    }

    if (index === 1) {
      onChange([
        { x: topLeft.x, y },
        { x, y },
        { x, y: bottomRight.y },
        bottomLeft
      ]);
      return;
    }

    if (index === 2) {
      onChange([
        topLeft,
        { x, y: topRight.y },
        { x, y },
        { x: bottomLeft.x, y }
      ]);
      return;
    }

    onChange([
      { x, y: topLeft.y },
      topRight,
      { x: bottomRight.x, y },
      { x, y }
    ]);
  };

  const handlePointerDown = (index) => (event) => {
    event.preventDefault();

    const root = event.currentTarget.ownerSVGElement;
    const box = root.getBoundingClientRect();

    const move = (moveEvent) => {
      const x = Math.min(0.98, Math.max(0.02, (moveEvent.clientX - box.left) / box.width));
      const y = Math.min(0.98, Math.max(0.02, (moveEvent.clientY - box.top) / box.height));
      updateRectangle(index, x, y);
    };

    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  if (!preview) {
    return null;
  }

  if (!orderedCorners.length) {
    return (
      <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-3">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-white">Crop tool</div>
            <div className="text-xs text-slate-300">The upload stays original until you choose to crop it.</div>
          </div>
        </div>
        <div className="overflow-hidden rounded-[1.25rem] border border-dashed border-white/10 bg-black/30">
          <img src={preview} alt="Document preview" className="w-full object-contain" />
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onInitialize}
            className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white"
          >
            Start manual crop
          </button>
          <button
            type="button"
            onClick={() => onChange(DEFAULT_CORNERS)}
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white"
          >
            Use default page box
          </button>
        </div>
      </div>
    );
  }

  const polygonPoints = orderedCorners
    .map((point) => `${point.x * 100},${point.y * 100}`)
    .join(" ");

  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-3">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-white">Manual crop tool</div>
          <div className="text-xs text-slate-300">Drag the handles to tighten the document boundary.</div>
        </div>
      </div>
      <div className="relative overflow-hidden rounded-[1.25rem]">
        <img src={preview} alt="Document preview" className="w-full rounded-[1.25rem]" />
        <svg className="absolute inset-0 h-full w-full touch-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon
            points={polygonPoints}
            fill="rgba(249,115,22,0.15)"
            stroke="rgba(249,115,22,0.9)"
            strokeWidth="0.9"
          />
          {orderedCorners.map((corner, index) => (
            <circle
              key={index}
              cx={corner.x * 100}
              cy={corner.y * 100}
              r="2.2"
              fill="#22c55e"
              stroke="white"
              strokeWidth="0.6"
              onPointerDown={handlePointerDown(index)}
              className="cursor-grab"
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
