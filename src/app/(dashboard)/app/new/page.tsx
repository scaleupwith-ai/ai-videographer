"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { 
  Mic, MicOff, FileText, Upload, Sparkles, Loader2, 
  ChevronRight, ChevronLeft, Check, Film, ArrowLeftRight,
  Search, X, Play, RefreshCw, Music, UserSquare2, Volume2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Available transitions for user to choose
const TRANSITIONS = [
  { value: "none", label: "No Transition" },
  { value: "fade", label: "Fade" },
  { value: "fadeblack", label: "Fade to Black" },
  { value: "fadewhite", label: "Fade to White" },
  { value: "wipeleft", label: "Wipe Left" },
  { value: "wiperight", label: "Wipe Right" },
  { value: "slideup", label: "Slide Up" },
  { value: "slidedown", label: "Slide Down" },
  { value: "circleopen", label: "Circle Open" },
  { value: "circleclose", label: "Circle Close" },
  { value: "dissolve", label: "Dissolve" },
  { value: "pixelize", label: "Pixelize" },
  { value: "radial", label: "Radial" },
];

interface Voice {
  id: string;
  name: string;
  eleven_labs_id: string;
  profile_image_url: string | null;
  is_default: boolean;
}

interface UserAsset {
  id: string;
  filename: string;
  public_url: string;
  thumbnail_url: string | null;
  kind: string;
  duration_sec: number | null;
  metadata: {
    name?: string;
    description?: string;
  } | null;
}

interface TimelineScene {
  clipId: string;
  intent: string;
  clipDescription: string;
  durationSec: number;
  transitionOut: string | null;
  transitionDuration: number;
  isUserAsset?: boolean;
}

interface Clip {
  id: string;
  description: string;
  tags: string[];
  durationSeconds: number;
  thumbnailUrl: string | null;
}

type Step = 
  | "video-type"
  | "talking-head-upload"  // New step for talking head video upload
  | "voiceover" 
  | "script" 
  | "assets" 
  | "describe" 
  | "generating" 
  | "timeline";

type VideoType = "talking-head" | "voiceover" | null;

