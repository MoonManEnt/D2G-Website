"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar } from "./avatar";
import { useToast } from "@/lib/use-toast";
import {
  Upload,
  X,
  Image,
  Loader2,
  Trash2,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from "lucide-react";

interface ProfilePictureUploadProps {
  currentImage?: string | null;
  name?: string;
  onSave: (imageDataUrl: string | null) => Promise<void>;
  size?: "sm" | "md" | "lg" | "xl";
}

export function ProfilePictureUpload({
  currentImage,
  name,
  onSave,
  size = "lg",
}: ProfilePictureUploadProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImage || null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file (JPEG, PNG, GIF, or WebP).",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload an image under 5MB.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
      setZoom(1);
      setRotation(0);
    };
    reader.readAsDataURL(file);
  }, [toast]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const processImage = async (): Promise<string | null> => {
    if (!previewUrl) return null;

    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) {
          resolve(previewUrl);
          return;
        }

        const size = 256; // Output size
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(previewUrl);
          return;
        }

        // Clear canvas
        ctx.clearRect(0, 0, size, size);

        // Apply transformations
        ctx.save();
        ctx.translate(size / 2, size / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(zoom, zoom);

        // Calculate dimensions to center and cover
        const aspectRatio = img.width / img.height;
        let drawWidth, drawHeight;
        if (aspectRatio > 1) {
          drawHeight = size;
          drawWidth = size * aspectRatio;
        } else {
          drawWidth = size;
          drawHeight = size / aspectRatio;
        }

        ctx.drawImage(
          img,
          -drawWidth / 2,
          -drawHeight / 2,
          drawWidth,
          drawHeight
        );
        ctx.restore();

        // Convert to data URL
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
      img.src = previewUrl;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const processedImage = await processImage();
      await onSave(processedImage);
      setIsOpen(false);
      toast({
        title: "Profile Picture Updated",
        description: processedImage
          ? "Your profile picture has been saved."
          : "Your profile picture has been removed.",
      });
    } catch {
      toast({
        title: "Save Failed",
        description: "Failed to update profile picture. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    setPreviewUrl(null);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      // Reset to current image when opening
      setPreviewUrl(currentImage || null);
      setZoom(1);
      setRotation(0);
    }
  };

  return (
    <>
      <Avatar
        src={currentImage}
        name={name}
        size={size}
        editable
        onEdit={() => setIsOpen(true)}
      />

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Update Profile Picture</DialogTitle>
            <DialogDescription className="text-slate-400">
              Upload a new profile picture or remove your current one.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Preview area */}
            <motion.div
              className={`relative aspect-square max-w-[240px] mx-auto rounded-full overflow-hidden border-2 transition-colors ${isDragging
                ? "border-brand-500 bg-brand-500/10"
                : "border-slate-600 bg-slate-700/50"
                }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              animate={isDragging ? { scale: 1.02 } : { scale: 1 }}
            >
              <AnimatePresence mode="wait">
                {previewUrl ? (
                  <motion.div
                    key="preview"
                    className="w-full h-full flex items-center justify-center overflow-hidden"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="min-w-full min-h-full object-cover"
                      style={{
                        transform: `scale(${zoom}) rotate(${rotation}deg)`,
                        transition: "transform 0.2s ease-out",
                      }}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="placeholder"
                    className="w-full h-full flex flex-col items-center justify-center p-4 text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <Image className="w-12 h-12 text-slate-500 mb-3" />
                    <p className="text-sm text-slate-400">
                      Drag and drop an image or
                    </p>
                    <Button
                      variant="link"
                      className="text-brand-400 p-0 h-auto"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      browse to upload
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>

              <canvas ref={canvasRef} className="hidden" />
            </motion.div>

            {/* Controls */}
            {previewUrl && (
              <motion.div
                className="flex items-center justify-center gap-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs text-slate-400 w-12 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <div className="w-px h-6 bg-slate-600" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  <RotateCw className="w-4 h-4" />
                </Button>
              </motion.div>
            )}

            {/* Upload/Remove buttons */}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleInputChange}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <Upload className="w-4 h-4 mr-2" />
                {previewUrl ? "Change Image" : "Upload Image"}
              </Button>
              {previewUrl && (
                <Button
                  variant="outline"
                  onClick={handleRemove}
                  className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>

            <p className="text-xs text-slate-500 text-center">
              Supported formats: JPEG, PNG, GIF, WebP (max 5MB)
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-brand-600 hover:bg-brand-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Save Picture
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
