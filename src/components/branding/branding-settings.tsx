"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBranding } from "./branding-provider";
import { themePresets, generateHoverColor, defaultBranding, type ThemePreset } from "@/types/branding";
import { useToast } from "@/lib/use-toast";
import {
  Palette,
  Building2,
  Upload,
  Loader2,
  Check,
  RotateCcw,
  Eye,
  Image,
  Mail,
  Code,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

export function BrandingSettings() {
  const { branding, updateBranding, resetBranding, isLoading } = useBranding();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("colors");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local state for form values
  const [localBranding, setLocalBranding] = useState(branding);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync local state when branding is loaded from server
  useEffect(() => {
    if (!isLoading) {
      setLocalBranding(branding);
    }
  }, [branding, isLoading]);

  const handleChange = (key: string, value: string) => {
    setLocalBranding((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleColorChange = (key: string, value: string) => {
    const updates: Record<string, string> = { [key]: value };

    // Auto-generate hover color for primary
    if (key === "primaryColor") {
      updates.primaryHoverColor = generateHoverColor(value);
    }

    setLocalBranding((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const applyThemePreset = (preset: ThemePreset) => {
    setLocalBranding((prev) => ({
      ...prev,
      ...preset.colors,
      emailHeaderColor: preset.colors.primaryColor,
    }));
    setHasChanges(true);
  };

  // Detect which preset is currently active (if any)
  const activePresetId = themePresets.find((p) =>
    p.colors.primaryColor === localBranding.primaryColor &&
    p.colors.accentColor === localBranding.accentColor &&
    p.colors.sidebarBgColor === localBranding.sidebarBgColor
  )?.id || null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateBranding(localBranding);
      setHasChanges(false);
      toast({
        title: "Branding Saved",
        description: "Your branding settings have been updated.",
      });
    } catch {
      toast({
        title: "Save Failed",
        description: "Failed to save branding settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      await resetBranding();
      setLocalBranding(defaultBranding);
      setHasChanges(false);
      toast({
        title: "Branding Reset",
        description: "Branding has been reset to defaults.",
      });
    } catch {
      toast({
        title: "Reset Failed",
        description: "Failed to reset branding settings.",
        variant: "destructive",
      });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Logo must be under 2MB.",
        variant: "destructive",
      });
      return;
    }

    // Convert to base64 for simple storage
    const reader = new FileReader();
    reader.onloadend = () => {
      handleChange("logoUrl", reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Palette className="w-5 h-5" />
          White Label Branding
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Customize the look and feel of your workspace with your brand colors and logo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted border border-input">
            <TabsTrigger value="colors" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Palette className="w-4 h-4 mr-2" />
              Colors
            </TabsTrigger>
            <TabsTrigger value="logo" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Image className="w-4 h-4 mr-2" />
              Logo
            </TabsTrigger>
            <TabsTrigger value="company" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Building2 className="w-4 h-4 mr-2" />
              Company
            </TabsTrigger>
            <TabsTrigger value="advanced" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Code className="w-4 h-4 mr-2" />
              Advanced
            </TabsTrigger>
          </TabsList>

          {/* Colors Tab */}
          <TabsContent value="colors" className="space-y-6">
            {/* Theme Presets */}
            <div className="space-y-3">
              <Label className="text-foreground text-base">Theme Presets</Label>
              <p className="text-xs text-muted-foreground">
                Select a preset to change all colors at once, or customize individual colors below.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {themePresets.map((preset) => {
                  const isActive = activePresetId === preset.id;
                  return (
                    <motion.button
                      key={preset.id}
                      onClick={() => applyThemePreset(preset)}
                      className={`relative flex flex-col rounded-lg border overflow-hidden transition-all ${
                        isActive
                          ? "border-white ring-2 ring-white/30"
                          : "border-border hover:border-muted-foreground"
                      }`}
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      {/* Mini preview */}
                      <div className="flex h-16">
                        {/* Mini sidebar */}
                        <div
                          className="w-8 flex flex-col items-center pt-2 gap-1"
                          style={{ backgroundColor: preset.colors.sidebarBgColor }}
                        >
                          <div
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: preset.colors.primaryColor }}
                          />
                          <div
                            className="w-3 h-1 rounded-full"
                            style={{ backgroundColor: preset.colors.sidebarActiveColor, opacity: 0.8 }}
                          />
                          <div
                            className="w-3 h-1 rounded-full"
                            style={{ backgroundColor: preset.colors.sidebarTextColor, opacity: 0.4 }}
                          />
                          <div
                            className="w-3 h-1 rounded-full"
                            style={{ backgroundColor: preset.colors.sidebarTextColor, opacity: 0.4 }}
                          />
                        </div>
                        {/* Mini content */}
                        <div className="flex-1 bg-slate-900 p-1.5 flex flex-col gap-1">
                          <div className="flex gap-1">
                            <div
                              className="h-2 w-8 rounded-sm"
                              style={{ backgroundColor: preset.colors.primaryColor }}
                            />
                            <div
                              className="h-2 w-6 rounded-sm"
                              style={{ backgroundColor: preset.colors.accentColor }}
                            />
                          </div>
                          <div className="flex gap-1 mt-auto">
                            <div
                              className="h-1.5 w-3 rounded-full"
                              style={{ backgroundColor: preset.colors.successColor }}
                            />
                            <div
                              className="h-1.5 w-3 rounded-full"
                              style={{ backgroundColor: preset.colors.warningColor }}
                            />
                            <div
                              className="h-1.5 w-3 rounded-full"
                              style={{ backgroundColor: preset.colors.errorColor }}
                            />
                          </div>
                        </div>
                      </div>
                      {/* Name + description */}
                      <div className="px-2 py-1.5 bg-slate-800/80 text-left">
                        <p className="text-xs font-medium text-slate-200 truncate">{preset.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{preset.description}</p>
                      </div>
                      {/* Active indicator */}
                      {isActive && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-1 right-1"
                        >
                          <CheckCircle2 className="w-4 h-4 text-white drop-shadow-lg" />
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Custom Colors */}
            <div className="space-y-3 pt-2 border-t border-border">
              <Label className="text-foreground text-base">Custom Colors</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Primary Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={localBranding.primaryColor}
                      onChange={(e) => handleColorChange("primaryColor", e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border border-input"
                    />
                    <Input
                      value={localBranding.primaryColor}
                      onChange={(e) => handleColorChange("primaryColor", e.target.value)}
                      className="bg-muted border-input text-foreground font-mono"
                      placeholder="#3b82f6"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Accent Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={localBranding.accentColor}
                      onChange={(e) => handleColorChange("accentColor", e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border border-input"
                    />
                    <Input
                      value={localBranding.accentColor}
                      onChange={(e) => handleColorChange("accentColor", e.target.value)}
                      className="bg-muted border-input text-foreground font-mono"
                      placeholder="#8b5cf6"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Sidebar Background</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={localBranding.sidebarBgColor}
                      onChange={(e) => handleChange("sidebarBgColor", e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border border-input"
                    />
                    <Input
                      value={localBranding.sidebarBgColor}
                      onChange={(e) => handleChange("sidebarBgColor", e.target.value)}
                      className="bg-muted border-input text-foreground font-mono"
                      placeholder="#1e293b"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Sidebar Text</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={localBranding.sidebarTextColor}
                      onChange={(e) => handleChange("sidebarTextColor", e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border border-input"
                    />
                    <Input
                      value={localBranding.sidebarTextColor}
                      onChange={(e) => handleChange("sidebarTextColor", e.target.value)}
                      className="bg-muted border-input text-foreground font-mono"
                      placeholder="#94a3b8"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Success Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={localBranding.successColor}
                      onChange={(e) => handleChange("successColor", e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border border-input"
                    />
                    <Input
                      value={localBranding.successColor}
                      onChange={(e) => handleChange("successColor", e.target.value)}
                      className="bg-muted border-input text-foreground font-mono"
                      placeholder="#22c55e"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Warning Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={localBranding.warningColor}
                      onChange={(e) => handleChange("warningColor", e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border border-input"
                    />
                    <Input
                      value={localBranding.warningColor}
                      onChange={(e) => handleChange("warningColor", e.target.value)}
                      className="bg-muted border-input text-foreground font-mono"
                      placeholder="#f59e0b"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Error Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={localBranding.errorColor}
                      onChange={(e) => handleChange("errorColor", e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border border-input"
                    />
                    <Input
                      value={localBranding.errorColor}
                      onChange={(e) => handleChange("errorColor", e.target.value)}
                      className="bg-muted border-input text-foreground font-mono"
                      placeholder="#ef4444"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Info Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={localBranding.infoColor}
                      onChange={(e) => handleChange("infoColor", e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border border-input"
                    />
                    <Input
                      value={localBranding.infoColor}
                      onChange={(e) => handleChange("infoColor", e.target.value)}
                      className="bg-muted border-input text-foreground font-mono"
                      placeholder="#3b82f6"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Live Preview */}
            <div className="space-y-2 pt-2 border-t border-border">
              <Label className="text-foreground flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Live Preview
              </Label>
              <div className="bg-background rounded-lg p-4 border border-border">
                <div className="flex gap-4">
                  {/* Mini sidebar preview */}
                  <div
                    className="w-36 rounded-lg p-3 space-y-2"
                    style={{ backgroundColor: localBranding.sidebarBgColor }}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles
                        className="w-4 h-4"
                        style={{ color: localBranding.primaryColor }}
                      />
                      <span
                        className="text-xs font-semibold"
                        style={{ color: localBranding.sidebarTextColor }}
                      >
                        {localBranding.logoText || "Brand"}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div
                        className="text-xs px-2 py-1 rounded"
                        style={{
                          backgroundColor: `${localBranding.sidebarActiveColor}30`,
                          color: localBranding.sidebarActiveColor,
                        }}
                      >
                        Dashboard
                      </div>
                      <div
                        className="text-xs px-2 py-1"
                        style={{ color: localBranding.sidebarTextColor }}
                      >
                        Clients
                      </div>
                      <div
                        className="text-xs px-2 py-1"
                        style={{ color: localBranding.sidebarTextColor }}
                      >
                        Disputes
                      </div>
                    </div>
                  </div>

                  {/* Main content preview */}
                  <div className="flex-1 space-y-3">
                    {/* Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="px-3 py-1.5 rounded-md text-xs text-white font-medium"
                        style={{ backgroundColor: localBranding.primaryColor }}
                      >
                        Primary
                      </button>
                      <button
                        className="px-3 py-1.5 rounded-md text-xs text-white font-medium"
                        style={{ backgroundColor: localBranding.accentColor }}
                      >
                        Accent
                      </button>
                      <button
                        className="px-3 py-1.5 rounded-md text-xs text-white font-medium"
                        style={{ backgroundColor: localBranding.primaryHoverColor }}
                      >
                        Hover
                      </button>
                    </div>
                    {/* Status badges */}
                    <div className="flex flex-wrap gap-1.5">
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                        style={{ backgroundColor: localBranding.successColor }}
                      >
                        Success
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                        style={{ backgroundColor: localBranding.warningColor }}
                      >
                        Warning
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                        style={{ backgroundColor: localBranding.errorColor }}
                      >
                        Error
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                        style={{ backgroundColor: localBranding.infoColor }}
                      >
                        Info
                      </span>
                    </div>
                    {/* Link and text */}
                    <div className="text-xs space-y-1">
                      <div>
                        <span style={{ color: localBranding.primaryColor }}>
                          Link text example
                        </span>
                        <span className="text-muted-foreground mx-1">/</span>
                        <span style={{ color: localBranding.accentColor }}>
                          Accent link
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] border"
                          style={{
                            borderColor: localBranding.primaryColor,
                            color: localBranding.primaryColor,
                          }}
                        >
                          Tag
                        </span>
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] border"
                          style={{
                            borderColor: localBranding.accentColor,
                            color: localBranding.accentColor,
                          }}
                        >
                          Category
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Logo Tab */}
          <TabsContent value="logo" className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Logo</Label>
                <p className="text-xs text-muted-foreground">
                  Upload your company logo. Recommended size: 200x50px. Max 2MB.
                </p>
                <div className="flex items-center gap-4">
                  {localBranding.logoUrl ? (
                    <div className="relative">
                      <img
                        src={localBranding.logoUrl}
                        alt="Logo preview"
                        className="h-12 max-w-[200px] object-contain bg-muted rounded p-2"
                      />
                      <button
                        onClick={() => handleChange("logoUrl", "")}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="h-12 w-[200px] border-2 border-dashed border-input rounded flex items-center justify-center text-muted-foreground">
                      No logo
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="border-input text-muted-foreground hover:bg-muted"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Logo
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Logo Text (Fallback)</Label>
                <p className="text-xs text-muted-foreground">
                  Text to display if no logo is uploaded
                </p>
                <Input
                  value={localBranding.logoText || ""}
                  onChange={(e) => handleChange("logoText", e.target.value)}
                  className="bg-muted border-input text-foreground max-w-xs"
                  placeholder="Your Company Name"
                />
              </div>
            </div>
          </TabsContent>

          {/* Company Tab */}
          <TabsContent value="company" className="space-y-6">
            <p className="text-sm text-muted-foreground">
              This information will be used in generated documents and dispute letters.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">Company Name</Label>
                <Input
                  value={localBranding.companyName || ""}
                  onChange={(e) => handleChange("companyName", e.target.value)}
                  className="bg-muted border-input text-foreground"
                  placeholder="Your Company LLC"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Phone</Label>
                <Input
                  value={localBranding.companyPhone || ""}
                  onChange={(e) => handleChange("companyPhone", e.target.value)}
                  className="bg-muted border-input text-foreground"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Email</Label>
                <Input
                  value={localBranding.companyEmail || ""}
                  onChange={(e) => handleChange("companyEmail", e.target.value)}
                  className="bg-muted border-input text-foreground"
                  placeholder="support@yourcompany.com"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Website</Label>
                <Input
                  value={localBranding.companyWebsite || ""}
                  onChange={(e) => handleChange("companyWebsite", e.target.value)}
                  className="bg-muted border-input text-foreground"
                  placeholder="https://yourcompany.com"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-foreground">Address</Label>
                <Input
                  value={localBranding.companyAddress || ""}
                  onChange={(e) => handleChange("companyAddress", e.target.value)}
                  className="bg-muted border-input text-foreground"
                  placeholder="123 Main St, Suite 100, City, ST 12345"
                />
              </div>
            </div>

            {/* Email Customization */}
            <div className="pt-4 border-t border-border space-y-4">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Customization
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Email Header Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={localBranding.emailHeaderColor || localBranding.primaryColor}
                      onChange={(e) => handleChange("emailHeaderColor", e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border border-input"
                    />
                    <Input
                      value={localBranding.emailHeaderColor || ""}
                      onChange={(e) => handleChange("emailHeaderColor", e.target.value)}
                      className="bg-muted border-input text-foreground font-mono"
                      placeholder="Same as primary"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Email Footer Text</Label>
                  <Input
                    value={localBranding.emailFooterText || ""}
                    onChange={(e) => handleChange("emailFooterText", e.target.value)}
                    className="bg-muted border-input text-foreground"
                    placeholder="© 2024 Your Company. All rights reserved."
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced" className="space-y-6">
            <div className="space-y-2">
              <Label className="text-foreground">Custom CSS</Label>
              <p className="text-xs text-muted-foreground">
                Advanced: Add custom CSS to further customize the appearance. Use with caution.
              </p>
              <textarea
                value={localBranding.customCss || ""}
                onChange={(e) => handleChange("customCss", e.target.value)}
                className="w-full h-40 bg-muted border border-input text-foreground font-mono text-sm rounded-lg p-3 focus:border-primary focus:outline-none"
                placeholder={`/* Example custom CSS */
.sidebar { border-radius: 0; }
.card { box-shadow: none; }`}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-6 mt-6 border-t border-border">
          <Button
            variant="outline"
            onClick={handleReset}
            className="border-input text-muted-foreground hover:bg-muted"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Defaults
          </Button>
          <AnimatePresence mode="wait">
            <motion.div
              key={hasChanges ? "save" : "saved"}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Button
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className="bg-primary hover:bg-primary/90 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : hasChanges ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Save Branding
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    All Changes Saved
                  </>
                )}
              </Button>
            </motion.div>
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
