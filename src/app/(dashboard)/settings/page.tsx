
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import {
  User,
  Building,
  Shield,
  Save,
  Loader2,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  CreditCard,
  Settings,
  AlertTriangle,
  Trash2,
  Users,
  FileText,
  Scale,
  Archive,
} from "lucide-react";
import { useToast } from "@/lib/use-toast";
import { BrandingSettings } from "@/components/branding";
import { ProfilePictureUpload } from "@/components/profile";
import { ArchivedClientsList } from "@/components/archive";
import { motion } from "framer-motion";

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

  // Reset data state
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirmPhrase, setResetConfirmPhrase] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [dataCounts, setDataCounts] = useState<{
    clients: number;
    reports: number;
    disputes: number;
    accounts: number;
    evidence: number;
    documents: number;
  } | null>(null);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);

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

  // Fetch data counts for reset preview
  const fetchDataCounts = async () => {
    setIsLoadingCounts(true);
    try {
      const response = await fetch("/api/organization/reset");
      if (response.ok) {
        const data = await response.json();
        setDataCounts(data.counts);
      }
    } catch (error) {
      console.error("Failed to fetch data counts:", error);
    } finally {
      setIsLoadingCounts(false);
    }
  };

  // Handle reset all data
  const handleResetAllData = async () => {
    if (resetConfirmPhrase !== "DELETE ALL MY DATA") {
      toast({
        title: "Invalid Confirmation",
        description: "Please type 'DELETE ALL MY DATA' exactly to confirm.",
        variant: "destructive",
      });
      return;
    }

    setIsResetting(true);
    try {
      const response = await fetch("/api/organization/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationPhrase: resetConfirmPhrase }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reset data");
      }

      toast({
        title: "Data Reset Complete",
        description: `Deleted ${data.deleted.clients} clients, ${data.deleted.reports} reports, and ${data.deleted.disputes} disputes.`,
      });

      setShowResetDialog(false);
      setResetConfirmPhrase("");
      setDataCounts(null);

      // Refresh the page to reflect changes
      window.location.reload();
    } catch (error) {
      toast({
        title: "Reset Failed",
        description: error instanceof Error ? error.message : "Failed to reset data",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  const tabContentVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  };

  return (
    <motion.div
      className="space-y-6 lg:ml-64 pt-16 lg:pt-0 p-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Settings className="w-8 h-8 text-blue-500" />
          Settings
        </h1>
        <p className="text-slate-400 mt-2 text-lg">Manage your account and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="bg-slate-800/50 border-slate-700 p-1 rounded-lg mb-6">
          <TabsTrigger value="profile" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <User className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="organization" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Building className="w-4 h-4 mr-2" />
            Organization
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Shield className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="billing" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <CreditCard className="w-4 h-4 mr-2" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="archived" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Archive className="w-4 h-4 mr-2" />
            Archived
          </TabsTrigger>
          {session?.user?.role === "ADMIN" && (
            <TabsTrigger value="danger" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-red-400">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Danger Zone
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile" asChild>
          <motion.div variants={tabContentVariants} initial="hidden" animate="visible">
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white">Profile Information</CardTitle>
                <CardDescription className="text-slate-400">Update your personal details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <ProfilePictureUpload
                    currentImage={profilePicture}
                    name={session?.user?.name}
                    onSave={handleProfilePictureSave}
                    size="xl"
                  />
                  <div className="space-y-1 text-center sm:text-left">
                    <Label className="text-slate-200 text-lg">Profile Picture</Label>
                    <p className="text-sm text-slate-400">
                      Supports JPG, PNG, GIF (max 5MB)
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-700/50" />

                <div className="grid gap-6 max-w-2xl">
                  <div className="space-y-2">
                    <Label className="text-slate-200">Full Name</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-slate-900/50 border-slate-600 text-white focus:border-blue-500 h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-200">Email Address</Label>
                    <Input
                      value={session?.user?.email || ""}
                      className="bg-slate-900/50 border-slate-600 text-slate-400 h-11"
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-200">Role</Label>
                    <div>
                      <Badge variant="outline" className="text-blue-400 border-blue-500/30 px-3 py-1">
                        {session?.user?.role || "SPECIALIST"}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-700/50 flex justify-end">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={!profileChanged || isSavingProfile}
                    className="bg-blue-600 hover:bg-blue-700 min-w-[140px]"
                  >
                    {isSavingProfile ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                    ) : profileChanged ? (
                      <><Save className="w-4 h-4 mr-2" /> Save Changes</>
                    ) : (
                      "Saved"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="organization" asChild>
          <motion.div variants={tabContentVariants} initial="hidden" animate="visible" className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white">Organization Details</CardTitle>
                <CardDescription className="text-slate-400">Manage your workspace settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 max-w-2xl">
                <div className="space-y-2">
                  <Label className="text-slate-200">Organization Name</Label>
                  <Input
                    value={session?.user?.organizationName || ""}
                    className="bg-slate-900/50 border-slate-600 text-slate-400 h-11"
                    disabled
                  />
                  <p className="text-sm text-slate-500">Contact support to rename your organization.</p>
                </div>
              </CardContent>
            </Card>

            {/* Admin Only Branding */}
            {session?.user?.role === "ADMIN" && <BrandingSettings />}
          </motion.div>
        </TabsContent>

        <TabsContent value="security" asChild>
          <motion.div variants={tabContentVariants} initial="hidden" animate="visible">
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white">Security Settings</CardTitle>
                <CardDescription className="text-slate-400">Protect your account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 max-w-2xl">
                <div className="flex items-center justify-between p-4 border border-slate-700/50 rounded-lg bg-slate-900/30">
                  <div className="space-y-1">
                    <Label className="text-slate-200 text-base">Password</Label>
                    <p className="text-sm text-slate-400">Secure your account with a strong password</p>
                  </div>
                  <Button variant="outline" onClick={() => setShowPasswordDialog(true)} className="border-slate-600 hover:bg-slate-800">
                    Change Password
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border border-slate-700/50 rounded-lg bg-slate-900/30 opacity-75">
                  <div className="space-y-1">
                    <Label className="text-slate-200 text-base">Two-Factor Authentication</Label>
                    <p className="text-sm text-slate-400">Add an extra layer of security</p>
                  </div>
                  <Button variant="ghost" disabled className="text-slate-500">
                    Coming Soon
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="billing" asChild>
          <motion.div variants={tabContentVariants} initial="hidden" animate="visible">
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white">Subscription & Billing</CardTitle>
                <CardDescription className="text-slate-400">Manage your plan</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-6 border border-slate-700 rounded-lg bg-gradient-to-br from-slate-900 to-slate-800">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-white">Current Plan</h3>
                      <Badge className={
                        session?.user?.subscriptionTier === "PROFESSIONAL"
                          ? "bg-gradient-to-r from-amber-500 to-orange-500 border-0"
                          : "bg-slate-600"
                      }>
                        {session?.user?.subscriptionTier || "FREE"}
                      </Badge>
                    </div>
                    <p className="text-slate-400">
                      Status: <span className="text-emerald-400">{session?.user?.subscriptionStatus || "Active"}</span>
                    </p>
                  </div>

                  {session?.user?.subscriptionTier !== "PROFESSIONAL" && (
                    <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => window.location.href = "/billing"}>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Upgrade to PRO
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="archived" asChild>
          <motion.div variants={tabContentVariants} initial="hidden" animate="visible">
            <ArchivedClientsList />
          </motion.div>
        </TabsContent>

        {session?.user?.role === "ADMIN" && (
          <TabsContent value="danger" asChild>
            <motion.div variants={tabContentVariants} initial="hidden" animate="visible">
              <Card className="bg-slate-800/50 border-red-900/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-red-400 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Danger Zone
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Irreversible actions that affect all organization data
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-6 border border-red-900/50 rounded-lg bg-red-950/20">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                          <Trash2 className="w-5 h-5 text-red-400" />
                          Reset All Data
                        </h3>
                        <p className="text-sm text-slate-400 max-w-md">
                          Permanently delete ALL client data, reports, disputes, and evidence.
                          This action cannot be undone. Use this to start fresh with a clean slate.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        className="border-red-600 text-red-400 hover:bg-red-950/50 hover:text-red-300 shrink-0"
                        onClick={() => {
                          setShowResetDialog(true);
                          fetchDataCounts();
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Reset All Data
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 border border-slate-700/50 rounded-lg bg-slate-900/30">
                    <p className="text-sm text-slate-400">
                      <strong className="text-slate-300">Note:</strong> This will delete all clients, credit reports,
                      disputes, account items, evidence, documents, and related data. Your organization settings,
                      user accounts, and billing information will remain intact.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        )}
      </Tabs>

      {/* Password Change Dialog */}
      <ResponsiveDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <ResponsiveDialogContent size="sm">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Change Password</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Enter your current password and choose a new one.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogBody className="space-y-4">
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
                className={`bg-slate-700/50 border-slate-600 text-white ${confirmPassword && confirmPassword !== newPassword
                  ? "border-red-500"
                  : ""
                  }`}
                placeholder="Confirm new password"
              />
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="text-xs text-red-400">Passwords do not match</p>
              )}
            </div>
          </ResponsiveDialogBody>
          <ResponsiveDialogFooter>
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
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Reset All Data Dialog */}
      <ResponsiveDialog open={showResetDialog} onOpenChange={(open) => {
        setShowResetDialog(open);
        if (!open) {
          setResetConfirmPhrase("");
        }
      }}>
        <ResponsiveDialogContent size="md">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Reset All Organization Data
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              This will permanently delete ALL data. This action cannot be undone.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogBody className="space-y-6">
            {/* Data counts preview */}
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
              <h4 className="text-sm font-medium text-slate-300 mb-3">Data to be deleted:</h4>
              {isLoadingCounts ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : dataCounts ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span className="text-slate-400">Clients:</span>
                    <span className="text-white font-medium">{dataCounts.clients}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <span className="text-slate-400">Reports:</span>
                    <span className="text-white font-medium">{dataCounts.reports}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Scale className="w-4 h-4 text-amber-400" />
                    <span className="text-slate-400">Disputes:</span>
                    <span className="text-white font-medium">{dataCounts.disputes}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CreditCard className="w-4 h-4 text-purple-400" />
                    <span className="text-slate-400">Accounts:</span>
                    <span className="text-white font-medium">{dataCounts.accounts}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4 text-rose-400" />
                    <span className="text-slate-400">Evidence:</span>
                    <span className="text-white font-medium">{dataCounts.evidence}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <span className="text-slate-400">Documents:</span>
                    <span className="text-white font-medium">{dataCounts.documents}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Unable to load data counts</p>
              )}
            </div>

            {/* Warning */}
            <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-4">
              <p className="text-sm text-red-300">
                <strong>Warning:</strong> This will permanently delete all client data, credit reports,
                disputes, account items, evidence, and documents. Your organization settings and
                user accounts will remain intact.
              </p>
            </div>

            {/* Confirmation input */}
            <div className="space-y-2">
              <Label className="text-slate-200">
                Type <code className="bg-slate-800 px-2 py-0.5 rounded text-red-400">DELETE ALL MY DATA</code> to confirm
              </Label>
              <Input
                value={resetConfirmPhrase}
                onChange={(e) => setResetConfirmPhrase(e.target.value)}
                className="bg-slate-700/50 border-slate-600 text-white font-mono"
                placeholder="Type confirmation phrase..."
              />
            </div>
          </ResponsiveDialogBody>
          <ResponsiveDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowResetDialog(false);
                setResetConfirmPhrase("");
              }}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleResetAllData}
              disabled={isResetting || resetConfirmPhrase !== "DELETE ALL MY DATA"}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isResetting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete All Data
                </>
              )}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </motion.div>
  );
}
