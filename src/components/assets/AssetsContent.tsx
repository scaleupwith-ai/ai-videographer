"use client";

import { useState, useRef, useEffect } from "react";
import {
  Upload,
  Film,
  Image,
  Trash2,
  MoreVertical,
  Search,
  Grid,
  List,
  Loader2,
  Sparkles,
  X,
  Edit2,
  Music,
  Volume2,
  ChevronDown,
  ChevronRight,
  Play,
  Pause,
  FolderOpen,
  Globe,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, formatDuration } from "@/lib/date";
import { toast } from "sonner";
import type { MediaAsset } from "@/lib/database.types";

interface AssetsContentProps {
  initialAssets: MediaAsset[];
}

interface AssetMetadata {
  name?: string;
  description?: string;
  tags?: string[];
  scenes?: Array<{ start: number; end: number; description: string }>;
  analysisError?: string;
  analyzedAt?: string;
  aiGenerated?: boolean;
  videoJobId?: string;
  chapters?: Array<{
    chapter_number: number;
    start: number;
    end: number;
    chapter_title: string;
    chapter_summary: string;
  }>;
  highlights?: Array<{
    start: number;
    end: number;
    highlight: string;
    highlight_summary: string;
  }>;
}

interface VideoJobResult {
  videoId?: string;
  summary?: string;
  chapters?: Array<{
    chapter_number: number;
    start: number;
    end: number;
    chapter_title: string;
    chapter_summary: string;
  }>;
  highlights?: Array<{
    start: number;
    end: number;
    highlight: string;
    highlight_summary: string;
  }>;
  metadata?: {
    filename?: string;
    duration?: number;
    width?: number;
    height?: number;
  };
}

interface PublicClip {
  id: string;
  clip_link: string;
  description: string | null;
  tags: string[];
  duration_seconds: number;
  thumbnail_url: string | null;
}

interface MusicTrack {
  id: string;
  title: string;
  artist: string | null;
  duration_seconds: number;
  audio_url: string;
  thumbnail_url: string | null;
  genre: string | null;
  mood: string[];
  tags: string[];
}

interface SoundEffect {
  id: string;
  title: string;
  category: string | null;
  duration_seconds: number;
  audio_url: string;
  thumbnail_url: string | null;
  tags: string[];
}

interface Overlay {
  id: string;
  title: string;
  category: string | null;
  image_url: string;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  tags: string[];
}

const kindConfig = {
  video: { label: "Video", icon: Film, color: "bg-blue-500/20 text-blue-400" },
  image: { label: "Image", icon: Image, color: "bg-green-500/20 text-green-400" },
};

