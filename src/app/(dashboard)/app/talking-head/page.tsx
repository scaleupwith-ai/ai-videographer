"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Upload, Video, Trash2, Play, Pause, Volume2, VolumeX,
  Sparkles, Loader2, ChevronRight, X, Clock, FileVideo,
  Captions, Music2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadedVideo {
  id: string;
  file: File;
  previewUrl: string;
  duration: number;
  name: string;
  status: "pending" | "transcribing" | "ready" | "error";
  transcript?: string;
  captions?: Array<{ start: number; end: number; text: string }>;
}

interface MusicTrack {
  id: string;
  title: string;
  artist?: string;
  audio_url: string;
  duration_seconds: number;
}

// Maximum file size for transcription (uploads via R2 URL, much larger limit)
const MAX_TRANSCRIPTION_SIZE_MB = 500;

export default function TalkingHeadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Uploaded videos
  const [videos, setVideos] = useState<UploadedVideo[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // Settings
  const [projectTitle, setProjectTitle] = useState("");
  const [enableCaptions, setEnableCaptions] = useState(true);
  const [captionWordsPerBlock, setCaptionWordsPerBlock] = useState(3);
  const [captionFont, setCaptionFont] = useState("Impact");
  
  // Music
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const [selectedMusicId, setSelectedMusicId] = useState<string | null>(null);
  const [musicVolume, setMusicVolume] = useState<"off" | "faint" | "low" | "medium">("low");
  
  // B-roll settings
  const [brollFrequency, setBrollFrequency] = useState<"low" | "medium" | "high">("medium");
  const [brollDuration, setBrollDuration] = useState<"short" | "medium" | "long">("medium");
  const [brollPrompt, setBrollPrompt] = useState("");
  
  // Transcript editing
  const [editingTranscriptId, setEditingTranscriptId] = useState<string | null>(null);
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStep, setGenerationStep] = useState("");
  
  // Load music tracks
  useState(() => {
    fetch("/api/public/music")
      .then(res => res.json())
      .then(data => setMusicTracks(data.tracks || []))
      .catch(console.error);
  });
  
  // Handle file selection
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    setIsUploading(true);
    
    for (const file of files) {
      if (!file.type.startsWith("video/")) {
        toast.error(`${file.name} is not a video file`);
        continue;
      }
      
      // Check file size
      const fileSizeMB = file.size / 1024 / 1024;
      if (fileSizeMB > MAX_TRANSCRIPTION_SIZE_MB) {
        toast.error(`${file.name} is too large (${fileSizeMB.toFixed(1)}MB). Max ${MAX_TRANSCRIPTION_SIZE_MB}MB allowed.`);
        continue;
      }
      
      // Get video duration
      const duration = await new Promise<number>((resolve) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
          resolve(video.duration);
          URL.revokeObjectURL(video.src);
        };
        video.onerror = () => resolve(0);
        video.src = URL.createObjectURL(file);
      });
      
      if (duration === 0) {
        toast.error(`Could not read ${file.name}`);
        continue;
      }
      
      const newVideo: UploadedVideo = {
        id: `video-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        duration,
        name: file.name.replace(/\.[^/.]+$/, ""),
        status: "pending",
      };
      
      setVideos(prev => [...prev, newVideo]);
    }
    
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);
  
  // Remove video
  const removeVideo = useCallback((id: string) => {
    setVideos(prev => {
      const video = prev.find(v => v.id === id);
      if (video) URL.revokeObjectURL(video.previewUrl);
      return prev.filter(v => v.id !== id);
    });
  }, []);
  
  // Update transcript for a video and regenerate captions
  const updateTranscript = useCallback((id: string, newTranscript: string) => {
    setVideos(prev => prev.map(v => {
      if (v.id !== id) return v;
      
      // Regenerate captions from the edited transcript
      // Distribute words evenly across the video duration
      const words = newTranscript.split(/\s+/).filter(w => w.length > 0);
      const wordsPerCaption = 3;
      const duration = v.duration;
      const newCaptions: Array<{ start: number; end: number; text: string }> = [];
      
      if (words.length > 0 && duration > 0) {
        const timePerWord = duration / words.length;
        
        for (let i = 0; i < words.length; i += wordsPerCaption) {
          const wordGroup = words.slice(i, i + wordsPerCaption);
          if (wordGroup.length > 0) {
            newCaptions.push({
              start: i * timePerWord,
              end: Math.min((i + wordGroup.length) * timePerWord, duration),
              text: wordGroup.join(" "),
            });
          }
        }
      }
      
      return { 
        ...v, 
        transcript: newTranscript,
        captions: newCaptions,
      };
    }));
  }, []);
  
  // Transcribe a video using Deepgram
  const transcribeVideo = useCallback(async (videoId: string) => {
    const video = videos.find(v => v.id === videoId);
    if (!video) return;
    
    setVideos(prev => prev.map(v => 
      v.id === videoId ? { ...v, status: "transcribing" } : v
    ));
    
    try {
      const fileSizeMB = video.file.size / 1024 / 1024;
      
      // Check file size limit
      if (fileSizeMB > MAX_TRANSCRIPTION_SIZE_MB) {
        throw new Error(`File too large (${fileSizeMB.toFixed(1)}MB). Please use a video under ${MAX_TRANSCRIPTION_SIZE_MB}MB for transcription.`);
      }
      
      toast.info(`Transcribing ${video.name} (${fileSizeMB.toFixed(1)}MB)...`);
      
      // Always upload to R2 first, then send URL to transcribe API
      // This avoids Next.js body size limits entirely
      
      // Step 1: Get presigned upload URL
      const urlRes = await fetch("/api/assets/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: video.file.name,
          mime: video.file.type,
          kind: "temp",
        }),
      });
      
      if (!urlRes.ok) {
        throw new Error("Failed to get upload URL");
      }
      
      const { uploadUrl, objectKey } = await urlRes.json();
      
      // Step 2: Upload file directly to R2
      toast.info(`Uploading to cloud...`);
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: video.file,
        headers: { "Content-Type": video.file.type },
      });
      
      if (!uploadRes.ok) {
        throw new Error("Failed to upload file");
      }
      
      toast.info(`Upload complete, transcribing...`);
      
      // Step 3: Send URL to transcribe API
      const response = await fetch("/api/ai/transcribe-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          objectKey,
          filename: video.file.name,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Transcription failed");
      }
      
      if (!data.transcript || data.wordCount === 0) {
        toast.warning(`No speech detected in ${video.name}. The video may not have audio.`);
      }
      
      setVideos(prev => prev.map(v => 
        v.id === videoId ? { 
          ...v, 
          status: "ready",
          transcript: data.transcript || "(No speech detected)",
          captions: data.captions || [],
        } : v
      ));
      
      toast.success(`Transcribed: ${video.name} (${data.wordCount || 0} words)`);
    } catch (error) {
      console.error("Transcription error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setVideos(prev => prev.map(v => 
        v.id === videoId ? { ...v, status: "error" } : v
      ));
      toast.error(`${errorMessage}`);
    }
  }, [videos]);
  
  // Transcribe all pending videos
  const transcribeAll = useCallback(async () => {
    const pendingVideos = videos.filter(v => v.status === "pending");
    for (const video of pendingVideos) {
      await transcribeVideo(video.id);
    }
  }, [videos, transcribeVideo]);
  
  // Calculate total duration
  const totalDuration = videos.reduce((sum, v) => sum + v.duration, 0);
  
  // Generate the video
  const handleGenerate = async () => {
    if (videos.length === 0) {
      toast.error("Please upload at least one video");
      return;
    }
    
    // Check if all videos are transcribed
    const notReady = videos.filter(v => v.status !== "ready");
    if (notReady.length > 0) {
      toast.error("Please transcribe all videos first");
      return;
    }
    
    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationStep("Uploading videos...");
    
    try {
      // Upload all videos to R2
      const uploadedVideos: Array<{
        assetId: string;
        duration: number;
        transcript: string;
        captions: Array<{ start: number; end: number; text: string }>;
      }> = [];
      
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        setGenerationProgress((i / videos.length) * 30);
        setGenerationStep(`Uploading ${video.name}...`);
        
        // Get upload URL
        const urlRes = await fetch("/api/assets/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: video.file.name,
            mime: video.file.type,
            kind: "video",
          }),
        });
        
        if (!urlRes.ok) throw new Error("Failed to get upload URL");
        const { uploadUrl, objectKey } = await urlRes.json();
        
        // Upload file
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          body: video.file,
          headers: { "Content-Type": video.file.type },
        });
        
        if (!uploadRes.ok) throw new Error("Upload failed");
        
        // Save asset metadata
        const saveRes = await fetch("/api/assets/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            objectKey,
            kind: "video",
            filename: video.file.name,
            mime: video.file.type,
            sizeBytes: video.file.size,
            durationSec: video.duration,
            metadata: {
              name: video.name,
              description: "Talking head video",
              isTalkingHead: true,
            },
          }),
        });
        
        if (!saveRes.ok) throw new Error("Failed to save asset");
        const { asset } = await saveRes.json();
        
        uploadedVideos.push({
          assetId: asset.id,
          duration: video.duration,
          transcript: video.transcript || "",
          captions: video.captions || [],
        });
      }
      
      setGenerationProgress(35);
      setGenerationStep("AI analyzing speech patterns...");
      
      // Call the talking head API
      const response = await fetch("/api/ai/build-talking-head-timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: projectTitle || "My Talking Head Video",
          videos: uploadedVideos,
          settings: {
            enableCaptions,
            captionWordsPerBlock,
            captionFont,
            selectedMusicId,
            musicVolume,
            brollFrequency,
            brollDuration,
            brollPrompt,
          },
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Generation failed");
      }
      
      const data = await response.json();
      
      setGenerationProgress(90);
      setGenerationStep("Starting render...");
      
      // Auto-start rendering
      const renderRes = await fetch(`/api/projects/${data.projectId}/render`, {
        method: "POST",
      });
      
      if (!renderRes.ok) {
        const renderError = await renderRes.json();
        // If render fails due to credits, still redirect but show a warning
        if (renderRes.status === 402) {
          toast.warning("Project created but you need credits to render. Redirecting...");
        } else {
          console.error("Render error:", renderError);
          toast.warning("Project created but render failed to start. You can try again from the project page.");
        }
      } else {
        toast.success("Video rendering started! Redirecting...");
      }
      
      setGenerationProgress(100);
      setGenerationStep("Complete!");
      
      // Redirect to project page
      setTimeout(() => {
        router.push(`/app/projects/${data.projectId}`);
      }, 1000);
      
    } catch (error) {
      console.error("Generation error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate video");
    } finally {
      setIsGenerating(false);
    }
  };
  
  return (
    <div className="container max-w-4xl py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Talking Head + B-Roll</h1>
        <p className="text-muted-foreground mt-2">
          Upload videos of yourself speaking. AI will automatically cut to relevant B-roll 
          while keeping your audio playing, then cut back to you.
        </p>
      </div>
      
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            Your Videos
          </CardTitle>
          <CardDescription>
            Upload one or more videos of yourself speaking. We'll transcribe the audio and 
            intelligently insert B-roll clips.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload area */}
          <div 
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              "hover:border-primary hover:bg-primary/5",
              isUploading && "opacity-50 pointer-events-none"
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <Upload className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
            <p className="font-medium">Click to upload videos</p>
            <p className="text-sm text-muted-foreground mt-1">
              MP4, MOV, or WebM • Max {MAX_TRANSCRIPTION_SIZE_MB}MB per video
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Tip: Compress larger videos or split them into shorter clips
            </p>
          </div>
          
          {/* Uploaded videos list */}
          {videos.length > 0 && (
            <div className="space-y-3">
              {videos.map((video) => (
                <div 
                  key={video.id}
                  className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg"
                >
                  {/* Preview */}
                  <div className="w-32 h-20 bg-black rounded overflow-hidden flex-shrink-0">
                    <video 
                      src={video.previewUrl} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{video.name}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {Math.floor(video.duration / 60)}:{String(Math.floor(video.duration % 60)).padStart(2, "0")}
                      </span>
                      <Badge 
                        variant={
                          video.status === "ready" ? "default" :
                          video.status === "transcribing" ? "secondary" :
                          video.status === "error" ? "destructive" : "outline"
                        }
                      >
                        {video.status === "transcribing" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                        {video.status}
                      </Badge>
                    </div>
                    
                    {/* Transcript display/edit */}
                    {video.transcript && editingTranscriptId !== video.id && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground truncate">
                          "{video.transcript.slice(0, 100)}..."
                        </p>
                        <Button
                          size="sm"
                          variant="link"
                          className="h-auto p-0 text-xs"
                          onClick={() => setEditingTranscriptId(video.id)}
                        >
                          Edit transcript
                        </Button>
                      </div>
                    )}
                    
                    {/* Transcript editor */}
                    {video.transcript && editingTranscriptId === video.id && (
                      <div className="mt-2 space-y-2">
                        <Textarea
                          value={video.transcript}
                          onChange={(e) => updateTranscript(video.id, e.target.value)}
                          className="text-xs min-h-[80px]"
                          placeholder="Edit transcript..."
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingTranscriptId(null)}
                          >
                            Done
                          </Button>
                          <p className="text-xs text-muted-foreground self-center">
                            Edit misspellings or fix transcription errors
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {video.status === "pending" && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => transcribeVideo(video.id)}
                      >
                        Transcribe
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeVideo(video.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              
              {/* Transcribe all button */}
              {videos.some(v => v.status === "pending") && (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={transcribeAll}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Transcribe All ({videos.filter(v => v.status === "pending").length} pending)
                </Button>
              )}
              
              {/* Total duration */}
              <div className="flex justify-between text-sm text-muted-foreground pt-2 border-t">
                <span>Total Duration</span>
                <span className="font-medium">
                  {Math.floor(totalDuration / 60)}:{String(Math.floor(totalDuration % 60)).padStart(2, "0")}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Project Title */}
          <div className="space-y-2">
            <Label>Project Title</Label>
            <Input
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              placeholder="My Talking Head Video"
            />
          </div>
          
          {/* B-Roll Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>B-Roll Frequency</Label>
              <Select value={brollFrequency} onValueChange={(v: any) => setBrollFrequency(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - Minimal cuts</SelectItem>
                  <SelectItem value="medium">Medium - Balanced</SelectItem>
                  <SelectItem value="high">High - Frequent cuts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>B-Roll Duration</Label>
              <Select value={brollDuration} onValueChange={(v: any) => setBrollDuration(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short - 2-4 seconds</SelectItem>
                  <SelectItem value="medium">Medium - 4-7 seconds</SelectItem>
                  <SelectItem value="long">Long - 7-12 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* B-Roll Prompt */}
          <div className="space-y-2">
            <Label>B-Roll Instructions (Optional)</Label>
            <Textarea
              placeholder="E.g., 'This video is about waterproofing bathrooms. Use clips showing waterproof membranes, tiling, and bathroom renovations.'"
              value={brollPrompt}
              onChange={(e) => setBrollPrompt(e.target.value)}
              className="min-h-[80px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Help the AI choose better B-roll by describing your industry, topic, or preferred clip types
            </p>
          </div>
          
          {/* Captions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Captions</Label>
                <p className="text-sm text-muted-foreground">Burn captions into the video</p>
              </div>
              <Switch
                checked={enableCaptions}
                onCheckedChange={setEnableCaptions}
              />
            </div>
            
            {enableCaptions && (
              <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-primary/20">
                <div className="space-y-2">
                  <Label>Words Per Block</Label>
                  <Select 
                    value={String(captionWordsPerBlock)} 
                    onValueChange={(v) => setCaptionWordsPerBlock(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 words</SelectItem>
                      <SelectItem value="3">3 words</SelectItem>
                      <SelectItem value="4">4 words</SelectItem>
                      <SelectItem value="5">5 words</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Caption Font</Label>
                  <Select value={captionFont} onValueChange={setCaptionFont}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Impact">Impact (Bold)</SelectItem>
                      <SelectItem value="Arial">Arial</SelectItem>
                      <SelectItem value="Helvetica">Helvetica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
          
          {/* Music */}
          <div className="space-y-4">
            <Label>Background Music (Optional)</Label>
            <div className="grid grid-cols-2 gap-4">
              <Select 
                value={selectedMusicId || "none"} 
                onValueChange={(v) => setSelectedMusicId(v === "none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No music" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No music</SelectItem>
                  {musicTracks.map((track) => (
                    <SelectItem key={track.id} value={track.id}>
                      {track.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedMusicId && (
                <Select value={musicVolume} onValueChange={(v: any) => setMusicVolume(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="faint">Faint</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Generate Button */}
      <div className="flex flex-col gap-4">
        {isGenerating && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{generationStep}</span>
              <span>{Math.round(generationProgress)}%</span>
            </div>
            <Progress value={generationProgress} />
          </div>
        )}
        
        <Button 
          size="lg" 
          className="w-full"
          onClick={handleGenerate}
          disabled={isGenerating || videos.length === 0 || videos.some(v => v.status !== "ready")}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 mr-2" />
              Generate Video with B-Roll
            </>
          )}
        </Button>
        
        {videos.length > 0 && videos.some(v => v.status !== "ready") && (
          <p className="text-sm text-center text-muted-foreground">
            Transcribe all videos before generating
          </p>
        )}
      </div>
    </div>
  );
}

