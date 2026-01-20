"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBranding } from "./branding-provider";
import { colorPresets, generateHoverColor, defaultBranding } from "@/types/branding";
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

  const applyPreset = (preset: typeof colorPresets[0]) => {
    setLocalBranding((prev) => ({
      ...prev,
      primaryColor: preset.primary,
      primaryHoverColor: generateHoverColor(preset.primary),
      accentColor: preset.accent,
      sidebarActiveColor: preset.primary,
    }));
    setHasChanges(true);
  };

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
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Palette className="w-5 h-5" />
          White Label Branding
        </CardTitle>
        <CardDescription className="text-slate-400">
          Customize the look and feel of your workspace with your brand colors and logo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-slate-700/50 border border-slate-600">
            <TabsTrigger value="colors" className="data-[state=active]:bg-slate-600">
              <Palette className="w-4 h-4 mr-2" />
              Colors
            </TabsTrigger>
            <TabsTrigger value="logo" className="data-[state=active]:bg-slate-600">
              <Image className="w-4 h-4 mr-2" />
              Logo
            </TabsTrigger>
            <TabsTrigger value="company" className="data-[state=active]:bg-slate-600">
              <Building2 className="w-4 h-4 mr-2" />
              Company
            </TabsTrigger>
            <TabsTrigger value="advanced" className="data-[state=active]:bg-slate-600">
              <Code className="w-4 h-4 mr-2" />
              Advanced
            </TabsTrigger>
          </TabsList>

          {/* Colors Tab */}
          <TabsContent value="colors" className="space-y-6">
            {/* Color Presets */}
            <div className="space-y-3">
              <Label className="text-slate-200">Quick Presets</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {colorPresets.map((preset) => (
                  <motion.button
                    key={preset.name}
                    onClick={() => applyPreset(preset)}
                    className="flex items-center gap-2 p-3 rounded-lg border border-slate-600 hover:border-slate-500 bg-slate-700/30 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex gap-1">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: preset.primary }}
                      />
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: preset.accent }}
                      />
                    </div>
                    <span className="text-sm text-slate-300">{preset.name}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Custom Colors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-200">Primary Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={localBranding.primaryColor}
                    onChange={(e) => handleColorChange("primaryColor", e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border border-slate-600"
                  />
                  <Input
                    value={localBranding.primaryColor}
                    onChange={(e) => handleColorChange("primaryColor", e.target.value)}
                    className="bg-slate-700/50 border-slate-600 text-white font-mono"
                    placeholder="#3b82f6"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-200">Accent Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={localBranding.accentColor}
                    onChange={(e) => handleColorChange("accentColor", e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border border-slate-600"
                  />
                  <Input
                    value={localBranding.accentColor}
                    onChange={(e) => handleColorChange("accentColor", e.target.value)}
                    className="bg-slate-700/50 border-slate-600 text-white font-mono"
                    placeholder="#8b5cf6"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-200">Sidebar Background</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={localBranding.sidebarBgColor}
                    onChange={(e) => handleChange("sidebarBgColor", e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border border-slate-600"
                  />
                  <Input
                    value={localBranding.sidebarBgColor}
                    onChange={(e) => handleChange("sidebarBgColor", e.target.value)}
                    className="bg-slate-700/50 border-slate-600 text-white font-mono"
                    placeholder="#1e293b"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-200">Sidebar Text Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={localBranding.sidebarTextColor}
                    onChange={(e) => handleChange("sidebarTextColor", e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border border-slate-600"
                  />
                  <Input
                    value={localBranding.sidebarTextColor}
                    onChange={(e) => handleChange("sidebarTextColor", e.target.value)}
                    className="bg-slate-700/50 border-slate-600 text-white font-mono"
                    placeholder="#94a3b8"
                  />
                </div>
              </div>
            </div>

            {/* Live Preview */}
            <div className="space-y-2">
              <Label className="text-slate-200 flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Live Preview
              </Label>
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <div className="flex gap-4">
                  {/* Mini sidebar preview */}
                  <div
                    className="w-32 rounded-lg p-3 space-y-2"
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
                          backgroundColor: localBranding.sidebarActiveColor,
                          color: "white",
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
                    </div>
                  </div>

                  {/* Main content preview */}
                  <div className="flex-1 space-y-3">
                    <button
                      className="px-4 py-2 rounded-lg text-sm text-white transition-colors"
                      style={{ backgroundColor: localBranding.primaryColor }}
                    >
                      Primary Button
                    </button>
                    <button
                      className="px-4 py-2 rounded-lg text-sm text-white ml-2"
                      style={{ backgroundColor: localBranding.accentColor }}
                    >
                      Accent Button
                    </button>
                    <div className="text-sm">
                      <span style={{ color: localBranding.primaryColor }}>
                        Link text example
                      </span>
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
                <Label className="text-slate-200">Logo</Label>
                <p className="text-xs text-slate-500">
                  Upload your company logo. Recommended size: 200x50px. Max 2MB.
                </p>
                <div className="flex items-center gap-4">
                  {localBranding.logoUrl ? (
                    <div className="relative">
                      <img
                        src={localBranding.logoUrl}
                        alt="Logo preview"
                        className="h-12 max-w-[200px] object-contain bg-slate-700 rounded p-2"
                      />
                      <button
                        onClick={() => handleChange("logoUrl", "")}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="h-12 w-[200px] border-2 border-dashed border-slate-600 rounded flex items-center justify-center text-slate-500">
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
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Logo
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-200">Logo Text (Fallback)</Label>
                <p className="text-xs text-slate-500">
                  Text to display if no logo is uploaded
                </p>
                <Input
                  value={localBranding.logoText || ""}
                  onChange={(e) => handleChange("logoText", e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white max-w-xs"
                  placeholder="Your Company Name"
                />
              </div>
            </div>
          </TabsContent>

          {/* Company Tab */}
          <TabsContent value="company" className="space-y-6">
            <p className="text-sm text-slate-400">
              This information will be used in generated documents and dispute letters.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-200">Company Name</Label>
                <Input
                  value={localBranding.companyName || ""}
                  onChange={(e) => handleChange("companyName", e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white"
                  placeholder="Your Company LLC"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Phone</Label>
                <Input
                  value={localBranding.companyPhone || ""}
                  onChange={(e) => handleChange("companyPhone", e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Email</Label>
                <Input
                  value={localBranding.companyEmail || ""}
                  onChange={(e) => handleChange("companyEmail", e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white"
                  placeholder="support@yourcompany.com"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Website</Label>
                <Input
                  value={localBranding.companyWebsite || ""}
                  onChange={(e) => handleChange("companyWebsite", e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white"
                  placeholder="https://yourcompany.com"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-slate-200">Address</Label>
                <Input
                  value={localBranding.companyAddress || ""}
                  onChange={(e) => handleChange("companyAddress", e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white"
                  placeholder="123 Main St, Suite 100, City, ST 12345"
                />
              </div>
            </div>

            {/* Email Customization */}
            <div className="pt-4 border-t border-slate-700 space-y-4">
              <h4 className="text-sm font-medium text-white flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Customization
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-200">Email Header Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={localBranding.emailHeaderColor || localBranding.primaryColor}
                      onChange={(e) => handleChange("emailHeaderColor", e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border border-slate-600"
                    />
                    <Input
                      value={localBranding.emailHeaderColor || ""}
                      onChange={(e) => handleChange("emailHeaderColor", e.target.value)}
                      className="bg-slate-700/50 border-slate-600 text-white font-mono"
                      placeholder="Same as primary"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-200">Email Footer Text</Label>
                  <Input
                    value={localBranding.emailFooterText || ""}
                    onChange={(e) => handleChange("emailFooterText", e.target.value)}
                    className="bg-slate-700/50 border-slate-600 text-white"
                    placeholder="© 2024 Your Company. All rights reserved."
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced" className="space-y-6">
            <div className="space-y-2">
              <Label className="text-slate-200">Custom CSS</Label>
              <p className="text-xs text-slate-500">
                Advanced: Add custom CSS to further customize the appearance. Use with caution.
              </p>
              <textarea
                value={localBranding.customCss || ""}
                onChange={(e) => handleChange("customCss", e.target.value)}
                className="w-full h-40 bg-slate-700/50 border border-slate-600 text-white font-mono text-sm rounded-lg p-3 focus:border-blue-500 focus:outline-none"
                placeholder={`/* Example custom CSS */
.sidebar { border-radius: 0; }
.card { box-shadow: none; }`}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-700">
          <Button
            variant="outline"
            onClick={handleReset}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
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
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
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
