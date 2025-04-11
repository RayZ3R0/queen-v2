import pkg from "@napi-rs/canvas";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { LRUCache } from "lru-cache";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { createCanvas, GlobalFonts } = pkg;

// Check and register custom font
try {
  // Check multiple possible font locations relative to current file
  const possiblePaths = [
    path.join(__dirname, "../Commands/Slash/Leveling/Fonts/Baloo-Regular.ttf"),
    path.join(__dirname, "../fonts/Baloo-Regular.ttf"),
    path.join(__dirname, "../Fonts/Baloo-Regular.ttf"),
  ];

  let fontLoaded = false;
  for (const fontPath of possiblePaths) {
    try {
      if (GlobalFonts.registerFromPath(fontPath, "Baloo")) {
        console.log("Successfully registered Baloo font from:", fontPath);
        fontLoaded = true;
        break;
      }
    } catch (err) {
      console.debug(`Font not found at ${fontPath}`);
    }
  }

  if (!fontLoaded) {
    console.warn("Could not load Baloo font, falling back to system fonts");
  }
} catch (error) {
  console.error("Error in font registration:", error);
}

// Fallback font configuration
const FONT_FAMILY = GlobalFonts.has("Baloo") ? "Baloo" : "Arial";

// Initialize chart dimensions
const WIDTH = 800;
const HEIGHT = 400;

// Cache configuration
const chartCache = new LRUCache({
  max: 50, // Maximum number of items
  ttl: 300000, // 5 minutes
  updateAgeOnGet: true,
});

/**
 * Generates a unique cache key based on chart parameters
 */
function generateCacheKey(type, data, options) {
  try {
    return `chart_${type}_${JSON.stringify(data)}_${JSON.stringify(options)}`;
  } catch (error) {
    console.error("Error generating cache key:", error);
    return `chart_${type}_${Date.now()}`;
  }
}

/**
 * Validates chart input data
 */
