"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Mic, Check, X, LogOut, Gift, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface Voice {
  id: string;
  name: string;
  eleven_labs_id: string;
  profile_image_url: string | null;
  description: string | null;
  is_default: boolean;
  created_at: string;
}

interface PromoCode {
  id: string;
  code: string;
  credits: number;
  max_uses: number | null;
  current_uses: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  
  const [voices, setVoices] = useState<Voice[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewVoice, setShowNewVoice] = useState(false);
  const [showNewCode, setShowNewCode] = useState(false);
  
  // New voice form
  const [newVoice, setNewVoice] = useState({
    name: "",
    eleven_labs_id: "",
    description: "",
    profile_image: null as File | null,
  });
  const [isCreating, setIsCreating] = useState(false);

  // New promo code form
  const [newCode, setNewCode] = useState({
    code: "",
    credits: "5",
    max_uses: "",
    expires_at: "",
  });
  const [isCreatingCode, setIsCreatingCode] = useState(false);

  // Check session on mount
  useEffect(() => {
    const session = sessionStorage.getItem("admin_authenticated");
    if (session === "true") {
      setIsAuthenticated(true);
      fetchVoices();
      fetchPromoCodes();
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    try {
      const response = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        sessionStorage.setItem("admin_authenticated", "true");
        setIsAuthenticated(true);
        fetchVoices();
      } else {
        setLoginError("Invalid credentials");
      }
    } catch {
      setLoginError("Authentication failed");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("admin_authenticated");
    setIsAuthenticated(false);
    setUsername("");
    setPassword("");
  };

  const fetchVoices = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/voices");
      if (response.ok) {
        const data = await response.json();
        setVoices(data.voices || []);
      }
    } catch (error) {
      console.error("Failed to fetch voices:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateVoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVoice.name || !newVoice.eleven_labs_id) {
      toast.error("Name and ElevenLabs ID are required");
      return;
    }

    setIsCreating(true);
    try {
      // First upload profile image if provided
      let profileImageUrl = null;
      if (newVoice.profile_image) {
        const formData = new FormData();
        formData.append("file", newVoice.profile_image);
        formData.append("type", "voice-profile");

        const uploadResponse = await fetch("/api/admin/upload", {
          method: "POST",
          body: formData,
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          profileImageUrl = uploadData.url;
        }
      }

      // Create voice
      const response = await fetch("/api/admin/voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newVoice.name,
          eleven_labs_id: newVoice.eleven_labs_id,
          description: newVoice.description,
          profile_image_url: profileImageUrl,
        }),
      });

      if (response.ok) {
        toast.success("Voice created successfully");
        setNewVoice({ name: "", eleven_labs_id: "", description: "", profile_image: null });
        setShowNewVoice(false);
        fetchVoices();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create voice");
      }
    } catch (error) {
      console.error("Failed to create voice:", error);
      toast.error("Failed to create voice");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteVoice = async (voiceId: string) => {
    if (!confirm("Are you sure you want to delete this voice?")) return;

    try {
      const response = await fetch(`/api/admin/voices/${voiceId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Voice deleted");
        fetchVoices();
      } else {
        toast.error("Failed to delete voice");
      }
    } catch {
      toast.error("Failed to delete voice");
    }
  };

  const handleSetDefault = async (voiceId: string) => {
    try {
      const response = await fetch(`/api/admin/voices/${voiceId}/default`, {
        method: "POST",
      });

      if (response.ok) {
        toast.success("Default voice updated");
        fetchVoices();
      } else {
        toast.error("Failed to set default voice");
      }
    } catch {
      toast.error("Failed to set default voice");
    }
  };

  // Promo code functions
  const fetchPromoCodes = async () => {
    try {
      const response = await fetch("/api/admin/promo-codes");
      if (response.ok) {
        const data = await response.json();
        setPromoCodes(data.codes || []);
      }
    } catch (error) {
      console.error("Failed to fetch promo codes:", error);
    }
  };

  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.code || !newCode.credits) {
      toast.error("Code and credits are required");
      return;
    }

    setIsCreatingCode(true);
    try {
      const response = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newCode.code,
          credits: newCode.credits,
          max_uses: newCode.max_uses || null,
          expires_at: newCode.expires_at || null,
        }),
      });

      if (response.ok) {
        toast.success("Promo code created");
        setNewCode({ code: "", credits: "5", max_uses: "", expires_at: "" });
        setShowNewCode(false);
        fetchPromoCodes();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create promo code");
      }
    } catch {
      toast.error("Failed to create promo code");
    } finally {
      setIsCreatingCode(false);
    }
  };

  const handleDeleteCode = async (codeId: string) => {
    if (!confirm("Are you sure you want to delete this promo code?")) return;

    try {
      const response = await fetch(`/api/admin/promo-codes/${codeId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Promo code deleted");
        fetchPromoCodes();
      } else {
        toast.error("Failed to delete promo code");
      }
    } catch {
      toast.error("Failed to delete promo code");
    }
  };

  const handleToggleCodeActive = async (code: PromoCode) => {
    try {
      const response = await fetch(`/api/admin/promo-codes/${code.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !code.is_active }),
      });

      if (response.ok) {
        toast.success(`Code ${code.is_active ? "deactivated" : "activated"}`);
        fetchPromoCodes();
      } else {
        toast.error("Failed to update promo code");
      }
    } catch {
      toast.error("Failed to update promo code");
    }
  };

  // Login form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Admin Login</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                />
              </div>
              {loginError && (
                <p className="text-sm text-destructive">{loginError}</p>
              )}
              <Button type="submit" className="w-full">
                Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Admin dashboard
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Admin Dashboard</h1>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="voices" className="space-y-6">
          <TabsList>
            <TabsTrigger value="voices" className="gap-2">
              <Mic className="w-4 h-4" />
              Voices
            </TabsTrigger>
            <TabsTrigger value="promo-codes" className="gap-2">
              <Gift className="w-4 h-4" />
              Promo Codes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="voices">
            {/* Voices Section */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold">Voices</h2>
                  <p className="text-muted-foreground">Manage ElevenLabs voice profiles</p>
                </div>
                <Button onClick={() => setShowNewVoice(!showNewVoice)}>
                  {showNewVoice ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  {showNewVoice ? "Cancel" : "Add Voice"}
                </Button>
              </div>

          {/* New Voice Form */}
          {showNewVoice && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <form onSubmit={handleCreateVoice} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="voice-name">Voice Name *</Label>
                      <Input
                        id="voice-name"
                        value={newVoice.name}
                        onChange={(e) => setNewVoice({ ...newVoice, name: e.target.value })}
                        placeholder="e.g., Rachel"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="eleven-labs-id">ElevenLabs Voice ID *</Label>
                      <Input
                        id="eleven-labs-id"
                        value={newVoice.eleven_labs_id}
                        onChange={(e) => setNewVoice({ ...newVoice, eleven_labs_id: e.target.value })}
                        placeholder="e.g., EXAVITQu4vr4xnSDxMaL"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newVoice.description}
                      onChange={(e) => setNewVoice({ ...newVoice, description: e.target.value })}
                      placeholder="Describe this voice..."
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-image">Profile Image</Label>
                    <div className="flex items-center gap-4">
                      {newVoice.profile_image && (
                        <Avatar className="w-16 h-16">
                          <AvatarImage src={URL.createObjectURL(newVoice.profile_image)} />
                          <AvatarFallback>{newVoice.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      )}
                      <Input
                        id="profile-image"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setNewVoice({ ...newVoice, profile_image: file });
                        }}
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? "Creating..." : "Create Voice"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Voices Grid */}
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading voices...</div>
          ) : voices.length === 0 ? (
            <Card className="text-center py-12">
              <Mic className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No voices yet. Add your first voice!</p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {voices.map((voice) => (
                <Card key={voice.id} className="relative">
                  {voice.is_default && (
                    <Badge className="absolute top-3 right-3" variant="secondary">
                      Default
                    </Badge>
                  )}
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <Avatar className="w-14 h-14">
                        <AvatarImage src={voice.profile_image_url || undefined} />
                        <AvatarFallback className="text-lg">
                          {voice.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{voice.name}</h3>
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {voice.eleven_labs_id}
                        </p>
                        {voice.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {voice.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                      {!voice.is_default && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetDefault(voice.id)}
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Set Default
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive ml-auto"
                        onClick={() => handleDeleteVoice(voice.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
            </section>
          </TabsContent>

          <TabsContent value="promo-codes">
            {/* Promo Codes Section */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold">Promo Codes</h2>
                  <p className="text-muted-foreground">Create and manage promotional codes for free credits</p>
                </div>
                <Button onClick={() => setShowNewCode(!showNewCode)}>
                  {showNewCode ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  {showNewCode ? "Cancel" : "Create Code"}
                </Button>
              </div>

              {/* New Code Form */}
              {showNewCode && (
                <Card className="mb-6">
                  <CardContent className="pt-6">
                    <form onSubmit={handleCreateCode} className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="code">Code *</Label>
                          <Input
                            id="code"
                            value={newCode.code}
                            onChange={(e) => setNewCode({ ...newCode, code: e.target.value.toUpperCase() })}
                            placeholder="e.g., WELCOME10"
                            className="uppercase"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="credits">Credits to Grant *</Label>
                          <Input
                            id="credits"
                            type="number"
                            min="1"
                            value={newCode.credits}
                            onChange={(e) => setNewCode({ ...newCode, credits: e.target.value })}
                            placeholder="5"
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="max-uses">Max Uses (leave empty for unlimited)</Label>
                          <Input
                            id="max-uses"
                            type="number"
                            min="1"
                            value={newCode.max_uses}
                            onChange={(e) => setNewCode({ ...newCode, max_uses: e.target.value })}
                            placeholder="Unlimited"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="expires">Expiration Date (optional)</Label>
                          <Input
                            id="expires"
                            type="datetime-local"
                            value={newCode.expires_at}
                            onChange={(e) => setNewCode({ ...newCode, expires_at: e.target.value })}
                          />
                        </div>
                      </div>
                      <Button type="submit" disabled={isCreatingCode}>
                        {isCreatingCode ? "Creating..." : "Create Promo Code"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* Promo Codes List */}
              {promoCodes.length === 0 ? (
                <Card className="text-center py-12">
                  <Gift className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No promo codes yet. Create your first code!</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {promoCodes.map((code) => (
                    <Card key={code.id} className={!code.is_active ? "opacity-60" : ""}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Gift className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <code className="font-mono font-bold text-lg">{code.code}</code>
                                {!code.is_active && (
                                  <Badge variant="secondary">Inactive</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                                <span>+{code.credits} credits</span>
                                <span>•</span>
                                <span>
                                  {code.current_uses}/{code.max_uses ?? "∞"} uses
                                </span>
                                {code.expires_at && (
                                  <>
                                    <span>•</span>
                                    <span>
                                      Expires {new Date(code.expires_at).toLocaleDateString()}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleCodeActive(code)}
                              title={code.is_active ? "Deactivate" : "Activate"}
                            >
                              {code.is_active ? (
                                <ToggleRight className="w-5 h-5 text-green-600" />
                              ) : (
                                <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteCode(code.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

