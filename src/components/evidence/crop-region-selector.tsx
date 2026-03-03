"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CropRegionSelectorProps {
  canvasWidth: number;
  canvasHeight: number;
  onRegionSelected: (region: CropRegion) => void;
  onClear: () => void;
}

type InteractionMode =
  | "none"
  | "drawing"
  | "moving"
  | "resize-nw"
  | "resize-ne"
  | "resize-sw"
  | "resize-se";

const MIN_SIZE = 50;
const HANDLE_SIZE = 8;

export function CropRegionSelector({
  canvasWidth,
  canvasHeight,
  onRegionSelected,
  onClear,
}: CropRegionSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [region, setRegion] = useState<CropRegion | null>(null);
  const [mode, setMode] = useState<InteractionMode>("none");
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Clamp a region to stay within canvas bounds
  const clampRegion = useCallback(
    (r: CropRegion): CropRegion => {
      let { x, y, width, height } = r;
      x = Math.max(0, Math.min(x, canvasWidth - MIN_SIZE));
      y = Math.max(0, Math.min(y, canvasHeight - MIN_SIZE));
      width = Math.max(MIN_SIZE, Math.min(width, canvasWidth - x));
      height = Math.max(MIN_SIZE, Math.min(height, canvasHeight - y));
      return { x, y, width, height };
    },
    [canvasWidth, canvasHeight]
  );

  // Get pointer position relative to the overlay container
  const getPointerPos = useCallback(
    (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
      const container = containerRef.current;
      if (!container) return { x: 0, y: 0 };
      const rect = container.getBoundingClientRect();
      let clientX: number, clientY: number;
      if ("touches" in e) {
        const touch = e.touches[0] || (e as TouchEvent).changedTouches[0];
        clientX = touch.clientX;
        clientY = touch.clientY;
      } else {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      }
      return {
        x: Math.max(0, Math.min(clientX - rect.left, canvasWidth)),
        y: Math.max(0, Math.min(clientY - rect.top, canvasHeight)),
      };
    },
    [canvasWidth, canvasHeight]
  );

  // Determine which resize handle (if any) is under the pointer
  const getHandleAtPos = useCallback(
    (px: number, py: number): InteractionMode => {
      if (!region) return "none";
      const { x, y, width, height } = region;
      const half = HANDLE_SIZE / 2;

      // Check corners
      if (
        Math.abs(px - x) <= half + 4 &&
        Math.abs(py - y) <= half + 4
      )
        return "resize-nw";
      if (
        Math.abs(px - (x + width)) <= half + 4 &&
        Math.abs(py - y) <= half + 4
      )
        return "resize-ne";
      if (
        Math.abs(px - x) <= half + 4 &&
        Math.abs(py - (y + height)) <= half + 4
      )
        return "resize-sw";
      if (
        Math.abs(px - (x + width)) <= half + 4 &&
        Math.abs(py - (y + height)) <= half + 4
      )
        return "resize-se";

      return "none";
    },
    [region]
  );

  // Check if pointer is inside the selection rectangle
  const isInsideRegion = useCallback(
    (px: number, py: number): boolean => {
      if (!region) return false;
      return (
        px >= region.x &&
        px <= region.x + region.width &&
        py >= region.y &&
        py <= region.y + region.height
      );
    },
    [region]
  );

  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const pos = getPointerPos(e);

      if (region) {
        // Check for resize handles first
        const handle = getHandleAtPos(pos.x, pos.y);
        if (handle !== "none") {
          setMode(handle);
          setStartPos(pos);
          return;
        }

        // Check for move (clicking inside selection)
        if (isInsideRegion(pos.x, pos.y)) {
          setMode("moving");
          setDragOffset({
            x: pos.x - region.x,
            y: pos.y - region.y,
          });
          return;
        }
      }

      // Start a new selection
      setRegion(null);
      onClear();
      setMode("drawing");
      setStartPos(pos);
    },
    [region, getPointerPos, getHandleAtPos, isInsideRegion, onClear]
  );

  const handlePointerMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (mode === "none") return;
      e.preventDefault();
      const pos = getPointerPos(e);

      if (mode === "drawing") {
        const x = Math.min(startPos.x, pos.x);
        const y = Math.min(startPos.y, pos.y);
        const width = Math.abs(pos.x - startPos.x);
        const height = Math.abs(pos.y - startPos.y);
        setRegion({ x, y, width, height });
      } else if (mode === "moving" && region) {
        const newX = pos.x - dragOffset.x;
        const newY = pos.y - dragOffset.y;
        setRegion(
          clampRegion({
            x: newX,
            y: newY,
            width: region.width,
            height: region.height,
          })
        );
      } else if (mode.startsWith("resize-") && region) {
        let newRegion = { ...region };
        if (mode === "resize-nw") {
          const right = region.x + region.width;
          const bottom = region.y + region.height;
          newRegion.x = Math.min(pos.x, right - MIN_SIZE);
          newRegion.y = Math.min(pos.y, bottom - MIN_SIZE);
          newRegion.width = right - newRegion.x;
          newRegion.height = bottom - newRegion.y;
        } else if (mode === "resize-ne") {
          const bottom = region.y + region.height;
          newRegion.width = Math.max(MIN_SIZE, pos.x - region.x);
          newRegion.y = Math.min(pos.y, bottom - MIN_SIZE);
          newRegion.height = bottom - newRegion.y;
        } else if (mode === "resize-sw") {
          const right = region.x + region.width;
          newRegion.x = Math.min(pos.x, right - MIN_SIZE);
          newRegion.width = right - newRegion.x;
          newRegion.height = Math.max(MIN_SIZE, pos.y - region.y);
        } else if (mode === "resize-se") {
          newRegion.width = Math.max(MIN_SIZE, pos.x - region.x);
          newRegion.height = Math.max(MIN_SIZE, pos.y - region.y);
        }
        setRegion(clampRegion(newRegion));
      }
    },
    [mode, startPos, region, dragOffset, getPointerPos, clampRegion]
  );

  const handlePointerUp = useCallback(() => {
    if (mode === "none") return;

    if (region && region.width >= MIN_SIZE && region.height >= MIN_SIZE) {
      const clamped = clampRegion(region);
      setRegion(clamped);
      // Return coordinates as fractions (0-1) relative to canvas dimensions
      onRegionSelected({
        x: clamped.x / canvasWidth,
        y: clamped.y / canvasHeight,
        width: clamped.width / canvasWidth,
        height: clamped.height / canvasHeight,
      });
    } else if (mode === "drawing") {
      // Selection too small — clear it
      setRegion(null);
      onClear();
    }

    setMode("none");
  }, [mode, region, clampRegion, onRegionSelected, onClear, canvasWidth, canvasHeight]);

  // Listen for global mouse/touch up to handle out-of-bounds releases
  useEffect(() => {
    const handleGlobalUp = () => {
      if (mode !== "none") {
        handlePointerUp();
      }
    };
    window.addEventListener("mouseup", handleGlobalUp);
    window.addEventListener("touchend", handleGlobalUp);
    return () => {
      window.removeEventListener("mouseup", handleGlobalUp);
      window.removeEventListener("touchend", handleGlobalUp);
    };
  }, [mode, handlePointerUp]);

  // Cursor style based on hover position
  const getCursor = useCallback(
    (e: React.MouseEvent) => {
      const pos = getPointerPos(e);
      if (region) {
        const handle = getHandleAtPos(pos.x, pos.y);
        if (handle === "resize-nw" || handle === "resize-se") return "nwse-resize";
        if (handle === "resize-ne" || handle === "resize-sw") return "nesw-resize";
        if (isInsideRegion(pos.x, pos.y)) return "move";
      }
      return "crosshair";
    },
    [region, getPointerPos, getHandleAtPos, isInsideRegion]
  );

  const [cursor, setCursor] = useState("crosshair");

  const handleMouseMoveForCursor = useCallback(
    (e: React.MouseEvent) => {
      if (mode === "none") {
        setCursor(getCursor(e));
      }
    },
    [mode, getCursor]
  );

  // Render the 4 overlay regions (darkened areas outside selection)
  const renderOverlays = () => {
    if (!region) {
      return null;
    }

    const { x, y, width, height } = region;

    return (
      <>
        {/* Top overlay */}
        <div
          className="absolute bg-black/40 pointer-events-none"
          style={{ top: 0, left: 0, right: 0, height: y }}
        />
        {/* Bottom overlay */}
        <div
          className="absolute bg-black/40 pointer-events-none"
          style={{
            top: y + height,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />
        {/* Left overlay */}
        <div
          className="absolute bg-black/40 pointer-events-none"
          style={{
            top: y,
            left: 0,
            width: x,
            height: height,
          }}
        />
        {/* Right overlay */}
        <div
          className="absolute bg-black/40 pointer-events-none"
          style={{
            top: y,
            left: x + width,
            right: 0,
            height: height,
          }}
        />
      </>
    );
  };

  // Render the selection border and corner handles
  const renderSelection = () => {
    if (!region) return null;

    const { x, y, width, height } = region;
    const half = HANDLE_SIZE / 2;

    const handles = [
      { left: x - half, top: y - half, cursor: "nwse-resize" },
      { left: x + width - half, top: y - half, cursor: "nesw-resize" },
      { left: x - half, top: y + height - half, cursor: "nesw-resize" },
      { left: x + width - half, top: y + height - half, cursor: "nwse-resize" },
    ];

    return (
      <>
        {/* Selection border */}
        <div
          className="absolute border-2 border-dashed border-white pointer-events-none"
          style={{
            left: x,
            top: y,
            width: width,
            height: height,
          }}
        />

        {/* Corner handles */}
        {handles.map((h, i) => (
          <div
            key={i}
            className="absolute bg-white border border-gray-400 pointer-events-none"
            style={{
              left: h.left,
              top: h.top,
              width: HANDLE_SIZE,
              height: HANDLE_SIZE,
            }}
          />
        ))}

        {/* Dimension label */}
        <div
          className="absolute text-xs text-white bg-black/70 px-1.5 py-0.5 rounded pointer-events-none"
          style={{
            left: x + width / 2 - 30,
            top: y + height + 4,
          }}
        >
          {Math.round(width)} x {Math.round(height)}
        </div>
      </>
    );
  };

  return (
    <div
      ref={containerRef}
      className="absolute top-0 left-0"
      style={{
        width: canvasWidth,
        height: canvasHeight,
        cursor: mode !== "none" ? (mode === "moving" ? "move" : "crosshair") : cursor,
      }}
      onMouseDown={handlePointerDown}
      onMouseMove={(e) => {
        handlePointerMove(e);
        handleMouseMoveForCursor(e);
      }}
      onMouseUp={handlePointerUp}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
    >
      {renderOverlays()}
      {renderSelection()}
    </div>
  );
}
