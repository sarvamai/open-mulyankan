/**
 * SVGThreadRenderer: the imperative SVG twin of the WebGL renderer.
 *
 * Pools one <g> of 6 paths + a needle circle per leg and updates them
 * from the engine's live geometry: contact shadow, dark rounded edge,
 * body, lit body, sheen core (matched to the shader's material
 * response), a ply-dash twist overlay, and a travelling needle head
 * while a leg is stitching. Reveal is dash-offset trimming.
 *
 * Frames only arrive while the owning runtime is awake, and within a
 * frame each leg diffs against its last-written state; settled legs
 * cost a few comparisons instead of ~30 attribute writes.
 */

import { quadPoint, type EngineLeg } from './engine';
import { shade, mix3 } from './units';

const NS = 'http://www.w3.org/2000/svg';

interface LegCache {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  cxp: number;
  cyp: number;
  progress: number;
  reverse: boolean;
  color: string;
  width: number;
  opacity: number;
}

export class SVGThreadRenderer {
  readonly svg: SVGSVGElement;
  private group: SVGGElement;
  private cache: (LegCache | null)[] = [];
  nodeCount = 0;

  constructor(svg: SVGSVGElement) {
    this.svg = svg;
    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = `<filter id="st-soft" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0.6" dy="1.2" stdDeviation="0.8" flood-color="rgba(40,25,10,.45)"/></filter>`;
    svg.appendChild(defs);
    this.group = document.createElementNS(NS, 'g');
    svg.appendChild(this.group);
  }

  render(legs: EngineLeg[]) {
    const g = this.group;
    while (g.childNodes.length < legs.length) {
      const grp = document.createElementNS(NS, 'g');
      for (let i = 0; i < 6; i++) {
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke-linecap', 'round');
        grp.appendChild(p);
      }
      const nd = document.createElementNS(NS, 'circle');
      nd.setAttribute('r', '3.2');
      grp.appendChild(nd);
      g.appendChild(grp);
    }
    while (g.childNodes.length > legs.length) {
      g.removeChild(g.lastChild!);
    }
    if (this.cache.length !== legs.length) {
      this.cache.length = legs.length;
    }

    legs.forEach((lg, idx) => {
      const prev = this.cache[idx];
      if (
        prev &&
        prev.x0 === lg.x0 &&
        prev.y0 === lg.y0 &&
        prev.x1 === lg.x1 &&
        prev.y1 === lg.y1 &&
        prev.cxp === lg.cxp &&
        prev.cyp === lg.cyp &&
        prev.progress === lg.progress &&
        prev.reverse === lg.reverse &&
        prev.color === lg.color &&
        prev.width === lg.width &&
        prev.opacity === lg.opacity
      ) {
        return;
      }
      this.cache[idx] = {
        x0: lg.x0,
        y0: lg.y0,
        x1: lg.x1,
        y1: lg.y1,
        cxp: lg.cxp,
        cyp: lg.cyp,
        progress: lg.progress,
        reverse: lg.reverse,
        color: lg.color,
        width: lg.width,
        opacity: lg.opacity,
      };

      const d = `M${lg.x0} ${lg.y0} Q${lg.cxp} ${lg.cyp} ${lg.x1} ${lg.y1}`;
      const grp = g.childNodes[idx] as SVGGElement;
      const rawLen = Math.hypot(lg.x1 - lg.x0, lg.y1 - lg.y0);
      const len = rawLen * 1.4 + 2;
      const mat = lg.material;
      // Highlight stays a lighter shade of the thread color (not chalk white)
      let sheenCol = shade(lg.color, mat.sheen * 0.34);
      if (mat.tint) sheenCol = mix3(sheenCol, mat.tint);
      const layers = [
        { w: lg.width * 1.3, col: 'rgba(40,25,10,0.30)', soft: true },
        { w: lg.width * 1.06, col: shade(lg.color, mat.edge - 1) },
        { w: lg.width, col: lg.color },
        { w: lg.width * 0.6, col: shade(lg.color, mat.sheen * 0.18) },
        { w: lg.width * (0.2 + mat.sheenW * 0.35), col: sheenCol },
      ];
      if (grp.dataset.op !== String(lg.opacity)) {
        grp.dataset.op = String(lg.opacity);
        grp.setAttribute('opacity', String(lg.opacity));
      }
      for (let i = 0; i < 5; i++) {
        const p = grp.childNodes[i] as SVGPathElement;
        const ly = layers[i];
        p.setAttribute('d', d);
        p.setAttribute('stroke', ly.col);
        p.setAttribute('stroke-width', String(ly.w));
        if (ly.soft) p.setAttribute('filter', 'url(#st-soft)');
        else p.removeAttribute('filter');
        p.setAttribute('stroke-dasharray', String(len));
        const off = lg.reverse ? -len * (1 - lg.progress) : len * (1 - lg.progress);
        p.setAttribute('stroke-dashoffset', String(off));
      }
      // ply twist overlay
      const ply = grp.childNodes[5] as SVGPathElement;
      if (lg.progress >= 1 && lg.width > 2.6 && mat.ply > 0.15) {
        const twists = Math.max(3, rawLen * mat.plyFreq);
        const period = rawLen / twists;
        ply.setAttribute('d', d);
        ply.setAttribute('stroke', shade(lg.color, 0.55));
        ply.setAttribute('stroke-width', String(lg.width * 0.5));
        ply.setAttribute('stroke-linecap', 'butt');
        ply.setAttribute(
          'stroke-dasharray',
          `${(period * 0.5).toFixed(2)} ${(period * 0.5).toFixed(2)}`
        );
        ply.style.opacity = (0.3 * mat.ply).toFixed(2);
      } else {
        ply.style.opacity = '0';
      }
      // needle head
      const nd = grp.childNodes[6] as SVGCircleElement;
      if (lg.showNeedle && lg.progress > 0 && lg.progress < 1) {
        const t = lg.reverse ? 1 - lg.progress : lg.progress;
        const [hx, hy] = quadPoint(t, lg.x0, lg.y0, lg.cxp, lg.cyp, lg.x1, lg.y1);
        nd.setAttribute('cx', String(hx));
        nd.setAttribute('cy', String(hy));
        nd.setAttribute('fill', '#e8e8ee');
        nd.setAttribute('stroke', '#888');
        nd.setAttribute('stroke-width', '0.5');
        nd.style.opacity = '1';
      } else {
        nd.style.opacity = '0';
      }
    });
    this.nodeCount = g.childNodes.length * 7;
  }

  dispose() {
    this.svg.replaceChildren();
    this.cache = [];
  }
}
