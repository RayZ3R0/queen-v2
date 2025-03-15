import { createCanvas } from "@napi-rs/canvas";
import { LRUCache } from "lru-cache";

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
  if (!Array.isArray(labels) || labels.length === 0) {
    throw new Error("Labels must be a non-empty array");
  }
  if (!Array.isArray(datasets) || datasets.length === 0) {
    throw new Error("Datasets must be a non-empty array");
  }
  datasets.forEach((dataset, i) => {
    if (!Array.isArray(dataset.data) || dataset.data.length === 0) {
      throw new Error(`Dataset ${i} must contain non-empty data array`);
    }
    if (dataset.data.length !== labels.length) {
      throw new Error(`Dataset ${i} length must match labels length`);
    }
  });
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

  return { canvas, ctx };
}

/**
 * Draw a line chart manually using Canvas
 */
async function generateLineChart(labels, datasets, title = "") {
  try {
    validateChartData(labels, datasets, title);
    const cacheKey = generateCacheKey("line", { labels, datasets, title });

    if (chartCache.has(cacheKey)) {
      return chartCache.get(cacheKey);
    }

    const { canvas, ctx } = createChartCanvas();

    // Calculate chart area
    const margin = 50;
    const chartWidth = WIDTH - 2 * margin;
    const chartHeight = HEIGHT - 2 * margin;

    // Draw title
    if (title) {
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 16px Arial";
      ctx.textAlign = "center";
      ctx.fillText(title, WIDTH / 2, margin / 2);
    }

    // Draw axes
    ctx.strokeStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, HEIGHT - margin);
    ctx.lineTo(WIDTH - margin, HEIGHT - margin);
    ctx.stroke();

    // Calculate scales
    const allValues = datasets.flatMap((d) => d.data);
    const maxValue = Math.max(...allValues);
    const minValue = Math.min(0, Math.min(...allValues));
    const yScale = chartHeight / (maxValue - minValue);
    const xStep = chartWidth / (labels.length - 1);

    // Draw grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    for (let i = 0; i <= 5; i++) {
      const y = margin + chartHeight - (i * chartHeight) / 5;
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(WIDTH - margin, y);
      ctx.stroke();
    }

    // Draw labels
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "12px Arial";
    ctx.textAlign = "right";
    for (let i = 0; i <= 5; i++) {
      const value = Math.round((maxValue * i) / 5);
      const y = margin + chartHeight - (i * chartHeight) / 5;
      ctx.fillText(value.toString(), margin - 5, y + 4);
    }

    // Draw x-axis labels
    ctx.textAlign = "center";
    labels.forEach((label, i) => {
      const x = margin + i * xStep;
      ctx.fillText(label, x, HEIGHT - margin + 20);
    });

    // Draw datasets
    datasets.forEach((dataset, datasetIndex) => {
      ctx.strokeStyle = dataset.borderColor || generateColors(1)[0];
      ctx.lineWidth = 2;
      ctx.beginPath();

      dataset.data.forEach((value, i) => {
        const x = margin + i * xStep;
        const y = margin + chartHeight - (value - minValue) * yScale;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      // Draw points
      ctx.fillStyle = ctx.strokeStyle;
      dataset.data.forEach((value, i) => {
        const x = margin + i * xStep;
        const y = margin + chartHeight - (value - minValue) * yScale;

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

      // Draw legend marker
      ctx.fillRect(legendX - 100, legendY - 8, 16, 16);

      // Draw legend text
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
    throw error;
  }
}

/**
 * Draw a bar chart manually using Canvas
 */
async function generateBarChart(labels, datasets, title = "", stacked = false) {
  try {
    validateChartData(labels, datasets, title);
    const cacheKey = generateCacheKey("bar", {
      labels,
      datasets,
      title,
      stacked,
    });

    if (chartCache.has(cacheKey)) {
      return chartCache.get(cacheKey);
    }

    const { canvas, ctx } = createChartCanvas();

    // Calculate chart area
    const margin = 50;
    const chartWidth = WIDTH - 2 * margin;
    const chartHeight = HEIGHT - 2 * margin;

    // Draw title
    if (title) {
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 16px Arial";
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
    ctx.font = "12px Arial";
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

      // Draw legend marker
      ctx.fillRect(legendX - 100, legendY - 8, 16, 16);

      // Draw legend text
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
    throw error;
  }
}

/**
 * Draw a pie chart manually using Canvas
 */
async function generatePieChart(labels, data, title = "") {
  try {
    if (
      !Array.isArray(labels) ||
      !Array.isArray(data) ||
      labels.length !== data.length
    ) {
      throw new Error("Labels and data must be arrays of the same length");
    }

    const cacheKey = generateCacheKey("pie", { labels, data, title });

    if (chartCache.has(cacheKey)) {
      return chartCache.get(cacheKey);
    }

    const { canvas, ctx } = createChartCanvas();

    // Draw title
    if (title) {
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 16px Arial";
      ctx.textAlign = "center";
      ctx.fillText(title, WIDTH / 2, 30);
    }

    const total = data.reduce((sum, value) => sum + value, 0);
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
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        `${labels[i]} (${Math.round((value / total) * 100)}%)`,
        labelX,
        labelY
      );

      startAngle += sliceAngle;
    });

    const buffer = canvas.toBuffer("image/png");
    chartCache.set(cacheKey, buffer);
    return buffer;
  } catch (error) {
    console.error("Error generating pie chart:", error);
    throw error;
  }
}

export { generateLineChart, generateBarChart, generatePieChart, chartCache };
