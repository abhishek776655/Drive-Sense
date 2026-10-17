/**
 * Outline of the Drive map sheet: a rounded card whose top edge rises into a semicircular bump,
 * Rovy style. Sheet and bump are one path so the glass has one outline and no seam; small concave
 * fillets join the bump to the sheet's top edge.
 */
export interface BumpGeometry {
  /** Bump circle radius. */
  radius: number;
  /** How far the bump rises above the sheet's top edge. Must be less than `radius`. */
  rise: number;
  /** Concave fillet radius where the bump meets the top edge. */
  fillet: number;
  /** Sheet corner radius. */
  corner: number;
}

export const DEFAULT_BUMP: BumpGeometry = {radius: 90, rise: 82, fillet: 16, corner: 28};

/** The smaller bump from the v9 mockup, kept for reference and tests. */
export const MOCKUP_V9_BUMP: BumpGeometry = {radius: 66, rise: 46, fillet: 12, corner: 28};

const fmt = (n: number) => Number(n.toFixed(2));

export interface BumpLayout {
  path: string;
  /** Centre of the bump circle, for drawing the speed arc concentric with it. */
  center: {x: number; y: number};
  /** y of the sheet's top edge (the bump sits above it). */
  bodyTop: number;
}

export const bumpLayout = (width: number, height: number, geometry: BumpGeometry = DEFAULT_BUMP): BumpLayout => {
  const {radius: R, rise, fillet: f, corner: c} = geometry;
  const cx = width / 2;
  const cy = R;
  const top = rise;

  // Fillet circle sits above the top edge, tangent to it and externally tangent to the bump.
  const fy = top - f;
  const dy = cy - fy;
  const dx = Math.sqrt((R + f) ** 2 - dy ** 2);
  const leftF = {x: cx - dx, y: fy};
  const rightF = {x: cx + dx, y: fy};
  const k = R / (R + f);
  const leftT = {x: cx + (leftF.x - cx) * k, y: cy + (leftF.y - cy) * k};
  const rightT = {x: cx + (rightF.x - cx) * k, y: cy + (rightF.y - cy) * k};

  const path = [
    `M0 ${fmt(top + c)}`,
    `A${c} ${c} 0 0 1 ${c} ${top}`,
    `L${fmt(leftF.x)} ${top}`,
    `A${f} ${f} 0 0 0 ${fmt(leftT.x)} ${fmt(leftT.y)}`,
    `A${R} ${R} 0 0 1 ${fmt(rightT.x)} ${fmt(rightT.y)}`,
    `A${f} ${f} 0 0 0 ${fmt(rightF.x)} ${top}`,
    `L${fmt(width - c)} ${top}`,
    `A${c} ${c} 0 0 1 ${width} ${fmt(top + c)}`,
    `L${width} ${fmt(height - c)}`,
    `A${c} ${c} 0 0 1 ${fmt(width - c)} ${height}`,
    `L${c} ${height}`,
    `A${c} ${c} 0 0 1 0 ${fmt(height - c)}`,
    'Z',
  ].join('');

  return {path, center: {x: cx, y: cy}, bodyTop: top};
};
