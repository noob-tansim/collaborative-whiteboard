import React, { useRef, useEffect, useState } from 'react';
import './Canvas.css';
import { FaPen, FaEraser, FaMinus, FaSquare, FaCircle, FaTrash, FaFileDownload, FaFont } from 'react-icons/fa';
import jsPDF from 'jspdf';
import toast, { Toaster } from 'react-hot-toast';

function Canvas({ drawEvents, sendDrawEvent, previewShape, addLocalDrawEvent }) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const lastPosRef = useRef(null);
  const shapeStartRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // --- Toolbar State ---
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(5);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [tool, setTool] = useState('pen'); // 'pen' | 'eraser' | 'line' | 'rect' | 'circle' | 'text'
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showTextModal, setShowTextModal] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textPosition, setTextPosition] = useState(null);

  // This effect is for REDRAWING when remote events come in
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Clear and fill background first
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Fill logical size (we scaled for DPR already)
    const baseWidth = 1200;
    const baseHeight = 700;
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, baseWidth, baseHeight);

    // Redraw ALL events from the history
    drawEvents.forEach(event => {
      if (event.type === 'line-segment') {
        drawSegment(ctx, event);
      } else if (event.type === 'shape-line') {
        drawLineShape(ctx, event);
      } else if (event.type === 'shape-rect') {
        drawRectShape(ctx, event);
      } else if (event.type === 'shape-circle') {
        drawCircleShape(ctx, event);
      } else if (event.type === 'text') {
        // Draw text events
        ctx.font = `${event.fontSize || 20}px Arial`;
        ctx.fillStyle = event.color;
        ctx.fillText(event.text, event.x, event.y);
      } else if (event.type === 'clear') {
        // Already cleared above by state reset, keep background
      }
    });
  }, [drawEvents, backgroundColor]); // Re-run when drawEvents or background changes

  // Make canvas crisp on HiDPI displays and set up initial size (ONLY on mount)
  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    
    const updateCanvasSize = () => {
      const ratio = window.devicePixelRatio || 1;
      // base size (logical dimensions)
      const baseWidth = 1200;
      const baseHeight = 700;
      
      canvas.width = baseWidth * ratio;
      canvas.height = baseHeight * ratio;
      canvas.style.width = baseWidth + 'px';
      canvas.style.height = baseHeight + 'px';
      
      const ctx = canvas.getContext('2d');
      ctx.scale(ratio, ratio);
      // Initial fill background
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, baseWidth, baseHeight);

      if (overlay) {
        overlay.width = baseWidth * ratio;
        overlay.height = baseHeight * ratio;
        overlay.style.width = baseWidth + 'px';
        overlay.style.height = baseHeight + 'px';
        const octx = overlay.getContext('2d');
        octx.scale(ratio, ratio);
      }
    };
    
    updateCanvasSize();
  }, []); // Empty dependency array - run only once on mount

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
    const rect = canvasRef.current.getBoundingClientRect();
    // Use clientX/clientY for pointer events
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const drawLocalSegment = (segment) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    drawSegment(ctx, segment);
  };

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
      drawLocalSegment(dotPayload);
      // Keep local history in sync so redraw effect doesn't erase the dot before server echo
      addLocalDrawEvent && addLocalDrawEvent(dotPayload);
      sendDrawEvent(dotPayload);
    } else {
      // Shapes: no immediate draw, prepare overlay
      const overlay = overlayRef.current;
      if (overlay) {
        const octx = overlay.getContext('2d');
        octx.clearRect(0, 0, 1200, 700);
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
      drawLocalSegment(payload);
      // Add to local history immediately so re-render preserves what user sees
      addLocalDrawEvent && addLocalDrawEvent(payload);
      sendDrawEvent(payload);
      lastPosRef.current = newPos;
      return;
    }
    // Shape preview (local overlay only)
    const overlay = overlayRef.current;
    if (!overlay) return;
    const octx = overlay.getContext('2d');
    octx.clearRect(0, 0, 1200, 700);
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
      shapeStartRef.current = null;
      return;
    }
    const overlay = overlayRef.current;
    if (overlay) {
      const octx = overlay.getContext('2d');
      octx.clearRect(0, 0, 1200, 700);
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
    octx.clearRect(0, 0, 1200, 700);
    if (!previewShape) return;
    const t = previewShape.type || '';
    const seg = previewShape;
    if (t.endsWith('line')) drawLineShape(octx, seg);
    else if (t.endsWith('rect')) drawRectShape(octx, seg);
    else if (t.endsWith('circle')) drawCircleShape(octx, seg);
  }, [previewShape]);

  // --- Text Tool Handlers ---
  const handleCanvasClick = (e) => {
    // Close export menu when clicking canvas
    if (showExportMenu) {
      setShowExportMenu(false);
    }
    
    if (tool === 'text' && !isDrawing) {
      const pos = getPointerPos(e);
      setTextPosition(pos);
      setShowTextModal(true);
    }
  };

  const handleTextSubmit = () => {
    if (!textInput.trim() || !textPosition) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Draw text on canvas
    ctx.font = `${lineWidth * 4}px Arial`;
    ctx.fillStyle = color;
    ctx.fillText(textInput, textPosition.x, textPosition.y);
    
    // Create a text event to send to other users
    const textPayload = {
      type: 'text',
      text: textInput,
      x: textPosition.x,
      y: textPosition.y,
      color: color,
      fontSize: lineWidth * 4
    };
    
    addLocalDrawEvent && addLocalDrawEvent(textPayload);
    sendDrawEvent(textPayload);
    
    // Reset
    setTextInput('');
    setShowTextModal(false);
    setTextPosition(null);
    toast.success('Text added!');
  };

  // --- Export Handlers ---
  const handleExportPNG = async () => {
    try {
      const canvas = canvasRef.current;
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `whiteboard-${Date.now()}.png`;
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
        orientation: 'landscape',
        unit: 'px',
        format: [1200, 700]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, 1200, 700);
      pdf.save(`whiteboard-${Date.now()}.pdf`);
      toast.success('Exported as PDF!');
    } catch (error) {
      toast.error('Export failed!');
    }
  };

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

        <div className="tool-buttons">
          <button 
            className={tool === 'pen' ? 'active' : ''} 
            onClick={() => setTool('pen')}
            title="Pen"
          >
            <FaPen />
          </button>
          <button 
            className={tool === 'line' ? 'active' : ''} 
            onClick={() => setTool('line')}
            title="Line"
          >
            <FaMinus />
          </button>
          <button 
            className={tool === 'rect' ? 'active' : ''} 
            onClick={() => setTool('rect')}
            title="Rectangle"
          >
            <FaSquare />
          </button>
          <button 
            className={tool === 'circle' ? 'active' : ''} 
            onClick={() => setTool('circle')}
            title="Circle"
          >
            <FaCircle />
          </button>
          <button 
            className={tool === 'text' ? 'active' : ''} 
            onClick={() => setTool('text')}
            title="Text"
          >
            <FaFont />
          </button>
          <button 
            className={tool === 'eraser' ? 'active' : ''} 
            onClick={() => setTool('eraser')}
            title="Eraser"
          >
            <FaEraser />
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

      <div className="canvas-stage">
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <canvas
            ref={canvasRef}
            width={1200}
            height={700}
            className="whiteboard-canvas"
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={stopDrawing}
            onPointerLeave={stopDrawing}
            onClick={handleCanvasClick}
          />
          <canvas
            ref={overlayRef}
            width={1200}
            height={700}
            className="overlay-canvas"
          />
        </div>
      </div>

      {/* Text Input Modal */}
      {showTextModal && (
        <div className="text-modal-backdrop" onClick={() => setShowTextModal(false)}>
          <div className="text-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Text</h3>
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enter text..."
              autoFocus
              onKeyPress={(e) => e.key === 'Enter' && handleTextSubmit()}
            />
            <div className="text-modal-buttons">
              <button onClick={handleTextSubmit}>Add</button>
              <button onClick={() => setShowTextModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Canvas;