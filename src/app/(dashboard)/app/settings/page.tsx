"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, X, Play, Film, Music, Type, Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface UserSettings {
  id?: string;
  intro_asset_id: string | null;
  outro_asset_id: string | null;
  always_use_intro: boolean;
  always_use_outro: boolean;
  default_caption_words_per_block: number;
  default_caption_font: string;
  default_caption_style: {
    fontSize: number;
    color: string;
    backgroundColor: string;
    position: string;
  };
  default_music_volume: number;
  default_voiceover_volume: number;
  default_resolution: string;
  // Brand colors for effects
  brand_primary_color: string;
  brand_secondary_color: string;
  brand_accent_color: string;
}

interface MediaAsset {
  id: string;
  filename: string;
  public_url: string;
  duration_sec: number | null;
}

const CAPTION_FONTS = [
  "Inter",
  "Space Grotesk",
  "Roboto",
  "Open Sans",
  "Montserrat",
  "Poppins",
  "Oswald",
  "Bebas Neue",
  "Impact",
  "Arial Black",
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>({
    intro_asset_id: null,
    outro_asset_id: null,
    always_use_intro: false,
    always_use_outro: false,
    default_caption_words_per_block: 3,
    default_caption_font: "Inter",
    default_caption_style: {
      fontSize: 48,
      color: "#ffffff",
      backgroundColor: "#000000",
      position: "bottom",
    },
    default_music_volume: 0.3,
    default_voiceover_volume: 1.0,
    default_resolution: "1080p",
    brand_primary_color: "#00f0ff",
    brand_secondary_color: "#36454f",
    brand_accent_color: "#ff7f50",
  });
  
  const [introAsset, setIntroAsset] = useState<MediaAsset | null>(null);
  const [outroAsset, setOutroAsset] = useState<MediaAsset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingIntro, setIsUploadingIntro] = useState(false);
  const [isUploadingOutro, setIsUploadingOutro] = useState(false);
  
  const introInputRef = useRef<HTMLInputElement>(null);
  const outroInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/user/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSettings(data.settings);
          if (data.introAsset) setIntroAsset(data.introAsset);
          if (data.outroAsset) setOutroAsset(data.outroAsset);
        }
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      
      if (!res.ok) {
        throw new Error("Failed to save settings");
      }
      
      toast.success("Settings saved!");
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpload = async (file: File, type: "intro" | "outro") => {
    const setUploading = type === "intro" ? setIsUploadingIntro : setIsUploadingOutro;
    setUploading(true);
    
    try {
      // Get duration first
      const duration = await new Promise<number>((resolve) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
          resolve(Math.floor(video.duration * 10) / 10);
          URL.revokeObjectURL(video.src);
        };
        video.onerror = () => resolve(5); // Default 5s
        video.src = URL.createObjectURL(file);
      });
      
      // Get presigned URL
      const urlRes = await fetch("/api/assets/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mime: file.type,
          kind: "video",
        }),
      });
      
      if (!urlRes.ok) {
        const errorData = await urlRes.json().catch(() => ({}));
        console.error("Upload URL error:", errorData);
        throw new Error(errorData.error || "Failed to get upload URL");
      }
      const { uploadUrl, objectKey } = await urlRes.json();
      
      // Upload to R2
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      
      if (!uploadRes.ok) {
        throw new Error(`Upload failed: ${uploadRes.status}`);
      }
      
      // Complete upload
      const completeRes = await fetch("/api/assets/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectKey,
          kind: "video",
          filename: file.name,
          mime: file.type,
          sizeBytes: file.size,
          durationSec: duration,
          metadata: {
            name: `${type === "intro" ? "Intro" : "Outro"} Video`,
            description: `User ${type} video`,
          },
        }),
      });
      
      if (!completeRes.ok) {
        const errorData = await completeRes.json().catch(() => ({}));
        console.error("Complete upload error:", errorData);
        throw new Error(errorData.error || "Failed to complete upload");
      }
      const { asset } = await completeRes.json();
      console.log("Upload complete, asset:", asset);
      
      // Update local state
      const newSettings = {
        ...settings,
        [type === "intro" ? "intro_asset_id" : "outro_asset_id"]: asset.id,
        [type === "intro" ? "always_use_intro" : "always_use_outro"]: true,
      };
      setSettings(newSettings);
      
      if (type === "intro") {
        setIntroAsset({
          id: asset.id,
          filename: asset.filename,
          public_url: asset.public_url,
          duration_sec: asset.duration_sec,
        });
      } else {
        setOutroAsset({
          id: asset.id,
          filename: asset.filename,
          public_url: asset.public_url,
          duration_sec: asset.duration_sec,
        });
      }
      
      // Auto-save settings to database
      const saveRes = await fetch("/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      });
      
      if (!saveRes.ok) {
        console.error("Failed to auto-save settings");
      }
      
      toast.success(`${type === "intro" ? "Intro" : "Outro"} uploaded and saved!`);
      
    } catch (error) {
      toast.error(`Failed to upload ${type}`);
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (type: "intro" | "outro") => {
    const newSettings = {
      ...settings,
      [type === "intro" ? "intro_asset_id" : "outro_asset_id"]: null,
      [type === "intro" ? "always_use_intro" : "always_use_outro"]: false,
    };
    setSettings(newSettings);
    if (type === "intro") {
      setIntroAsset(null);
    } else {
      setOutroAsset(null);
    }
    
    // Persist to database
    try {
      const saveRes = await fetch("/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      });
      
      if (saveRes.ok) {
        toast.success(`${type === "intro" ? "Intro" : "Outro"} removed`);
      } else {
        toast.error("Failed to save changes");
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save changes");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto space-y-8 p-6 pb-24">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Settings className="w-8 h-8" />
            Video Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure default settings for all your videos
          </p>
        </div>

      {/* Intro/Outro Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="w-5 h-5" />
            Intro & Outro
          </CardTitle>
          <CardDescription>
            Upload custom intro and outro videos that will be automatically added to all your generated videos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Intro */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Intro Video</Label>
              <div className="flex items-center gap-2">
                <Label htmlFor="always-intro" className="text-sm text-muted-foreground">
                  Always use
                </Label>
                <Switch
                  id="always-intro"
                  checked={settings.always_use_intro}
                  onCheckedChange={(checked) => setSettings({ ...settings, always_use_intro: checked })}
                  disabled={!introAsset}
                />
              </div>
            </div>
            
            {introAsset ? (
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <video
                  src={introAsset.public_url}
                  className="w-32 h-20 object-cover rounded"
                  muted
                  playsInline
                />
                <div className="flex-1">
                  <p className="font-medium">{introAsset.filename}</p>
                  <p className="text-sm text-muted-foreground">
                    {introAsset.duration_sec ? `${introAsset.duration_sec}s` : "Duration unknown"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove("intro")}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ) : (
              <div
                onClick={() => introInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              >
                {isUploadingIntro ? (
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Click to upload intro video</p>
                  </>
                )}
              </div>
            )}
            <input
              ref={introInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file, "intro");
              }}
            />
          </div>

          {/* Outro */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Outro Video</Label>
              <div className="flex items-center gap-2">
                <Label htmlFor="always-outro" className="text-sm text-muted-foreground">
                  Always use
                </Label>
                <Switch
                  id="always-outro"
                  checked={settings.always_use_outro}
                  onCheckedChange={(checked) => setSettings({ ...settings, always_use_outro: checked })}
                  disabled={!outroAsset}
                />
              </div>
            </div>
            
            {outroAsset ? (
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <video
                  src={outroAsset.public_url}
                  className="w-32 h-20 object-cover rounded"
                  muted
                  playsInline
                />
                <div className="flex-1">
                  <p className="font-medium">{outroAsset.filename}</p>
                  <p className="text-sm text-muted-foreground">
                    {outroAsset.duration_sec ? `${outroAsset.duration_sec}s` : "Duration unknown"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove("outro")}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ) : (
              <div
                onClick={() => outroInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              >
                {isUploadingOutro ? (
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Click to upload outro video</p>
                  </>
                )}
              </div>
            )}
            <input
              ref={outroInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file, "outro");
              }}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            💡 Intro plays before your video content. Outro plays after. Music will continue through both.
          </p>
        </CardContent>
      </Card>

      {/* Caption Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="w-5 h-5" />
            Default Caption Settings
          </CardTitle>
          <CardDescription>
            Configure how captions appear by default (can be changed per video)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Words per Block</Label>
              <Select
                value={String(settings.default_caption_words_per_block)}
                onValueChange={(v) => setSettings({ ...settings, default_caption_words_per_block: parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 word</SelectItem>
                  <SelectItem value="2">2 words</SelectItem>
                  <SelectItem value="3">3 words</SelectItem>
                  <SelectItem value="4">4 words</SelectItem>
                  <SelectItem value="5">5 words</SelectItem>
                  <SelectItem value="6">6 words</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">How many words show at once</p>
            </div>

            <div className="space-y-2">
              <Label>Font</Label>
              <Select
                value={settings.default_caption_font}
                onValueChange={(v) => setSettings({ ...settings, default_caption_font: v })}
              >
                <SelectTrigger style={{ fontFamily: settings.default_caption_font }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAPTION_FONTS.map((font) => (
                    <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                      {font}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Text Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={settings.default_caption_style.color}
                  onChange={(e) => setSettings({
                    ...settings,
                    default_caption_style: { ...settings.default_caption_style, color: e.target.value }
                  })}
                  className="w-12 h-10 p-1"
                />
                <Input
                  value={settings.default_caption_style.color}
                  onChange={(e) => setSettings({
                    ...settings,
                    default_caption_style: { ...settings.default_caption_style, color: e.target.value }
                  })}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Background Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={settings.default_caption_style.backgroundColor}
                  onChange={(e) => setSettings({
                    ...settings,
                    default_caption_style: { ...settings.default_caption_style, backgroundColor: e.target.value }
                  })}
                  className="w-12 h-10 p-1"
                />
                <Input
                  value={settings.default_caption_style.backgroundColor}
                  onChange={(e) => setSettings({
                    ...settings,
                    default_caption_style: { ...settings.default_caption_style, backgroundColor: e.target.value }
                  })}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Position</Label>
              <Select
                value={settings.default_caption_style.position}
                onValueChange={(v) => setSettings({
                  ...settings,
                  default_caption_style: { ...settings.default_caption_style, position: v }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top">Top</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="bottom">Bottom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-black rounded-lg aspect-video flex items-end justify-center p-8 relative">
            <div
              className={`absolute ${
                settings.default_caption_style.position === "top" ? "top-8" :
                settings.default_caption_style.position === "center" ? "top-1/2 -translate-y-1/2" :
                "bottom-8"
              } left-1/2 -translate-x-1/2`}
            >
              <span
                style={{
                  fontFamily: settings.default_caption_font,
                  fontSize: "24px",
                  color: settings.default_caption_style.color,
                  backgroundColor: settings.default_caption_style.backgroundColor + "cc",
                  padding: "8px 16px",
                  borderRadius: "4px",
                }}
              >
                {"Caption ".repeat(settings.default_caption_words_per_block).trim()}
              </span>
            </div>
            <Badge variant="secondary" className="absolute top-2 right-2">Preview</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Brand Colors for Effects */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Brand Colors
          </CardTitle>
          <CardDescription>
            These colors will be used for video effects and overlays
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={settings.brand_primary_color}
                  onChange={(e) => setSettings({ ...settings, brand_primary_color: e.target.value })}
                  className="w-12 h-10 p-1"
                />
                <Input
                  value={settings.brand_primary_color}
                  onChange={(e) => setSettings({ ...settings, brand_primary_color: e.target.value })}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">Main brand color</p>
            </div>

            <div className="space-y-2">
              <Label>Secondary Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={settings.brand_secondary_color}
                  onChange={(e) => setSettings({ ...settings, brand_secondary_color: e.target.value })}
                  className="w-12 h-10 p-1"
                />
                <Input
                  value={settings.brand_secondary_color}
                  onChange={(e) => setSettings({ ...settings, brand_secondary_color: e.target.value })}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">Background/accent</p>
            </div>

            <div className="space-y-2">
              <Label>Accent Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={settings.brand_accent_color}
                  onChange={(e) => setSettings({ ...settings, brand_accent_color: e.target.value })}
                  className="w-12 h-10 p-1"
                />
                <Input
                  value={settings.brand_accent_color}
                  onChange={(e) => setSettings({ ...settings, brand_accent_color: e.target.value })}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">Highlight color</p>
            </div>
          </div>

          {/* Color Preview */}
          <div className="grid grid-cols-3 gap-4">
            <div 
              className="h-20 rounded-lg flex items-center justify-center text-white font-semibold shadow-lg"
              style={{ backgroundColor: settings.brand_primary_color }}
            >
              Primary
            </div>
            <div 
              className="h-20 rounded-lg flex items-center justify-center text-white font-semibold shadow-lg"
              style={{ backgroundColor: settings.brand_secondary_color }}
            >
              Secondary
            </div>
            <div 
              className="h-20 rounded-lg flex items-center justify-center text-black font-semibold shadow-lg"
              style={{ backgroundColor: settings.brand_accent_color }}
            >
              Accent
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audio Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="w-5 h-5" />
            Default Audio Levels
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Music Volume</Label>
                <span className="text-sm text-muted-foreground">{Math.round(settings.default_music_volume * 100)}%</span>
              </div>
              <Slider
                value={[settings.default_music_volume]}
                onValueChange={([v]) => setSettings({ ...settings, default_music_volume: v })}
                min={0}
                max={1}
                step={0.05}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Voiceover Volume</Label>
                <span className="text-sm text-muted-foreground">{Math.round(settings.default_voiceover_volume * 100)}%</span>
              </div>
              <Slider
                value={[settings.default_voiceover_volume]}
                onValueChange={([v]) => setSettings({ ...settings, default_voiceover_volume: v })}
                min={0}
                max={1}
                step={0.05}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} size="lg">
          {isSaving ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
          ) : (
            "Save Settings"
          )}
        </Button>
      </div>
      </div>
    </div>
  );
}
