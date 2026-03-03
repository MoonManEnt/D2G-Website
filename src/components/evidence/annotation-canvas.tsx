"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage, Line, Rect, Arrow, Text, Circle } from "react-konva";
import { Button } from "@/components/ui/button";
import {
  Pencil,
  Square,
  ArrowUpRight,
  Type,
  Circle as CircleIcon,
  Eraser,
  Undo2,
  Redo2,
  Save,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToolType = "freehand" | "rectangle" | "arrow" | "text" | "circle";

interface DrawShape {
  id: string;
  type: ToolType;
  points?: number[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radius?: number;
  color: string;
  strokeWidth: number;
  text?: string;
}

interface AnnotationCanvasProps {
  imageUrl: string;
  clientId: string;
  evidenceId: string;
  onSave: (annotatedImageData: string) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRESET_COLORS = [
  { value: "#ef4444", label: "Red" },
  { value: "#eab308", label: "Yellow" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#22c55e", label: "Green" },
  { value: "#000000", label: "Black" },
];

const STROKE_WIDTHS = [
  { value: 2, label: "Thin" },
  { value: 4, label: "Medium" },
  { value: 8, label: "Thick" },
];

const TOOLS: { type: ToolType; icon: typeof Pencil; label: string }[] = [
  { type: "freehand", icon: Pencil, label: "Freehand" },
  { type: "rectangle", icon: Square, label: "Rectangle" },
  { type: "arrow", icon: ArrowUpRight, label: "Arrow" },
  { type: "text", icon: Type, label: "Text" },
  { type: "circle", icon: CircleIcon, label: "Circle" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AnnotationCanvas({
  imageUrl,
  clientId,
  evidenceId,
  onSave,
  onClose,
}: AnnotationCanvasProps) {
  // Suppress unused-var lint for props that identify context
  void clientId;
  void evidenceId;

  // Image
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });

  // Tools
  const [activeTool, setActiveTool] = useState<ToolType>("freehand");
  const [activeColor, setActiveColor] = useState("#ef4444");
  const [activeStrokeWidth, setActiveStrokeWidth] = useState(4);

  // Shapes
  const [shapes, setShapes] = useState<DrawShape[]>([]);
  const [undoStack, setUndoStack] = useState<DrawShape[]>([]);

  // Drawing state
  const isDrawing = useRef(false);
  const currentShapeId = useRef<string | null>(null);

  // Text input overlay
  const [textInput, setTextInput] = useState<{
    visible: boolean;
    x: number;
    y: number;
    stageX: number;
    stageY: number;
  } | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  // Stage ref for export
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stageRef = useRef<any>(null);

  // ---------------------------------------------------------------------------
  // Load the background image
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImage(img);

      // Fit image to viewport (leave room for toolbar ~64px top, 16px padding)
      const maxW = window.innerWidth - 32;
      const maxH = window.innerHeight - 96;
      const scale = Math.min(1, maxW / img.width, maxH / img.height);
      setStageSize({
        width: Math.round(img.width * scale),
        height: Math.round(img.height * scale),
      });
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // ---------------------------------------------------------------------------
  // Keyboard shortcut: Escape to close, Ctrl+Z undo, Ctrl+Shift+Z redo
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (textInput) {
          setTextInput(null);
        } else {
          onClose();
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        handleRedo();
        return;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textInput, shapes, undoStack]);

  // Focus the text input when it appears
  useEffect(() => {
    if (textInput?.visible && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [textInput]);

  // ---------------------------------------------------------------------------
  // Generate unique shape IDs
  // ---------------------------------------------------------------------------

  const genId = () => `shape_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // ---------------------------------------------------------------------------
  // Undo / Redo
  // ---------------------------------------------------------------------------

  const handleUndo = useCallback(() => {
    setShapes((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setUndoStack((stack) => [...stack, last]);
      return prev.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const last = stack[stack.length - 1];
      setShapes((prev) => [...prev, last]);
      return stack.slice(0, -1);
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Eraser: remove last shape
  // ---------------------------------------------------------------------------

  const handleErase = useCallback(() => {
    setShapes((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setUndoStack((stack) => [...stack, last]);
      return prev.slice(0, -1);
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Drawing handlers
  // ---------------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getPointerPos = (e: any) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    return pos || { x: 0, y: 0 };
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleStageMouseDown = (e: any) => {
    if (textInput) return; // Don't draw while text input is open

    const pos = getPointerPos(e);

    if (activeTool === "text") {
      // Show text input at this position
      const stage = stageRef.current;
      if (!stage) return;
      const container = stage.container().getBoundingClientRect();
      setTextInput({
        visible: true,
        x: container.left + pos.x,
        y: container.top + pos.y,
        stageX: pos.x,
        stageY: pos.y,
      });
      return;
    }

    isDrawing.current = true;
    setUndoStack([]); // Clear redo stack on new draw
    const id = genId();
    currentShapeId.current = id;

    const baseShape: Partial<DrawShape> = {
      id,
      color: activeColor,
      strokeWidth: activeStrokeWidth,
    };

    if (activeTool === "freehand") {
      setShapes((prev) => [
        ...prev,
        {
          ...baseShape,
          type: "freehand",
          points: [pos.x, pos.y],
        } as DrawShape,
      ]);
    } else if (activeTool === "rectangle") {
      setShapes((prev) => [
        ...prev,
        {
          ...baseShape,
          type: "rectangle",
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
        } as DrawShape,
      ]);
    } else if (activeTool === "arrow") {
      setShapes((prev) => [
        ...prev,
        {
          ...baseShape,
          type: "arrow",
          points: [pos.x, pos.y, pos.x, pos.y],
        } as DrawShape,
      ]);
    } else if (activeTool === "circle") {
      setShapes((prev) => [
        ...prev,
        {
          ...baseShape,
          type: "circle",
          x: pos.x,
          y: pos.y,
          radius: 0,
        } as DrawShape,
      ]);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleStageMouseMove = (e: any) => {
    if (!isDrawing.current || !currentShapeId.current) return;

    const pos = getPointerPos(e);
    const id = currentShapeId.current;

    setShapes((prev) =>
      prev.map((shape) => {
        if (shape.id !== id) return shape;

        if (shape.type === "freehand") {
          return {
            ...shape,
            points: [...(shape.points || []), pos.x, pos.y],
          };
        }
        if (shape.type === "rectangle") {
          return {
            ...shape,
            width: pos.x - (shape.x || 0),
            height: pos.y - (shape.y || 0),
          };
        }
        if (shape.type === "arrow") {
          const pts = shape.points || [0, 0, 0, 0];
          return {
            ...shape,
            points: [pts[0], pts[1], pos.x, pos.y],
          };
        }
        if (shape.type === "circle") {
          const dx = pos.x - (shape.x || 0);
          const dy = pos.y - (shape.y || 0);
          return {
            ...shape,
            radius: Math.sqrt(dx * dx + dy * dy),
          };
        }
        return shape;
      })
    );
  };

  const handleStageMouseUp = () => {
    isDrawing.current = false;
    currentShapeId.current = null;
  };

  // ---------------------------------------------------------------------------
  // Text placement
  // ---------------------------------------------------------------------------

  const handleTextSubmit = (value: string) => {
    if (value.trim() && textInput) {
      setUndoStack([]);
      setShapes((prev) => [
        ...prev,
        {
          id: genId(),
          type: "text",
          x: textInput.stageX,
          y: textInput.stageY,
          color: activeColor,
          strokeWidth: activeStrokeWidth,
          text: value.trim(),
        },
      ]);
    }
    setTextInput(null);
  };

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const handleSave = () => {
    if (!stageRef.current) return;
    const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 });
    onSave(dataUrl);
  };

  // ---------------------------------------------------------------------------
  // Render shapes
  // ---------------------------------------------------------------------------

  const renderShape = (shape: DrawShape) => {
    const key = shape.id;

    switch (shape.type) {
      case "freehand":
        return (
          <Line
            key={key}
            points={shape.points || []}
            stroke={shape.color}
            strokeWidth={shape.strokeWidth}
            tension={0.5}
            lineCap="round"
            lineJoin="round"
            globalCompositeOperation="source-over"
          />
        );
      case "rectangle":
        return (
          <Rect
            key={key}
            x={shape.x || 0}
            y={shape.y || 0}
            width={shape.width || 0}
            height={shape.height || 0}
            stroke={shape.color}
            strokeWidth={shape.strokeWidth}
            cornerRadius={2}
          />
        );
      case "arrow":
        return (
          <Arrow
            key={key}
            points={shape.points || [0, 0, 0, 0]}
            stroke={shape.color}
            strokeWidth={shape.strokeWidth}
            fill={shape.color}
            pointerLength={10}
            pointerWidth={10}
          />
        );
      case "text":
        return (
          <Text
            key={key}
            x={shape.x || 0}
            y={shape.y || 0}
            text={shape.text || ""}
            fontSize={Math.max(16, shape.strokeWidth * 4)}
            fill={shape.color}
            fontFamily="sans-serif"
          />
        );
      case "circle":
        return (
          <Circle
            key={key}
            x={shape.x || 0}
            y={shape.y || 0}
            radius={shape.radius || 0}
            stroke={shape.color}
            strokeWidth={shape.strokeWidth}
          />
        );
      default:
        return null;
    }
  };

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-white/10">
        {/* Left: Tools */}
        <div className="flex items-center gap-1">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <Button
                key={tool.type}
                variant={activeTool === tool.type ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTool(tool.type)}
                title={tool.label}
                className={
                  activeTool === tool.type
                    ? ""
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }
              >
                <Icon className="h-4 w-4" />
              </Button>
            );
          })}

          <div className="w-px h-6 bg-white/20 mx-1" />

          {/* Eraser */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleErase}
            title="Erase last"
            className="text-white/60 hover:text-white hover:bg-white/10"
            disabled={shapes.length === 0}
          >
            <Eraser className="h-4 w-4" />
          </Button>

          {/* Undo */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUndo}
            title="Undo (Ctrl+Z)"
            className="text-white/60 hover:text-white hover:bg-white/10"
            disabled={shapes.length === 0}
          >
            <Undo2 className="h-4 w-4" />
          </Button>

          {/* Redo */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRedo}
            title="Redo (Ctrl+Shift+Z)"
            className="text-white/60 hover:text-white hover:bg-white/10"
            disabled={undoStack.length === 0}
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Center: Colors + stroke width */}
        <div className="flex items-center gap-3">
          {/* Color picker */}
          <div className="flex items-center gap-1.5">
            {PRESET_COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => setActiveColor(color.value)}
                title={color.label}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  activeColor === color.value
                    ? "border-white scale-125"
                    : "border-white/30 hover:border-white/60"
                }`}
                style={{ backgroundColor: color.value }}
              />
            ))}
          </div>

          <div className="w-px h-6 bg-white/20" />

          {/* Stroke width */}
          <div className="flex items-center gap-1">
            {STROKE_WIDTHS.map((sw) => (
              <button
                key={sw.value}
                onClick={() => setActiveStrokeWidth(sw.value)}
                title={sw.label}
                className={`flex items-center justify-center w-8 h-8 rounded transition-colors ${
                  activeStrokeWidth === sw.value
                    ? "bg-white/20"
                    : "hover:bg-white/10"
                }`}
              >
                <div
                  className="rounded-full bg-white"
                  style={{
                    width: sw.value * 2 + 4,
                    height: sw.value * 2 + 4,
                  }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Right: Save / Cancel */}
        <div className="flex items-center gap-2">
          <Button
            onClick={handleSave}
            size="sm"
            disabled={!image}
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 flex items-center justify-center overflow-auto p-4">
        {image ? (
          <div className="relative">
            <Stage
              ref={stageRef}
              width={stageSize.width}
              height={stageSize.height}
              onMouseDown={handleStageMouseDown}
              onMouseMove={handleStageMouseMove}
              onMouseUp={handleStageMouseUp}
              onTouchStart={handleStageMouseDown}
              onTouchMove={handleStageMouseMove}
              onTouchEnd={handleStageMouseUp}
              className="shadow-2xl"
              style={{ cursor: activeTool === "text" ? "text" : "crosshair" }}
            >
              <Layer>
                {/* Background image */}
                <KonvaImage
                  image={image}
                  width={stageSize.width}
                  height={stageSize.height}
                />

                {/* Drawn shapes */}
                {shapes.map(renderShape)}
              </Layer>
            </Stage>

            {/* Floating text input */}
            {textInput?.visible && (
              <input
                ref={textInputRef}
                type="text"
                className="absolute bg-transparent border border-dashed border-white text-white px-1 py-0.5 text-base outline-none min-w-[120px]"
                style={{
                  left: textInput.stageX,
                  top: textInput.stageY,
                  color: activeColor,
                  fontSize: `${Math.max(16, activeStrokeWidth * 4)}px`,
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleTextSubmit((e.target as HTMLInputElement).value);
                  }
                  if (e.key === "Escape") {
                    setTextInput(null);
                  }
                }}
                onBlur={(e) => handleTextSubmit(e.target.value)}
                placeholder="Type text..."
              />
            )}
          </div>
        ) : (
          <div className="text-white/40 text-sm">Loading image...</div>
        )}
      </div>
    </div>
  );
}
