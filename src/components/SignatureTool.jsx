import { useEffect, useRef, useState } from "react";

const SIGNATURE_COLORS = [
  { label: "Black", value: "#111111" },
  { label: "Blue", value: "#1d4ed8" },
  { label: "Green", value: "#166534" }
];

function drawSignature(ctx, strokes, color = "#111111") {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  strokes.forEach((points) => {
    if (points.length < 2) {
      return;
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.stroke();
  });
}

function createSignatureCanvasData(strokes, width, height, color) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "transparent";
  drawSignature(ctx, strokes, color);

  return canvas.toDataURL("image/png");
}

export function SignatureTool({ onAdd }) {
  const canvasRef = useRef(null);
  const [typing, setTyping] = useState("");
  const [color, setColor] = useState("#111111");
  const [strokes, setStrokes] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const activeStrokeRef = useRef([]);
  const strokesRef = useRef([]);

  useEffect(() => {
    strokesRef.current = strokes;
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    drawSignature(ctx, strokes, color);
  }, [strokes, color]);

  const getPoint = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  };

  const startDraw = (event) => {
    event.preventDefault();
    canvasRef.current?.setPointerCapture?.(event.pointerId);
    setIsDrawing(true);
    activeStrokeRef.current = [getPoint(event)];
  };

  const redrawCanvas = (draftStroke = null) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    const nextStrokes = draftStroke ? [...strokesRef.current, draftStroke] : strokesRef.current;
    drawSignature(ctx, nextStrokes, color);
  };

  const draw = (event) => {
    if (!isDrawing || !canvasRef.current) {
      return;
    }

    activeStrokeRef.current = [...activeStrokeRef.current, getPoint(event)];
    redrawCanvas(activeStrokeRef.current);
  };

  const stopDraw = () => {
    if (!isDrawing) {
      return;
    }

    setIsDrawing(false);
    if (activeStrokeRef.current.length > 1) {
      const committedStroke = [...activeStrokeRef.current];
      setStrokes((current) => [...current, committedStroke]);
    }

    activeStrokeRef.current = [];
  };

  const handleUpload = (file) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => onAdd(reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 text-slate-900 shadow-lg">
      <div className="text-sm font-semibold text-slate-900">Signature tool</div>
      <div className="mt-3 space-y-3">
        <canvas
          ref={canvasRef}
          width={320}
          height={120}
          onPointerDown={startDraw}
          onPointerMove={draw}
          onPointerUp={stopDraw}
          onPointerCancel={stopDraw}
          onPointerLeave={stopDraw}
          className="w-full rounded-2xl border border-slate-200 bg-white"
          style={{ touchAction: "none" }}
        />
        <div className="flex flex-wrap items-center gap-2">
          {SIGNATURE_COLORS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setColor(item.value)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                color === item.value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-900"
              }`}
            >
              <span
                className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                style={{ backgroundColor: item.value }}
              />
              {item.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              if (!strokes.some((stroke) => stroke.length > 1)) {
                return;
              }

              onAdd(createSignatureCanvasData(strokes, 320, 120, color));
              setStrokes([]);
            }}
            className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
          >
            Add drawn signature
          </button>
          <button
            type="button"
            onClick={() => {
              setIsDrawing(false);
              activeStrokeRef.current = [];
              setStrokes([]);
            }}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900"
          >
            Clear signature
          </button>
        </div>
        <input
          value={typing}
          onChange={(event) => setTyping(event.target.value)}
          placeholder="Type a signature"
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
        <button
          type="button"
          onClick={() => {
            if (!typing.trim()) {
              return;
            }
            const canvas = document.createElement("canvas");
            canvas.width = 420;
            canvas.height = 160;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "transparent";
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = color;
            ctx.font = "italic 64px 'Segoe Script', 'Snell Roundhand', 'Brush Script MT', cursive";
            ctx.textBaseline = "middle";
            ctx.fillText(typing.trim(), 16, 84);
            onAdd(canvas.toDataURL("image/png"));
          }}
          className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
        >
          Add typed signature
        </button>
        <label className="block cursor-pointer rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-center text-sm text-slate-900">
          Upload signature image
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => handleUpload(event.target.files?.[0])}
          />
        </label>
      </div>
    </div>
  );
}
