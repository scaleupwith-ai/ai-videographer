"use client";

import { useState, useEffect } from "react";
import { Loader2, Play, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  EFFECT_TEMPLATES, 
  getEffectCategories, 
  getEffectById,
  type EffectTemplate,
  type EffectConfig,
  type EffectCategory,
} from "@/lib/effects/templates";

export default function EffectsTestPage() {
  const [selectedEffectId, setSelectedEffectId] = useState<string>(EFFECT_TEMPLATES[0]?.id || "");
  const [config, setConfig] = useState<EffectConfig>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [expandedCategories, setExpandedCategories] = useState<Set<EffectCategory>>(new Set(["lower_third", "shape_overlay"]));
  const [brandColors, setBrandColors] = useState({
    primary: "#00f0ff",
    secondary: "#36454f",
    accent: "#ff7f50",
  });

  const selectedEffect = getEffectById(selectedEffectId);
  const categories = getEffectCategories();

  // Fetch user's brand colors from settings
  useEffect(() => {
    fetchBrandColors();
  }, []);

  const fetchBrandColors = async () => {
    try {
      const res = await fetch("/api/user/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setBrandColors({
            primary: data.settings.brand_primary_color || "#00f0ff",
            secondary: data.settings.brand_secondary_color || "#36454f",
            accent: data.settings.brand_accent_color || "#ff7f50",
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch brand colors:", error);
    }
  };

  // Initialize config when effect changes
  useEffect(() => {
    if (selectedEffect) {
      const defaultConfig: EffectConfig = {};
      selectedEffect.properties.forEach(prop => {
        // Use brand colors for color properties where appropriate
        if (prop.type === "color") {
          if (prop.key.includes("primary") || prop.key === "boxColor" || prop.key === "lineColor") {
            defaultConfig[prop.key] = brandColors.primary;
          } else if (prop.key.includes("secondary") || prop.key === "bgColor") {
            defaultConfig[prop.key] = brandColors.secondary;
          } else if (prop.key.includes("accent") || prop.key === "borderColor") {
            defaultConfig[prop.key] = brandColors.accent;
          } else {
            defaultConfig[prop.key] = prop.default;
          }
        } else {
          defaultConfig[prop.key] = prop.default;
        }
      });
      // Add timing defaults
      defaultConfig.slideIn = selectedEffect.defaultTiming.slideIn;
      defaultConfig.hold = selectedEffect.defaultTiming.hold;
      defaultConfig.slideOut = selectedEffect.defaultTiming.slideOut;
      setConfig(defaultConfig);
    }
  }, [selectedEffectId, selectedEffect, brandColors]);

  const handlePlayPreview = () => {
    setAnimationKey(prev => prev + 1);
    setIsPlaying(true);
    
    const totalDuration = (config.slideIn as number || 0.5) + (config.hold as number || 3) + (config.slideOut as number || 0.5);
    setTimeout(() => {
      setIsPlaying(false);
    }, totalDuration * 1000);
  };

  const handleReset = () => {
    if (selectedEffect) {
      const defaultConfig: EffectConfig = {};
      selectedEffect.properties.forEach(prop => {
        defaultConfig[prop.key] = prop.default;
      });
      defaultConfig.slideIn = selectedEffect.defaultTiming.slideIn;
      defaultConfig.hold = selectedEffect.defaultTiming.hold;
      defaultConfig.slideOut = selectedEffect.defaultTiming.slideOut;
      setConfig(defaultConfig);
    }
    setIsPlaying(false);
  };

  const toggleCategory = (category: EffectCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const totalDuration = (config.slideIn as number || 0) + (config.hold as number || 0) + (config.slideOut as number || 0);

  // Generate CSS animation for preview
  const getPreviewAnimation = (effect: EffectTemplate | undefined) => {
    if (!effect || !isPlaying) return {};
    
    const slideIn = config.slideIn as number || 0.5;
    const hold = config.hold as number || 3;
    const slideOut = config.slideOut as number || 0.5;
    const total = slideIn + hold + slideOut;
    
    return {
      animation: `effectPreview-${animationKey} ${total}s ease-in-out forwards`,
    };
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Header */}
      <div className="shrink-0 border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold">Effects Library</h1>
          <p className="text-muted-foreground mt-1">
            {EFFECT_TEMPLATES.length} effects available • Click to preview • AI can auto-select effects for your videos
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex">
          {/* Left Sidebar - Effect List */}
          <div className="w-80 border-r bg-card/50 flex flex-col">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Effects by Category
              </h2>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2">
                {categories.map(({ category, count, label }) => (
                  <Collapsible 
                    key={category} 
                    open={expandedCategories.has(category)}
                    onOpenChange={() => toggleCategory(category)}
                  >
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-muted text-left">
                      <span className="font-medium">{label}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{count}</Badge>
                        {expandedCategories.has(category) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-2 space-y-1 py-1">
                        {EFFECT_TEMPLATES.filter(e => e.category === category).map(effect => (
                          <button
                            key={effect.id}
                            onClick={() => setSelectedEffectId(effect.id)}
                            className={`w-full text-left p-2 rounded-lg text-sm transition-colors ${
                              selectedEffectId === effect.id
                                ? "bg-primary/10 text-primary border border-primary/30"
                                : "hover:bg-muted"
                            }`}
                          >
                            <div className="font-medium">{effect.name}</div>
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {effect.description}
                            </div>
                          </button>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {selectedEffect ? (
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Effect Info */}
                <div>
                  <h2 className="text-2xl font-bold">{selectedEffect.name}</h2>
                  <p className="text-muted-foreground">{selectedEffect.description}</p>
                  <Badge variant="outline" className="mt-2">{selectedEffect.category.replace("_", " ")}</Badge>
                </div>

                {/* Preview */}
                <Card>
                  <CardHeader>
                    <CardTitle>Preview</CardTitle>
                    <CardDescription>
                      Live CSS preview • {totalDuration.toFixed(1)}s total duration
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Inject animation keyframes */}
                    <style>{`
                      @keyframes effectPreview-${animationKey} {
                        0% { opacity: 0; transform: translateX(${config.slideFrom === "right" ? "100%" : "-100%"}); }
                        ${((config.slideIn as number || 0.5) / totalDuration * 100).toFixed(0)}% { opacity: 1; transform: translateX(0); }
                        ${(((config.slideIn as number || 0.5) + (config.hold as number || 3)) / totalDuration * 100).toFixed(0)}% { opacity: 1; transform: translateX(0); }
                        100% { opacity: 0; transform: translateX(${config.slideFrom === "right" ? "100%" : "-100%"}); }
                      }
                    `}</style>
                    
                    <div 
                      className="aspect-video bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg overflow-hidden relative"
                      style={{
                        "--primary": brandColors.primary,
                        "--secondary": brandColors.secondary,
                        "--accent": brandColors.accent,
                      } as React.CSSProperties}
                    >
                      {/* Static sample video frame placeholder */}
                      <div className="absolute inset-0 flex items-center justify-center text-white/20 text-lg">
                        Sample Video Frame
                      </div>

                      {/* Effect preview */}
                      {selectedEffect.category === "lower_third" && (
                        <div 
                          key={animationKey}
                          className="absolute bottom-[10%] left-0"
                          style={isPlaying ? getPreviewAnimation(selectedEffect) : { opacity: 1 }}
                        >
                          <div 
                            className="px-8 py-4"
                            style={{ backgroundColor: config.boxColor as string || brandColors.primary }}
                          >
                            <div 
                              className="text-2xl font-bold"
                              style={{ color: config.textColor as string || "#fff" }}
                            >
                              {config.header as string || "Header Text"}
                            </div>
                            <div 
                              className="text-lg opacity-80"
                              style={{ color: config.textColor as string || "#fff" }}
                            >
                              {config.body as string || config.text as string || "Body Text"}
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedEffect.category === "shape_overlay" && (
                        <div 
                          key={animationKey}
                          className="absolute inset-y-0"
                          style={{
                            width: `${config.boxWidth as number || 50}%`,
                            backgroundColor: config.boxColor as string || brandColors.primary,
                            right: config.slideFrom === "right" ? 0 : "auto",
                            left: config.slideFrom !== "right" ? 0 : "auto",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            ...(isPlaying ? getPreviewAnimation(selectedEffect) : {}),
                          }}
                        >
                          <div 
                            className="text-4xl font-bold"
                            style={{ color: config.textColor as string || "#000" }}
                          >
                            {config.header as string || "HEADER"}
                          </div>
                          <div 
                            className="text-xl opacity-80 mt-2"
                            style={{ color: config.textColor as string || "#000" }}
                          >
                            {config.body as string || "Body text here"}
                          </div>
                        </div>
                      )}

                      {selectedEffect.category === "text_overlay" && (
                        <div 
                          key={animationKey}
                          className="absolute inset-0 flex items-center justify-center"
                          style={isPlaying ? { animation: `fadeInOut-${animationKey} ${totalDuration}s ease-in-out` } : {}}
                        >
                          <div 
                            className="font-bold text-shadow-lg"
                            style={{ 
                              color: config.textColor as string || "#fff",
                              fontSize: `${(config.fontSize as number || 72) / 3}px`,
                              textShadow: "0 4px 20px rgba(0,0,0,0.5)",
                            }}
                          >
                            {config.text as string || "Sample Text"}
                          </div>
                        </div>
                      )}

                      {selectedEffect.category === "social" && (
                        <div 
                          key={animationKey}
                          className="absolute bottom-[15%] right-[10%]"
                          style={isPlaying ? getPreviewAnimation(selectedEffect) : {}}
                        >
                          <div 
                            className="px-6 py-3 rounded font-bold"
                            style={{ 
                              backgroundColor: config.bgColor as string || "#ff0000",
                              color: config.textColor as string || "#fff",
                            }}
                          >
                            {config.text as string || "SUBSCRIBE"}
                          </div>
                        </div>
                      )}

                      {selectedEffect.category === "frame" && (
                        <div 
                          key={animationKey}
                          className="absolute inset-0 pointer-events-none"
                        >
                          {selectedEffect.id === "frame-letterbox" && (
                            <>
                              <div 
                                className="absolute top-0 left-0 right-0"
                                style={{ 
                                  height: `${config.barHeight as number || 12}%`,
                                  backgroundColor: config.barColor as string || "#000",
                                }}
                              />
                              <div 
                                className="absolute bottom-0 left-0 right-0"
                                style={{ 
                                  height: `${config.barHeight as number || 12}%`,
                                  backgroundColor: config.barColor as string || "#000",
                                }}
                              />
                            </>
                          )}
                          {selectedEffect.id === "frame-corner-accents" && (
                            <>
                              <div className="absolute top-10 left-10 w-16 h-16 border-l-4 border-t-4" style={{ borderColor: config.cornerColor as string || brandColors.accent }} />
                              <div className="absolute top-10 right-10 w-16 h-16 border-r-4 border-t-4" style={{ borderColor: config.cornerColor as string || brandColors.accent }} />
                              <div className="absolute bottom-10 left-10 w-16 h-16 border-l-4 border-b-4" style={{ borderColor: config.cornerColor as string || brandColors.accent }} />
                              <div className="absolute bottom-10 right-10 w-16 h-16 border-r-4 border-b-4" style={{ borderColor: config.cornerColor as string || brandColors.accent }} />
                            </>
                          )}
                          {selectedEffect.id === "frame-border-glow" && (
                            <div 
                              className="absolute inset-5 border-4"
                              style={{ 
                                borderColor: config.borderColor as string || brandColors.primary,
                                boxShadow: `0 0 20px ${config.borderColor as string || brandColors.primary}`,
                              }}
                            />
                          )}
                        </div>
                      )}

                      {selectedEffect.category === "progress" && (
                        <>
                          {selectedEffect.id === "progress-bar-bottom" && (
                            <div className="absolute bottom-0 left-0 right-0">
                              <div 
                                className="h-2"
                                style={{ backgroundColor: config.bgColor as string || "#333" }}
                              >
                                <div 
                                  key={animationKey}
                                  className="h-full"
                                  style={{ 
                                    backgroundColor: config.barColor as string || brandColors.primary,
                                    width: isPlaying ? "100%" : "30%",
                                    transition: isPlaying ? `width ${config.hold}s linear` : "none",
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          {selectedEffect.id === "progress-countdown" && (
                            <div 
                              className="absolute top-5 right-5 w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold"
                              style={{ 
                                backgroundColor: config.bgColor as string || "#000",
                                color: config.textColor as string || "#fff",
                              }}
                            >
                              {isPlaying ? "..." : config.startNumber as number || 10}
                            </div>
                          )}
                        </>
                      )}

                      {/* Playing indicator */}
                      {isPlaying && (
                        <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                          Playing
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 mt-4">
                      <Button 
                        onClick={handlePlayPreview} 
                        disabled={isPlaying}
                        className="flex-1 bg-[#00f0ff] hover:bg-[#00d4e0] text-black"
                      >
                        {isPlaying ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Playing ({totalDuration.toFixed(1)}s)
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            Play Preview
                          </>
                        )}
                      </Button>
                      <Button variant="outline" onClick={handleReset}>
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Configuration */}
                <Card>
                  <CardHeader>
                    <CardTitle>Configuration</CardTitle>
                    <CardDescription>
                      Customize the effect properties • Brand colors from Settings are used as defaults
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Timing */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Slide In: {(config.slideIn as number || 0).toFixed(1)}s</Label>
                        <Slider
                          value={[config.slideIn as number || 0.5]}
                          onValueChange={([v]) => setConfig({ ...config, slideIn: v })}
                          min={0.1}
                          max={2}
                          step={0.1}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Hold: {(config.hold as number || 0).toFixed(1)}s</Label>
                        <Slider
                          value={[config.hold as number || 3]}
                          onValueChange={([v]) => setConfig({ ...config, hold: v })}
                          min={1}
                          max={10}
                          step={0.5}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Slide Out: {(config.slideOut as number || 0).toFixed(1)}s</Label>
                        <Slider
                          value={[config.slideOut as number || 0.5]}
                          onValueChange={([v]) => setConfig({ ...config, slideOut: v })}
                          min={0.1}
                          max={2}
                          step={0.1}
                        />
                      </div>
                    </div>

                    {/* Effect-specific properties */}
                    <div className="grid grid-cols-2 gap-4">
                      {selectedEffect.properties.map(prop => (
                        <div key={prop.key} className="space-y-2">
                          <Label>{prop.label}</Label>
                          
                          {prop.type === "text" && (
                            <Input
                              value={config[prop.key] as string || ""}
                              onChange={(e) => setConfig({ ...config, [prop.key]: e.target.value })}
                            />
                          )}
                          
                          {prop.type === "color" && (
                            <div className="flex gap-2">
                              <Input
                                type="color"
                                value={config[prop.key] as string || "#000000"}
                                onChange={(e) => setConfig({ ...config, [prop.key]: e.target.value })}
                                className="w-12 h-10 p-1"
                              />
                              <Input
                                value={config[prop.key] as string || ""}
                                onChange={(e) => setConfig({ ...config, [prop.key]: e.target.value })}
                                className="flex-1"
                              />
                            </div>
                          )}
                          
                          {prop.type === "number" && (
                            <div className="flex items-center gap-2">
                              <Slider
                                value={[config[prop.key] as number || prop.default as number]}
                                onValueChange={([v]) => setConfig({ ...config, [prop.key]: v })}
                                min={prop.min || 0}
                                max={prop.max || 100}
                                step={1}
                                className="flex-1"
                              />
                              <span className="text-sm text-muted-foreground w-12 text-right">
                                {config[prop.key] as number || prop.default}
                              </span>
                            </div>
                          )}
                          
                          {prop.type === "select" && prop.options && (
                            <Select
                              value={config[prop.key] as string || prop.default as string}
                              onValueChange={(v) => setConfig({ ...config, [prop.key]: v })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {prop.options.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* FFmpeg Filter */}
                <Card>
                  <CardHeader>
                    <CardTitle>FFmpeg Filter</CardTitle>
                    <CardDescription>
                      Generated filter for video rendering
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-slate-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm whitespace-pre-wrap">
                      {Object.keys(config).length > 0 
                        ? selectedEffect.generateFilter(config, { width: 1920, height: 1080 })
                        : "Loading..."}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Select an effect from the sidebar
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
