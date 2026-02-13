
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
  MessageSquarePlus,
} from "lucide-react";
import { ArrowRight, Mic2, AlertCircle, Flame, Gavel, Angry } from "lucide-react";
import { useToast } from "@/lib/use-toast";
import { BrandingSettings } from "@/components/branding";
import { ProfilePictureUpload } from "@/components/profile";
import { ArchivedClientsList } from "@/components/archive";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { motion } from "framer-motion";
import { createLogger } from "@/lib/logger";
const log = createLogger("settings-page");

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
    documents: number;
  } | null>(null);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);

  // Dispute settings - now informational only (AMELIA handles tone automatically)

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
        log.error({ err: error }, "Failed to fetch profile picture");
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
      log.error({ err: error }, "Failed to fetch data counts");
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
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <Settings className="w-8 h-8 text-primary" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">Manage your account and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="bg-card border-border p-1 rounded-lg mb-6">
          <TabsTrigger value="profile" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <User className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="organization" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Building className="w-4 h-4 mr-2" />
            Organization
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Shield className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="billing" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <CreditCard className="w-4 h-4 mr-2" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="archived" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Archive className="w-4 h-4 mr-2" />
            Archived
          </TabsTrigger>
          <TabsTrigger value="disputes" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <MessageSquarePlus className="w-4 h-4 mr-2" />
            Disputes
          </TabsTrigger>
          {(session?.user?.role === "ADMIN" || session?.user?.role === "OWNER") && (
            <TabsTrigger value="danger" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-red-400">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Danger Zone
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile" asChild>
          <motion.div variants={tabContentVariants} initial="hidden" animate="visible">
            <Card className="bg-card border-border backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-foreground">Profile Information</CardTitle>
                <CardDescription className="text-muted-foreground">Update your personal details</CardDescription>
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
                    <Label className="text-foreground text-lg">Profile Picture</Label>
                    <p className="text-sm text-muted-foreground">
                      Supports JPG, PNG, GIF (max 5MB)
                    </p>
                  </div>
                </div>

                <div className="border-t border-border" />

                <div className="grid gap-6 max-w-2xl">
                  <div className="space-y-2">
                    <Label className="text-foreground">Full Name</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-background border-input text-foreground focus:border-primary h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">Email Address</Label>
                    <Input
                      value={session?.user?.email || ""}
                      className="bg-background border-input text-muted-foreground h-11"
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">Role</Label>
                    <div>
                      <Badge variant="outline" className="text-primary border-primary/30 px-3 py-1">
                        {session?.user?.role || "SPECIALIST"}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-border/50 flex justify-end">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={!profileChanged || isSavingProfile}
                    className="bg-primary hover:bg-primary/90 min-w-[140px]"
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

            {/* Appearance */}
            <Card className="bg-card border-border backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-foreground">Appearance</CardTitle>
                <CardDescription className="text-muted-foreground">Choose your preferred theme mode</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-foreground text-base">Theme Mode</Label>
                    <p className="text-sm text-muted-foreground">Select light, dark, or match your system settings</p>
                  </div>
                  <ThemeToggle />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="organization" asChild>
          <motion.div variants={tabContentVariants} initial="hidden" animate="visible" className="space-y-6">
            <Card className="bg-card border-border backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-foreground">Organization Details</CardTitle>
                <CardDescription className="text-muted-foreground">Manage your workspace settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 max-w-2xl">
                <div className="space-y-2">
                  <Label className="text-foreground">Organization Name</Label>
                  <Input
                    value={session?.user?.organizationName || ""}
                    className="bg-background border-input text-muted-foreground h-11"
                    disabled
                  />
                  <p className="text-sm text-muted-foreground">Contact support to rename your organization.</p>
                </div>
              </CardContent>
            </Card>

            {/* Admin/Owner Only Branding */}
            {(session?.user?.role === "ADMIN" || session?.user?.role === "OWNER") && <BrandingSettings />}
          </motion.div>
        </TabsContent>

        <TabsContent value="security" asChild>
          <motion.div variants={tabContentVariants} initial="hidden" animate="visible">
            <Card className="bg-card border-border backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-foreground">Security Settings</CardTitle>
                <CardDescription className="text-muted-foreground">Protect your account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 max-w-2xl">
                <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/30">
                  <div className="space-y-1">
                    <Label className="text-foreground text-base">Password</Label>
                    <p className="text-sm text-muted-foreground">Secure your account with a strong password</p>
                  </div>
                  <Button variant="outline" onClick={() => setShowPasswordDialog(true)} className="border-input hover:bg-muted">
                    Change Password
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/30 opacity-75">
                  <div className="space-y-1">
                    <Label className="text-foreground text-base">Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                  </div>
                  <Button variant="ghost" disabled className="text-muted-foreground">
                    Coming Soon
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="billing" asChild>
          <motion.div variants={tabContentVariants} initial="hidden" animate="visible">
            <Card className="bg-card border-border backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-foreground">Subscription & Billing</CardTitle>
                <CardDescription className="text-muted-foreground">Manage your plan</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-6 border border-border rounded-lg bg-gradient-to-br from-slate-900 to-slate-800">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-foreground">Current Plan</h3>
                      <Badge className={
                        session?.user?.subscriptionTier === "PROFESSIONAL"
                          ? "bg-gradient-to-r from-amber-500 to-orange-500 border-0"
                          : "bg-slate-600"
                      }>
                        {session?.user?.subscriptionTier || "FREE"}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">
                      Status: <span className="text-emerald-400">{session?.user?.subscriptionStatus || "Active"}</span>
                    </p>
                  </div>

                  {session?.user?.subscriptionTier !== "PROFESSIONAL" && (
                    <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => window.location.href = "/billing"}>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Upgrade to Professional
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

        <TabsContent value="disputes" asChild>
          <motion.div variants={tabContentVariants} initial="hidden" animate="visible">
            <Card className="bg-card border-border backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  AMELIA Letter Generation
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  How dispute letters are generated using the Kitchen Table Test
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Kitchen Table Test Explanation */}
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                      <MessageSquarePlus className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-emerald-400 mb-1">Kitchen Table Test</h3>
                      <p className="text-sm text-muted-foreground">
                        All letters sound like a real person wrote them at their kitchen table.
                        <strong className="text-foreground"> 6th-9th grade reading level</strong>, colloquial language,
                        no corporate speak, and unique AI-generated impact stories.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tone Escalation System */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-foreground text-lg">Automatic Tone Escalation</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Letter tone automatically escalates based on dispute round
                    </p>
                  </div>

                  <div className="grid gap-3">
                    {[
                      { round: "R1", tone: "Concerned", icon: Mic2, color: "blue", desc: "Polite, establishing facts. NO statute citations - just tells your story." },
                      { round: "R2", tone: "Worried", icon: AlertCircle, color: "cyan", desc: "More assertive, expressing genuine concern about the errors." },
                      { round: "R3", tone: "Fed Up", icon: Flame, color: "amber", desc: "Frustrated tone, demanding action and accountability." },
                      { round: "R4", tone: "Warning", icon: Gavel, color: "orange", desc: "Mentioning legal rights and consequences of non-compliance." },
                      { round: "R5+", tone: "Final Notice", icon: Angry, color: "red", desc: "Last warning before pursuing legal remedies." },
                    ].map((item, idx) => {
                      const Icon = item.icon;
                      const colorMap: Record<string, string> = {
                        blue: "bg-blue-500/10 border-blue-500/30 text-blue-400",
                        cyan: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400",
                        amber: "bg-amber-500/10 border-amber-500/30 text-amber-400",
                        orange: "bg-orange-500/10 border-orange-500/30 text-orange-400",
                        red: "bg-red-500/10 border-red-500/30 text-red-400",
                      };
                      return (
                        <div key={item.round} className="flex items-center gap-3">
                          {idx > 0 && (
                            <ArrowRight className="w-4 h-4 text-muted-foreground/50 -ml-1 -mr-1" />
                          )}
                          <div className={`flex items-center gap-3 flex-1 p-3 rounded-lg border ${colorMap[item.color]}`}>
                            <div className="flex items-center gap-2 min-w-[100px]">
                              <Icon className="w-4 h-4" />
                              <span className="font-mono font-bold">{item.round}</span>
                              <span className="font-medium">{item.tone}</span>
                            </div>
                            <span className="text-xs text-muted-foreground flex-1">{item.desc}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Key Features */}
                <div className="border-t border-border pt-6">
                  <Label className="text-foreground text-lg mb-4 block">Key Features</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { title: "Infinite Uniqueness", desc: "Every letter is 100% unique - defeats eOSCAR pattern detection" },
                      { title: "Backdated Letters", desc: "R1 backdated 60-69 days, R2+ backdated 30-39 days" },
                      { title: "Personal Info Disputes", desc: "R1 includes previous names, addresses, and hard inquiries" },
                      { title: "Natural Closings", desc: "No 'Consumer Statement' labels - just authentic sign-offs" },
                    ].map((feature) => (
                      <div key={feature.title} className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                        <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-medium text-foreground text-sm">{feature.title}</span>
                          <p className="text-xs text-muted-foreground">{feature.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-foreground">Note:</strong> The tone escalation is automatic based on round number.
                    You can override the tone when editing individual letters in Letter Studio, but the Kitchen Table Test
                    compliance (6th-9th grade reading level, colloquial language) is always enforced.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {(session?.user?.role === "ADMIN" || session?.user?.role === "OWNER") && (
          <TabsContent value="danger" asChild>
            <motion.div variants={tabContentVariants} initial="hidden" animate="visible">
              <Card className="bg-card border-red-900/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-red-400 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Danger Zone
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Irreversible actions that affect all organization data
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-6 border border-red-900/50 rounded-lg bg-red-950/20">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                          <Trash2 className="w-5 h-5 text-red-400" />
                          Reset All Data
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                          Permanently delete ALL client data, reports, and disputes.
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

                  <div className="p-4 border border-border rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground">
                      <strong className="text-foreground">Note:</strong> This will delete all clients, credit reports,
                      disputes, account items, documents, and related data. Your organization settings,
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
              <Label className="text-foreground">Current Password</Label>
              <div className="relative">
                <Input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="bg-muted border-input text-foreground pr-10"
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
              <Label className="text-foreground">New Password</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-muted border-input text-foreground pr-10"
                  placeholder="Enter new password (min 8 characters)"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
              <Label className="text-foreground">Confirm New Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`bg-muted border-input text-foreground ${confirmPassword && confirmPassword !== newPassword
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
              className="border-input text-muted-foreground hover:bg-muted"
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
              className="bg-primary hover:bg-primary/90"
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
            <div className="bg-background rounded-lg p-4 border border-border">
              <h4 className="text-sm font-medium text-foreground mb-3">Data to be deleted:</h4>
              {isLoadingCounts ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : dataCounts ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span className="text-muted-foreground">Clients:</span>
                    <span className="text-foreground font-medium">{dataCounts.clients}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <span className="text-muted-foreground">Reports:</span>
                    <span className="text-foreground font-medium">{dataCounts.reports}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Scale className="w-4 h-4 text-amber-400" />
                    <span className="text-muted-foreground">Disputes:</span>
                    <span className="text-foreground font-medium">{dataCounts.disputes}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CreditCard className="w-4 h-4 text-purple-400" />
                    <span className="text-muted-foreground">Accounts:</span>
                    <span className="text-foreground font-medium">{dataCounts.accounts}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <span className="text-muted-foreground">Documents:</span>
                    <span className="text-foreground font-medium">{dataCounts.documents}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Unable to load data counts</p>
              )}
            </div>

            {/* Warning */}
            <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-4">
              <p className="text-sm text-red-300">
                <strong>Warning:</strong> This will permanently delete all client data, credit reports,
                disputes, account items, and documents. Your organization settings and
                user accounts will remain intact.
              </p>
            </div>

            {/* Confirmation input */}
            <div className="space-y-2">
              <Label className="text-foreground">
                Type <code className="bg-card px-2 py-0.5 rounded text-red-400">DELETE ALL MY DATA</code> to confirm
              </Label>
              <Input
                value={resetConfirmPhrase}
                onChange={(e) => setResetConfirmPhrase(e.target.value)}
                className="bg-muted border-input text-foreground font-mono"
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
              className="border-input text-muted-foreground hover:bg-muted"
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
