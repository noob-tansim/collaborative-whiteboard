import React, { memo, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import './Canvas.css';

function Canvas({ drawEvents, sendDrawEvent, previewShape, addLocalDrawEvent }) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const lastPosRef = useRef(null);
  const shapeStartRef = useRef(null);
  const rafIdRef = useRef(null);
  const pendingSegmentRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // --- Toolbar State ---
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(5);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const initialBackgroundColor = useRef(backgroundColor);
  const [tool, setTool] = useState('pen'); // 'pen' | 'eraser' | 'line' | 'rect' | 'circle'

  // Make canvas crisp on HiDPI displays and set up initial size (ONLY on mount)
  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    const ratio = window.devicePixelRatio || 1;
    const baseWidth = 900;
    const baseHeight = 600;

    canvas.width = baseWidth * ratio;
    canvas.height = baseHeight * ratio;
    canvas.style.width = baseWidth + 'px';
    canvas.style.height = baseHeight + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.fillStyle = initialBackgroundColor.current;
    ctx.fillRect(0, 0, baseWidth, baseHeight);

    if (overlay) {
      overlay.width = baseWidth * ratio;
      overlay.height = baseHeight * ratio;
      overlay.style.width = baseWidth + 'px';
      overlay.style.height = baseHeight + 'px';
      const octx = overlay.getContext('2d');
      octx.scale(ratio, ratio);
    }
  }, []); // Empty dependency array - run only once on mount

  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  // --- Helper function for drawing a single segment ---
  const drawSegment = useCallback((ctx, segment) => {
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
  }, []);

  // --- Shape renderers ---
  const drawLineShape = useCallback((ctx, seg) => {
    ctx.beginPath();
    ctx.strokeStyle = seg.color;
    ctx.lineWidth = seg.lineWidth;
    ctx.lineCap = 'round';
    ctx.moveTo(seg.x1, seg.y1);
    ctx.lineTo(seg.x2, seg.y2);
    ctx.stroke();
    ctx.closePath();
  }, []);

  const drawRectShape = useCallback((ctx, seg) => {
    ctx.beginPath();
    ctx.strokeStyle = seg.color;
    ctx.lineWidth = seg.lineWidth;
    const x = Math.min(seg.x1, seg.x2);
    const y = Math.min(seg.y1, seg.y2);
    const w = Math.abs(seg.x2 - seg.x1);
    const h = Math.abs(seg.y2 - seg.y1);
    ctx.strokeRect(x, y, w, h);
    ctx.closePath();
  }, []);

  const drawCircleShape = useCallback((ctx, seg) => {
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
  }, []);

  // --- Pointer Event Handlers for LOCAL drawing (works for mouse, touch, stylus) ---
  const getPointerPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    // Use clientX/clientY for pointer events
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const drawLocalSegment = useCallback((segment) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    drawSegment(ctx, segment);
  }, [drawSegment]);

  // Redraw remote events whenever history changes
  // Optimize: Only redraw if drawEvents actually changed (not just reference)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const baseWidth = 900;
    const baseHeight = 600;
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, baseWidth, baseHeight);

    // Only redraw if we have a reasonable number of events
    // Limit to last 500 events for performance on long sessions
    const recentEvents = drawEvents.slice(-500);
    
    recentEvents.forEach(event => {
      if (event.type === 'line-segment') {
        drawSegment(ctx, event);
      } else if (event.type === 'shape-line') {
        drawLineShape(ctx, event);
      } else if (event.type === 'shape-rect') {
        drawRectShape(ctx, event);
      } else if (event.type === 'shape-circle') {
        drawCircleShape(ctx, event);
      }
    });
  }, [drawEvents, backgroundColor, drawSegment, drawLineShape, drawRectShape, drawCircleShape]);

  const flushPendingSegment = useCallback(() => {
    if (!pendingSegmentRef.current) {
      rafIdRef.current = null;
      return;
    }
    const segment = pendingSegmentRef.current;
    pendingSegmentRef.current = null;
    drawLocalSegment(segment);
    addLocalDrawEvent && addLocalDrawEvent(segment);
    sendDrawEvent(segment);
    rafIdRef.current = null;
  }, [addLocalDrawEvent, sendDrawEvent, drawLocalSegment]);

  const queueSegment = useCallback((segment) => {
    pendingSegmentRef.current = segment;
    if (!rafIdRef.current) {
      rafIdRef.current = requestAnimationFrame(flushPendingSegment);
    }
  }, [flushPendingSegment]);

  const startDrawing = (e) => {
    // capture pointer so we continue receiving events even if pointer leaves canvas
    try { e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); } catch (err) {}
    setIsDrawing(true);
    const pos = getPointerPos(e);
    lastPosRef.current = pos;

    if (tool === 'pen' || tool === 'eraser') {
      // Draw an immediate dot where user pressed (handles click without move)
      const dotPayload = {
        type: 'line-segment',
        x1: pos.x,
        y1: pos.y,
        x2: pos.x,
        y2: pos.y,
        color: tool === 'eraser' ? backgroundColor : color,
        lineWidth: lineWidth
      };
      queueSegment(dotPayload);
    } else {
      // Shapes: no immediate draw, prepare overlay
      const overlay = overlayRef.current;
      if (overlay) {
        const octx = overlay.getContext('2d');
        octx.clearRect(0, 0, 900, 600);
      }
      // Remember where the shape started
      shapeStartRef.current = pos;
    }
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const newPos = getPointerPos(e);
    const lastPos = lastPosRef.current || newPos;
    if (tool === 'pen' || tool === 'eraser') {
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
        color: tool === 'eraser' ? backgroundColor : color,
        lineWidth: lineWidth
      };
      queueSegment(payload);
      lastPosRef.current = newPos;
      return;
    }
    // Shape preview (local overlay only)
    const overlay = overlayRef.current;
    if (!overlay) return;
    const octx = overlay.getContext('2d');
    octx.clearRect(0, 0, 900, 600);
    const start = shapeStartRef.current || newPos;
    const preview = { x1: start.x, y1: start.y, x2: newPos.x, y2: newPos.y, color, lineWidth };
    if (tool === 'line') drawLineShape(octx, preview);
    else if (tool === 'rect') drawRectShape(octx, preview);
    else if (tool === 'circle') drawCircleShape(octx, preview);
    // We no longer broadcast previews to simplify and ensure stability
  };

  const stopDrawing = (e) => {
    setIsDrawing(false);
    try { e && e.target.releasePointerCapture && e.target.releasePointerCapture(e.pointerId); } catch (err) {}
    const end = e ? getPointerPos(e) : (lastPosRef.current || shapeStartRef.current);
    const start = shapeStartRef.current;
    lastPosRef.current = null;
    if (tool === 'pen' || tool === 'eraser') {
      if (pendingSegmentRef.current) {
        flushPendingSegment();
      }
      shapeStartRef.current = null;
      return;
    }
    const overlay = overlayRef.current;
    if (overlay) {
      const octx = overlay.getContext('2d');
      octx.clearRect(0, 0, 900, 600);
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
    octx.clearRect(0, 0, 900, 600);
    if (!previewShape) return;
    const t = previewShape.type || '';
    const seg = previewShape;
    if (t.endsWith('line')) drawLineShape(octx, seg);
    else if (t.endsWith('rect')) drawRectShape(octx, seg);
    else if (t.endsWith('circle')) drawCircleShape(octx, seg);
  }, [previewShape, drawLineShape, drawRectShape, drawCircleShape]);

  // --- Toolbar Handlers ---
  const handleClear = () => {
    // Immediate local clear via sending clear event; parent now clears state instantly
    sendDrawEvent({ type: 'clear' });
    // Additionally clear the visual canvas directly for redundancy
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const baseWidth = 900;
    const baseHeight = 600;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Re-fill background color so cleared board keeps chosen background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, baseWidth, baseHeight);
  };

  return (
    <div className="canvas-container">
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
            // THIS IS THE FIX: Convert the string value to an integer
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
        <button className={tool==='pen'?'active':''} onClick={() => setTool('pen')}>Pen</button>
        <button className={tool==='line'?'active':''} onClick={() => setTool('line')}>Line</button>
        <button className={tool==='rect'?'active':''} onClick={() => setTool('rect')}>Rectangle</button>
        <button className={tool==='circle'?'active':''} onClick={() => setTool('circle')}>Circle</button>
        <button className={tool==='eraser'?'active':''} onClick={() => setTool('eraser')}>Eraser</button>
        <button onClick={handleClear}>Clear All</button>
      </div>
      <div className="canvas-stage">
        <canvas
          ref={canvasRef}
          width={900}
          height={600}
          className="whiteboard-canvas"
          // Pointer events for cross-device input
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
        />
        <canvas
          ref={overlayRef}
          width={900}
          height={600}
          className="overlay-canvas"
        />
      </div>
    </div>
  );
}

export default memo(Canvas);