function validateChartData(labels, datasets, title) {
  try {
    // Basic type checking
    if (!Array.isArray(labels)) {
      console.log("Labels is not an array");
      return false;
    }
    if (!Array.isArray(datasets)) {
      console.log("Datasets is not an array");
      return false;
    }

    // Length validation
    if (labels.length === 0 || datasets.length === 0) {
      console.log("Empty labels or datasets");
      return false;
    }

    // Dataset validation
    for (const dataset of datasets) {
      if (!dataset?.data || !Array.isArray(dataset.data)) {
        console.log("Invalid dataset data");
        return false;
      }

      if (dataset.data.length !== labels.length) {
        console.log("Dataset length mismatch");
        return false;
      }

      // Ensure all values are valid numbers
      const validData = dataset.data.every((value) => {
        const num = Number(value);
        return !isNaN(num) && isFinite(num);
      });

      if (!validData) {
        console.log("Dataset contains invalid numeric values");
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error("Error in validateChartData:", error);
    return false;
  }
}

/**
 * Creates a "No Data Available" chart
 */
function createEmptyChart(title = "") {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  // Set background
  ctx.fillStyle = "#2F3136";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Draw message
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (title) {
    ctx.font = `bold 16px ${FONT_FAMILY}`;
    ctx.fillText(title, WIDTH / 2, HEIGHT / 4);
  }

  ctx.font = `14px ${FONT_FAMILY}`;
  ctx.fillText("No data available yet", WIDTH / 2, HEIGHT / 2);
  ctx.fillText(
    "Statistics will appear as data is collected",
    WIDTH / 2,
    HEIGHT / 2 + 30
  );

  return canvas.toBuffer("image/png");
}

/**
 * Generates color palette for charts
 */
function generateColors(count, opacity = 1) {
  return Array.from({ length: count }, (_, i) => {
    const hue = (i * 137.508) % 360; // Use golden angle approximation
    return `hsla(${hue}, 70%, 60%, ${opacity})`;
  });
}

/**
 * Creates a canvas with Discord-themed background
 */
function createChartCanvas() {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  // Set Discord-like background
  ctx.fillStyle = "#2F3136";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Set default text properties
  ctx.font = `14px ${FONT_FAMILY}`;
  ctx.textBaseline = "middle";

  return { canvas, ctx };
}

/**
 * Determines if labels need to be rotated based on available space
 */
function shouldRotateLabels(ctx, labels, availableWidth) {
  const totalWidth = labels.reduce((sum, label) => {
    return sum + ctx.measureText(label).width + 10; // 10px padding
  }, 0);
  return totalWidth > availableWidth * 0.7;
}

/**
 * Truncates text if it exceeds maxWidth
 */
function truncateText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;

  let truncated = text;
  while (
    ctx.measureText(truncated + "...").width > maxWidth &&
    truncated.length > 0
  ) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + "...";
}

/**
 * Draws x-axis labels with smart rotation and truncation
 */
function drawXAxisLabels(ctx, labels, x, y, width, rotated = false) {
  const labelSpacing = width / (labels.length - 1);
  const maxWidth = rotated ? 100 : labelSpacing * 0.9;

  ctx.save();
  ctx.textAlign = rotated ? "right" : "center";

  labels.forEach((label, i) => {
    const labelX = x + i * labelSpacing;
    const truncatedLabel = truncateText(ctx, label, maxWidth);

    ctx.save();
    if (rotated) {
      ctx.translate(labelX, y);
      ctx.rotate(-Math.PI / 4);
      ctx.fillText(truncatedLabel, 0, 0);
    } else {
      ctx.fillText(truncatedLabel, labelX, y);
    }
    ctx.restore();
  });

  ctx.restore();
}

/**
 * Draw a line chart manually using Canvas
 */
async function generateLineChart(labels, datasets, title = "") {
  try {
    const cacheKey = generateCacheKey("line", { labels, datasets, title });

    if (chartCache.has(cacheKey)) {
      return chartCache.get(cacheKey);
    }

    if (!validateChartData(labels, datasets, title)) {
      return createEmptyChart(title);
    }

    const { canvas, ctx } = createChartCanvas();

    // Calculate chart area
    const margin = 50;
    const chartWidth = WIDTH - 2 * margin;
    const chartHeight = HEIGHT - 2 * margin;

    // Draw title
    if (title) {
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `bold 18px ${FONT_FAMILY}`;
      ctx.textAlign = "center";
      ctx.fillText(title, WIDTH / 2, margin / 2);
    }

    // Calculate margins based on label rotation
    const shouldRotate = shouldRotateLabels(ctx, labels, chartWidth);
    const bottomMargin = shouldRotate ? margin * 2 : margin;
    const effectiveHeight = HEIGHT - margin - bottomMargin;

    // Draw axes
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, HEIGHT - bottomMargin);
    ctx.lineTo(WIDTH - margin, HEIGHT - bottomMargin);
    ctx.stroke();

    // Draw grid lines
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";

    // Calculate scales
    const allValues = datasets.flatMap((d) => d.data).map((v) => Number(v));
    const validValues = allValues.filter((v) => !isNaN(v) && isFinite(v));

    if (validValues.length === 0) {
      console.log("No valid numeric values for chart");
      return createEmptyChart(title);
    }

    const maxValue = Math.max(...validValues, 0);
    const minValue = Math.min(0, ...validValues);
    const valueRange = maxValue - minValue;

    // Avoid division by zero
    const yScale = valueRange > 0 ? chartHeight / valueRange : chartHeight;
    const xStep =
      labels.length > 1 ? chartWidth / (labels.length - 1) : chartWidth;

    // Draw grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    for (let i = 0; i <= 5; i++) {
      const y = margin + chartHeight - (i * chartHeight) / 5;
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(WIDTH - margin, y);
      ctx.stroke();
    }

    // Draw y-axis labels
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `14px ${FONT_FAMILY}`;
    ctx.textAlign = "right";
    for (let i = 0; i <= 5; i++) {
      const value = Math.round((maxValue * i) / 5);
      const y = margin + chartHeight - (i * chartHeight) / 5;
      ctx.fillText(value.toString(), margin - 5, y + 4);
    }

    // Draw x-axis labels
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `14px ${FONT_FAMILY}`;
    drawXAxisLabels(
      ctx,
      labels,
      margin,
      HEIGHT - bottomMargin + 20,
      chartWidth,
      shouldRotate
    );

    // Draw datasets
    datasets.forEach((dataset) => {
      ctx.strokeStyle = dataset.borderColor || generateColors(1)[0];
      ctx.lineWidth = 2;
      ctx.beginPath();

      dataset.data.forEach((value, i) => {
        const x = margin + i * xStep;
        const y = margin + chartHeight - (Number(value) - minValue) * yScale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });

      ctx.stroke();

      // Draw points
      ctx.fillStyle = dataset.borderColor || generateColors(1)[0];
      dataset.data.forEach((value, i) => {
        const x = margin + i * xStep;
        const y = margin + chartHeight - (Number(value) - minValue) * yScale;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    // Draw legend
    const legendY = margin / 2;
    let legendX = WIDTH - margin;
    datasets.forEach((dataset, i) => {
      const label = dataset.label || `Dataset ${i + 1}`;
      ctx.fillStyle = dataset.borderColor || generateColors(1)[0];
      ctx.fillRect(legendX - 100, legendY - 8, 16, 16);
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "left";
      ctx.fillText(label, legendX - 80, legendY);
      legendX -= 120;
    });

    const buffer = canvas.toBuffer("image/png");
    chartCache.set(cacheKey, buffer);
    return buffer;
  } catch (error) {
    console.error("Error generating line chart:", error);
    return createEmptyChart(title);
  }
}

/**
 * Draw a bar chart manually using Canvas
 */
async function generateBarChart(labels, datasets, title = "", stacked = false) {
  try {
    const cacheKey = generateCacheKey("bar", {
      labels,
      datasets,
      title,
      stacked,
    });

    if (chartCache.has(cacheKey)) {
      return chartCache.get(cacheKey);
    }

    if (!validateChartData(labels, datasets, title)) {
      return createEmptyChart(title);
    }

    const { canvas, ctx } = createChartCanvas();

    // Calculate chart area
    const margin = 50;
    const chartWidth = WIDTH - 2 * margin;
    const chartHeight = HEIGHT - 2 * margin;

    // Draw title
    if (title) {
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `bold 18px ${FONT_FAMILY}`;
      ctx.textAlign = "center";
      ctx.fillText(title, WIDTH / 2, margin / 2);
    }

    // Calculate scales
    const allValues = datasets.flatMap((d) => d.data);
    const maxValue = Math.max(...allValues);
    const barWidth =
      chartWidth / labels.length / (stacked ? 1 : datasets.length);

    // Draw axes
    ctx.strokeStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, HEIGHT - margin);
    ctx.lineTo(WIDTH - margin, HEIGHT - margin);
    ctx.stroke();

    // Draw grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    for (let i = 0; i <= 5; i++) {
      const y = margin + chartHeight - (i * chartHeight) / 5;
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(WIDTH - margin, y);
      ctx.stroke();
    }

    // Draw y-axis labels
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `14px ${FONT_FAMILY}`;
    ctx.textAlign = "right";
    for (let i = 0; i <= 5; i++) {
      const value = Math.round((maxValue * i) / 5);
      const y = margin + chartHeight - (i * chartHeight) / 5;
      ctx.fillText(value.toString(), margin - 5, y + 4);
    }

    // Draw bars
    labels.forEach((label, labelIndex) => {
      let stackedHeight = 0;

      datasets.forEach((dataset, datasetIndex) => {
        const value = dataset.data[labelIndex];
        const barHeight = (value / maxValue) * chartHeight;

        const x =
          margin +
          labelIndex * (chartWidth / labels.length) +
          (stacked ? barWidth / 2 : datasetIndex * barWidth);
        const y = stacked
          ? HEIGHT - margin - stackedHeight - barHeight
          : HEIGHT - margin - barHeight;

        ctx.fillStyle = dataset.backgroundColor || generateColors(1, 0.8)[0];
        ctx.fillRect(x, y, barWidth - 2, barHeight);

        if (stacked) stackedHeight += barHeight;
      });

      // Draw x-axis labels
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      const x =
        margin +
        labelIndex * (chartWidth / labels.length) +
        (stacked ? barWidth / 2 : (barWidth * datasets.length) / 2);
      ctx.fillText(label, x, HEIGHT - margin + 20);
    });

    // Draw legend
    const legendY = margin / 2;
    let legendX = WIDTH - margin;
    datasets.forEach((dataset, i) => {
      const label = dataset.label || `Dataset ${i + 1}`;
      ctx.fillStyle = dataset.backgroundColor || generateColors(1, 0.8)[0];
      ctx.fillRect(legendX - 100, legendY - 8, 16, 16);
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "left";
      ctx.fillText(label, legendX - 80, legendY);
      legendX -= 120;
    });

    const buffer = canvas.toBuffer("image/png");
    chartCache.set(cacheKey, buffer);
    return buffer;
  } catch (error) {
    console.error("Error generating bar chart:", error);
    return createEmptyChart(title);
  }
}

/**
 * Draw a pie chart manually using Canvas
 */
async function generatePieChart(labels, data, title = "") {
  try {
    const cacheKey = generateCacheKey("pie", { labels, data, title });

    if (chartCache.has(cacheKey)) {
      return chartCache.get(cacheKey);
    }

    if (
      !Array.isArray(labels) ||
      !Array.isArray(data) ||
      labels.length === 0 ||
      data.length === 0 ||
      labels.length !== data.length
    ) {
      return createEmptyChart(title);
    }

    const total = data.reduce((sum, value) => sum + (Number(value) || 0), 0);
    if (total === 0) {
      return createEmptyChart(title);
    }

    const { canvas, ctx } = createChartCanvas();

    // Draw title
    if (title) {
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `bold 16px ${FONT_FAMILY}`;
      ctx.textAlign = "center";
      ctx.fillText(title, WIDTH / 2, 30);
    }

    const centerX = WIDTH / 2;
    const centerY = HEIGHT / 2;
    const radius = Math.min(WIDTH, HEIGHT) / 3;

    let startAngle = 0;
    const colors = generateColors(data.length, 0.8);

    // Draw pie segments
    data.forEach((value, i) => {
      const sliceAngle = (value / total) * 2 * Math.PI;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();

      ctx.fillStyle = colors[i];
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.stroke();

      // Calculate label position
      const labelAngle = startAngle + sliceAngle / 2;
      const labelRadius = radius * 1.2;
      const labelX = centerX + Math.cos(labelAngle) * labelRadius;
      const labelY = centerY + Math.sin(labelAngle) * labelRadius;

      // Draw label line
      ctx.beginPath();
      ctx.moveTo(
        centerX + Math.cos(labelAngle) * radius,
        centerY + Math.sin(labelAngle) * radius
      );
      ctx.lineTo(labelX, labelY);
      ctx.strokeStyle = "#FFFFFF";
      ctx.stroke();

      // Draw label
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `14px ${FONT_FAMILY}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const percentage = Math.round((value / total) * 100);
      ctx.fillText(`${labels[i]} (${percentage}%)`, labelX, labelY);

      startAngle += sliceAngle;
    });

    const buffer = canvas.toBuffer("image/png");
    chartCache.set(cacheKey, buffer);
    return buffer;
  } catch (error) {
    console.error("Error generating pie chart:", error);
    return createEmptyChart(title);
  }
}

export { generateLineChart, generateBarChart, generatePieChart, chartCache };
