/**
 * Pannable, zoomable canvas. Content is drawn by `onDraw` in content space (1 unit = 1 sprite pixel);
 * zoom is restricted to integer steps so pixel art stays crisp.
 */

const ZOOM_LEVELS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32];

export interface CanvasViewOptions {
  canvas: HTMLCanvasElement;
  onDraw: (ctx: CanvasRenderingContext2D, zoom: number) => void;
  /** Click without dragging, in content coordinates. */
  onClick?: (x: number, y: number) => void;
}

export class CanvasView {
  private readonly ctx: CanvasRenderingContext2D;
  private cssWidth = 1;
  private cssHeight = 1;
  private dpr = 1;
  private zoom = 4;
  /** Screen position (CSS px) of content origin (0, 0). */
  private panX = 0;
  private panY = 0;
  /** True once the user chose a zoom; the view then keeps it when the content changes. */
  private manualZoom = false;
  private focus = { minX: -16, minY: -16, maxX: 16, maxY: 16 };

  private dragging = false;
  private dragMoved = false;
  private lastX = 0;
  private lastY = 0;
  private downX = 0;
  private downY = 0;

  constructor(private readonly opts: CanvasViewOptions) {
    this.ctx = opts.canvas.getContext('2d')!;
    const c = opts.canvas;
    c.addEventListener('mousedown', this.onDown);
    c.addEventListener('mousemove', this.onMove);
    window.addEventListener('mouseup', this.onUp);
    c.addEventListener('wheel', this.onWheel, { passive: false });
    c.addEventListener('dblclick', () => {
      this.manualZoom = false;
      this.fit();
    });
  }

  get currentZoom(): number {
    return this.zoom;
  }

  resize(cssWidth: number, cssHeight: number): void {
    this.dpr = window.devicePixelRatio || 1;
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
    const c = this.opts.canvas;
    c.width = Math.round(cssWidth * this.dpr);
    c.height = Math.round(cssHeight * this.dpr);
    this.fit();
  }

  /** Set the content rectangle (content space) the view should frame and re-centre on it. */
  setFocus(bounds: { minX: number; minY: number; maxX: number; maxY: number }, keepPan = false): void {
    this.focus = bounds;
    if (!keepPan) this.fit();
    else this.redraw();
  }

  /** Auto zoom (unless the user chose one) and centre the focus rectangle. */
  fit(): void {
    const w = this.focus.maxX - this.focus.minX;
    const h = this.focus.maxY - this.focus.minY;
    if (!this.manualZoom) {
      const margin = 24;
      const fit = Math.min((this.cssWidth - margin * 2) / Math.max(1, w), (this.cssHeight - margin * 2) / Math.max(1, h));
      let level = ZOOM_LEVELS[0];
      for (const z of ZOOM_LEVELS) if (z <= fit) level = z;
      this.zoom = level;
    }
    const cx = (this.focus.minX + this.focus.maxX) / 2;
    const cy = (this.focus.minY + this.focus.maxY) / 2;
    this.panX = this.cssWidth / 2 - cx * this.zoom;
    this.panY = this.cssHeight / 2 - cy * this.zoom;
    this.redraw();
  }

  redraw(): void {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.opts.canvas.width, this.opts.canvas.height);
    ctx.setTransform(this.dpr * this.zoom, 0, 0, this.dpr * this.zoom, this.dpr * this.panX, this.dpr * this.panY);
    ctx.imageSmoothingEnabled = false;
    this.opts.onDraw(ctx, this.zoom);
  }

  private toContent(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.opts.canvas.getBoundingClientRect();
    return { x: (clientX - rect.left - this.panX) / this.zoom, y: (clientY - rect.top - this.panY) / this.zoom };
  }

  private onDown = (e: MouseEvent): void => {
    if (e.button !== 0 && e.button !== 1) return;
    this.dragging = true;
    this.dragMoved = false;
    this.lastX = this.downX = e.clientX;
    this.lastY = this.downY = e.clientY;
    e.preventDefault();
  };

  private onMove = (e: MouseEvent): void => {
    if (!this.dragging) return;
    if (!this.dragMoved && Math.hypot(e.clientX - this.downX, e.clientY - this.downY) < 4) return;
    this.dragMoved = true;
    this.opts.canvas.style.cursor = 'grabbing';
    this.panX += e.clientX - this.lastX;
    this.panY += e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.redraw();
  };

  private onUp = (e: MouseEvent): void => {
    if (!this.dragging) return;
    this.dragging = false;
    this.opts.canvas.style.cursor = 'grab';
    if (!this.dragMoved && e.button === 0 && this.opts.onClick) {
      const p = this.toContent(e.clientX, e.clientY);
      this.opts.onClick(p.x, p.y);
    }
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    let index = ZOOM_LEVELS.indexOf(this.zoom);
    if (index < 0) index = 0;
    const next = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, index + (e.deltaY < 0 ? 1 : -1)));
    if (ZOOM_LEVELS[next] === this.zoom) return;
    const rect = this.opts.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cx = (mx - this.panX) / this.zoom;
    const cy = (my - this.panY) / this.zoom;
    this.zoom = ZOOM_LEVELS[next];
    this.manualZoom = true;
    this.panX = mx - cx * this.zoom;
    this.panY = my - cy * this.zoom;
    this.redraw();
  };
}
