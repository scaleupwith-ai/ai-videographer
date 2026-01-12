"use client";

import { useMemo } from "react";
import {
  Film,
  Image,
  Music,
  Mic,
  Type,
  Palette,
  Settings,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useEditorStore } from "@/lib/state/editorStore";
import { formatDuration } from "@/lib/date";
import type { MediaAsset, BrandPreset } from "@/lib/database.types";
import type { Scene } from "@/lib/timeline/v1";

interface InspectorPanelProps {
  assets: MediaAsset[];
  brandPresets: BrandPreset[];
}

export function InspectorPanel({ assets, brandPresets }: InspectorPanelProps) {
  const {
    timeline,
    selectedSceneId,
    updateSceneById,
    updateGlobalMusic,
    updateGlobalVoiceover,
    updateGlobalBrand,
    updateGlobalExport,
  } = useEditorStore();

  const selectedScene = useMemo(() => {
    if (!timeline || !selectedSceneId) return null;
    return timeline.scenes.find((s) => s.id === selectedSceneId) || null;
  }, [timeline, selectedSceneId]);

  const videoAssets = useMemo(
    () => assets.filter((a) => a.kind === "video"),
    [assets]
  );
  const imageAssets = useMemo(
    () => assets.filter((a) => a.kind === "image"),
    [assets]
  );
  const audioAssets = useMemo(
    () => assets.filter((a) => a.kind === "audio"),
    [assets]
  );

  if (!timeline) {
    return (
      <div className="p-4 text-center text-muted-foreground">Loading...</div>
    );
  }

  const updateOverlay = (key: string, value: string | null) => {
    if (!selectedScene) return;
    updateSceneById(selectedScene.id, {
      overlays: {
        ...selectedScene.overlays,
        [key]: value,
      },
    } as Partial<Scene>);
  };

  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="scene" className="flex-1 flex flex-col">
        <div className="shrink-0 border-b border-border px-4">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="scene">Scene</TabsTrigger>
            <TabsTrigger value="global">Global</TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          {/* Scene Tab */}
          <TabsContent value="scene" className="m-0 p-4 space-y-6">
            {selectedScene ? (
              <>
                {/* Media Selection */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {selectedScene.kind === "video" ? (
                      <Film className="w-4 h-4" />
                    ) : (
                      <Image className="w-4 h-4" />
                    )}
                    <Label className="font-medium">Media</Label>
                  </div>

                  <Select
                    value={selectedScene.assetId || ""}
                    onValueChange={(value) =>
                      updateSceneById(selectedScene.id, {
                        assetId: value || null,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select media..." />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedScene.kind === "video" ? (
                        videoAssets.length > 0 ? (
                          videoAssets.map((asset) => (
                            <SelectItem key={asset.id} value={asset.id}>
                              {asset.filename}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="" disabled>
                            No videos uploaded
                          </SelectItem>
                        )
                      ) : imageAssets.length > 0 ? (
                        imageAssets.map((asset) => (
                          <SelectItem key={asset.id} value={asset.id}>
                            {asset.filename}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="" disabled>
                          No images uploaded
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>

                  <Select
                    value={selectedScene.kind}
                    onValueChange={(value: "video" | "image") =>
                      updateSceneById(selectedScene.id, { kind: value, assetId: null })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="image">Image</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Trim Controls */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <Label className="font-medium">Duration & Trim</Label>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        In Point
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.1}
                        value={selectedScene.inSec}
                        onChange={(e) =>
                          updateSceneById(selectedScene.id, {
                            inSec: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Out Point
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.1}
                        value={selectedScene.outSec}
                        onChange={(e) =>
                          updateSceneById(selectedScene.id, {
                            outSec: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Duration: {formatDuration(selectedScene.durationSec)}
                  </p>
                </div>

                <Separator />

                {/* Overlay Text */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Type className="w-4 h-4" />
                    <Label className="font-medium">Overlay Text</Label>
                  </div>

                  <div className="space-y-2">
                    <Input
                      placeholder="Title..."
                      value={selectedScene.overlays?.title || ""}
                      onChange={(e) => updateOverlay("title", e.target.value || null)}
                    />
                    <Input
                      placeholder="Subtitle..."
                      value={selectedScene.overlays?.subtitle || ""}
                      onChange={(e) => updateOverlay("subtitle", e.target.value || null)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Position
                      </Label>
                      <Select
                        value={selectedScene.overlays?.position || "lower_third"}
                        onValueChange={(value) => updateOverlay("position", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="center">Center</SelectItem>
                          <SelectItem value="top">Top</SelectItem>
                          <SelectItem value="bottom">Bottom</SelectItem>
                          <SelectItem value="lower_third">Lower Third</SelectItem>
                          <SelectItem value="upper_third">Upper Third</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Style
                      </Label>
                      <Select
                        value={selectedScene.overlays?.stylePreset || "lower_third"}
                        onValueChange={(value) => updateOverlay("stylePreset", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="boxed">Boxed</SelectItem>
                          <SelectItem value="lower_third">Lower Third</SelectItem>
                          <SelectItem value="minimal">Minimal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Transition */}
                <div className="space-y-3">
                  <Label className="font-medium">Transition Out</Label>
                  <Select
                    value={selectedScene.transitionOut || "none"}
                    onValueChange={(value) =>
                      updateSceneById(selectedScene.id, {
                        transitionOut: value === "none" ? null : value as "crossfade" | "fade_black",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="crossfade">Crossfade</SelectItem>
                      <SelectItem value="fade_black">Fade to Black</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Type className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Select a scene</p>
                <p className="text-xs">to edit its properties</p>
              </div>
            )}
          </TabsContent>

          {/* Global Tab */}
          <TabsContent value="global" className="m-0 p-4 space-y-6">
            {/* Music */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4" />
                <Label className="font-medium">Background Music</Label>
              </div>

              <Select
                value={timeline.global.music.assetId || ""}
                onValueChange={(value) =>
                  updateGlobalMusic({ assetId: value || null })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select music..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {audioAssets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.filename}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Volume: {Math.round(timeline.global.music.volume * 100)}%
                </Label>
                <Slider
                  value={[timeline.global.music.volume]}
                  max={1}
                  step={0.05}
                  onValueChange={(value) =>
                    updateGlobalMusic({ volume: value[0] })
                  }
                />
              </div>
            </div>

            <Separator />

            {/* Voiceover */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4" />
                <Label className="font-medium">Voiceover</Label>
              </div>

              <Select
                value={timeline.global.voiceover.assetId || ""}
                onValueChange={(value) =>
                  updateGlobalVoiceover({ assetId: value || null })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select voiceover..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {audioAssets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.filename}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Volume: {Math.round(timeline.global.voiceover.volume * 100)}%
                </Label>
                <Slider
                  value={[timeline.global.voiceover.volume]}
                  max={1}
                  step={0.05}
                  onValueChange={(value) =>
                    updateGlobalVoiceover({ volume: value[0] })
                  }
                />
              </div>
            </div>

            <Separator />

            {/* Brand */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                <Label className="font-medium">Brand</Label>
              </div>

              <Select
                value={timeline.global.brand.presetId || ""}
                onValueChange={(value) =>
                  updateGlobalBrand({ presetId: value || null })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select brand preset..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {brandPresets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Logo Position
                  </Label>
                  <Select
                    value={timeline.global.brand.logoPosition}
                    onValueChange={(value: "top-left" | "top-right" | "bottom-left" | "bottom-right") =>
                      updateGlobalBrand({ logoPosition: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top-left">Top Left</SelectItem>
                      <SelectItem value="top-right">Top Right</SelectItem>
                      <SelectItem value="bottom-left">Bottom Left</SelectItem>
                      <SelectItem value="bottom-right">Bottom Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Logo Size
                  </Label>
                  <Input
                    type="number"
                    min={20}
                    max={200}
                    value={timeline.global.brand.logoSize}
                    onChange={(e) =>
                      updateGlobalBrand({
                        logoSize: parseInt(e.target.value) || 80,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Export Settings */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <Label className="font-medium">Export Settings</Label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Codec</Label>
                  <Select
                    value={timeline.global.export.codec}
                    onValueChange={(value: "h264" | "h265") =>
                      updateGlobalExport({ codec: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="h264">H.264</SelectItem>
                      <SelectItem value="h265">H.265 (HEVC)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Bitrate (Mbps)
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={timeline.global.export.bitrateMbps}
                    onChange={(e) =>
                      updateGlobalExport({
                        bitrateMbps: parseInt(e.target.value) || 10,
                      })
                    }
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

