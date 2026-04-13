export function EdgeDetector({ corners, onDetect, loading }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-white">Auto edge detection</div>
          <div className="text-xs text-slate-300">
            OpenCV.js tries to find the document boundary. You can still fine-tune corners manually.
          </div>
        </div>
        <button
          type="button"
          onClick={onDetect}
          disabled={loading}
          className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Detecting..." : "Detect Edges"}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300 sm:grid-cols-4">
        {corners.map((corner, index) => (
          <div key={index} className="rounded-2xl bg-black/20 p-2">
            P{index + 1}: {corner.x.toFixed(2)}, {corner.y.toFixed(2)}
          </div>
        ))}
      </div>
    </div>
  );
}
