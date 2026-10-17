/**
 * SVG path for a line chart and its filled area, data scaled into a width × height box.
 * `minTop` keeps the vertical scale from stretching a tiny range to full height.
 */
export const linePath = (values: {x: number; y: number}[], width: number, height: number, pad = 4, minTop = 0) => {
  if (values.length === 0) {
    return {line: '', area: '', toXY: (p: {x: number; y: number}) => ({x: p.x, y: p.y})};
  }
  const xs = values.map((v) => v.x);
  const ys = values.map((v) => v.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  // The baseline is 0 so a chart never exaggerates small changes by starting mid-range.
  const y0 = Math.min(0, ...ys);
  const y1 = Math.max(minTop, ...ys);
  const sx = x1 > x0 ? (width - pad * 2) / (x1 - x0) : 0;
  const sy = y1 > y0 ? (height - pad * 2) / (y1 - y0) : 0;
  const round = (n: number) => Math.round(n * 10) / 10;
  const toXY = (p: {x: number; y: number}) => ({x: round(pad + (p.x - x0) * sx), y: round(height - pad - (p.y - y0) * sy)});
  const pts = values.map(toXY);
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join('');
  const area = `${line}L${pts[pts.length - 1].x} ${height - pad}L${pts[0].x} ${height - pad}Z`;
  return {line, area, toXY};
};
