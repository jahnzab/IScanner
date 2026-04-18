export const FILTERS = [
  {
    id: "original",
    name: "Original",
    style: "none"
  },
  {
    id: "bw",
    name: "B&W",
    style: "grayscale(1) contrast(1.45) brightness(1.08)"
  },
  {
    id: "grayscale",
    name: "Grayscale",
    style: "grayscale(1)"
  },
  {
    id: "magic",
    name: "Magic Enhance",
    style: "contrast(1.3) saturate(0.75) brightness(1.12)"
  },
  {
    id: "contrast",
    name: "Contrast Boost",
    style: "contrast(1.45) brightness(1.05)"
  },
  {
    id: "shadow",
    name: "Shadow Removal",
    style: "brightness(1.18) contrast(1.15) saturate(0.9)"
  }
];

async function loadImage(src) {
  const image = new Image();
  image.src = src;

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });

  return image;
}

function normalizeCorners(points) {
  if (!points || points.length !== 4) {
    return points;
  }

  const sortedByY = [...points].sort((a, b) => a.y - b.y);
  const top = sortedByY.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = sortedByY.slice(2).sort((a, b) => a.x - b.x);

  return [top[0], top[1], bottom[1], bottom[0]];
}

function getCropBounds(points, sourceWidth, sourceHeight) {
  const xs = points.map((point) => point.x * sourceWidth);
  const ys = points.map((point) => point.y * sourceHeight);
  const paddingX = sourceWidth * 0.015;
  const paddingY = sourceHeight * 0.015;

  const minX = Math.max(0, Math.min(...xs) - paddingX);
  const minY = Math.max(0, Math.min(...ys) - paddingY);
  const maxX = Math.min(sourceWidth, Math.max(...xs) + paddingX);
  const maxY = Math.min(sourceHeight, Math.max(...ys) + paddingY);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY)
  };
}

export async function buildCanvasFromImage({
  image,
  corners,
  filterStyle,
  watermark,
  annotations = []
}) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  canvas.width = sourceWidth;
  canvas.height = sourceHeight;

  if (ctx.filter !== undefined) {
    ctx.filter = filterStyle === "none" ? "none" : filterStyle;
  }

  if (corners?.length === 4) {
    const orderedCorners = normalizeCorners(corners);
    const { minX, minY, width, height } = getCropBounds(orderedCorners, sourceWidth, sourceHeight);
    canvas.width = Math.round(width);
    canvas.height = Math.round(height);
    ctx.filter = filterStyle === "none" ? "none" : filterStyle;
    ctx.drawImage(image, minX, minY, width, height, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.drawImage(image, 0, 0, sourceWidth, sourceHeight);
  }

  ctx.filter = "none";
  for (const item of annotations) {
    if (item.type === "text") {
      ctx.fillStyle = item.color || "#ffffff";
      ctx.font = `${item.fontSize || 32}px ${item.fontFamily || "sans-serif"}`;
      ctx.fillText(item.value, item.x * canvas.width, item.y * canvas.height);
    }

    if (item.type === "signature" && item.image) {
      const sigImage = await loadImage(item.image);
      ctx.drawImage(
        sigImage,
        item.x * canvas.width,
        item.y * canvas.height,
        (item.width || 0.25) * canvas.width,
        (item.height || 0.12) * canvas.height
      );
    }
  }

  if (watermark) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#f97316";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-0.28);
    ctx.font = `800 ${Math.max(44, canvas.width * 0.11)}px sans-serif`;
    ctx.fillText("iScanner", 0, -Math.max(8, canvas.height * 0.03));
    ctx.globalAlpha = 0.14;
    ctx.font = `700 ${Math.max(14, canvas.width * 0.03)}px sans-serif`;
    ctx.fillText("FREE PLAN", 0, Math.max(34, canvas.height * 0.06));
    ctx.restore();
  }

  return canvas;
}

export async function detectDocumentCorners(imageElement) {
  const fallback = [
    { x: 0.06, y: 0.04 },
    { x: 0.94, y: 0.04 },
    { x: 0.94, y: 0.96 },
    { x: 0.06, y: 0.96 }
  ];

  const cv = window.cv;

  if (!cv?.Mat) {
    return fallback;
  }

  try {
    const source = cv.imread(imageElement);
    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    const edged = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY, 0);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
    cv.Canny(blurred, edged, 75, 200);
    cv.findContours(edged, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    let bestContour = null;
    let bestArea = 0;

    for (let i = 0; i < contours.size(); i += 1) {
      const contour = contours.get(i);
      const perimeter = cv.arcLength(contour, true);
      const approx = new cv.Mat();

      cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);

      if (approx.rows === 4) {
        const area = cv.contourArea(approx);
        if (area > bestArea) {
          bestArea = area;
          bestContour = approx.clone();
        }
      }

      approx.delete();
      contour.delete();
    }

    const result = bestContour
      ? Array.from({ length: 4 }, (_, index) => ({
          x: bestContour.intPtr(index, 0)[0] / source.cols,
          y: bestContour.intPtr(index, 0)[1] / source.rows
        }))
      : fallback;

    source.delete();
    gray.delete();
    blurred.delete();
    edged.delete();
    contours.delete();
    hierarchy.delete();
    bestContour?.delete();

    const ordered = normalizeCorners(result);
    const bounds = getCropBounds(ordered, source.cols, source.rows);
    const areaRatio = (bounds.width * bounds.height) / (source.cols * source.rows);

    if (areaRatio < 0.25) {
      return fallback;
    }

    return ordered;
  } catch {
    return fallback;
  }
}