export default function NewVideoPage() {
  const router = useRouter();
  
  // AI Mode - let AI decide everything
  const [aiMode, setAiMode] = useState<boolean>(false);
  
  // Video type - talking head or voiceover video
  const [videoType, setVideoType] = useState<VideoType>(null);
  
  // Current step
  const [step, setStep] = useState<Step>("video-type");
  
  // Step 1: Voiceover
  const [wantVoiceover, setWantVoiceover] = useState<boolean | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [voiceoverVolume, setVoiceoverVolume] = useState<number>(1.0); // 0.3-1.5
  
  // Step 2: Script
  const [hasScript, setHasScript] = useState<boolean | null>(null);
  const [script, setScript] = useState("");
  const [isEditingScript, setIsEditingScript] = useState(false);
  
  // Step 3: User Assets
  const [wantUserAssets, setWantUserAssets] = useState<boolean | null>(null);
  const [userAssets, setUserAssets] = useState<UserAsset[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  
  // Music selection
  const [musicTracks, setMusicTracks] = useState<Array<{ id: string; title: string; artist: string | null; duration_seconds: number; audio_url: string; genre: string | null }>>([]);
  const [selectedMusicId, setSelectedMusicId] = useState<string>("");
  const [musicVolume, setMusicVolume] = useState<"loud" | "medium" | "low" | "faint">("medium");
  
  // Quality settings
  const [videoQuality, setVideoQuality] = useState<"4k" | "1080p" | "720p">("1080p");
  
  // Caption settings
  const [enableCaptions, setEnableCaptions] = useState<boolean>(false);
  const [captionWordsPerBlock, setCaptionWordsPerBlock] = useState<number>(3);
  const [captionFont, setCaptionFont] = useState<string>("Inter");
  
  // Step 4: Description
  const [description, setDescription] = useState("");
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  
  // Timeline state
  const [projectId, setProjectId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<{ title: string; scenes: TimelineScene[] } | null>(null);
  const [voiceoverDuration, setVoiceoverDuration] = useState<number>(0);
  
  // Scene switching
  const [swapSceneIndex, setSwapSceneIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Clip[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Rendering
  const [isRendering, setIsRendering] = useState(false);
  
  // Talking head specific state
  const [talkingHeadAsset, setTalkingHeadAsset] = useState<UserAsset | null>(null);
  const [brollFrequency, setBrollFrequency] = useState<"low" | "medium" | "high">("medium");
  const [brollLength, setBrollLength] = useState<number>(3); // seconds
  const [talkingHeadCaptions, setTalkingHeadCaptions] = useState<boolean>(false);
  const [talkingHeadPrompt, setTalkingHeadPrompt] = useState<string>("");

  // Fetch voices and music on mount
  useEffect(() => {
    fetchVoices();
    fetchMusic();
  }, []);

  const fetchVoices = async () => {
    try {
      const res = await fetch("/api/voices");
      if (res.ok) {
        const data = await res.json();
        setVoices(data.voices || []);
        const defaultVoice = data.voices?.find((v: Voice) => v.is_default);
        if (defaultVoice) {
          setSelectedVoiceId(defaultVoice.id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch voices:", error);
    }
  };

  const fetchMusic = async () => {
    try {
      const res = await fetch("/api/public/music");
      if (res.ok) {
        const data = await res.json();
        setMusicTracks(data.tracks || []);
      }
    } catch (error) {
      console.error("Failed to fetch music:", error);
    }
  };

  const fetchUserAssets = async () => {
    try {
      const res = await fetch("/api/assets");
      if (res.ok) {
        const data = await res.json();
        setUserAssets(data.assets || []);
      }
    } catch (error) {
      console.error("Failed to fetch assets:", error);
    }
  };

  const handleVoiceoverChoice = (want: boolean) => {
    setWantVoiceover(want);
    if (want) {
      // Stay to pick voice, then next
    } else {
      setStep("assets");
      fetchUserAssets();
    }
  };

  const handleScriptChoice = (has: boolean) => {
    setHasScript(has);
    if (has) {
      setIsEditingScript(true);
    }
  };

  const handleAssetChoice = (want: boolean) => {
    setWantUserAssets(want);
    if (want) {
      fetchUserAssets();
    }
  };

  const toggleAssetSelection = (assetId: string) => {
    setSelectedAssetIds(prev => 
      prev.includes(assetId) 
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    );
  };

  const goToNextStep = () => {
    // In AI mode, go directly to generate from voiceover step
    if (aiMode && step === "voiceover") {
      handleGenerate();
      return;
    }
    
    switch (step) {
      case "video-type":
        if (videoType === "talking-head") {
          // Talking head goes to upload step first
          fetchUserAssets();
          setStep("talking-head-upload");
        } else {
          setStep("voiceover");
        }
        break;
      case "talking-head-upload":
        // For talking head, go directly to generate - all options are on this page
        handleGenerate();
        break;
      case "voiceover":
        setStep("script");
        break;
      case "script":
        setStep("assets");
        fetchUserAssets();
        break;
      case "assets":
        setStep("describe");
        break;
      case "describe":
        handleGenerate();
        break;
    }
  };

  const goToPrevStep = () => {
    switch (step) {
      case "talking-head-upload":
        setStep("video-type");
        break;
      case "voiceover":
        setStep("video-type");
        break;
      case "script":
        setStep("voiceover");
        break;
      case "assets":
        setStep("script");
        break;
      case "describe":
        if (videoType === "talking-head") {
          // Talking head goes back to upload, skip script/assets
          setStep("talking-head-upload");
        } else {
          setStep("assets");
        }
        break;
      case "timeline":
        setStep("describe");
        break;
    }
  };

  const canProceed = () => {
    switch (step) {
      case "video-type":
        return videoType !== null;
      case "talking-head-upload":
        return talkingHeadAsset !== null;
      case "voiceover":
        // In AI mode, just need description
        if (aiMode) return description.trim().length > 10;
        if (wantVoiceover === null) return false;
        if (wantVoiceover && !selectedVoiceId) return false;
        return true;
      case "script":
        if (wantVoiceover || videoType === "talking-head") {
          if (hasScript === null) return false;
          if (hasScript && !script.trim()) return false;
        }
        return true;
      case "assets":
        return wantUserAssets !== null;
      case "describe":
        return description.trim().length > 10;
      default:
        return false;
    }
  };

  const handleGenerate = async () => {
    setStep("generating");
    setIsGenerating(true);

    try {
      // Handle talking head videos differently
      if (videoType === "talking-head" && talkingHeadAsset) {
        setGenerationStatus("Step 1/3: AI is analyzing your video and selecting b-roll...");
        
        // For talking head, we use their video as the base and add b-roll overlays
        const timelineRes = await fetch("/api/ai/build-timeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: talkingHeadPrompt.slice(0, 50) || "Talking Head Video",
            description: talkingHeadPrompt || "Add relevant b-roll overlays to this talking head video",
            talkingHeadMode: true,
            talkingHeadAssetId: talkingHeadAsset.id,
            talkingHeadDuration: talkingHeadAsset.duration_sec || 60,
            brollFrequency: brollFrequency,
            brollLength: brollLength,
            enableCaptions: talkingHeadCaptions,
            resolution: { width: 1920, height: 1080 },
          }),
        });

        if (!timelineRes.ok) {
          const errorData = await timelineRes.json().catch(() => ({}));
          console.error("Timeline API error:", errorData);
          throw new Error(errorData.error || "Failed to build timeline");
        }
        
        const timelineData = await timelineRes.json();
        const newProjectId = timelineData.projectId;
        
        // Automatically start rendering
        setGenerationStatus("Step 2/3: Starting render...");
        const renderRes = await fetch(`/api/projects/${newProjectId}/render`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });

        if (!renderRes.ok) {
          const errorData = await renderRes.json().catch(() => ({}));
          console.error("Render API error:", errorData);
          // Still redirect to project page even if render fails - they can retry
          toast.error("Render failed to start, but you can retry from the project page");
          router.push(`/app/projects/${newProjectId}`);
          return;
        }
        
        setGenerationStatus("Step 3/3: Redirecting to your video...");
        toast.success("Rendering started! Watch progress on the project page.");
        router.push(`/app/projects/${newProjectId}`);
        return;
      }

      // Step 1: Generate or use existing script (for voiceover videos)
      let finalScript = script;
      let voiceDuration = 0;
      let voiceoverAssetId: string | null = null;
      let timedCaptions: string | undefined;
      let captionSegments: Array<{ start: number; end: number; text: string }> | undefined;

      if (wantVoiceover || aiMode) {
        // Ensure we have a voice selected
        let voiceToUse = selectedVoiceId;
        if (!voiceToUse && voices.length > 0) {
          voiceToUse = voices.find(v => v.is_default)?.id || voices[0].id;
        }
        if (!voiceToUse) {
          throw new Error("No voice available. Please add a voice in the admin panel.");
        }
        
        if (!hasScript || !script.trim()) {
          // Generate script first
          setGenerationStatus("Step 1/4: AI is writing your script...");
          
          const scriptRes = await fetch("/api/ai/generate-script", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description,
              selectedAssets: selectedAssetIds.length > 0 ? userAssets.filter(a => selectedAssetIds.includes(a.id)) : undefined,
            }),
          });

          if (!scriptRes.ok) throw new Error("Failed to generate script");
          
          const scriptData = await scriptRes.json();
          finalScript = scriptData.script;
          setScript(finalScript);
        }

        // Step 2: Generate voiceover with timed captions from Deepgram
        setGenerationStatus("Step 1/4: Generating voiceover audio...");
        
        const voiceoverRes = await fetch("/api/ai/generate-voiceover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            script: finalScript,
            voiceId: voiceToUse,
          }),
        });

        if (!voiceoverRes.ok) throw new Error("Failed to generate voiceover");
        
        const voiceoverData = await voiceoverRes.json();
        voiceDuration = voiceoverData.durationSec;
        voiceoverAssetId = voiceoverData.assetId;
        timedCaptions = voiceoverData.formattedCaptions; // Timed captions from Deepgram (for AI context)
        captionSegments = voiceoverData.captions; // Actual caption segments with timing (for burning in)
        setVoiceoverDuration(voiceDuration);
      } else {
        // No voiceover - estimate duration from description
        voiceDuration = 30; // Default 30 seconds
      }

      // Step 3: Build timeline (with timed captions if available)
      setGenerationStatus("Step 2/4: AI is building your video timeline...");
      
      // Map volume label to actual value
      const volumeMap = { faint: 0.1, low: 0.2, medium: 0.3, loud: 0.5 };
      
      // Map quality to resolution
      const qualityMap = {
        "4k": { width: 3840, height: 2160 },
        "1080p": { width: 1920, height: 1080 },
        "720p": { width: 1280, height: 720 },
      };
      
      const timelineRes = await fetch("/api/ai/build-timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: description.slice(0, 50),
          script: finalScript || description,
          description: description,
          voiceoverAssetId,
          voiceoverDurationSec: voiceDuration,
          voiceoverVolume: wantVoiceover ? voiceoverVolume : undefined,
          selectedAssets: selectedAssetIds.length > 0 ? selectedAssetIds : undefined,
          timedCaptions, // Pass timed captions to AI for precise timing
          captionSegments: enableCaptions ? captionSegments : undefined, // Pass caption segments for burning in
          selectedMusicId: aiMode ? undefined : (selectedMusicId || undefined), // Let AI choose in AI mode
          musicVolume: aiMode ? undefined : (selectedMusicId ? volumeMap[musicVolume] : undefined),
          aiMode, // Tell API this is AI mode
          resolution: qualityMap[videoQuality], // Pass resolution
          // Caption settings
          captionSettings: enableCaptions ? {
            enabled: true,
            wordsPerBlock: captionWordsPerBlock,
            font: captionFont,
          } : { enabled: false },
        }),
      });

      if (!timelineRes.ok) {
        const errorData = await timelineRes.json().catch(() => ({}));
        console.error("Timeline API error:", errorData);
        throw new Error(errorData.error || "Failed to build timeline");
      }
      
      const timelineData = await timelineRes.json();
      const newProjectId = timelineData.projectId;
      
      // Automatically start rendering after timeline creation
      setGenerationStatus("Step 3/4: Starting render...");
      const renderRes = await fetch(`/api/projects/${newProjectId}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!renderRes.ok) {
        const errorData = await renderRes.json().catch(() => ({}));
        console.error("Render API error:", errorData);
        // Still redirect to project page even if render fails - they can retry
        toast.error("Render failed to start, but you can retry from the project page");
        router.push(`/app/projects/${newProjectId}`);
        return;
      }
      
      setGenerationStatus("Step 4/4: Redirecting to your video...");
      toast.success("Rendering started! Watch progress on the project page.");
      router.push(`/app/projects/${newProjectId}`);
    } catch (error) {
      console.error("Generation error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate video");
      setStep("describe");
    } finally {
      setIsGenerating(false);
      setGenerationStatus("");
    }
  };

  const handleSearchClips = async (minDuration: number) => {
    setIsSearching(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      params.set("minDuration", minDuration.toString());

      const res = await fetch(`/api/clips/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.clips || []);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSwapClip = (newClipId: string, newDescription: string) => {
    if (swapSceneIndex === null || !timeline) return;

    const newScenes = [...timeline.scenes];
    newScenes[swapSceneIndex] = {
      ...newScenes[swapSceneIndex],
      clipId: newClipId,
      clipDescription: newDescription,
    };

    setTimeline({ ...timeline, scenes: newScenes });
    setSwapSceneIndex(null);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleTransitionChange = (sceneIndex: number, transition: string) => {
    if (!timeline) return;

    const newScenes = [...timeline.scenes];
    newScenes[sceneIndex] = {
      ...newScenes[sceneIndex],
      transitionOut: transition === "none" ? null : transition,
    };

    setTimeline({ ...timeline, scenes: newScenes });
  };

  const handleRender = async () => {
    if (!projectId) return;

    setIsRendering(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeline }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to start render");
      }

      router.push(`/app/projects/${projectId}`);
    } catch (error) {
      console.error("Render error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to start render");
    } finally {
      setIsRendering(false);
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case "video-type":
        return (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-2">
                What type of video?
              </h1>
              <p className="text-muted-foreground">Choose the style that best fits your content</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Talking Head Option */}
              <button
                onClick={() => setVideoType("talking-head")}
                className={cn(
                  "p-6 rounded-2xl border-2 transition-all text-left group hover:scale-[1.02]",
                  videoType === "talking-head"
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/50"
                )}
              >
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors",
                  videoType === "talking-head" 
                    ? "bg-primary/20" 
                    : "bg-muted group-hover:bg-primary/10"
                )}>
                  <UserSquare2 className={cn(
                    "w-8 h-8 transition-colors",
                    videoType === "talking-head" ? "text-primary" : "text-muted-foreground"
                  )} />
                </div>
                <h3 className="text-xl font-semibold mb-2">Talking Head</h3>
                <p className="text-sm text-muted-foreground">
                  Upload your own talking head footage. AI will sync your video with the script and add b-roll overlays.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs">Your Face</Badge>
                  <Badge variant="outline" className="text-xs">B-Roll Overlays</Badge>
                  <Badge variant="outline" className="text-xs">Lip Sync</Badge>
                </div>
              </button>

              {/* Voiceover Option */}
              <button
                onClick={() => setVideoType("voiceover")}
                className={cn(
                  "p-6 rounded-2xl border-2 transition-all text-left group hover:scale-[1.02]",
                  videoType === "voiceover"
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/50"
                )}
              >
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors",
                  videoType === "voiceover" 
                    ? "bg-primary/20" 
                    : "bg-muted group-hover:bg-primary/10"
                )}>
                  <Volume2 className={cn(
                    "w-8 h-8 transition-colors",
                    videoType === "voiceover" ? "text-primary" : "text-muted-foreground"
                  )} />
                </div>
                <h3 className="text-xl font-semibold mb-2">Voiceover Video</h3>
                <p className="text-sm text-muted-foreground">
                  AI generates everything from your description - script, voiceover, b-roll footage, and music.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs">AI Voice</Badge>
                  <Badge variant="outline" className="text-xs">Stock B-Roll</Badge>
                  <Badge variant="outline" className="text-xs">Music</Badge>
                </div>
              </button>
            </div>
          </div>
        );

      case "talking-head-upload":
        return (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-2">Create Talking Head Video</h1>
              <p className="text-muted-foreground">Select your video and configure b-roll settings</p>
            </div>

            {/* Video Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserSquare2 className="w-5 h-5 text-primary" />
                  Your Video
                </CardTitle>
                <CardDescription>
                  Select your talking head footage
                </CardDescription>
              </CardHeader>
              <CardContent>
                {userAssets.filter(a => a.kind === "video").length === 0 ? (
                  <div className="text-center py-8">
                    <Upload className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-muted-foreground mb-3">
                      You don&apos;t have any videos yet
                    </p>
                    <Button onClick={() => router.push("/app/assets")}>
                      Upload Video
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {userAssets.filter(a => a.kind === "video").map((asset) => {
                      const isSelected = talkingHeadAsset?.id === asset.id;
                      const meta = asset.metadata || {};
                      
                      return (
                        <button
                          key={asset.id}
                          onClick={() => setTalkingHeadAsset(isSelected ? null : asset)}
                          className={cn(
                            "relative aspect-video rounded-xl border-2 overflow-hidden transition-all hover:scale-[1.02]",
                            isSelected
                              ? "border-primary ring-2 ring-primary/30"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          {asset.thumbnail_url || asset.public_url ? (
                            <video
                              src={asset.public_url}
                              className="w-full h-full object-cover"
                              muted
                              onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                              onMouseLeave={(e) => {
                                e.currentTarget.pause();
                                e.currentTarget.currentTime = 0;
                              }}
                            />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center">
                              <Film className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow-lg">
                              <Check className="w-4 h-4 text-primary-foreground" />
                            </div>
                          )}
                          {asset.duration_sec && (
                            <Badge variant="secondary" className="absolute bottom-2 right-2 text-xs bg-black/70 text-white">
                              {Math.floor(asset.duration_sec / 60)}:{String(Math.floor(asset.duration_sec % 60)).padStart(2, '0')}
                            </Badge>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                            <p className="text-xs text-white truncate">
                              {meta.name || asset.filename}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                
                {talkingHeadAsset && (
                  <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      {(talkingHeadAsset.metadata as { name?: string })?.name || talkingHeadAsset.filename}
                      <span className="text-muted-foreground font-normal">
                        • {talkingHeadAsset.duration_sec ? `${Math.floor(talkingHeadAsset.duration_sec / 60)}:${String(Math.floor(talkingHeadAsset.duration_sec % 60)).padStart(2, '0')}` : "Unknown duration"}
                      </span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* B-Roll Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Film className="w-5 h-5 text-primary" />
                  B-Roll Settings
                </CardTitle>
                <CardDescription>
                  Configure how often and how long b-roll clips appear
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Frequency */}
                <div className="space-y-3">
                  <Label>B-Roll Frequency</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: "low" as const, label: "Low", desc: "Occasional cuts" },
                      { value: "medium" as const, label: "Medium", desc: "Regular cuts" },
                      { value: "high" as const, label: "High", desc: "Frequent cuts" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setBrollFrequency(opt.value)}
                        className={cn(
                          "p-4 rounded-xl border-2 text-left transition-all",
                          brollFrequency === opt.value
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <p className="font-semibold">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Length */}
                <div className="space-y-3">
                  <Label>B-Roll Clip Length</Label>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { value: 2, label: "2 sec" },
                      { value: 3, label: "3 sec" },
                      { value: 4, label: "4 sec" },
                      { value: 5, label: "5 sec" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setBrollLength(opt.value)}
                        className={cn(
                          "p-3 rounded-lg border-2 text-center transition-all",
                          brollLength === opt.value
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <p className="font-semibold">{opt.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Captions Toggle */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Add Captions</p>
                    <p className="text-sm text-muted-foreground">Burn subtitles into the video</p>
                  </div>
                  <button
                    onClick={() => setTalkingHeadCaptions(!talkingHeadCaptions)}
                    className={cn(
                      "w-14 h-7 rounded-full transition-colors relative",
                      talkingHeadCaptions ? "bg-primary" : "bg-muted"
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 bg-white rounded-full absolute top-0.5 transition-all shadow-sm",
                      talkingHeadCaptions ? "left-[30px]" : "left-0.5"
                    )} />
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* AI Prompt */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  AI Guidance
                </CardTitle>
                <CardDescription>
                  Tell the AI what kind of b-roll to use (optional)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={talkingHeadPrompt}
                  onChange={(e) => setTalkingHeadPrompt(e.target.value)}
                  placeholder="E.g., Use tech-related b-roll, office environments, computer screens. Keep it professional and modern."
                  rows={3}
                  className="resize-none"
                />
              </CardContent>
            </Card>
          </div>
        );

      case "voiceover":
        return (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-2">Create Your Video</h1>
              <p className="text-muted-foreground">Let&apos;s start by setting up your video options</p>
            </div>

            {/* AI Mode Banner */}
            <button
              onClick={() => {
                setAiMode(!aiMode);
                if (!aiMode) {
                  // When enabling AI mode, set defaults
                  setWantVoiceover(true);
                  setHasScript(false);
                  setWantUserAssets(false);
                  // Use default voice, or first voice if no default
                  const defaultVoice = voices.find(v => v.is_default) || voices[0];
                  if (defaultVoice) setSelectedVoiceId(defaultVoice.id);
                }
              }}
              className={cn(
                "w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4",
                aiMode 
                  ? "border-primary bg-primary/10 shadow-lg shadow-primary/20" 
                  : "border-dashed border-muted-foreground/30 hover:border-primary/50"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                aiMode ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold text-lg">Let AI Do Everything</p>
                <p className="text-sm text-muted-foreground">
                  AI decides voiceover, music, sound effects, timeline, and more
                </p>
              </div>
              <ChevronRight className={cn(
                "w-5 h-5 transition-transform",
                aiMode && "rotate-90"
              )} />
            </button>

            {aiMode && (
              <Card className="border-primary/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Describe Your Video
                  </CardTitle>
                  <CardDescription>
                    Tell the AI what you want. It will handle everything else!
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="E.g., Create a 30-second promotional video for our new running shoes. Show the product in action with athletic scenes. Make it energetic and modern with upbeat music."
                    rows={6}
                    className="resize-none"
                  />
                  <p className="text-sm text-muted-foreground">
                    Be specific about style, mood, music preference, and what you want to show
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Voiceover choice */}
            {!aiMode && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="w-5 h-5 text-primary" />
                  Do you want a voiceover?
                </CardTitle>
                <CardDescription>
                  AI will generate natural-sounding narration for your video
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    variant={wantVoiceover === true ? "default" : "outline"}
                    size="lg"
                    className="h-24 flex-col gap-2"
                    onClick={() => handleVoiceoverChoice(true)}
                  >
                    <Mic className="w-8 h-8" />
                    <span>Yes, add voiceover</span>
                  </Button>
                  <Button
                    variant={wantVoiceover === false ? "default" : "outline"}
                    size="lg"
                    className="h-24 flex-col gap-2"
                    onClick={() => handleVoiceoverChoice(false)}
                  >
                    <MicOff className="w-8 h-8" />
                    <span>No, video only</span>
                  </Button>
                </div>

                {/* Voice selection */}
                {wantVoiceover && (
                  <div className="pt-4 border-t">
                    <Label className="mb-3 block">Choose a voice</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {voices.map((voice) => (
                        <button
                          key={voice.id}
                          onClick={() => setSelectedVoiceId(voice.id)}
                          className={cn(
                            "p-3 rounded-lg border text-left transition-all",
                            selectedVoiceId === voice.id
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="w-8 h-8">
                              {voice.profile_image_url ? (
                                <AvatarImage src={voice.profile_image_url} />
                              ) : null}
                              <AvatarFallback>{voice.name[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{voice.name}</p>
                              {voice.is_default && (
                                <Badge variant="secondary" className="text-xs">Default</Badge>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                    {/* Voiceover Volume Selector */}
                    <div className="pt-4 border-t">
                      <Label className="mb-3 block">Voiceover Volume</Label>
                      <div className="grid grid-cols-5 gap-2">
                        {[
                          { label: "Faint", value: 0.3 },
                          { label: "Quiet", value: 0.6 },
                          { label: "Normal", value: 1.0 },
                          { label: "Loud", value: 1.2 },
                          { label: "Very Loud", value: 1.5 },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setVoiceoverVolume(opt.value)}
                            className={cn(
                              "p-2 rounded-lg border text-xs font-medium transition-all",
                              voiceoverVolume === opt.value
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:border-primary/50"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            )}
          </div>
        );

      case "script":
        return (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-2">Script</h1>
              <p className="text-muted-foreground">
                {wantVoiceover 
                  ? "Provide a script or let AI generate one for you"
                  : "Skip this step if you don't need a voiceover"
                }
              </p>
            </div>

            {wantVoiceover ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Do you have a script?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {hasScript === null ? (
                    <div className="grid grid-cols-2 gap-4">
                      <Button
                        variant="outline"
                        size="lg"
                        className="h-24 flex-col gap-2"
                        onClick={() => handleScriptChoice(true)}
                      >
                        <FileText className="w-8 h-8" />
                        <span>Yes, I have a script</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        className="h-24 flex-col gap-2"
                        onClick={() => handleScriptChoice(false)}
                      >
                        <Sparkles className="w-8 h-8" />
                        <span>No, generate for me</span>
                      </Button>
                    </div>
                  ) : hasScript ? (
                    <div className="space-y-3">
                      <Label>Paste your script</Label>
                      <Textarea
                        value={script}
                        onChange={(e) => setScript(e.target.value)}
                        placeholder="Enter your voiceover script here..."
                        rows={8}
                        className="resize-none"
                      />
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          {script.split(/\s+/).filter(Boolean).length} words
                          {" • "}
                          ~{Math.ceil(script.split(/\s+/).filter(Boolean).length / 2.5)}s estimated duration
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Natural pauses will be added automatically
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setHasScript(null); setScript(""); }}
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Change choice
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <Sparkles className="w-12 h-12 mx-auto mb-3 text-primary" />
                      <p className="text-sm text-muted-foreground mb-3">
                        AI will generate a script based on your video description
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setHasScript(null)}
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Change choice
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="text-center py-8">
                <MicOff className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">
                  No voiceover selected. You can continue to the next step.
                </p>
              </Card>
            )}
          </div>
        );

      case "assets":
        return (
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-2">Your Assets</h1>
              <p className="text-muted-foreground">
                Include your own product videos or images in the video
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-primary" />
                  Include your own clips?
                </CardTitle>
                <CardDescription>
                  Select videos or images that MUST appear in your video
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {wantUserAssets === null ? (
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      size="lg"
                      className="h-24 flex-col gap-2"
                      onClick={() => handleAssetChoice(true)}
                    >
                      <Upload className="w-8 h-8" />
                      <span>Yes, use my assets</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      className="h-24 flex-col gap-2"
                      onClick={() => handleAssetChoice(false)}
                    >
                      <Film className="w-8 h-8" />
                      <span>No, use b-roll only</span>
                    </Button>
                  </div>
                ) : wantUserAssets ? (
                  <div className="space-y-4">
                    {userAssets.length === 0 ? (
                      <div className="text-center py-8">
                        <Upload className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-muted-foreground mb-3">
                          You haven&apos;t uploaded any assets yet
                        </p>
                        <Button onClick={() => router.push("/app/assets")}>
                          Go to Assets
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Label>Select assets to include ({selectedAssetIds.length} selected)</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-64 overflow-y-auto p-1">
                          {userAssets.map((asset) => {
                            const isSelected = selectedAssetIds.includes(asset.id);
                            const meta = asset.metadata || {};
                            
                            return (
                              <button
                                key={asset.id}
                                onClick={() => toggleAssetSelection(asset.id)}
                                className={cn(
                                  "relative aspect-video rounded-lg border overflow-hidden transition-all",
                                  isSelected
                                    ? "border-primary ring-2 ring-primary"
                                    : "border-border hover:border-primary/50"
                                )}
                              >
                                {asset.thumbnail_url || asset.public_url ? (
                                  <img
                                    src={asset.thumbnail_url || asset.public_url}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-muted flex items-center justify-center">
                                    <Film className="w-8 h-8 text-muted-foreground" />
                                  </div>
                                )}
                                {isSelected && (
                                  <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                                    <Check className="w-4 h-4 text-primary-foreground" />
                                  </div>
                                )}
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1">
                                  <p className="text-xs text-white truncate">
                                    {meta.name || asset.filename}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setWantUserAssets(null); setSelectedAssetIds([]); }}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Change choice
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Film className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-3">
                      AI will use b-roll clips to create your video
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setWantUserAssets(null)}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Change choice
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Music Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Music className="w-5 h-5 text-primary" />
                  Background Music
                </CardTitle>
                <CardDescription>
                  Optional: Choose background music for your video
                </CardDescription>
              </CardHeader>
              <CardContent>
                {musicTracks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No music tracks available
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div 
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-all",
                        !selectedMusicId ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      )}
                      onClick={() => setSelectedMusicId("")}
                    >
                      <p className="font-medium">No background music</p>
                      <p className="text-sm text-muted-foreground">AI can still add sound effects</p>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {musicTracks.map((track) => (
                        <div 
                          key={track.id}
                          className={cn(
                            "p-3 rounded-lg border cursor-pointer transition-all flex items-center gap-3",
                            selectedMusicId === track.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                          )}
                          onClick={() => setSelectedMusicId(track.id)}
                        >
                          <div className="w-10 h-10 rounded bg-purple-500/20 flex items-center justify-center shrink-0">
                            <Music className="w-5 h-5 text-purple-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{track.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {track.artist || "Unknown"} • {Math.round(track.duration_seconds)}s
                              {track.genre && ` • ${track.genre}`}
                            </p>
                          </div>
                          {selectedMusicId === track.id && (
                            <Check className="w-5 h-5 text-primary shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {/* Volume selector - only show when music is selected */}
                    {selectedMusicId && (
                      <div className="pt-3 border-t">
                        <Label className="text-sm mb-2 block">Music Volume</Label>
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { value: "faint" as const, label: "Faint", vol: 0.1 },
                            { value: "low" as const, label: "Low", vol: 0.2 },
                            { value: "medium" as const, label: "Medium", vol: 0.3 },
                            { value: "loud" as const, label: "Loud", vol: 0.5 },
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => setMusicVolume(opt.value)}
                              className={cn(
                                "p-2 rounded-lg border text-sm font-medium transition-all",
                                musicVolume === opt.value
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border hover:border-primary/50"
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case "describe":
        return (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-2">Describe Your Video</h1>
              <p className="text-muted-foreground">
                Tell the AI what kind of video you want to create
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Video Description
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="E.g., Create a 30-second promotional video for our new running shoes. Show the product in action with athletic scenes. Make it energetic and modern."
                  rows={6}
                  className="resize-none"
                />
                <p className="text-sm text-muted-foreground">
                  Be specific about style, mood, and what you want to show
                </p>

                {/* Quality Selection */}
                <div className="pt-4 border-t space-y-3">
                  <Label className="text-sm font-medium">Output Quality</Label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setVideoQuality("4k")}
                      className={cn(
                        "flex-1 py-3 px-4 rounded-lg border-2 transition-all",
                        videoQuality === "4k"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-muted hover:border-primary/50"
                      )}
                    >
                      <div className="font-semibold">4K</div>
                      <div className="text-xs text-muted-foreground">3840×2160</div>
                    </button>
                    <button
                      onClick={() => setVideoQuality("1080p")}
                      className={cn(
                        "flex-1 py-3 px-4 rounded-lg border-2 transition-all",
                        videoQuality === "1080p"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-muted hover:border-primary/50"
                      )}
                    >
                      <div className="font-semibold">1080p</div>
                      <div className="text-xs text-muted-foreground">1920×1080</div>
                    </button>
                    <button
                      onClick={() => setVideoQuality("720p")}
                      className={cn(
                        "flex-1 py-3 px-4 rounded-lg border-2 transition-all",
                        videoQuality === "720p"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-muted hover:border-primary/50"
                      )}
                    >
                      <div className="font-semibold">720p</div>
                      <div className="text-xs text-muted-foreground">1280×720</div>
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {videoQuality === "4k" 
                      ? "Best quality. Larger file size, slower rendering." 
                      : videoQuality === "1080p" 
                      ? "Recommended. Great quality with fast rendering." 
                      : "Faster rendering. Good for previews and social media."}
                  </p>
                </div>

                {/* Caption Settings */}
                {wantVoiceover && (
                  <div className="pt-4 border-t space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Burn-in Captions</Label>
                        <p className="text-xs text-muted-foreground">Add text captions directly on the video</p>
                      </div>
                      <button
                        onClick={() => setEnableCaptions(!enableCaptions)}
                        className={cn(
                          "w-12 h-6 rounded-full transition-colors relative",
                          enableCaptions ? "bg-primary" : "bg-muted"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-sm",
                          enableCaptions ? "left-[26px]" : "left-0.5"
                        )} />
                      </button>
                    </div>
                    
                    {enableCaptions && (
                      <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                        <div className="space-y-2">
                          <Label className="text-xs">Words Per Block</Label>
                          <Select
                            value={String(captionWordsPerBlock)}
                            onValueChange={(v) => setCaptionWordsPerBlock(parseInt(v))}
                          >
                            <SelectTrigger className="h-9">
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
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Caption Font</Label>
                          <Select
                            value={captionFont}
                            onValueChange={setCaptionFont}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Inter">Inter</SelectItem>
                              <SelectItem value="Space Grotesk">Space Grotesk</SelectItem>
                              <SelectItem value="Roboto">Roboto</SelectItem>
                              <SelectItem value="Montserrat">Montserrat</SelectItem>
                              <SelectItem value="Poppins">Poppins</SelectItem>
                              <SelectItem value="Oswald">Oswald</SelectItem>
                              <SelectItem value="Bebas Neue">Bebas Neue</SelectItem>
                              <SelectItem value="Impact">Impact</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Summary of choices */}
                <div className="pt-4 border-t space-y-2">
                  <h4 className="font-medium text-sm">Summary</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {wantVoiceover ? `Voiceover: ${voices.find(v => v.id === selectedVoiceId)?.name || "Selected"}` : "No voiceover"}
                    </Badge>
                    <Badge variant="secondary">
                      {hasScript ? "Custom script" : wantVoiceover ? "AI script" : "No script"}
                    </Badge>
                    <Badge variant="secondary">
                      {selectedAssetIds.length > 0 
                        ? `${selectedAssetIds.length} assets selected`
                        : "B-roll only"}
                    </Badge>
                    <Badge variant="secondary">
                      Quality: {videoQuality.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "generating":
        return (
          <div className="text-center">
            <div className="relative w-32 h-32 mx-auto mb-8">
              <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
              <div className="absolute inset-4 rounded-full border-4 border-transparent border-t-accent animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
              <div className="absolute inset-8 rounded-full border-4 border-transparent border-t-primary animate-spin" style={{ animationDuration: "2s" }} />
              <Film className="absolute inset-0 m-auto w-10 h-10 text-primary" />
            </div>
            <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Creating Your Video
            </h2>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              {generationStatus || "Please wait while we work our magic..."}
            </p>
            <div className="mt-6 flex justify-center gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-primary animate-bounce"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
          </div>
        );

      case "timeline":
        return (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">{timeline?.title || "Your Video"}</h1>
                <p className="text-muted-foreground">
                  Review and customize your video timeline
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("describe")}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <Button onClick={handleRender} disabled={isRendering}>
                  {isRendering ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Rendering...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Render Video
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Timeline scenes */}
            <div className="space-y-4">
              {(!timeline?.scenes || timeline.scenes.length === 0) && (
                <Card className="p-8 text-center">
                  <Film className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No scenes generated</h3>
                  <p className="text-muted-foreground mb-4">
                    The AI couldn&apos;t find suitable clips for your video. 
                    Make sure you have clips in your library.
                  </p>
                  <Button variant="outline" onClick={() => setStep("describe")}>
                    Try Again
                  </Button>
                </Card>
              )}
              {timeline?.scenes?.map((scene, index) => (
                <Card key={index} className="overflow-hidden">
                  <div className="flex">
                    {/* Scene thumbnail */}
                    <div className="w-48 aspect-video bg-muted shrink-0 flex items-center justify-center">
                      <Film className="w-8 h-8 text-muted-foreground" />
                    </div>

                    {/* Scene info */}
                    <CardContent className="flex-1 p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <Badge variant="outline" className="mb-1">
                            Scene {index + 1} • {scene.durationSec}s
                          </Badge>
                          <p className="font-medium">{scene.intent}</p>
                          <p className="text-sm text-muted-foreground">
                            {scene.clipDescription}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSwapSceneIndex(index);
                            handleSearchClips(scene.durationSec);
                          }}
                        >
                          <ArrowLeftRight className="w-4 h-4 mr-1" />
                          Switch
                        </Button>
                      </div>

                      {/* Transition selector */}
                      {index < (timeline?.scenes?.length || 0) - 1 && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                          <Label className="text-xs">Transition:</Label>
                          <Select
                            value={scene.transitionOut || "none"}
                            onValueChange={(v) => handleTransitionChange(index, v)}
                          >
                            <SelectTrigger className="w-32 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TRANSITIONS.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </CardContent>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Progress bar */}
      {step !== "generating" && step !== "timeline" && (
        <div className="shrink-0 border-b bg-card">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">
                {videoType === "talking-head" ? (
                  // Talking head: video-type -> upload & configure (2 steps)
                  `Step ${step === "video-type" ? 1 : 2} of 2`
                ) : (
                  // Voiceover: video-type -> voiceover -> script -> assets -> describe
                  `Step ${
                    step === "video-type" ? 1 :
                    step === "voiceover" ? 2 :
                    step === "script" ? 3 :
                    step === "assets" ? 4 : 5
                  } of 5`
                )}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all"
                style={{ 
                  width: videoType === "talking-head" 
                    ? (step === "video-type" ? "50%" : "100%")
                    : (step === "video-type" ? "20%" :
                       step === "voiceover" ? "40%" :
                       step === "script" ? "60%" :
                       step === "assets" ? "80%" : "100%")
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {step === "generating" ? (
        <div className="flex-1 flex items-center justify-center">
          {renderStepContent()}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 pb-24">
            {renderStepContent()}
          </div>
        </div>
      )}

      {/* Navigation */}
      {step !== "generating" && step !== "timeline" && (
        <div className="shrink-0 border-t bg-card">
          <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between">
            <Button
              variant="outline"
              onClick={goToPrevStep}
              disabled={step === "video-type"}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <Button
              onClick={goToNextStep}
              disabled={!canProceed()}
            >
              {step === "describe" || (aiMode && step === "voiceover") || step === "talking-head-upload" ? (
                <>
                  <Sparkles className="w-4 h-4 mr-1" />
                  Generate Video
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Scene swap dialog */}
      <Dialog open={swapSceneIndex !== null} onOpenChange={(open) => !open && setSwapSceneIndex(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Switch Scene Clip</DialogTitle>
            <DialogDescription>
              {swapSceneIndex !== null && timeline?.scenes[swapSceneIndex] && (
                <>
                  <strong>Scene intent:</strong> {timeline.scenes[swapSceneIndex].intent}
                  <br />
                  Minimum duration: {timeline.scenes[swapSceneIndex].durationSec}s
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search clips..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button 
                onClick={() => swapSceneIndex !== null && timeline && handleSearchClips(timeline.scenes[swapSceneIndex].durationSec)}
                disabled={isSearching}
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>

            {/* Results */}
            <ScrollArea className="h-64">
              <div className="grid grid-cols-2 gap-3">
                {searchResults.map((clip) => (
                  <button
                    key={clip.id}
                    onClick={() => handleSwapClip(clip.id, clip.description)}
                    className="text-left p-3 rounded-lg border hover:border-primary transition-colors"
                  >
                    <div className="aspect-video bg-muted rounded mb-2 flex items-center justify-center">
                      {clip.thumbnailUrl ? (
                        <img src={clip.thumbnailUrl} alt="" className="w-full h-full object-cover rounded" />
                      ) : (
                        <Film className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-sm font-medium line-clamp-2">{clip.description}</p>
                    <p className="text-xs text-muted-foreground">{clip.durationSeconds}s</p>
                  </button>
                ))}
              </div>
              {searchResults.length === 0 && !isSearching && (
                <div className="text-center py-8 text-muted-foreground">
                  No matching clips found
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