export function AssetsContent({ initialAssets }: AssetsContentProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [mounted, setMounted] = useState(false);
  const [assets, setAssets] = useState(initialAssets);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeTab, setActiveTab] = useState<"my" | "public">("my");
  
  // Public assets state
  const [clips, setClips] = useState<PublicClip[]>([]);
  const [music, setMusic] = useState<MusicTrack[]>([]);
  const [soundEffects, setSoundEffects] = useState<SoundEffect[]>([]);
  const [overlaysPublic, setOverlaysPublic] = useState<Overlay[]>([]);
  const [loadingPublic, setLoadingPublic] = useState(false);
  const [clipsOpen, setClipsOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [sfxOpen, setSfxOpen] = useState(false);
  const [overlaysOpen, setOverlaysOpen] = useState(false);
  
  // Audio playback
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  
  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [assetName, setAssetName] = useState("");
  const [assetDescription, setAssetDescription] = useState("");
  const [assetTags, setAssetTags] = useState("");
  const [assetReference, setAssetReference] = useState(""); // Product name or address
  const [assetDuration, setAssetDuration] = useState<number | null>(null); // Auto-detected duration
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [autoGenerateDescription, setAutoGenerateDescription] = useState(true); // Default to auto-generate
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'uploading' | 'analyzing' | 'complete'>('idle');
  const [analysisProgress, setAnalysisProgress] = useState("");
  const [uploadAnalysisProgress, setUploadAnalysisProgress] = useState(0);
  const [uploadedAsset, setUploadedAsset] = useState<MediaAsset | null>(null);
  const [uploadJobId, setUploadJobId] = useState<string | null>(null);
  
  // Detail modal state
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisJobId, setAnalysisJobId] = useState<string | null>(null);
  const [analysisJob, setAnalysisJob] = useState<{
    status: string;
    progress: number;
    resultJson?: VideoJobResult;
    error?: string;
  } | null>(null);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Prevent page close during upload/analysis
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (uploadPhase === 'uploading' || uploadPhase === 'analyzing') {
        e.preventDefault();
        e.returnValue = 'Your video is still being processed. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [uploadPhase]);

  // Fetch public assets when switching to public tab
  useEffect(() => {
    if (activeTab === "public" && clips.length === 0) {
      fetchPublicAssets();
    }
  }, [activeTab]);

  const fetchPublicAssets = async () => {
    setLoadingPublic(true);
    try {
      const [clipsRes, musicRes, sfxRes, overlaysRes] = await Promise.all([
        fetch("/api/public/clips"),
        fetch("/api/public/music"),
        fetch("/api/public/sound-effects"),
        fetch("/api/public/overlays"),
      ]);

      if (clipsRes.ok) {
        const data = await clipsRes.json();
        setClips(data.clips || []);
      }
      if (musicRes.ok) {
        const data = await musicRes.json();
        setMusic(data.tracks || []);
      }
      if (sfxRes.ok) {
        const data = await sfxRes.json();
        setSoundEffects(data.effects || []);
      }
      if (overlaysRes.ok) {
        const data = await overlaysRes.json();
        setOverlaysPublic(data.overlays || []);
      }
    } catch (error) {
      console.error("Failed to fetch public assets:", error);
    } finally {
      setLoadingPublic(false);
    }
  };

  const filteredAssets = assets.filter((asset) => {
    const metadata = (asset.metadata as AssetMetadata) || {};
    const searchLower = search.toLowerCase();
    if (search) {
      const matchesName = metadata.name?.toLowerCase().includes(searchLower);
      const matchesDesc = metadata.description?.toLowerCase().includes(searchLower);
      const matchesTags = metadata.tags?.some(t => t.toLowerCase().includes(searchLower));
      if (!matchesName && !matchesDesc && !matchesTags) return false;
    }
    return true;
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setPendingFile(file);
    setPendingPreviewUrl(previewUrl);
    setAssetName(file.name.replace(/\.[^/.]+$/, "")); // Remove extension
    setAssetDescription("");
    setAssetTags("");
    setAssetReference("");
    setAssetDuration(null);
    setAutoGenerateDescription(true);
    setShowUploadModal(true);
    
    // Auto-detect duration for video files
    if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        // Round down to 1 decimal place
        const duration = Math.floor(video.duration * 10) / 10;
        setAssetDuration(duration);
        URL.revokeObjectURL(video.src);
      };
      video.onerror = () => {
        console.warn("Could not detect video duration");
        URL.revokeObjectURL(video.src);
      };
      video.src = URL.createObjectURL(file);
    }
    
    // Auto-detect duration for audio files
    if (file.type.startsWith("audio/")) {
      const audio = document.createElement("audio");
      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        const duration = Math.floor(audio.duration * 10) / 10;
        setAssetDuration(duration);
        URL.revokeObjectURL(audio.src);
      };
      audio.onerror = () => {
        console.warn("Could not detect audio duration");
        URL.revokeObjectURL(audio.src);
      };
      audio.src = URL.createObjectURL(file);
    }
  };

  const handleGenerateDescription = async () => {
    if (!pendingFile) {
      toast.error("No file selected");
      return;
    }
    
    setIsGeneratingDescription(true);
    console.log("Starting AI description generation for:", pendingFile.name);
    
    try {
      const fileSizeMB = pendingFile.size / (1024 * 1024);
      console.log(`File size: ${fileSizeMB.toFixed(2)}MB`);
      
      // Check file size limit
      if (fileSizeMB > 20) {
        toast.error(`File too large (${fileSizeMB.toFixed(1)}MB). Max 20MB for AI analysis.`);
        setIsGeneratingDescription(false);
        return;
      }
      
      toast.info("Analyzing media with AI...", { duration: 10000 });
      
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          if (base64Data) {
            console.log(`Base64 conversion complete, length: ${base64Data.length}`);
            resolve(base64Data);
          } else {
            reject(new Error("Failed to extract base64 data"));
          }
        };
        reader.onerror = () => reject(new Error("FileReader error"));
        reader.readAsDataURL(pendingFile);
      });
      
      const type = pendingFile.type.startsWith("video") ? "video" : "image";
      console.log(`Sending ${type} to API (${fileSizeMB.toFixed(1)}MB)...`);
      
      // Add timeout to fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      const response = await fetch("/api/assets/describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          base64,
          mimeType: pendingFile.type,
          type,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.log("API response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();
      console.log("API response data:", data);
      
      // API returns { name, description, tags }
      if (data.name) setAssetName(data.name);
      if (data.description) setAssetDescription(data.description);
      if (data.tags && Array.isArray(data.tags)) {
        setAssetTags(data.tags.join(", "));
      }
      
      toast.success("Description generated!");
    } catch (error) {
      console.error("AI description error:", error);
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          toast.error("Request timed out. Please try again or enter description manually.");
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error("Failed to generate description");
      }
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const handleUploadConfirm = async () => {
    if (!pendingFile) return;

    setUploading(true);
    setUploadPhase('uploading');
    setAnalysisProgress("Preparing upload...");
    setUploadAnalysisProgress(0);
    
    try {
      // 1. Get presigned URL
      const kind = pendingFile.type.startsWith("video/") ? "video" : "image";
      setAnalysisProgress("Getting upload URL...");
      setUploadAnalysisProgress(5);
      
      const urlRes = await fetch("/api/assets/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: pendingFile.name,
          mime: pendingFile.type,
          kind,
        }),
      });

      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, objectKey } = await urlRes.json();

      // 2. Upload to R2
      setAnalysisProgress("Uploading file to cloud...");
      setUploadAnalysisProgress(10);
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: pendingFile,
        headers: { "Content-Type": pendingFile.type },
      });

      if (!uploadRes.ok) throw new Error("Failed to upload file");
      setUploadAnalysisProgress(30);

      // 3. Complete upload with metadata
      setAnalysisProgress("Saving asset...");
      const completeRes = await fetch("/api/assets/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectKey,
          kind,
          filename: pendingFile.name,
          mime: pendingFile.type,
          sizeBytes: pendingFile.size,
          durationSec: assetDuration,
          metadata: {
            name: assetName,
            description: assetDescription || undefined,
          },
          tags: assetTags.split(",").map(t => t.trim()).filter(Boolean),
          reference: assetReference || undefined,
          generateDescription: autoGenerateDescription && kind === "video",
        }),
      });

      if (!completeRes.ok) throw new Error("Failed to complete upload");

      const { asset, videoJobId } = await completeRes.json();
      setUploadedAsset(asset);
      
      // Add asset to list immediately
      setAssets((prev) => [asset, ...prev]);
      
      // If AI analysis was triggered, wait for it to complete
      if (autoGenerateDescription && kind === "video" && videoJobId) {
        setUploadPhase('analyzing');
        setUploadJobId(videoJobId);
        setAnalysisProgress("AI is analyzing your video...");
        setUploadAnalysisProgress(35);
        
        // Poll for job completion
        let jobDone = false;
        while (!jobDone) {
          await new Promise(resolve => setTimeout(resolve, 3000)); // Poll every 3 seconds
          
          try {
            const jobRes = await fetch(`/api/video-jobs/${videoJobId}`, { cache: "no-store" });
            if (jobRes.ok) {
              const jobData = await jobRes.json();
              
              // Update progress - map job progress (0-100) to our progress (35-95)
              const mappedProgress = 35 + Math.round((jobData.progress || 0) * 0.6);
              setUploadAnalysisProgress(mappedProgress);
              
              if (jobData.progress < 50) {
                setAnalysisProgress("Indexing video content...");
              } else if (jobData.progress < 80) {
                setAnalysisProgress("Analyzing scenes and content...");
              } else {
                setAnalysisProgress("Generating description...");
              }
              
              if (jobData.status === "done") {
                jobDone = true;
                setUploadAnalysisProgress(95);
                setAnalysisProgress("Saving results...");
                
                // Refresh the asset to get updated metadata
                const refreshedAsset = await refreshAsset(asset.id);
                if (refreshedAsset) {
                  setUploadedAsset(refreshedAsset);
                }
                
                setUploadAnalysisProgress(100);
                setUploadPhase('complete');
                setAnalysisProgress("Analysis complete!");
                toast.success("Video analyzed successfully!");
              } else if (jobData.status === "failed") {
                jobDone = true;
                throw new Error(jobData.error || "Analysis failed");
              }
            }
          } catch (pollError) {
            console.error("Error polling job:", pollError);
            // Continue polling unless it's a fatal error
            if (pollError instanceof Error && pollError.message.includes("failed")) {
              throw pollError;
            }
          }
        }
      } else {
        // No analysis needed - just complete
        setUploadPhase('complete');
        setUploadAnalysisProgress(100);
        setAnalysisProgress("Upload complete!");
        toast.success("Asset uploaded successfully!");
      }
      
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload asset");
      setUploadPhase('idle');
      setAnalysisProgress("");
      setUploadAnalysisProgress(0);
      setUploading(false);
    }
  };

  const handleDelete = async (assetId: string) => {
    try {
      const res = await fetch(`/api/assets/${assetId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
      toast.success("Asset deleted");
    } catch {
      toast.error("Failed to delete asset");
    }
  };

  const cancelUpload = () => {
    setShowUploadModal(false);
    setPendingFile(null);
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingPreviewUrl(null);
    setAssetName("");
    setAssetDescription("");
    setAssetTags("");
    setAssetReference("");
    setAssetDuration(null);
    setAutoGenerateDescription(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const playAudio = (id: string, url: string) => {
    if (playingAudioId === id) {
      audioRef.current?.pause();
      setPlayingAudioId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
        setPlayingAudioId(id);
      }
    }
  };

  const generateThumbnailFromVideo = async (videoUrl: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.src = videoUrl;
      
      video.onloadeddata = () => {
        video.currentTime = 0.1; // Seek to first frame
      };
      
      video.onseeked = () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        } else {
          resolve(null);
        }
      };
      
      video.onerror = () => resolve(null);
    });
  };

  // Open asset detail modal
  const openAssetDetail = (asset: MediaAsset) => {
    setSelectedAsset(asset);
    setShowDetailModal(true);
    setAnalysisJobId(null);
    setAnalysisJob(null);
    setIsAnalyzing(false);
  };

  // Close asset detail modal
  const closeAssetDetail = () => {
    setShowDetailModal(false);
    setSelectedAsset(null);
    setAnalysisJobId(null);
    setAnalysisJob(null);
    setIsAnalyzing(false);
  };

  // Start TwelveLabs analysis for a video
  const startVideoAnalysis = async () => {
    if (!selectedAsset || !selectedAsset.public_url) return;
    
    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/video-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetUrl: selectedAsset.public_url,
          filename: selectedAsset.filename,
          contentType: selectedAsset.mime_type,
          duration: selectedAsset.duration_sec,
          metadata: {
            asset_id: selectedAsset.id, // Pass asset ID so results are saved back
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to start analysis");
      }
      
      const { jobId } = await response.json();
      setAnalysisJobId(jobId);
      toast.success("Video analysis started!");
    } catch (error) {
      console.error("Failed to start analysis:", error);
      toast.error("Failed to start video analysis");
      setIsAnalyzing(false);
    }
  };

  // Refresh asset data from server
  const refreshAsset = async (assetId: string) => {
    try {
      const response = await fetch(`/api/assets/${assetId}`);
      if (response.ok) {
        const { asset: updatedAsset } = await response.json();
        // Update in assets list
        setAssets(prev => prev.map(a => a.id === assetId ? updatedAsset : a));
        // Update selected asset if it's the one being viewed
        if (selectedAsset?.id === assetId) {
          setSelectedAsset(updatedAsset);
        }
        return updatedAsset;
      }
    } catch (error) {
      console.error("Failed to refresh asset:", error);
    }
    return null;
  };

  // Poll for analysis job status
  useEffect(() => {
    if (!analysisJobId) return;
    
    let cancelled = false;
    
    async function pollJob() {
      if (cancelled) return;
      
      try {
        const response = await fetch(`/api/video-jobs/${analysisJobId}`, {
          cache: "no-store",
        });
        
        if (response.ok) {
          const data = await response.json();
          setAnalysisJob({
            status: data.status,
            progress: data.progress,
            resultJson: data.resultJson,
            error: data.error,
          });
          
          if (data.status === "done" || data.status === "failed") {
            setIsAnalyzing(false);
            if (data.status === "done") {
              toast.success("Video analysis complete!");
              // Refresh the asset to get the updated metadata
              if (selectedAsset) {
                await refreshAsset(selectedAsset.id);
              }
            } else {
              toast.error(data.error || "Analysis failed");
            }
            return;
          }
        }
      } catch (error) {
        console.error("Error polling job:", error);
      }
      
      // Continue polling
      if (!cancelled) {
        setTimeout(pollJob, 5000);
      }
    }
    
    pollJob();
    
    return () => {
      cancelled = true;
    };
  }, [analysisJobId, selectedAsset]);

  // Format file size
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // Format resolution
  const formatResolution = (width: number | null, height: number | null) => {
    if (!width || !height) return "Unknown";
    return `${width} × ${height}`;
  };

  // Get quality label
  const getQualityLabel = (height: number | null) => {
    if (!height) return null;
    if (height >= 2160) return "4K";
    if (height >= 1080) return "1080p";
    if (height >= 720) return "720p";
    if (height >= 480) return "480p";
    return "SD";
  };

  // Prevent hydration mismatch with Radix UI components
  if (!mounted) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Hidden audio element for playback */}
      <audio 
        ref={audioRef} 
        onEnded={() => setPlayingAudioId(null)}
        className="hidden"
      />

      {/* Header */}
      <header className="shrink-0 bg-background border-b border-border">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-semibold">Assets</h1>
            <p className="text-muted-foreground">
              Manage your media files and browse public assets
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-64"
              />
            </div>

            <div className="flex items-center border rounded-md">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setViewMode("grid")}
                className={cn(viewMode === "grid" && "bg-muted")}
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setViewMode("list")}
                className={cn(viewMode === "list" && "bg-muted")}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>

            {activeTab === "my" && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="px-6 pt-4 pb-2 border-b bg-background">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "my" | "public")}>
          <TabsList>
            <TabsTrigger value="my" className="gap-2">
              <FolderOpen className="w-4 h-4" />
              My Assets
            </TabsTrigger>
            <TabsTrigger value="public" className="gap-2">
              <Globe className="w-4 h-4" />
              Public Assets
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {activeTab === "my" ? (
            /* My Assets Tab */
            filteredAssets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <FolderOpen className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-1">No assets yet</h3>
                <p className="text-muted-foreground mb-4">
                  Upload your videos and images to use in your projects
                </p>
                <Button onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Your First Asset
                </Button>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredAssets.map((asset) => {
                  const metadata = (asset.metadata as AssetMetadata) || {};
                  const config = kindConfig[asset.kind as keyof typeof kindConfig];
                  const Icon = config?.icon || Film;
                  return (
                    <Card 
                      key={asset.id} 
                      className="group overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                      onClick={() => openAssetDetail(asset)}
                    >
                      <div className="aspect-video bg-muted relative">
                        {asset.kind === "image" ? (
                          asset.public_url ? (
                            <img
                              src={asset.public_url}
                              alt={metadata.name || "Asset"}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Image className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )
                        ) : asset.public_url ? (
                          <video
                            src={asset.public_url}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                            onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                            onMouseLeave={(e) => {
                              e.currentTarget.pause();
                              e.currentTarget.currentTime = 0;
                            }}
                            onError={(e) => {
                              // Hide broken video, show placeholder
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        <Badge
                          variant="secondary"
                          className={cn("absolute top-2 left-2 text-xs", config?.color)}
                        >
                          <Icon className="w-3 h-3 mr-1" />
                          {config?.label}
                        </Badge>
                        {asset.duration_sec && (
                          <Badge
                            variant="secondary"
                            className="absolute bottom-2 right-2 text-xs bg-black/70 text-white"
                          >
                            {formatDuration(asset.duration_sec)}
                          </Badge>
                        )}
                        {(asset as any).status === 'processing' && (
                          <Badge
                            variant="secondary"
                            className="absolute bottom-2 left-2 text-xs bg-amber-500/20 text-amber-500"
                          >
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Analyzing...
                          </Badge>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="secondary"
                              size="icon"
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 w-7 h-7"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(asset.id);
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <CardContent className="p-3">
                        <p className="font-medium text-sm truncate">
                          {metadata.name || "Untitled"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(asset.created_at)}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAssets.map((asset) => {
                  const metadata = (asset.metadata as AssetMetadata) || {};
                  const config = kindConfig[asset.kind as keyof typeof kindConfig];
                  const Icon = config?.icon || Film;
                  return (
                    <Card 
                      key={asset.id} 
                      className="p-3 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                      onClick={() => openAssetDetail(asset)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-12 bg-muted rounded overflow-hidden shrink-0">
                          {asset.kind === "image" ? (
                            asset.public_url ? (
                              <img
                                src={asset.public_url}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => e.currentTarget.style.display = 'none'}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-muted">
                                <Image className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )
                          ) : asset.public_url ? (
                            <video
                              src={asset.public_url}
                              className="w-full h-full object-cover"
                              muted
                              onError={(e) => e.currentTarget.style.display = 'none'}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted">
                              <Film className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {metadata.name || "Untitled"}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {metadata.description || "No description"}
                          </p>
                        </div>
                        {asset.duration_sec && (
                          <Badge variant="outline" className="shrink-0">
                            {formatDuration(asset.duration_sec)}
                          </Badge>
                        )}
                        <Badge
                          variant="secondary"
                          className={cn("shrink-0", config?.color)}
                        >
                          <Icon className="w-3 h-3 mr-1" />
                          {config?.label}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(asset.id);
                          }}
                          className="shrink-0 text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )
          ) : (
            /* Public Assets Tab */
            loadingPublic ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Clips Section */}
                <Collapsible open={clipsOpen} onOpenChange={setClipsOpen}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <Film className="w-5 h-5 text-blue-500" />
                            Video Clips
                            <Badge variant="secondary">{clips.length}</Badge>
                          </CardTitle>
                          {clipsOpen ? (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        {clips.length === 0 ? (
                          <p className="text-muted-foreground text-center py-4">
                            No clips available yet
                          </p>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {clips.map((clip) => (
                              <div key={clip.id} className="group rounded-lg border overflow-hidden">
                                <div className="aspect-video bg-muted relative">
                                  {clip.thumbnail_url ? (
                                    <img
                                      src={clip.thumbnail_url}
                                      alt=""
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Film className="w-8 h-8 text-muted-foreground" />
                                    </div>
                                  )}
                                  <Badge variant="secondary" className="absolute bottom-2 right-2 text-xs">
                                    {clip.duration_seconds}s
                                  </Badge>
                                </div>
                                <div className="p-2">
                                  <p className="text-sm line-clamp-2">
                                    {clip.description || "No description"}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                {/* Music Section */}
                <Collapsible open={musicOpen} onOpenChange={setMusicOpen}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <Music className="w-5 h-5 text-purple-500" />
                            Music
                            <Badge variant="secondary">{music.length}</Badge>
                          </CardTitle>
                          {musicOpen ? (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        {music.length === 0 ? (
                          <p className="text-muted-foreground text-center py-4">
                            No music tracks available yet
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {music.map((track) => (
                              <div
                                key={track.id}
                                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                              >
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="shrink-0"
                                  onClick={() => playAudio(track.id, track.audio_url)}
                                >
                                  {playingAudioId === track.id ? (
                                    <Pause className="w-4 h-4" />
                                  ) : (
                                    <Play className="w-4 h-4" />
                                  )}
                                </Button>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{track.title}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {track.artist || "Unknown artist"} • {formatDuration(track.duration_seconds)}
                                  </p>
                                </div>
                                {track.genre && (
                                  <Badge variant="outline">{track.genre}</Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                {/* Sound Effects Section */}
                <Collapsible open={sfxOpen} onOpenChange={setSfxOpen}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <Volume2 className="w-5 h-5 text-orange-500" />
                            Sound Effects
                            <Badge variant="secondary">{soundEffects.length}</Badge>
                          </CardTitle>
                          {sfxOpen ? (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        {soundEffects.length === 0 ? (
                          <p className="text-muted-foreground text-center py-4">
                            No sound effects available yet
                          </p>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {soundEffects.map((sfx) => (
                              <div
                                key={sfx.id}
                                className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                                onClick={() => playAudio(sfx.id, sfx.audio_url)}
                              >
                                <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                                  {playingAudioId === sfx.id ? (
                                    <Pause className="w-4 h-4 text-orange-500" />
                                  ) : (
                                    <Play className="w-4 h-4 text-orange-500" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{sfx.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDuration(sfx.duration_seconds)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                {/* Overlays Section */}
                <Collapsible open={overlaysOpen} onOpenChange={setOverlaysOpen}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <Image className="w-5 h-5 text-green-500" />
                            Overlays & Graphics
                            <Badge variant="secondary">{overlaysPublic.length}</Badge>
                          </CardTitle>
                          {overlaysOpen ? (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        {overlaysPublic.length === 0 ? (
                          <p className="text-muted-foreground text-center py-4">
                            No overlays available yet
                          </p>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {overlaysPublic.map((overlay) => (
                              <div key={overlay.id} className="group rounded-lg border overflow-hidden">
                                <div className="aspect-video bg-muted relative flex items-center justify-center">
                                  {overlay.image_url ? (
                                    <img
                                      src={overlay.image_url}
                                      alt=""
                                      className="max-w-full max-h-full object-contain"
                                    />
                                  ) : (
                                    <Image className="w-8 h-8 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="p-2">
                                  <p className="text-sm font-medium">{overlay.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {overlay.category || "General"}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              </div>
            )
          )}
        </div>
      </ScrollArea>

      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={(open) => !open && uploadPhase === 'idle' && cancelUpload()}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {uploadPhase === 'idle' ? 'Upload Asset' : 
               uploadPhase === 'uploading' ? 'Uploading...' : 
               uploadPhase === 'analyzing' ? 'Analyzing with AI...' : 'Complete'}
            </DialogTitle>
          </DialogHeader>

          {/* Loading/Progress state */}
          {(uploadPhase === 'uploading' || uploadPhase === 'analyzing') ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  {uploadPhase === 'uploading' ? (
                    <Upload className="w-10 h-10 text-primary" />
                  ) : (
                    <Sparkles className="w-10 h-10 text-primary" />
                  )}
                </div>
                <Loader2 className="absolute -top-2 -left-2 w-24 h-24 text-primary animate-spin" />
              </div>
              <p className="text-lg font-medium">
                {uploadPhase === 'uploading' ? 'Uploading your file...' : 'AI is analyzing...'}
              </p>
              <p className="text-sm text-muted-foreground mt-2 text-center max-w-xs">
                {analysisProgress}
              </p>
              
              {/* Progress bar */}
              <div className="w-full max-w-xs mt-6">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${uploadAnalysisProgress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  {uploadAnalysisProgress}% complete
                </p>
              </div>
              
              {uploadPhase === 'analyzing' && (
                <p className="text-xs text-muted-foreground mt-4 text-center">
                  Please don&apos;t close this page. AI is analyzing your video content.
                </p>
              )}
            </div>
          ) : uploadPhase === 'complete' && uploadedAsset ? (
            /* Complete state - show results */
            <div className="flex flex-col items-center py-8 space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-emerald-500" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold">Upload Complete!</h3>
                <p className="text-sm text-muted-foreground">
                  Your video has been analyzed by AI
                </p>
              </div>
              
              {/* Show AI description */}
              {(uploadedAsset.metadata as AssetMetadata)?.description && (
                <div className="w-full p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <p className="text-sm font-medium">AI-Generated Description</p>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {(uploadedAsset.metadata as AssetMetadata).description}
                  </p>
                </div>
              )}
              
              {/* Show chapters if available */}
              {(uploadedAsset.metadata as AssetMetadata)?.chapters && 
               (uploadedAsset.metadata as AssetMetadata).chapters!.length > 0 && (
                <div className="w-full">
                  <p className="text-sm font-medium mb-2">Video Chapters</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {(uploadedAsset.metadata as AssetMetadata).chapters!.map((chapter, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-2 bg-muted/50 rounded-lg">
                        <Badge variant="outline" className="shrink-0 text-xs font-mono">
                          {formatDuration(chapter.start)}
                        </Badge>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{chapter.chapter_title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{chapter.chapter_summary}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button onClick={() => {
                // Reset and close modal
                setShowUploadModal(false);
                setPendingFile(null);
                if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
                setPendingPreviewUrl(null);
                setAssetName("");
                setAssetDescription("");
                setAssetTags("");
                setAssetReference("");
                setAssetDuration(null);
                setAutoGenerateDescription(true);
                setUploadPhase('idle');
                setAnalysisProgress("");
                setUploadAnalysisProgress(0);
                setUploadedAsset(null);
                setUploadJobId(null);
                setUploading(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }} className="w-full">
                Done
              </Button>
            </div>
          ) : (
          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            {/* Preview */}
            {pendingPreviewUrl && pendingFile && (
              <div className="aspect-video bg-muted rounded-lg overflow-hidden max-h-48">
                {pendingFile.type.startsWith("video/") ? (
                  <video
                    src={pendingPreviewUrl}
                    className="w-full h-full object-contain"
                    controls
                    muted
                  />
                ) : (
                  <img
                    src={pendingPreviewUrl}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            )}

            {/* Reference (Product/Location) */}
            <div className="space-y-2">
              <Label htmlFor="asset-reference">Reference (Product Name or Address)</Label>
              <Input
                id="asset-reference"
                value={assetReference}
                onChange={(e) => setAssetReference(e.target.value)}
                placeholder="e.g., iPhone 15 Pro, 123 Main Street"
              />
              <p className="text-xs text-muted-foreground">
                AI will use this context to generate better descriptions
              </p>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="asset-name">Name</Label>
              <Input
                id="asset-name"
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                placeholder="Enter a name for this asset"
              />
            </div>

            {/* Auto-generate toggle - for videos only */}
            {pendingFile?.type.startsWith("video/") && (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">AI Video Analysis</p>
                    <p className="text-xs text-muted-foreground">
                      {autoGenerateDescription 
                        ? "TwelveLabs will analyze your video in the background"
                        : "You can analyze later from the asset details"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoGenerateDescription(!autoGenerateDescription)}
                  className={cn(
                    "w-11 h-6 rounded-full transition-colors relative",
                    autoGenerateDescription ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                >
                  <div className={cn(
                    "absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform",
                    autoGenerateDescription ? "translate-x-5" : "translate-x-0.5"
                  )} />
                </button>
              </div>
            )}

            {/* Description - manual entry */}
            <div className="space-y-2">
              <Label htmlFor="asset-description">Description (Optional)</Label>
              <Textarea
                id="asset-description"
                value={assetDescription}
                onChange={(e) => setAssetDescription(e.target.value)}
                placeholder="Describe what this asset shows..."
                rows={3}
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label htmlFor="asset-tags">Tags (comma-separated, optional)</Label>
              <Input
                id="asset-tags"
                value={assetTags}
                onChange={(e) => setAssetTags(e.target.value)}
                placeholder="e.g., product, lifestyle, outdoor"
              />
            </div>

            {/* Duration - auto-detected for video/audio */}
            {pendingFile && (pendingFile.type.startsWith("video/") || pendingFile.type.startsWith("audio/")) && (
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Film className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Duration</p>
                  <p className="text-xs text-muted-foreground">
                    {assetDuration !== null ? (
                      `${assetDuration}s (auto-detected)`
                    ) : (
                      <span className="flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Detecting...
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
          )}

          {uploadPhase === 'idle' && (
            <DialogFooter className="shrink-0">
              <Button variant="outline" onClick={cancelUpload}>
                Cancel
              </Button>
              <Button onClick={handleUploadConfirm} disabled={uploading}>
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Asset Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={(open) => !open && closeAssetDetail()}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          {selectedAsset && (() => {
            const metadata = (selectedAsset.metadata as AssetMetadata) || {};
            const config = kindConfig[selectedAsset.kind as keyof typeof kindConfig];
            const Icon = config?.icon || Film;
            const qualityLabel = getQualityLabel(selectedAsset.height);
            
            return (
              <>
                <DialogHeader className="shrink-0">
                  <DialogTitle className="flex items-center gap-2">
                    <Icon className="w-5 h-5" />
                    {metadata.name || selectedAsset.filename || "Untitled Asset"}
                  </DialogTitle>
                </DialogHeader>

                <ScrollArea className="flex-1">
                  <div className="space-y-6 pr-4">
                    {/* Media Preview */}
                    <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                      {selectedAsset.kind === "image" ? (
                        selectedAsset.public_url ? (
                          <img
                            src={selectedAsset.public_url}
                            alt={metadata.name || "Asset"}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Image className="w-12 h-12 text-muted-foreground" />
                          </div>
                        )
                      ) : selectedAsset.public_url ? (
                        <video
                          src={selectedAsset.public_url}
                          className="w-full h-full object-contain"
                          controls
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="w-12 h-12 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Duration */}
                      {selectedAsset.duration_sec && (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Duration</p>
                          <p className="font-medium">{formatDuration(selectedAsset.duration_sec)}</p>
                        </div>
                      )}

                      {/* Resolution */}
                      {(selectedAsset.width || selectedAsset.height) && (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Resolution</p>
                          <p className="font-medium flex items-center gap-2">
                            {formatResolution(selectedAsset.width, selectedAsset.height)}
                            {qualityLabel && (
                              <Badge variant="secondary" className="text-xs">
                                {qualityLabel}
                              </Badge>
                            )}
                          </p>
                        </div>
                      )}

                      {/* File Size */}
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">File Size</p>
                        <p className="font-medium">{formatFileSize(selectedAsset.size_bytes)}</p>
                      </div>

                      {/* Type */}
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Type</p>
                        <p className="font-medium">{selectedAsset.mime_type}</p>
                      </div>

                      {/* Created */}
                      <div className="p-3 bg-muted/50 rounded-lg col-span-2">
                        <p className="text-xs text-muted-foreground mb-1">Uploaded</p>
                        <p className="font-medium">
                          {new Date(selectedAsset.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Description */}
                    {metadata.description && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-sm font-medium">Description</p>
                          {metadata.aiGenerated && (
                            <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                              <Sparkles className="w-3 h-3 mr-1" />
                              AI Generated
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {metadata.description}
                        </p>
                      </div>
                    )}

                    {/* AI Chapters - if available in metadata */}
                    {metadata.chapters && metadata.chapters.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Chapters</p>
                        <div className="space-y-2">
                          {metadata.chapters.map((chapter, idx) => (
                            <div
                              key={idx}
                              className="p-3 bg-muted/50 rounded-lg flex gap-3"
                            >
                              <Badge variant="outline" className="shrink-0 font-mono text-xs">
                                {formatDuration(chapter.start)}
                              </Badge>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {chapter.chapter_title}
                                </p>
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {chapter.chapter_summary}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* AI Highlights - if available in metadata */}
                    {metadata.highlights && metadata.highlights.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Highlights</p>
                        <div className="space-y-2">
                          {metadata.highlights.map((highlight, idx) => (
                            <div
                              key={idx}
                              className="p-3 bg-primary/5 rounded-lg flex gap-3 border border-primary/20"
                            >
                              <Badge variant="outline" className="shrink-0 font-mono text-xs border-primary/30 text-primary">
                                {formatDuration(highlight.start)}
                              </Badge>
                              <div className="min-w-0">
                                <p className="font-medium text-sm">
                                  {highlight.highlight}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {highlight.highlight_summary}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tags */}
                    {((metadata.tags && metadata.tags.length > 0) || (selectedAsset.tags && selectedAsset.tags.length > 0)) && (
                      <div>
                        <p className="text-sm font-medium mb-2">Tags</p>
                        <div className="flex flex-wrap gap-2">
                          {(metadata.tags || selectedAsset.tags || []).map((tag, idx) => (
                            <Badge key={idx} variant="outline">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* AI Analysis Section - Only for videos without AI description */}
                    {selectedAsset.kind === "video" && !metadata.aiGenerated && (
                      <div className="border-t pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="font-medium flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-primary" />
                              AI Video Analysis
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Get detailed insights with TwelveLabs AI
                            </p>
                          </div>
                          {!analysisJobId && !analysisJob && (
                            <Button
                              onClick={startVideoAnalysis}
                              disabled={isAnalyzing}
                              size="sm"
                            >
                              {isAnalyzing ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Starting...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4 mr-2" />
                                  Analyze Video
                                </>
                              )}
                            </Button>
                          )}
                        </div>

                        {/* Analysis in progress */}
                        {analysisJob && (analysisJob.status === "queued" || analysisJob.status === "processing") && (
                          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                            <div className="flex items-center gap-3 mb-3">
                              <Loader2 className="w-5 h-5 animate-spin text-primary" />
                              <div>
                                <p className="font-medium">
                                  {analysisJob.status === "queued" ? "Queued..." : "Processing..."}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {analysisJob.progress}% complete
                                </p>
                              </div>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full transition-all"
                                style={{ width: `${analysisJob.progress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Analysis failed */}
                        {analysisJob && analysisJob.status === "failed" && (
                          <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                            <p className="font-medium text-destructive mb-1">Analysis Failed</p>
                            <p className="text-sm text-muted-foreground">
                              {analysisJob.error || "An error occurred during analysis"}
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-3"
                              onClick={() => {
                                setAnalysisJob(null);
                                setAnalysisJobId(null);
                              }}
                            >
                              Try Again
                            </Button>
                          </div>
                        )}

                        {/* Analysis results */}
                        {analysisJob && analysisJob.status === "done" && analysisJob.resultJson && (
                          <div className="space-y-4">
                            {/* Summary */}
                            {analysisJob.resultJson.summary && (
                              <div className="p-4 bg-muted/50 rounded-lg">
                                <p className="text-sm font-medium mb-2">Summary</p>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                  {analysisJob.resultJson.summary}
                                </p>
                              </div>
                            )}

                            {/* Chapters */}
                            {analysisJob.resultJson.chapters && analysisJob.resultJson.chapters.length > 0 && (
                              <div>
                                <p className="text-sm font-medium mb-2">Chapters</p>
                                <div className="space-y-2">
                                  {analysisJob.resultJson.chapters.map((chapter, idx) => (
                                    <div
                                      key={idx}
                                      className="p-3 bg-muted/30 rounded-lg flex gap-3"
                                    >
                                      <Badge variant="outline" className="shrink-0 font-mono text-xs">
                                        {formatDuration(chapter.start)}
                                      </Badge>
                                      <div className="min-w-0">
                                        <p className="font-medium text-sm truncate">
                                          {chapter.chapter_title}
                                        </p>
                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                          {chapter.chapter_summary}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Highlights */}
                            {analysisJob.resultJson.highlights && analysisJob.resultJson.highlights.length > 0 && (
                              <div>
                                <p className="text-sm font-medium mb-2">Highlights</p>
                                <div className="space-y-2">
                                  {analysisJob.resultJson.highlights.map((highlight, idx) => (
                                    <div
                                      key={idx}
                                      className="p-3 bg-amber-500/10 rounded-lg flex gap-3"
                                    >
                                      <Badge variant="outline" className="shrink-0 font-mono text-xs border-amber-500/30">
                                        {formatDuration(highlight.start)}
                                      </Badge>
                                      <div className="min-w-0">
                                        <p className="font-medium text-sm">
                                          {highlight.highlight}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {highlight.highlight_summary}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </ScrollArea>

                <DialogFooter className="shrink-0 border-t pt-4">
                  <Button variant="outline" onClick={closeAssetDetail}>
                    Close
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      handleDelete(selectedAsset.id);
                      closeAssetDetail();
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Asset
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
