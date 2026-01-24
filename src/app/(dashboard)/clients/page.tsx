"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, User, FileText, ChevronRight } from "lucide-react";
import { useToast } from "@/lib/use-toast";
import { useRouter } from "next/navigation";
import { Spotlight, useOnboarding } from "@/components/onboarding";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  _count: {
    reports: number;
    disputes: number;
  };
}

export default function ClientsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const router = useRouter();
  const { steps, currentStep } = useOnboarding();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  const fetchClients = async () => {
    try {
      const res = await fetch("/api/clients");
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (error) {
      console.error("Failed to fetch clients:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();

    if (session?.user?.subscriptionTier === "FREE") {
      toast({
        title: "Upgrade Required",
        description: "Free plan is limited to viewing. Upgrade to Pro to add clients.",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newClient),
      });

      if (res.ok) {
        toast({
          title: "Client Added",
          description: `${newClient.firstName} ${newClient.lastName} has been added.`,
        });
        setIsAddDialogOpen(false);
        setNewClient({ firstName: "", lastName: "", email: "", phone: "" });
        fetchClients();
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.message || "Failed to add client",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const filteredClients = clients.filter((client) => {
    const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6 lg:ml-64 pt-16 lg:pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Clients</h1>
          <p className="text-slate-400 mt-1">Manage your client portfolio</p>
        </div>
        <ResponsiveDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <Spotlight
            active={!steps.find(s => s.id === "add-client")?.completed && steps[currentStep]?.id === "add-client"}
            message="Start here by adding your first client."
          >
            <ResponsiveDialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Client
              </Button>
            </ResponsiveDialogTrigger>
          </Spotlight>
          <ResponsiveDialogContent size="sm">
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>Add New Client</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                Enter the client&apos;s information to create their profile.
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <form onSubmit={handleAddClient}>
              <ResponsiveDialogBody className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-slate-200">First Name</Label>
                    <Input
                      id="firstName"
                      value={newClient.firstName}
                      onChange={(e) => setNewClient({ ...newClient, firstName: e.target.value })}
                      required
                      className="bg-slate-700/50 border-slate-600 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-slate-200">Last Name</Label>
                    <Input
                      id="lastName"
                      value={newClient.lastName}
                      onChange={(e) => setNewClient({ ...newClient, lastName: e.target.value })}
                      required
                      className="bg-slate-700/50 border-slate-600 text-white"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-200">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    className="bg-slate-700/50 border-slate-600 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-slate-200">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                    className="bg-slate-700/50 border-slate-600 text-white"
                  />
                </div>
              </ResponsiveDialogBody>
              <ResponsiveDialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Client</Button>
              </ResponsiveDialogFooter>
            </form>
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          placeholder="Search clients..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-slate-800/50 border-slate-700 text-white"
        />
      </div>

      {/* Clients List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading clients...</div>
      ) : filteredClients.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-12 text-center">
            <User className="w-12 h-12 mx-auto text-slate-600" />
            <h3 className="text-lg font-medium text-white mt-4">No clients found</h3>
            <p className="text-slate-400 mt-2">
              {searchQuery ? "Try a different search term" : "Add your first client to get started"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredClients.map((client) => (
            <Card
              key={client.id}
              className="bg-slate-800/50 border-slate-700 hover:border-slate-500 hover:bg-slate-800 transition-colors cursor-pointer"
              onClick={() => router.push(`/clients/${client.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-primary font-medium">
                        {client.firstName.charAt(0)}{client.lastName.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-medium text-white">
                        {client.firstName} {client.lastName}
                      </h3>
                      <p className="text-sm text-slate-400">
                        {client.email || "No email"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-slate-300">
                          <FileText className="w-3 h-3 mr-1" />
                          {client._count.reports} reports
                        </Badge>
                        <Badge variant="outline" className="text-slate-300">
                          {client._count.disputes} disputes
                        </Badge>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
