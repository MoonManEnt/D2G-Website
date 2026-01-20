"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { User, Building, Shield, Save, Loader2, Check, Eye, EyeOff, Sparkles } from "lucide-react";
import { useToast } from "@/lib/use-toast";
import { BrandingSettings } from "@/components/branding";
import { ProfilePictureUpload } from "@/components/profile";

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const { toast } = useToast();

  // Profile state
  const [name, setName] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileChanged, setProfileChanged] = useState(false);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);

  // Password state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Initialize form with session data
  useEffect(() => {
    if (session?.user?.name) {
      setName(session.user.name);
    }
  }, [session?.user?.name]);

  // Fetch profile picture
  useEffect(() => {
    async function fetchProfilePicture() {
      try {
        const response = await fetch("/api/user/profile-picture");
        if (response.ok) {
          const data = await response.json();
          setProfilePicture(data.profilePicture);
        }
      } catch (error) {
        console.error("Failed to fetch profile picture:", error);
      }
    }
    if (session?.user) {
      fetchProfilePicture();
    }
  }, [session?.user]);

  // Handle profile picture save
  const handleProfilePictureSave = async (imageDataUrl: string | null) => {
    const response = await fetch("/api/user/profile-picture", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profilePicture: imageDataUrl }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to update profile picture");
    }

    setProfilePicture(imageDataUrl);
  };

  // Track profile changes
  useEffect(() => {
    setProfileChanged(name !== session?.user?.name && name.trim().length >= 2);
  }, [name, session?.user?.name]);

  const handleSaveProfile = async () => {
    if (!profileChanged) return;

    setIsSavingProfile(true);
    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      // Update the session
      await updateSession({ name: name.trim() });

      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully.",
      });

      setProfileChanged(false);
    } catch (error) {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    // Validate
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "New password and confirmation must match.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to change password");
      }

      toast({
        title: "Password Changed",
        description: "Your password has been updated successfully.",
      });

      // Reset form and close dialog
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordDialog(false);
    } catch (error) {
      toast({
        title: "Password Change Failed",
        description: error instanceof Error ? error.message : "Failed to change password",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6 lg:ml-64 pt-16 lg:pt-0 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-1">Manage your account and organization settings</p>
      </div>

      {/* Profile Settings */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <User className="w-5 h-5" />
            Profile
          </CardTitle>
          <CardDescription className="text-slate-400">
            Your personal account information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Picture */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <ProfilePictureUpload
              currentImage={profilePicture}
              name={session?.user?.name}
              onSave={handleProfilePictureSave}
            />
            <div>
              <Label className="text-slate-200">Profile Picture</Label>
              <p className="text-sm text-slate-400 mt-1">
                Click on the image to upload a new profile picture.
                <br />
                <span className="text-xs text-slate-500">Supported: JPEG, PNG, GIF, WebP (max 5MB)</span>
              </p>
            </div>
          </div>

          <div className="border-t border-slate-700 pt-4" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-200">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-slate-700/50 border-slate-600 text-white focus:border-blue-500"
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-200">Email</Label>
              <Input
                value={session?.user?.email || ""}
                className="bg-slate-700/50 border-slate-600 text-slate-400"
                disabled
              />
              <p className="text-xs text-slate-500">Email cannot be changed</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-200">Role</Label>
            <div>
              <Badge
                variant="outline"
                className={
                  session?.user?.role === "ADMIN"
                    ? "border-amber-500/50 text-amber-400"
                    : "border-blue-500/50 text-blue-400"
                }
              >
                {session?.user?.role || "SPECIALIST"}
              </Badge>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-700">
            <Button
              onClick={handleSaveProfile}
              disabled={!profileChanged || isSavingProfile}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {isSavingProfile ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : profileChanged ? (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Saved
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Organization Settings */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Building className="w-5 h-5" />
            Organization
          </CardTitle>
          <CardDescription className="text-slate-400">
            Your organization details and subscription
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-200">Organization Name</Label>
            <Input
              value={session?.user?.organizationName || ""}
              className="bg-slate-700/50 border-slate-600 text-slate-400"
              disabled
            />
            <p className="text-xs text-slate-500">Contact support to change organization name</p>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-200">Subscription</Label>
            <div className="flex items-center gap-3">
              <Badge
                className={
                  session?.user?.subscriptionTier === "PRO"
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0"
                    : "bg-slate-600 text-slate-200"
                }
              >
                {session?.user?.subscriptionTier === "PRO" && (
                  <Sparkles className="w-3 h-3 mr-1" />
                )}
                {session?.user?.subscriptionTier || "FREE"}
              </Badge>
              <span className="text-sm text-slate-400">
                Status:{" "}
                <span className={
                  session?.user?.subscriptionStatus === "ACTIVE"
                    ? "text-emerald-400"
                    : "text-amber-400"
                }>
                  {session?.user?.subscriptionStatus || "ACTIVE"}
                </span>
              </span>
            </div>
            {session?.user?.subscriptionTier !== "PRO" && (
              <Button
                variant="outline"
                className="mt-3 border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                onClick={() => window.location.href = "/billing"}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Upgrade to PRO
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Security
          </CardTitle>
          <CardDescription className="text-slate-400">
            Password and security settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-200">Password</Label>
            <div className="flex items-center gap-3">
              <Input
                type="password"
                value="••••••••••••"
                className="bg-slate-700/50 border-slate-600 text-slate-400 max-w-xs"
                disabled
              />
              <Button
                variant="outline"
                onClick={() => setShowPasswordDialog(true)}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Change Password
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-700 space-y-2">
            <Label className="text-slate-200">Two-Factor Authentication</Label>
            <p className="text-sm text-slate-400">
              Two-factor authentication adds an extra layer of security to your account.
            </p>
            <Button
              variant="outline"
              disabled
              className="border-slate-600 text-slate-500"
            >
              Coming Soon
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Branding Settings - Admin Only */}
      {session?.user?.role === "ADMIN" && <BrandingSettings />}

      {/* Password Change Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Change Password</DialogTitle>
            <DialogDescription className="text-slate-400">
              Enter your current password and choose a new one.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-200">Current Password</Label>
              <div className="relative">
                <Input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white pr-10"
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                >
                  {showCurrentPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-200">New Password</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white pr-10"
                  placeholder="Enter new password (min 8 characters)"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                >
                  {showNewPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-200">Confirm New Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`bg-slate-700/50 border-slate-600 text-white ${
                  confirmPassword && confirmPassword !== newPassword
                    ? "border-red-500"
                    : ""
                }`}
                placeholder="Confirm new password"
              />
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="text-xs text-red-400">Passwords do not match</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordDialog(false);
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
              }}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={
                isChangingPassword ||
                !currentPassword ||
                !newPassword ||
                newPassword !== confirmPassword ||
                newPassword.length < 8
              }
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isChangingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Changing...
                </>
              ) : (
                "Change Password"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
