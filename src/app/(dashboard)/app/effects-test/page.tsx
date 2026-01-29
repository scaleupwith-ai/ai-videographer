"use client";

import { useState } from "react";
import { Loader2, Play, Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

interface EffectConfig {
  // Slide-in shape overlay settings
  boxColor: string;
  boxWidth: number; // percentage of screen (0-100)
  slideDirection: "left" | "right";
  slideInDuration: number; // seconds
  holdDuration: number; // seconds
  slideOutDuration: number; // seconds
  text: string;
  textColor: string;
  fontSize: number;
  textFont: string;
}

const DEFAULT_CONFIG: EffectConfig = {
  boxColor: "#ff7f50", // Coral like in the example
  boxWidth: 50, // 50% of screen
  slideDirection: "right",
  slideInDuration: 0.5,
  holdDuration: 5,
  slideOutDuration: 0.5,
  text: "AGENDA",
  textColor: "#000000",
  fontSize: 80,
  textFont: "Bebas Neue",
};

// Separate component for FFmpeg code preview to avoid hydration issues
function FFmpegPreview({ config, totalDuration }: { config: EffectConfig; totalDuration: number }) {
  const boxWidthPercent = config.boxWidth / 100;
  const slideIn = config.slideInDuration;
  const holdEnd = slideIn + config.holdDuration;
  const slideOut = config.slideOutDuration;
  
  const boxColorHex = config.boxColor.replace('#', '0x');
  const textColorHex = config.textColor.replace('#', '0x');
  
  const xExprRight = `if(lt(t,${slideIn}),W-W*${boxWidthPercent}*(t/${slideIn}),if(gt(t,${holdEnd}),W-W*${boxWidthPercent}*(1-(t-${holdEnd})/${slideOut}),W-W*${boxWidthPercent}))`;
  const xExprLeft = `if(lt(t,${slideIn}),-W*${boxWidthPercent}+W*${boxWidthPercent}*(t/${slideIn}),if(gt(t,${holdEnd}),W*${boxWidthPercent}*(1-(t-${holdEnd})/${slideOut})-W*${boxWidthPercent},0))`;
  const xExpr = config.slideDirection === "right" ? xExprRight : xExprLeft;
  
  const textX = config.slideDirection === "right" 
    ? `W-W*${boxWidthPercent}/2-text_w/2` 
    : `W*${boxWidthPercent}/2-text_w/2`;

  const code = `# Slide-in from ${config.slideDirection}
# Duration: ${totalDuration.toFixed(1)}s (in: ${slideIn}s, hold: ${config.holdDuration}s, out: ${slideOut}s)

# 1. Create colored box that slides in
drawbox=x='${xExpr}':y=0:w=W*${boxWidthPercent}:h=H:color=${boxColorHex}:t=fill

# 2. Add text on top
drawtext=text='${config.text}':fontsize=${config.fontSize}:fontcolor=${textColorHex}:fontfile=...
:x=${textX}:y=(H-text_h)/2
:enable='between(t,${slideIn},${holdEnd})'`;

  return (
    <pre className="bg-slate-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm whitespace-pre-wrap">
      {code}
    </pre>
  );
}

export default function EffectsTestPage() {
  const [config, setConfig] = useState<EffectConfig>(DEFAULT_CONFIG);
  const [isRendering, setIsRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleRender = async () => {
    setIsRendering(true);
    setProgress(0);
    setPreviewUrl(null);

    try {
      // Simulate progress
      const interval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 300);

      const res = await fetch("/api/effects/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ effect: "slide-in-shape", config }),
      });

      clearInterval(interval);

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to render effect");
      }

      const data = await res.json();
      setProgress(100);
      setPreviewUrl(data.previewUrl);
      toast.success("Effect rendered!");
    } catch (error) {
      console.error("Render error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to render");
    } finally {
      setIsRendering(false);
    }
  };

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    setPreviewUrl(null);
    setProgress(0);
  };

  const totalDuration = config.slideInDuration + config.holdDuration + config.slideOutDuration;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Header */}
      <div className="shrink-0 border-b bg-card">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold">Effects Tester</h1>
          <p className="text-muted-foreground mt-1">
            Test and preview video effects before using them
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>
                  5-second test video on black background
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                  {isRendering ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                      <Loader2 className="w-12 h-12 animate-spin text-[#00f0ff]" />
                      <p className="text-white">Rendering...</p>
                      <div className="w-48">
                        <Progress value={progress} className="h-2" />
                      </div>
                    </div>
                  ) : previewUrl ? (
                    <video
                      src={previewUrl}
                      controls
                      autoPlay
                      loop
                      className="w-full h-full"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div 
                        className="h-full transition-all duration-500"
                        style={{
                          width: `${config.boxWidth}%`,
                          backgroundColor: config.boxColor,
                          marginLeft: config.slideDirection === "right" ? "auto" : 0,
                        }}
                      >
                        <div className="flex items-center justify-center h-full p-4">
                          <span 
                            style={{
                              color: config.textColor,
                              fontSize: `${config.fontSize / 3}px`,
                              fontFamily: config.textFont,
                              textDecoration: "underline",
                              textUnderlineOffset: "8px",
                            }}
                          >
                            {config.text}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  <Button 
                    onClick={handleRender} 
                    disabled={isRendering}
                    className="flex-1 bg-[#00f0ff] hover:bg-[#00d4e0] text-black"
                  >
                    {isRendering ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Rendering...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Render Test
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleReset}>
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Slide-In Shape Overlay</CardTitle>
                <CardDescription>
                  A shape slides in with text, then slides out
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Box Color */}
                <div className="space-y-2">
                  <Label>Box Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={config.boxColor}
                      onChange={(e) => setConfig({ ...config, boxColor: e.target.value })}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={config.boxColor}
                      onChange={(e) => setConfig({ ...config, boxColor: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* Box Width */}
                <div className="space-y-2">
                  <Label>Box Width: {config.boxWidth}%</Label>
                  <Slider
                    value={[config.boxWidth]}
                    onValueChange={([v]) => setConfig({ ...config, boxWidth: v })}
                    min={20}
                    max={80}
                    step={5}
                  />
                </div>

                {/* Slide Direction */}
                <div className="space-y-2">
                  <Label>Slide From</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={config.slideDirection === "right" ? "default" : "outline"}
                      onClick={() => setConfig({ ...config, slideDirection: "right" })}
                      className="flex-1"
                    >
                      Right
                    </Button>
                    <Button
                      variant={config.slideDirection === "left" ? "default" : "outline"}
                      onClick={() => setConfig({ ...config, slideDirection: "left" })}
                      className="flex-1"
                    >
                      Left
                    </Button>
                  </div>
                </div>

                {/* Timing */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Slide In (s)</Label>
                    <Input
                      type="number"
                      min={0.1}
                      max={2}
                      step={0.1}
                      value={config.slideInDuration}
                      onChange={(e) => setConfig({ ...config, slideInDuration: parseFloat(e.target.value) || 0.5 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Hold (s)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      step={0.5}
                      value={config.holdDuration}
                      onChange={(e) => setConfig({ ...config, holdDuration: parseFloat(e.target.value) || 5 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Slide Out (s)</Label>
                    <Input
                      type="number"
                      min={0.1}
                      max={2}
                      step={0.1}
                      value={config.slideOutDuration}
                      onChange={(e) => setConfig({ ...config, slideOutDuration: parseFloat(e.target.value) || 0.5 })}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Total duration: {totalDuration.toFixed(1)}s
                </p>

                {/* Text */}
                <div className="space-y-2">
                  <Label>Text</Label>
                  <Input
                    value={config.text}
                    onChange={(e) => setConfig({ ...config, text: e.target.value })}
                    placeholder="AGENDA"
                  />
                </div>

                {/* Text Color */}
                <div className="space-y-2">
                  <Label>Text Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={config.textColor}
                      onChange={(e) => setConfig({ ...config, textColor: e.target.value })}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={config.textColor}
                      onChange={(e) => setConfig({ ...config, textColor: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* Font Size */}
                <div className="space-y-2">
                  <Label>Font Size: {config.fontSize}px</Label>
                  <Slider
                    value={[config.fontSize]}
                    onValueChange={([v]) => setConfig({ ...config, fontSize: v })}
                    min={24}
                    max={200}
                    step={4}
                  />
                </div>

                {/* Font Family */}
                <div className="space-y-2">
                  <Label>Font</Label>
                  <select
                    value={config.textFont}
                    onChange={(e) => setConfig({ ...config, textFont: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border bg-background"
                    style={{ fontFamily: config.textFont }}
                  >
                    <option value="Bebas Neue" style={{ fontFamily: "'Bebas Neue'" }}>Bebas Neue</option>
                    <option value="Inter" style={{ fontFamily: "'Inter'" }}>Inter</option>
                    <option value="Montserrat" style={{ fontFamily: "'Montserrat'" }}>Montserrat</option>
                    <option value="Oswald" style={{ fontFamily: "'Oswald'" }}>Oswald</option>
                    <option value="Poppins" style={{ fontFamily: "'Poppins'" }}>Poppins</option>
                    <option value="Impact" style={{ fontFamily: "Impact" }}>Impact</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* FFmpeg Code Preview */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>FFmpeg Filter (Reference)</CardTitle>
              <CardDescription>
                This is the filter that will be generated
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FFmpegPreview config={config} totalDuration={totalDuration} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

