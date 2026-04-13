import { useEffect, useRef, useState } from "react";

function drawSignature(ctx, strokes) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
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

function createSignatureCanvasData(strokes, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "transparent";
  drawSignature(ctx, strokes);

  return canvas.toDataURL("image/png");
}

export function SignatureTool({ onAdd }) {
  const canvasRef = useRef(null);
  const [typing, setTyping] = useState("");
  const [strokes, setStrokes] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const activeStrokeRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    drawSignature(ctx, strokes);
  }, [strokes]);

  const getPoint = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const startDraw = (event) => {
    event.preventDefault();
    setIsDrawing(true);
    activeStrokeRef.current = [getPoint(event)];
  };

  const draw = (event) => {
    if (!isDrawing || !canvasRef.current) {
      return;
    }

    activeStrokeRef.current = [...activeStrokeRef.current, getPoint(event)];

    const ctx = canvasRef.current.getContext("2d");
    drawSignature(ctx, [...strokes, activeStrokeRef.current]);
  };

  const stopDraw = () => {
    if (!isDrawing) {
      return;
    }

    setIsDrawing(false);

    if (activeStrokeRef.current.length > 1) {
      setStrokes((current) => [...current, activeStrokeRef.current]);
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
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-semibold text-white">Signature tool</div>
      <div className="mt-3 space-y-3">
        <canvas
          ref={canvasRef}
          width={320}
          height={120}
          onPointerDown={startDraw}
          onPointerMove={draw}
          onPointerUp={stopDraw}
          onPointerCancel={stopDraw}
          className="w-full rounded-2xl border border-white/10 bg-black/30"
        />
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              if (!strokes.some((stroke) => stroke.length > 1)) {
                return;
              }

              onAdd(createSignatureCanvasData(strokes, 320, 120));
              setStrokes([]);
            }}
            className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white"
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
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white"
          >
            Clear signature
          </button>
        </div>
        <input
          value={typing}
          onChange={(event) => setTyping(event.target.value)}
          placeholder="Type a signature"
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400"
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
            ctx.fillStyle = "#ffffff";
            ctx.font = "64px Caveat";
            ctx.fillText(typing.trim(), 16, 98);
            onAdd(canvas.toDataURL("image/png"));
          }}
          className="w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white"
        >
          Add typed signature
        </button>
        <label className="block cursor-pointer rounded-2xl border border-dashed border-white/15 bg-black/20 px-4 py-3 text-center text-sm text-slate-200">
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
