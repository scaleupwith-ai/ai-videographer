"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Palette, Plus, Trash2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { BrandPreset } from "@/lib/database.types";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [brandPresets, setBrandPresets] = useState<BrandPreset[]>([]);
  const [newPresetName, setNewPresetName] = useState("");
  const [creatingPreset, setCreatingPreset] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const supabase = createClient();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser({ email: user.email || "" });
      }

      const { data: presets } = await supabase
        .from("brand_presets")
        .select("*")
        .order("created_at", { ascending: false });
      
      setBrandPresets((presets as BrandPreset[]) || []);
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePreset = async () => {
    if (!newPresetName.trim()) {
      toast.error("Please enter a preset name");
      return;
    }

    setCreatingPreset(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Not authenticated");
        return;
      }

      const { data: preset, error } = await supabase
        .from("brand_presets")
        .insert({
          owner_id: user.id,
          name: newPresetName.trim(),
          colors: {
            primary: "#00b4d8",
            secondary: "#0077b6",
            accent: "#ff6b6b",
            text: "#ffffff",
            background: "#1a1a2e",
          },
          fonts: {
            heading: "Space Grotesk",
            body: "Inter",
          },
          safe_margins: {
            top: 50,
            bottom: 50,
            left: 50,
            right: 50,
          },
          overlay_style: "lower_third",
        })
        .select()
        .single();

      if (error) throw error;

      setBrandPresets((prev) => [preset as BrandPreset, ...prev]);
      setNewPresetName("");
      toast.success("Brand preset created");
    } catch (error) {
      console.error("Failed to create preset:", error);
      toast.error("Failed to create preset");
    } finally {
      setCreatingPreset(false);
    }
  };

  const handleDeletePreset = async (presetId: string) => {
    if (!confirm("Delete this brand preset?")) return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("brand_presets")
        .delete()
        .eq("id", presetId);

      if (error) throw error;

      setBrandPresets((prev) => prev.filter((p) => p.id !== presetId));
      toast.success("Preset deleted");
    } catch (error) {
      console.error("Failed to delete preset:", error);
      toast.error("Failed to delete preset");
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your account and brand presets
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Account Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5" />
              <CardTitle>Account</CardTitle>
            </div>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ""} disabled />
            </div>
            <Separator />
            <Button variant="destructive" onClick={handleSignOut}>
              Sign Out
            </Button>
          </CardContent>
        </Card>

        {/* Brand Presets Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              <CardTitle>Brand Presets</CardTitle>
            </div>
            <CardDescription>
              Create brand presets with your logo, colors, and styles for consistent videos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Create new preset */}
            <div className="flex gap-2">
              <Input
                placeholder="New preset name..."
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreatePreset();
                }}
              />
              <Button onClick={handleCreatePreset} disabled={creatingPreset}>
                {creatingPreset ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </Button>
            </div>

            <Separator />

            {/* Existing presets */}
            {brandPresets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No brand presets yet. Create one above.
              </p>
            ) : (
              <div className="space-y-3">
                {brandPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: preset.colors.primary }}
                        />
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: preset.colors.secondary }}
                        />
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: preset.colors.accent }}
                        />
                      </div>
                      <span className="font-medium">{preset.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeletePreset(preset.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

