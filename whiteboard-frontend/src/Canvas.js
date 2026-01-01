import React, { useRef, useEffect, useState } from 'react';
import './Canvas.css';
import { FaPen, FaEraser, FaMinus, FaSquare, FaCircle, FaTrash, FaFileDownload, FaFont, FaHandPaper, FaRegSquare } from 'react-icons/fa';
import jsPDF from 'jspdf';
import toast, { Toaster } from 'react-hot-toast';

function Canvas({ drawEvents, sendDrawEvent, previewShape, addLocalDrawEvent, userName, channelName }) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const stageRef = useRef(null);
  const lastPosRef = useRef(null);
  const penSmoothRef = useRef(null); // { lastPoint: {x,y}, lastMid: {x,y} }
  const shapeStartRef = useRef(null);
  const selectStartRef = useRef(null);
  const selectDragRef = useRef(false);
  const didPanRef = useRef(false);
  const [fallbackLocalEvents, setFallbackLocalEvents] = useState([]);
  const [canvasEpoch, setCanvasEpoch] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const isDrawingRef = useRef(false); // Ref version to avoid stale closure in callbacks
  const panStartRef = useRef(null);
  const [isPanning, setIsPanning] = useState(false);
  const [selectedRect, setSelectedRect] = useState(null); // {x1,y1,x2,y2} in logical coords
  const [, setHoverRect] = useState(null); // hover highlight (disabled)
  const [selectedText, setSelectedText] = useState(null); // { id, x, y } when selection is a text
  const [isDraggingText, setIsDraggingText] = useState(false);
  const textDragRef = useRef(null); // { startX, startY, origX, origY, origRect }
  const [isMovingSelection, setIsMovingSelection] = useState(false);
  const selectionMoveRef = useRef(null); // { startX, startY, origRect, moved }

  // Fixed canvas size - no infinite scrolling to prevent coordinate drift issues
  const CANVAS_WIDTH = 2400;
  const CANVAS_HEIGHT = 1600;
  const [baseWidth] = useState(CANVAS_WIDTH);
  const [baseHeight] = useState(CANVAS_HEIGHT);

  // --- Toolbar State ---
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(5);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [tool, setTool] = useState('pen'); // 'pen' | 'eraser' | 'select-erase' | 'line' | 'rect' | 'circle' | 'text' | 'hand'
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showTextModal, setShowTextModal] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textPosition, setTextPosition] = useState(null);
  const [zoom, setZoom] = useState(1);

  const handleTextSubmit = () => {
    if (!textPosition) return;
    const value = (textInput || '').toString();
    if (!value.trim()) return;

    const fontSize = lineWidth * 4;
    const id = newId();
    const textPayload = {
      type: 'text',
      id,
      text: value,
      x: textPosition.x,
      y: textPosition.y,
      x1: textPosition.x,
      y1: textPosition.y,
      color: color,
      fontSize,
      lineWidth: Math.max(1, parseInt(lineWidth, 10) || 1),
    };

    recordLocalEvent(textPayload);
    // Text is local-only (not broadcast)

    // Immediately select the newly added text so the user can drag/delete it
    // without extra clicks.
    try {
      const bb = shapeBounds(textPayload);
      if (bb) {
        setSelectedRect({ x1: bb.x, y1: bb.y, x2: bb.x + bb.w, y2: bb.y + bb.h });
      } else {
        setSelectedRect(null);
      }
    } catch (err) {
      setSelectedRect(null);
    }
    setSelectedText({ id, x: textPayload.x, y: textPayload.y });
    setHoverRect(null);
    setIsDraggingText(false);
    textDragRef.current = null;
    setTool('select-erase');

    setTextInput('');
    setShowTextModal(false);
    setTextPosition(null);
    toast.success('Text added!');
  };

  const getEventPoint = (evt) => {
    const x = evt?.x1 ?? evt?.x ?? 0;
    const y = evt?.y1 ?? evt?.y ?? 0;
    return { x, y };
  };

  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  };

  const distPointToSegment = (px, py, x1, y1, x2, y2) => {
    const vx = x2 - x1;
    const vy = y2 - y1;
    const wx = px - x1;
    const wy = py - y1;
    const c1 = vx * wx + vy * wy;
    if (c1 <= 0) return Math.sqrt(dist2(px, py, x1, y1));
    const c2 = vx * vx + vy * vy;
    if (c2 <= c1) return Math.sqrt(dist2(px, py, x2, y2));
    const t = c1 / c2;
    const projX = x1 + t * vx;
    const projY = y1 + t * vy;
    return Math.sqrt(dist2(px, py, projX, projY));
  };

  const distancePointToRect = (px, py, x, y, w, h) => {
    // 0 if inside; otherwise Euclidean distance to nearest edge
    const dx = Math.max(x - px, 0, px - (x + w));
    const dy = Math.max(y - py, 0, py - (y + h));
    return Math.sqrt(dx * dx + dy * dy);
  };

  const rectNorm = (a) => {
    const x1 = a?.x1 ?? 0;
    const y1 = a?.y1 ?? 0;
    const x2 = a?.x2 ?? x1;
    const y2 = a?.y2 ?? y1;
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      w: Math.abs(x2 - x1),
      h: Math.abs(y2 - y1),
      x1,
      y1,
      x2,
      y2,
    };
  };

  const rectsOverlap = (a, b) => {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  };

  const intersectsEraseRect = (shape, eraseRect) => {
    const t = shape?.type || '';
    const r = rectNorm(eraseRect);
    const lw = typeof shape?.lineWidth === 'number' ? shape.lineWidth : 0;
    const pad = Math.max(0, lw / 2);
    const rr = { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };

    if (t === 'line-segment' || t === 'shape-line') {
      const x1 = shape.x1 ?? 0;
      const y1 = shape.y1 ?? 0;
      const x2 = shape.x2 ?? x1;
      const y2 = shape.y2 ?? y1;
      const segBB = {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        w: Math.abs(x2 - x1),
        h: Math.abs(y2 - y1),
      };
      const segBBPad = { x: segBB.x - pad, y: segBB.y - pad, w: segBB.w + pad * 2, h: segBB.h + pad * 2 };
      if (!rectsOverlap(segBBPad, rr)) return false;
      return true;
    }

    if (t === 'shape-rect') {
      const x1 = shape.x1 ?? 0;
      const y1 = shape.y1 ?? 0;
      const x2 = shape.x2 ?? x1;
      const y2 = shape.y2 ?? y1;
      const s = { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
      return rectsOverlap(s, rr);
    }

    if (t === 'shape-circle') {
      const cx = shape.x1 ?? 0;
      const cy = shape.y1 ?? 0;
      const x2 = shape.x2 ?? cx;
      const y2 = shape.y2 ?? cy;
      const cr = Math.max(0.5, Math.hypot(x2 - cx, y2 - cy)) + pad;
      const bb = { x: cx - cr, y: cy - cr, w: cr * 2, h: cr * 2 };
      return rectsOverlap(bb, rr);
    }

    if (t === 'text') {
      const p = getEventPoint(shape);
      const inside = p.x >= rr.x && p.x <= rr.x + rr.w && p.y >= rr.y && p.y <= rr.y + rr.h;
      return inside;
    }

    return false;
  };

  const intersectsEraser = (shape, cx, cy, r) => {
    const t = shape?.type || '';
    const lw = typeof shape?.lineWidth === 'number' ? shape.lineWidth : 0;
    const pad = Math.max(0, lw / 2);
    const radius = r + pad;

    if (t === 'line-segment' || t === 'shape-line') {
      const x1 = shape.x1 ?? 0;
      const y1 = shape.y1 ?? 0;
      const x2 = shape.x2 ?? x1;
      const y2 = shape.y2 ?? y1;
      return distPointToSegment(cx, cy, x1, y1, x2, y2) <= radius;
    }

    if (t === 'shape-rect') {
      const x1 = shape.x1 ?? 0;
      const y1 = shape.y1 ?? 0;
      const x2 = shape.x2 ?? x1;
      const y2 = shape.y2 ?? y1;
      const x = Math.min(x1, x2);
      const y = Math.min(y1, y2);
      const w = Math.abs(x2 - x1);
      const h = Math.abs(y2 - y1);
      return distancePointToRect(cx, cy, x, y, w, h) <= radius;
    }

    if (t === 'shape-circle') {
      const x1 = shape.x1 ?? 0;
      const y1 = shape.y1 ?? 0;
      const x2 = shape.x2 ?? x1;
      const y2 = shape.y2 ?? y1;
      const circleRadius = Math.max(0.5, Math.hypot(x2 - x1, y2 - y1));
      return Math.sqrt(dist2(cx, cy, x1, y1)) <= (circleRadius + radius);
    }

    if (t === 'text') {
      const p = getEventPoint(shape);
      const fontSize = typeof shape?.fontSize === 'number' ? shape.fontSize : (typeof shape?.lineWidth === 'number' ? shape.lineWidth * 4 : 20);
      const textPad = Math.max(6, fontSize / 2);
      return Math.sqrt(dist2(cx, cy, p.x, p.y)) <= (radius + textPad);
    }

    return false;
  };

  const buildVisibleShapes = (events) => {
    let shapes = [];
    const textIndexById = new Map();

    const rebuildTextIndex = () => {
      textIndexById.clear();
      for (let j = 0; j < shapes.length; j++) {
        if ((shapes[j]?.type || '') === 'text' && shapes[j]?.id) {
          textIndexById.set(shapes[j].id, j);
        }
      }
    };

    const translateShape = (shape, dx, dy) => {
      if (!shape) return shape;
      const t = shape?.type || '';

      if (t === 'line-segment' || t === 'shape-line' || t === 'shape-rect' || t === 'shape-circle') {
        return {
          ...shape,
          x1: (shape.x1 ?? 0) + dx,
          y1: (shape.y1 ?? 0) + dy,
          x2: (shape.x2 ?? 0) + dx,
          y2: (shape.y2 ?? 0) + dy,
        };
      }

      if (t === 'text') {
        const x1 = typeof shape?.x1 === 'number' ? shape.x1 : (typeof shape?.x === 'number' ? shape.x : 0);
        const y1 = typeof shape?.y1 === 'number' ? shape.y1 : (typeof shape?.y === 'number' ? shape.y : 0);
        return {
          ...shape,
          x1: x1 + dx,
          y1: y1 + dy,
          x: x1 + dx,
          y: y1 + dy,
        };
      }

      return shape;
    };

    for (let i = 0; i < (events || []).length; i++) {
      const evt = events[i];
      const t = evt?.type || '';
      if (t === 'clear') {
        shapes = [];
        textIndexById.clear();
        continue;
      }
      if (t === 'erase') {
        const p = getEventPoint(evt);
        const r = typeof evt?.lineWidth === 'number' ? evt.lineWidth : 0;
        if (r > 0) {
          shapes = shapes.filter((s) => !intersectsEraser(s, p.x, p.y, r));
        }
        continue;
      }
      if (t === 'erase-rect') {
        shapes = shapes.filter((s) => !intersectsEraseRect(s, evt));
        // text indexes are no longer reliable after filtering; rebuild
        rebuildTextIndex();
        continue;
      }

      if (t === 'move-rect' || t === 'move-rect-preview') {
        const dx = typeof evt?.dx === 'number' ? evt.dx : 0;
        const dy = typeof evt?.dy === 'number' ? evt.dy : 0;
        if (dx === 0 && dy === 0) continue;
        const moveRect = {
          x1: typeof evt?.x1 === 'number' ? evt.x1 : 0,
          y1: typeof evt?.y1 === 'number' ? evt.y1 : 0,
          x2: typeof evt?.x2 === 'number' ? evt.x2 : (typeof evt?.x1 === 'number' ? evt.x1 : 0),
          y2: typeof evt?.y2 === 'number' ? evt.y2 : (typeof evt?.y1 === 'number' ? evt.y1 : 0),
          lineWidth: 1,
        };
        shapes = shapes.map((s) => (intersectsEraseRect(s, moveRect) ? translateShape(s, dx, dy) : s));
        rebuildTextIndex();
        continue;
      }

      if (t === 'text') {
        const id = evt?.id || `legacy-text-${i}`;
        const next = { ...evt, id };
        shapes.push(next);
        textIndexById.set(id, shapes.length - 1);
        continue;
      }

      if (t === 'text-move') {
        const targetId = evt?.targetId || evt?.id;
        if (targetId && textIndexById.has(targetId)) {
          const idx = textIndexById.get(targetId);
          const cur = shapes[idx];
          const nx = typeof evt?.x1 === 'number' ? evt.x1 : (typeof evt?.x === 'number' ? evt.x : cur?.x1);
          const ny = typeof evt?.y1 === 'number' ? evt.y1 : (typeof evt?.y === 'number' ? evt.y : cur?.y1);
          shapes[idx] = {
            ...cur,
            x1: typeof nx === 'number' ? nx : cur?.x1,
            y1: typeof ny === 'number' ? ny : cur?.y1,
            x: typeof nx === 'number' ? nx : cur?.x,
            y: typeof ny === 'number' ? ny : cur?.y,
          };
        }
        continue;
      }

      if (t === 'text-delete') {
        const targetId = evt?.targetId || evt?.id;
        if (targetId && textIndexById.has(targetId)) {
          const idx = textIndexById.get(targetId);
          shapes[idx] = { ...shapes[idx], _deleted: true };
          textIndexById.delete(targetId);
        }
        continue;
      }

      if (t && (t.startsWith('shape-preview') || t.startsWith('line-segment-preview'))) {
        continue;
      }
      shapes.push(evt);
    }
    return shapes.filter((s) => !s?._deleted);
  };

  const newId = () => {
    try {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    } catch (e) {}
    return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const hasExternalLocalBuffer = typeof addLocalDrawEvent === 'function';

  const recordLocalEvent = (evt) => {
    if (!evt) return;
    if (hasExternalLocalBuffer) {
      addLocalDrawEvent(evt);
      return;
    }
    setFallbackLocalEvents((prev) => [...prev, evt]);
  };

  const getAllEvents = () => {
    const base = Array.isArray(drawEvents) ? drawEvents : [];
    if (hasExternalLocalBuffer) return base;
    return base.concat(fallbackLocalEvents);
  };

  // If a clear happens (from us or remote), also clear the local fallback buffer.
  useEffect(() => {
    if (hasExternalLocalBuffer) return;
    const evts = Array.isArray(drawEvents) ? drawEvents : [];
    const sawClear = evts.some((e) => (e?.type || '') === 'clear');
    if (sawClear) setFallbackLocalEvents([]);
  }, [drawEvents, hasExternalLocalBuffer]);

  const pickTopmostShapeAtCursor = (x, y) => {
    const visible = buildVisibleShapes(getAllEvents());
    const hitRadius = 10;
    for (let i = visible.length - 1; i >= 0; i--) {
      const s = visible[i];
      if (intersectsEraser(s, x, y, hitRadius)) {
        const bb = shapeBounds(s);
        if (!bb) return null;
        return {
          shape: s,
          rect: { x1: bb.x, y1: bb.y, x2: bb.x + bb.w, y2: bb.y + bb.h },
        };
      }
    }
    return null;
  };

  const measureTextBlock = (text, fontSize) => {
    const lines = (text ?? '').toString().split(/\r?\n/);
    const safeFontSize = typeof fontSize === 'number' && fontSize > 0 ? fontSize : 20;
    const lineHeight = Math.max(10, Math.round(safeFontSize * 1.2));

    let maxW = 10;
    try {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.font = `${safeFontSize}px Arial`;
        for (const line of lines) {
          const w = Math.ceil(ctx.measureText((line ?? '').toString() || ' ').width);
          maxW = Math.max(maxW, w);
        }
        ctx.restore();
      } else {
        maxW = Math.max(10, Math.ceil(((lines[0] || '').length || 1) * safeFontSize * 0.6));
      }
    } catch (err) {
      maxW = Math.max(10, Math.ceil(((lines[0] || '').length || 1) * safeFontSize * 0.6));
    }

    const blockH = Math.max(10, lines.length * lineHeight);
    return { lines, maxW, blockH, lineHeight, fontSize: safeFontSize };
  };

  const rectsOverlapSimple = (a, b) => {
    if (!a || !b) return false;
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  };

  const findNonCollidingTextPos = (x, y, text, fontSize) => {
    const m = measureTextBlock(text, fontSize);
    const visible = buildVisibleShapes(getAllEvents());
    const existingTextRects = visible
      .filter((s) => (s?.type || '') === 'text')
      .map((s) => shapeBounds(s))
      .filter(Boolean);

    const maxAttempts = 200;
    let cy = y;
    for (let i = 0; i < maxAttempts; i++) {
      const candidate = {
        x: x - 4,
        y: cy - m.fontSize - 4,
        w: m.maxW + 8,
        h: m.blockH + 8,
      };
      const collides = existingTextRects.some((r) => rectsOverlapSimple(candidate, r));
      if (!collides) return { x, y: cy };
      cy += m.lineHeight;
    }
    return null;
  };

  const shapeBounds = (shape) => {
    const t = shape?.type || '';
    const lw = typeof shape?.lineWidth === 'number' ? shape.lineWidth : 0;
    const pad = Math.max(6, lw / 2);

    if (t === 'line-segment' || t === 'shape-line') {
      const x1 = shape.x1 ?? 0;
      const y1 = shape.y1 ?? 0;
      const x2 = shape.x2 ?? x1;
      const y2 = shape.y2 ?? y1;
      const x = Math.min(x1, x2) - pad;
      const y = Math.min(y1, y2) - pad;
      const w = Math.abs(x2 - x1) + pad * 2;
      const h = Math.abs(y2 - y1) + pad * 2;
      return { x, y, w, h };
    }

    if (t === 'shape-rect') {
      const x1 = shape.x1 ?? 0;
      const y1 = shape.y1 ?? 0;
      const x2 = shape.x2 ?? x1;
      const y2 = shape.y2 ?? y1;
      const x = Math.min(x1, x2) - pad;
      const y = Math.min(y1, y2) - pad;
      const w = Math.abs(x2 - x1) + pad * 2;
      const h = Math.abs(y2 - y1) + pad * 2;
      return { x, y, w, h };
    }

    if (t === 'shape-circle') {
      const cx = shape.x1 ?? 0;
      const cy = shape.y1 ?? 0;
      const x2 = shape.x2 ?? cx;
      const y2 = shape.y2 ?? cy;
      const cr = Math.max(0.5, Math.hypot(x2 - cx, y2 - cy)) + pad;
      return { x: cx - cr, y: cy - cr, w: cr * 2, h: cr * 2 };
    }

    if (t === 'text') {
      const p = getEventPoint(shape);
      const fontSize = typeof shape?.fontSize === 'number' ? shape.fontSize : 20;
      const text = (shape?.text ?? '').toString();
      const m = measureTextBlock(text, fontSize);
      return { x: p.x - 4, y: p.y - m.fontSize - 4, w: m.maxW + 8, h: m.blockH + 8 };
    }

    return null;
  };

  const clearSelection = () => {
    setSelectedRect(null);
    setHoverRect(null);
    setSelectedText(null);
    setIsDraggingText(false);
    textDragRef.current = null;
    setIsMovingSelection(false);
    selectionMoveRef.current = null;
  };

  const pointInRect = (p, rect, padding = 0) => {
    if (!p || !rect) return false;
    const r = rectNorm(rect);
    return (
      p.x >= r.x - padding &&
      p.x <= r.x + r.w + padding &&
      p.y >= r.y - padding &&
      p.y <= r.y + r.h + padding
    );
  };

  const deleteSelected = () => {
    if (!selectedRect) return;
    const payload = selectedText?.id
      ? { type: 'text-delete', targetId: selectedText.id, lineWidth: 1, x1: 0, y1: 0, x2: 0, y2: 0 }
      : { type: 'erase-rect', x1: selectedRect.x1, y1: selectedRect.y1, x2: selectedRect.x2, y2: selectedRect.y2 };
    addLocalDrawEvent && addLocalDrawEvent(payload);
    // Only broadcast non-text operations
    if ((payload?.type || '') !== 'text-delete') {
      sendDrawEvent(payload);
    }
    clearSelection();
  };

  const drawSelectionRect = (octx, start, end) => {
    const r = rectNorm({ x1: start.x, y1: start.y, x2: end.x, y2: end.y });
    octx.save();
    octx.clearRect(0, 0, baseWidth, baseHeight);
    octx.fillStyle = 'rgba(0, 122, 255, 0.12)';
    octx.strokeStyle = 'rgba(0, 122, 255, 0.9)';
    octx.lineWidth = 2;
    octx.setLineDash([6, 4]);
    octx.fillRect(r.x, r.y, r.w, r.h);
    octx.strokeRect(r.x, r.y, r.w, r.h);
    octx.restore();
  };

  const toolLabel = (t) => {
    switch (t) {
      case 'pen':
        return 'Pen';
      case 'hand':
        return 'Drag';
      case 'select-erase':
        return 'Select';
      case 'line':
        return 'Line';
      case 'rect':
        return 'Rect';
      case 'circle':
        return 'Circle';
      case 'text':
        return 'Text';
      case 'eraser':
        return 'Eraser';
      default:
        return '';
    }
  };

  // This effect is for REDRAWING when remote events come in
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Clear and fill background first
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Fill logical size (we scaled for DPR already)
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, baseWidth, baseHeight);

    // Redraw events, applying erase operations to keep a cursor-based eraser.
    let eventsForRender = getAllEvents();
    if (tool === 'select-erase' && isMovingSelection && selectionMoveRef.current && selectedRect) {
      const r0 = selectionMoveRef.current.origRect;
      const dx = selectedRect.x1 - r0.x1;
      const dy = selectedRect.y1 - r0.y1;
      eventsForRender = eventsForRender.concat({
        type: 'move-rect-preview',
        x1: r0.x1,
        y1: r0.y1,
        x2: r0.x2,
        y2: r0.y2,
        dx,
        dy,
        lineWidth: 1,
      });
    }

    let visibleShapes = buildVisibleShapes(eventsForRender);

    // While dragging a selected text, render it at the dragged position
    // immediately (optimistic local preview) so movement feels smooth.
    if (isDraggingText && selectedText?.id && typeof selectedText?.x === 'number' && typeof selectedText?.y === 'number') {
      visibleShapes = visibleShapes.map((s) => {
        if ((s?.type || '') !== 'text') return s;
        if (s?.id !== selectedText.id) return s;
        return { ...s, x1: selectedText.x, y1: selectedText.y, x: selectedText.x, y: selectedText.y };
      });
    }

    for (let i = 0; i < visibleShapes.length; i++) {
      const event = visibleShapes[i];
      if (!event) continue;

      if (event.type === 'line-segment') {
        const strokeColor = event.color;
        const strokeWidth = event.lineWidth;
        const points = [
          { x: event.x1, y: event.y1 },
          { x: event.x2, y: event.y2 },
        ];

        // Merge consecutive segments when they are continuous (same style + same end/start).
        let endX = event.x2;
        let endY = event.y2;
        while (i + 1 < visibleShapes.length) {
          const n = visibleShapes[i + 1];
          if (!n || n.type !== 'line-segment') break;
          if (n.color !== strokeColor) break;
          if (n.lineWidth !== strokeWidth) break;

          const dx = (n.x1 ?? 0) - endX;
          const dy = (n.y1 ?? 0) - endY;
          if (dx * dx + dy * dy > 0.75) break;

          points.push({ x: n.x2, y: n.y2 });
          endX = n.x2;
          endY = n.y2;
          i++;
        }

        drawSmoothStrokePath(ctx, points, strokeColor, strokeWidth);
        continue;
      }

      if (event.type === 'shape-line') {
        drawLineShape(ctx, event);
        continue;
      }
      if (event.type === 'shape-rect') {
        drawRectShape(ctx, event);
        continue;
      }
      if (event.type === 'shape-circle') {
        drawCircleShape(ctx, event);
        continue;
      }
      if (event.type === 'text') {
        const fontSize = event.fontSize || 20;
        ctx.font = `${fontSize}px Arial`;
        ctx.fillStyle = event.color || '#000000';
        const p = getEventPoint(event);
        const txt = (event.text ?? '').toString();
        if (!txt.trim()) continue;
        const m = measureTextBlock(txt, fontSize);
        for (let j = 0; j < m.lines.length; j++) {
          ctx.fillText((m.lines[j] ?? '').toString(), p.x, p.y + j * m.lineHeight);
        }
        continue;
      }
      // clear already handled above
    }
  }, [drawEvents, fallbackLocalEvents, backgroundColor, baseWidth, baseHeight, isDraggingText, selectedText, isMovingSelection, selectedRect, tool, canvasEpoch]); // Re-run when drawEvents/background/size change

  // Canvas size is fixed - no dynamic resizing needed
  // This prevents coordinate drift issues during drawing

  // Canvas dimensions are fixed - no resize observer needed

  // Set up canvas with proper DPI scaling - only runs once since dimensions are fixed
  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas) return;

    const ratio = window.devicePixelRatio || 1;

    canvas.width = Math.max(1, Math.floor(baseWidth * ratio));
    canvas.height = Math.max(1, Math.floor(baseHeight * ratio));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    if (overlay) {
      overlay.width = Math.max(1, Math.floor(baseWidth * ratio));
      overlay.height = Math.max(1, Math.floor(baseHeight * ratio));
      const octx = overlay.getContext('2d');
      octx.setTransform(ratio, 0, 0, ratio, 0, 0);
      octx.clearRect(0, 0, baseWidth, baseHeight);
    }

    // Force initial redraw
    setCanvasEpoch((v) => v + 1);
  }, [baseWidth, baseHeight]);

  // Update display size for zoom (doesn't affect logical coordinates)
  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas) return;

    const w = baseWidth * zoom;
    const h = baseHeight * zoom;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    if (overlay) {
      overlay.style.width = w + 'px';
      overlay.style.height = h + 'px';
    }
  }, [zoom, baseWidth, baseHeight]);

  // --- Helper function for drawing a single segment ---
  const drawSegment = (ctx, segment) => {
    ctx.beginPath();
    ctx.strokeStyle = segment.color;
    ctx.lineWidth = segment.lineWidth;
    ctx.lineCap = 'round';
    // If it's a zero-length segment (click without move) draw a small circle
    if (segment.x1 === segment.x2 && segment.y1 === segment.y2) {
      const r = Math.max(1, segment.lineWidth / 2);
      ctx.fillStyle = segment.color;
      ctx.arc(segment.x1, segment.y1, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.closePath();
      return;
    }
    ctx.moveTo(segment.x1, segment.y1);
    ctx.lineTo(segment.x2, segment.y2);
    ctx.stroke();
    ctx.closePath();
  };

  // --- Shape renderers ---
  const drawLineShape = (ctx, seg) => {
    ctx.beginPath();
    ctx.strokeStyle = seg.color;
    ctx.lineWidth = seg.lineWidth;
    ctx.lineCap = 'round';
    ctx.moveTo(seg.x1, seg.y1);
    ctx.lineTo(seg.x2, seg.y2);
    ctx.stroke();
    ctx.closePath();
  };

  const drawRectShape = (ctx, seg) => {
    ctx.beginPath();
    ctx.strokeStyle = seg.color;
    ctx.lineWidth = seg.lineWidth;
    const x = Math.min(seg.x1, seg.x2);
    const y = Math.min(seg.y1, seg.y2);
    const w = Math.abs(seg.x2 - seg.x1);
    const h = Math.abs(seg.y2 - seg.y1);
    ctx.strokeRect(x, y, w, h);
    ctx.closePath();
  };

  const drawCircleShape = (ctx, seg) => {
    // Interpret x1,y1 as center and x2,y2 as a point on circumference
    const dx = seg.x2 - seg.x1;
    const dy = seg.y2 - seg.y1;
    const r = Math.max(0.5, Math.hypot(dx, dy));
    ctx.beginPath();
    ctx.strokeStyle = seg.color;
    ctx.lineWidth = seg.lineWidth;
    ctx.arc(seg.x1, seg.y1, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.closePath();
  };

  // --- Pointer Event Handlers for LOCAL drawing (works for mouse, touch, stylus) ---
  const getPointerPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    // Use offsetX/offsetY - these are coordinates relative to the target element
    // and are the most reliable for canvas drawing, unaffected by scrolling.
    const offsetX = e.nativeEvent?.offsetX ?? e.offsetX ?? 0;
    const offsetY = e.nativeEvent?.offsetY ?? e.offsetY ?? 0;
    
    return {
      x: offsetX / zoom,
      y: offsetY / zoom
    };
  };

  const drawLocalSegment = (segment) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    drawSegment(ctx, segment);
  };

  const drawLocalSmoothPenTo = (newPoint, strokeColor, strokeWidth) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const cur = penSmoothRef.current;
    if (!cur || !cur.lastPoint || !cur.lastMid) {
      penSmoothRef.current = {
        lastPoint: { x: newPoint.x, y: newPoint.y },
        lastMid: { x: newPoint.x, y: newPoint.y },
      };
      return;
    }

    const lastPoint = cur.lastPoint;
    const lastMid = cur.lastMid;
    const mid = { x: (lastPoint.x + newPoint.x) / 2, y: (lastPoint.y + newPoint.y) / 2 };

    ctx.beginPath();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(lastMid.x, lastMid.y);
    ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, mid.x, mid.y);
    ctx.stroke();
    ctx.closePath();

    penSmoothRef.current = { lastPoint: { x: newPoint.x, y: newPoint.y }, lastMid: mid };
  };

  const drawSmoothStrokePath = (ctx, points, strokeColor, strokeWidth) => {
    if (!ctx || !Array.isArray(points) || points.length < 2) return;

    // Dot (tap/click without movement)
    if (points.length === 2 && points[0].x === points[1].x && points[0].y === points[1].y) {
      const r = Math.max(1, strokeWidth / 2);
      ctx.beginPath();
      ctx.fillStyle = strokeColor;
      ctx.arc(points[0].x, points[0].y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.closePath();
      return;
    }

    ctx.beginPath();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.moveTo(points[0].x, points[0].y);
    if (points.length === 2) {
      ctx.lineTo(points[1].x, points[1].y);
    } else {
      for (let i = 1; i < points.length - 2; i++) {
        const p = points[i];
        const next = points[i + 1];
        const mid = { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 };
        ctx.quadraticCurveTo(p.x, p.y, mid.x, mid.y);
      }
      const p1 = points[points.length - 2];
      const p2 = points[points.length - 1];
      ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
    }
    ctx.stroke();
    ctx.closePath();
  };

  const startDrawing = (e) => {
    // Avoid browser default actions (touch scrolling, text selection) while drawing/panning.
    // Don't block the Text tool's click behavior.
    if (tool !== 'text' && e && e.preventDefault) e.preventDefault();

    // Text tool uses click + modal (no pointer-down gesture)
    if (tool === 'text') return;

    // iPad-like behavior: finger/touch pans the canvas so you don't accidentally draw.
    // Mouse + pen follow the selected tool.
    const shouldPan = tool === 'hand' || (e && e.pointerType === 'touch' && tool !== 'text' && tool !== 'select-erase');

    if (shouldPan) {
      const stage = stageRef.current;
      if (!stage) return;
      try { e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); } catch (err) {}
      setIsPanning(true);
      didPanRef.current = false;
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: stage.scrollLeft,
        scrollTop: stage.scrollTop,
      };
      return;
    }

    // capture pointer so we continue receiving events even if pointer leaves canvas
    try { e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); } catch (err) {}
    setIsDrawing(true);
    isDrawingRef.current = true;
    const pos = getPointerPos(e);
    lastPosRef.current = pos;

    if (tool === 'select-erase') {
      // If a text is selected and user presses inside the selection, start dragging the text.
      if (selectedText?.id && selectedRect && pointInRect(pos, selectedRect, 6)) {
        // Clear any hover/overlay rectangles so we don't leave a "previous box" behind.
        setHoverRect(null);
        const overlay = overlayRef.current;
        if (overlay) {
          const octx = overlay.getContext('2d');
          octx.clearRect(0, 0, baseWidth, baseHeight);
        }
        setIsDraggingText(true);
        textDragRef.current = {
          startX: pos.x,
          startY: pos.y,
          origX: selectedText.x,
          origY: selectedText.y,
          origRect: { ...selectedRect },
        };
        return;
      }

      // If a normal selection exists and user presses inside it, start moving the selection.
      if (selectedRect && pointInRect(pos, selectedRect, 6)) {
        setHoverRect(null);
        const overlay = overlayRef.current;
        if (overlay) {
          const octx = overlay.getContext('2d');
          octx.clearRect(0, 0, baseWidth, baseHeight);
        }
        setIsMovingSelection(true);
        selectionMoveRef.current = {
          startX: pos.x,
          startY: pos.y,
          origRect: { ...selectedRect },
          moved: false,
        };
        return;
      }

      // Start a click/drag selection.
      selectDragRef.current = false;
      selectStartRef.current = pos;
      return;
    }

    if (tool === 'eraser') {
      const eraserRadius = Math.max(6, Math.round(lineWidth * 2));
      const erasePayload = {
        type: 'erase',
        x1: pos.x,
        y1: pos.y,
        lineWidth: eraserRadius,
      };
      recordLocalEvent(erasePayload);
      sendDrawEvent(erasePayload);
      return;
    }

    if (tool === 'pen') {
      // Draw an immediate dot where user pressed (handles click without move)
      const dotPayload = {
        type: 'line-segment',
        x1: pos.x,
        y1: pos.y,
        x2: pos.x,
        y2: pos.y,
        color: color,
        lineWidth: lineWidth
      };
      drawLocalSegment(dotPayload);
      // Keep local history in sync so redraw effect doesn't erase the dot before server echo
      recordLocalEvent(dotPayload);
      sendDrawEvent(dotPayload);

      // Initialize smoothing state for this stroke
      penSmoothRef.current = { lastPoint: { x: pos.x, y: pos.y }, lastMid: { x: pos.x, y: pos.y } };
    } else {
      // Shapes: no immediate draw, prepare overlay
      const overlay = overlayRef.current;
      if (overlay) {
        const octx = overlay.getContext('2d');
        octx.clearRect(0, 0, baseWidth, baseHeight);
      }
      // Remember where the shape started
      shapeStartRef.current = pos;
    }
  };

  const draw = (e) => {
    if ((isDrawing || isPanning) && e && e.preventDefault) e.preventDefault();
    if (isPanning) {
      const stage = stageRef.current;
      const start = panStartRef.current;
      if (!stage || !start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!didPanRef.current && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        didPanRef.current = true;
      }
      stage.scrollLeft = start.scrollLeft - dx;
      stage.scrollTop = start.scrollTop - dy;
      return;
    }
    const newPos = getPointerPos(e);

    if (tool === 'select-erase' && isDraggingText && textDragRef.current) {
      const dx = newPos.x - textDragRef.current.startX;
      const dy = newPos.y - textDragRef.current.startY;
      const r0 = textDragRef.current.origRect;
      setSelectedRect({ x1: r0.x1 + dx, y1: r0.y1 + dy, x2: r0.x2 + dx, y2: r0.y2 + dy });
      if (selectedText?.id) {
        const nx = textDragRef.current.origX + dx;
        const ny = textDragRef.current.origY + dy;
        setSelectedText({ id: selectedText.id, x: nx, y: ny });
      }

      // Keep overlay clear during text drag (prevents stale hover box).
      setHoverRect(null);
      const overlay = overlayRef.current;
      if (overlay) {
        const octx = overlay.getContext('2d');
        octx.clearRect(0, 0, baseWidth, baseHeight);
      }
      return;
    }

    if (tool === 'select-erase' && isMovingSelection && selectionMoveRef.current) {
      const dx = newPos.x - selectionMoveRef.current.startX;
      const dy = newPos.y - selectionMoveRef.current.startY;
      if (!selectionMoveRef.current.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        selectionMoveRef.current.moved = true;
      }
      const r0 = selectionMoveRef.current.origRect;
      setSelectedRect({ x1: r0.x1 + dx, y1: r0.y1 + dy, x2: r0.x2 + dx, y2: r0.y2 + dy });

      // Keep overlay clear during selection move.
      setHoverRect(null);
      const overlay = overlayRef.current;
      if (overlay) {
        const octx = overlay.getContext('2d');
        octx.clearRect(0, 0, baseWidth, baseHeight);
      }
      return;
    }

    // Select tool should not draw any rectangle until the user presses down.
    // (Fixes the "automatic rectangle" appearing before clicking.)
    if (!isDrawing && !isPanning && tool === 'select-erase') return;

    if (!isDrawing) return;
    const lastPos = lastPosRef.current || newPos;

    if (tool === 'select-erase') {
      const start = selectStartRef.current || newPos;
      const dx = newPos.x - start.x;
      const dy = newPos.y - start.y;
      if (!selectDragRef.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        selectDragRef.current = true;
      }
      if (selectDragRef.current) {
        const overlay = overlayRef.current;
        if (!overlay) return;
        const octx = overlay.getContext('2d');
        drawSelectionRect(octx, start, newPos);
      }
      return;
    }
    if (tool === 'eraser') {
      const dx = newPos.x - lastPos.x;
      const dy = newPos.y - lastPos.y;
      if (dx * dx + dy * dy < 6) {
        return;
      }
      const eraserRadius = Math.max(6, Math.round(lineWidth * 2));
      const erasePayload = {
        type: 'erase',
        x1: newPos.x,
        y1: newPos.y,
        lineWidth: eraserRadius,
      };
      recordLocalEvent(erasePayload);
      sendDrawEvent(erasePayload);
      lastPosRef.current = newPos;
      return;
    }

    if (tool === 'pen') {
      // Skip sending extremely tiny movements to reduce flooding
      const dx = newPos.x - lastPos.x;
      const dy = newPos.y - lastPos.y;
      if (dx*dx + dy*dy < 0.5) { // movement threshold
        return;
      }
      const payload = {
        type: 'line-segment',
        x1: lastPos.x,
        y1: lastPos.y,
        x2: newPos.x,
        y2: newPos.y,
        color: color,
        lineWidth: lineWidth
      };
      drawLocalSmoothPenTo(newPos, color, lineWidth);
      // Add to local history immediately so re-render preserves what user sees
      recordLocalEvent(payload);
      sendDrawEvent(payload);
      lastPosRef.current = newPos;
      return;
    }
    // Shape preview (local overlay only)
    const overlay = overlayRef.current;
    if (!overlay) return;
    const octx = overlay.getContext('2d');
    octx.clearRect(0, 0, baseWidth, baseHeight);
    const start = shapeStartRef.current || newPos;
    const preview = { x1: start.x, y1: start.y, x2: newPos.x, y2: newPos.y, color, lineWidth };
    if (tool === 'line') drawLineShape(octx, preview);
    else if (tool === 'rect') drawRectShape(octx, preview);
    else if (tool === 'circle') drawCircleShape(octx, preview);
    // We no longer broadcast previews to simplify and ensure stability
  };

  const stopDrawing = (e) => {
    if ((isDrawing || isPanning) && e && e.preventDefault) e.preventDefault();
    
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
      try { e && e.target && e.target.releasePointerCapture && e.target.releasePointerCapture(e.pointerId); } catch (err) {}
      return;
    }

    setIsDrawing(false);
    isDrawingRef.current = false;

    // Finish the last half-segment so the live stroke reaches the pointer.
    if (tool === 'pen' && penSmoothRef.current?.lastMid && penSmoothRef.current?.lastPoint) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const lm = penSmoothRef.current.lastMid;
        const lp = penSmoothRef.current.lastPoint;
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo(lm.x, lm.y);
        ctx.quadraticCurveTo(lp.x, lp.y, lp.x, lp.y);
        ctx.stroke();
        ctx.closePath();
      }
    }
    penSmoothRef.current = null;
    try { e && e.target.releasePointerCapture && e.target.releasePointerCapture(e.pointerId); } catch (err) {}
    const end = e ? getPointerPos(e) : (lastPosRef.current || shapeStartRef.current);
    const start = shapeStartRef.current;
    lastPosRef.current = null;
    if (tool === 'pen' || tool === 'eraser') {
      shapeStartRef.current = null;
      return;
    }

    if (tool === 'select-erase') {
      if (isMovingSelection && selectionMoveRef.current && end) {
        const dx = end.x - selectionMoveRef.current.startX;
        const dy = end.y - selectionMoveRef.current.startY;
        const r0 = selectionMoveRef.current.origRect;
        const moved = !!selectionMoveRef.current.moved;

        setIsMovingSelection(false);
        selectionMoveRef.current = null;
        setHoverRect(null);

        const overlay = overlayRef.current;
        if (overlay) {
          const octx = overlay.getContext('2d');
          octx.clearRect(0, 0, baseWidth, baseHeight);
        }

        if (moved) {
          const payload = {
            type: 'move-rect',
            x1: r0.x1,
            y1: r0.y1,
            x2: r0.x2,
            y2: r0.y2,
            dx,
            dy,
            lineWidth: 1,
          };
          recordLocalEvent(payload);
          sendDrawEvent(payload);
        } else {
          // If it was just a click, keep the original selection rectangle.
          setSelectedRect({ ...r0 });
        }
        return;
      }

      if (isDraggingText && selectedText?.id && textDragRef.current && end) {
        const dx = end.x - textDragRef.current.startX;
        const dy = end.y - textDragRef.current.startY;
        const nx = textDragRef.current.origX + dx;
        const ny = textDragRef.current.origY + dy;
        const payload = { type: 'text-move', targetId: selectedText.id, x1: nx, y1: ny, x2: 0, y2: 0, lineWidth: 1 };
        recordLocalEvent(payload);
        // Text moves are local-only (not broadcast)
        setSelectedText({ id: selectedText.id, x: nx, y: ny });
        setIsDraggingText(false);
        textDragRef.current = null;

        // Ensure no stale overlay boxes remain after a move.
        setHoverRect(null);
        const overlay = overlayRef.current;
        if (overlay) {
          const octx = overlay.getContext('2d');
          octx.clearRect(0, 0, baseWidth, baseHeight);
        }
        return;
      }

      const selStart = selectStartRef.current;
      selectStartRef.current = null;
      const overlay = overlayRef.current;
      if (overlay) {
        const octx = overlay.getContext('2d');
        octx.clearRect(0, 0, baseWidth, baseHeight);
      }
      if (selStart && end) {
        if (selectDragRef.current) {
          const r = rectNorm({ x1: selStart.x, y1: selStart.y, x2: end.x, y2: end.y });
          if (r.w >= 4 && r.h >= 4) {
            setSelectedRect({ x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2 });
            setHoverRect(null);
            setSelectedText(null);
          }
        } else {
          const picked = pickTopmostShapeAtCursor(end.x, end.y);
          setSelectedRect(picked ? picked.rect : null);
          setHoverRect(null);
          if (picked && (picked.shape?.type || '') === 'text' && picked.shape?.id) {
            const p = getEventPoint(picked.shape);
            setSelectedText({ id: picked.shape.id, x: p.x, y: p.y });
          } else {
            setSelectedText(null);
          }
        }
      }
      shapeStartRef.current = null;
      return;
    }
    const overlay = overlayRef.current;
    if (overlay) {
      const octx = overlay.getContext('2d');
      octx.clearRect(0, 0, baseWidth, baseHeight);
    }
    if (!start || !end) {
      shapeStartRef.current = null;
      return;
    }
    let payload;
    if (tool === 'line') payload = { type: 'shape-line', x1: start.x, y1: start.y, x2: end.x, y2: end.y, color, lineWidth };
    else if (tool === 'rect') payload = { type: 'shape-rect', x1: start.x, y1: start.y, x2: end.x, y2: end.y, color, lineWidth };
    else if (tool === 'circle') payload = { type: 'shape-circle', x1: start.x, y1: start.y, x2: end.x, y2: end.y, color, lineWidth };
    if (payload) {
      const ctx = canvasRef.current.getContext('2d');
      if (tool === 'line') drawLineShape(ctx, payload);
      else if (tool === 'rect') drawRectShape(ctx, payload);
      else if (tool === 'circle') drawCircleShape(ctx, payload);
      // Add locally so it persists even if server echo is delayed
      addLocalDrawEvent && addLocalDrawEvent(payload);
      sendDrawEvent(payload);
    }
    shapeStartRef.current = null;
  };

  // Render remote preview on overlay
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const octx = overlay.getContext('2d');
    octx.clearRect(0, 0, baseWidth, baseHeight);
    if (!previewShape) return;
    const t = previewShape.type || '';
    const seg = previewShape;
    if (t.endsWith('line')) drawLineShape(octx, seg);
    else if (t.endsWith('rect')) drawRectShape(octx, seg);
    else if (t.endsWith('circle')) drawCircleShape(octx, seg);
  }, [previewShape, baseWidth, baseHeight]);

  // --- Text Tool Handlers ---
  const handleCanvasClick = (e) => {
    // Close export menu when clicking canvas
    if (showExportMenu) {
      setShowExportMenu(false);
    }

    // If the last gesture was a pan/drag, don't treat it as a click (prevents accidental text placement).
    if (didPanRef.current) {
      didPanRef.current = false;
      return;
    }
    
    if (tool === 'text' && !isDrawing && !isPanning) {
      const pos = getPointerPos(e);
      setTextPosition(pos);
      setTextInput('');
      setShowTextModal(true);
    }
  };

  // If user switches away from the Text tool, close the text editor.
  useEffect(() => {
    if (tool !== 'text' && showTextModal) {
      setShowTextModal(false);
      setTextInput('');
      setTextPosition(null);
    }
  }, [tool, showTextModal]);

  // Hover outline for Select tool removed (it looked like an automatic selection rectangle).

  const fontSizePx = lineWidth * 4;

  // --- Export Handlers ---
  const safeFilenamePart = (value, fallback) => {
    const v = (value || '').toString().trim();
    if (!v) return fallback;
    return v
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .slice(0, 40) || fallback;
  };

  const exportStamp = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  };

  const exportBaseName = () => {
    const u = safeFilenamePart(userName, 'user');
    const c = safeFilenamePart(channelName, 'channel');
    return `${u}-${c}-${exportStamp()}`;
  };

  const handleExportPNG = async () => {
    try {
      const canvas = canvasRef.current;
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${exportBaseName()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Exported as PNG!');
    } catch (error) {
      toast.error('Export failed!');
    }
  };

  const handleExportPDF = async () => {
    try {
      const canvas = canvasRef.current;
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: baseWidth >= baseHeight ? 'landscape' : 'portrait',
        unit: 'px',
        format: [baseWidth, baseHeight]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, baseWidth, baseHeight);
      pdf.save(`${exportBaseName()}.pdf`);
      toast.success('Exported as PDF!');
    } catch (error) {
      toast.error('Export failed!');
    }
  };

  // Canvas has fixed size - no expansion needed
  const handleStageScroll = () => {
    // No-op: canvas size is fixed
  };

  // --- Toolbar Handlers ---
  const handleClear = () => {
    // Immediate local clear via sending clear event; parent now clears state instantly
    sendDrawEvent({ type: 'clear' });
    if (!hasExternalLocalBuffer) setFallbackLocalEvents([]);
    // Additionally clear the visual canvas directly for redundancy
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Re-fill background color so cleared board keeps chosen background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, baseWidth, baseHeight);
  };

  const clampZoom = (value) => Math.max(0.5, Math.min(2.5, value));
  const zoomOut = () => setZoom((z) => clampZoom(Math.round((z - 0.25) * 100) / 100));
  const zoomIn = () => setZoom((z) => clampZoom(Math.round((z + 0.25) * 100) / 100));
  const resetZoom = () => setZoom(1);

  return (
    <div className="canvas-container">
      <Toaster position="top-right" />
      <div className="canvas-toolbar">
        <div className="tool-group">
          <label htmlFor="color-picker">Color:</label>
          <input
            id="color-picker"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </div>
        <div className="tool-group">
          <label htmlFor="line-width">Width:</label>
          <input
            id="line-width"
            type="range"
            min="1"
            max="30"
            value={lineWidth}
            onChange={(e) => setLineWidth(parseInt(e.target.value, 10))}
          />
          <span>{lineWidth}</span>
        </div>
      
        <div className="tool-group">
          <label htmlFor="bg-color-picker">Board BG:</label>
          <input
            id="bg-color-picker"
            type="color"
            value={backgroundColor}
            onChange={(e) => setBackgroundColor(e.target.value)}
          />
        </div>

        <div className="tool-group">
          <label>Zoom:</label>
          <div className="tool-buttons">
            <button type="button" onClick={zoomOut} title="Zoom out">−</button>
            <button type="button" onClick={resetZoom} title="Reset zoom">
              {Math.round(zoom * 100)}%
            </button>
            <button type="button" onClick={zoomIn} title="Zoom in">+</button>
          </div>
        </div>

        <div className="tool-buttons tool-icons">
          <button 
            className={tool === 'pen' ? 'active' : ''} 
            onClick={() => setTool('pen')}
            title="Pen"
          >
            <FaPen />
            {tool === 'pen' && <span className="tool-icon-label">{toolLabel('pen')}</span>}
          </button>
          <button
            className={tool === 'hand' ? 'active' : ''}
            onClick={() => setTool('hand')}
            title="Drag / Pan"
          >
            <FaHandPaper />
            {tool === 'hand' && <span className="tool-icon-label">{toolLabel('hand')}</span>}
          </button>
          <button 
            className={tool === 'line' ? 'active' : ''} 
            onClick={() => setTool('line')}
            title="Line"
          >
            <FaMinus />
            {tool === 'line' && <span className="tool-icon-label">{toolLabel('line')}</span>}
          </button>
          <button 
            className={tool === 'rect' ? 'active' : ''} 
            onClick={() => setTool('rect')}
            title="Rectangle"
          >
            <FaSquare />
            {tool === 'rect' && <span className="tool-icon-label">{toolLabel('rect')}</span>}
          </button>
          <button 
            className={tool === 'circle' ? 'active' : ''} 
            onClick={() => setTool('circle')}
            title="Circle"
          >
            <FaCircle />
            {tool === 'circle' && <span className="tool-icon-label">{toolLabel('circle')}</span>}
          </button>
          <button 
            className={tool === 'text' ? 'active' : ''} 
            onClick={() => setTool('text')}
            title="Text"
          >
            <FaFont />
            {tool === 'text' && <span className="tool-icon-label">{toolLabel('text')}</span>}
          </button>
          <button 
            className={tool === 'eraser' ? 'active' : ''} 
            onClick={() => setTool('eraser')}
            title="Eraser"
          >
            <FaEraser />
            {tool === 'eraser' && <span className="tool-icon-label">{toolLabel('eraser')}</span>}
          </button>
          <button
            className={tool === 'select-erase' ? 'active' : ''}
            onClick={() => setTool('select-erase')}
            title="Select to Delete"
          >
            <FaRegSquare />
            {tool === 'select-erase' && <span className="tool-icon-label">{toolLabel('select-erase')}</span>}
          </button>
        </div>

        <button onClick={handleClear} className="clear-btn" title="Clear All">
          <FaTrash /> Clear
        </button>

        <button 
          onClick={handleExportPNG} 
          className="export-png-btn"
          title="Export as PNG"
        >
          <FaFileDownload /> PNG
        </button>

        <button 
          onClick={handleExportPDF} 
          className="export-pdf-btn"
          title="Export as PDF"
        >
          <FaFileDownload /> PDF
        </button>
      </div>

      <div
        className={`canvas-stage${isPanning ? ' panning' : ''}`}
        ref={stageRef}
        onScroll={handleStageScroll}
      >
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {tool === 'text' && showTextModal && textPosition && (
            <div
              className="text-float-editor"
              style={(() => {
                const maxW = 260;
                const maxH = 54;
                const maxLeft = Math.max(0, Math.round(baseWidth * zoom) - maxW);
                const maxTop = Math.max(0, Math.round(baseHeight * zoom) - maxH);
                const left = Math.min(maxLeft, Math.max(0, Math.round(textPosition.x * zoom)));
                const top = Math.min(maxTop, Math.max(0, Math.round(textPosition.y * zoom) - 10));
                return { left, top };
              })()}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleTextSubmit();
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setShowTextModal(false);
                    setTextInput('');
                    setTextPosition(null);
                  }
                }}
              />
              <button
                type="button"
                className="text-float-cancel"
                title="Cancel"
                onClick={() => {
                  setShowTextModal(false);
                  setTextInput('');
                  setTextPosition(null);
                }}
              >
                ✕
              </button>
            </div>
          )}
          {tool === 'select-erase' && selectedRect && (
            <div
              className={`selected-rect-outline${isDraggingText ? ' dragging' : ''}`}
              style={(() => {
                const r = rectNorm(selectedRect);
                return {
                  left: Math.max(0, Math.round(r.x * zoom)),
                  top: Math.max(0, Math.round(r.y * zoom)),
                  width: Math.max(0, Math.round(r.w * zoom)),
                  height: Math.max(0, Math.round(r.h * zoom)),
                };
              })()}
            />
          )}
          {tool === 'select-erase' && selectedRect && !isDraggingText && (
            <div
              className="selection-actions"
              style={(() => {
                const r = rectNorm(selectedRect);
                const canvasCssW = Math.max(1, Math.round(baseWidth * zoom));
                const canvasCssH = Math.max(1, Math.round(baseHeight * zoom));

                const popupW = 160; // approx, keeps it inside the canvas
                const popupH = 44;
                const margin = 8;

                // Prefer placing above the selection, otherwise below.
                const topAbove = Math.round(r.y * zoom) - popupH - margin;
                const topBelow = Math.round((r.y + r.h) * zoom) + margin;
                const top = topAbove >= margin ? topAbove : Math.min(canvasCssH - popupH - margin, topBelow);

                const leftPreferred = Math.round(r.x * zoom) + margin;
                const left = Math.min(canvasCssW - popupW - margin, Math.max(margin, leftPreferred));

                return { left, top };
              })()}
            >
              <button type="button" onClick={deleteSelected} title="Delete">
                Delete
              </button>
              <button type="button" onClick={clearSelection} title="Close">
                ✕
              </button>
            </div>
          )}
          <canvas
            ref={canvasRef}
            width={baseWidth}
            height={baseHeight}
            className={`whiteboard-canvas${tool === 'hand' ? ' hand' : ''}${tool === 'text' ? ' text' : ''}${isPanning ? ' panning' : ''}`}
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={stopDrawing}
            onPointerCancel={stopDrawing}
            onPointerLeave={stopDrawing}
            onClick={handleCanvasClick}
          />
          <canvas
            ref={overlayRef}
            width={baseWidth}
            height={baseHeight}
            className="overlay-canvas"
          />
        </div>
      </div>
    </div>
  );
}

export default Canvas;