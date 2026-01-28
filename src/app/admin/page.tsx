"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Mic, Check, X, LogOut, Gift, ToggleLeft, ToggleRight, Film, Upload, AlertCircle, ExternalLink, RefreshCw, Loader2, Music, Volume2, ImageIcon, ChevronRight, ChevronDown, Tag, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Voice {
  id: string;
  name: string;
  eleven_labs_id: string;
  profile_image_url: string | null;
  preview_url: string | null;
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

interface ClipRendition {
  id: string;
  clip_id: string;
  resolution: string;
  resolution_width: number;
  resolution_height: number;
  clip_url: string;
}

interface ClipTag {
  id: string;
  name: string;
  category: string;
  color: string | null;
}

interface Clip {
  id: string;
  clip_link: string;
  duration_seconds: number;
  description: string | null;
  tags: string[]; // Legacy field
  clipTags: ClipTag[]; // New: from junction table
  thumbnail_url: string | null;
  created_at: string;
  linkType: "gdrive" | "r2" | "other";
  needsMigration: boolean;
  source_resolution?: string;
  renditions?: ClipRendition[];
  hasAllRenditions?: boolean;
}

type Section = "clips" | "music" | "sfx" | "overlays" | "voices" | "promo" | "tags";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [activeSection, setActiveSection] = useState<Section>("clips");
  
  const [voices, setVoices] = useState<Voice[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [musicTracks, setMusicTracks] = useState<any[]>([]);
  const [soundEffects, setSoundEffects] = useState<any[]>([]);
  const [overlays, setOverlays] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewVoice, setShowNewVoice] = useState(false);
  const [showNewCode, setShowNewCode] = useState(false);
  const [showNewClip, setShowNewClip] = useState(false);
  const [showNewMusic, setShowNewMusic] = useState(false);
  const [showNewSfx, setShowNewSfx] = useState(false);
  const [showNewOverlay, setShowNewOverlay] = useState(false);
  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);
  
  // Clip management
  const clipFileRef = useRef<HTMLInputElement>(null);
  // Batch upload state - each pending clip has its own full form
  interface PendingClip {
    file: File;
    duration: number | null;
    description: string;
    selectedTagIds: string[];
    keywords: string;
    source_resolution: "4k" | "1080p" | "720p";
    status: "pending" | "uploading" | "done" | "error";
    error?: string;
    expanded: boolean; // For collapsible form
  }
  const [pendingClips, setPendingClips] = useState<PendingClip[]>([]);
  const [isUploadingClip, setIsUploadingClip] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [isGeneratingRenditions, setIsGeneratingRenditions] = useState<string | null>(null);
  const [tagFilterCategory, setTagFilterCategory] = useState<string>("all"); // For faceted filtering
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkUploadProgress, setBulkUploadProgress] = useState("");
  
  // Predefined tags for clips
  const [clipTags, setClipTags] = useState<{
    tags: Array<{ id: string; name: string; category: string; description: string; color: string }>;
    grouped: Record<string, Array<{ id: string; name: string; category: string; description: string; color: string }>>;
    categories: string[];
    categoryDescriptions?: Record<string, { label: string; description: string } | string>;
  }>({ tags: [], grouped: {}, categories: [] });
  
  // New tag form
  const [showNewTag, setShowNewTag] = useState(false);
  const [newTag, setNewTag] = useState({
    name: "",
    category: "setting",
    description: "",
    color: "#3B82F6",
  });
  const [isAddingTag, setIsAddingTag] = useState(false);
  
  // Bulk add state - with duration fields
  const [musicEntries, setMusicEntries] = useState<Array<{
    id: string;
    file: File | null;
    url: string;
    title: string;
    artist: string;
    duration: string;
    mood: string;
    tags: string;
    isUploading: boolean;
  }>>([]);
  const [sfxEntries, setSfxEntries] = useState<Array<{
    id: string;
    file: File | null;
    url: string;
    title: string;
    description: string;
    duration: string;
    tags: string;
    isUploading: boolean;
  }>>([]);
  const [overlayEntries, setOverlayEntries] = useState<Array<{
    id: string;
    file: File | null;
    url: string;
    title: string;
    description: string;
    width: string;
    height: string;
    tags: string;
    isUploading: boolean;
  }>>([]);
  
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResults, setMigrationResults] = useState<{
    message: string;
    summary: { successful: number; skipped: number; errors: number; total: number };
    results: Array<{
      clipId: string;
      description: string | null;
      status: "success" | "skipped" | "error";
      error?: string;
      oldLink?: string;
      newLink?: string;
    }>;
  } | null>(null);
  
  // New voice form
  const [newVoice, setNewVoice] = useState({
    name: "",
    eleven_labs_id: "",
    description: "",
    profile_image: null as File | null,
    preview_audio: null as File | null,
    preview_url: "",
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

  // Check auth on mount
  useEffect(() => {
    const auth = sessionStorage.getItem("admin_auth");
    if (auth === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  // Fetch data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchAll();
    }
  }, [isAuthenticated]);

  const fetchAll = () => {
    fetchVoices();
    fetchPromoCodes();
    fetchClips();
    fetchMusic();
    fetchSoundEffects();
    fetchOverlays();
    fetchClipTags();
  };
  
  const fetchClipTags = async () => {
    try {
      const response = await fetch("/api/tags");
      if (response.ok) {
        const data = await response.json();
        setClipTags({
          tags: data.tags || [],
          grouped: data.grouped || {},
          categories: Object.keys(data.categories || {}),
          categoryDescriptions: data.categories,
        });
      }
    } catch (error) {
      console.error("Failed to fetch clip tags:", error);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Get credentials from env vars or use defaults
    const adminUsername = process.env.NEXT_PUBLIC_ADMIN_USERNAME || "admin";
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin123";
    
    if (username === adminUsername && password === adminPassword) {
      setIsAuthenticated(true);
      sessionStorage.setItem("admin_auth", "true");
      setLoginError("");
    } else {
      setLoginError("Invalid credentials");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem("admin_auth");
  };

  // =============== VOICES ===============
  const fetchVoices = async () => {
    try {
      const response = await fetch("/api/voices");
      if (response.ok) {
        const data = await response.json();
        setVoices(data.voices || []);
      }
    } catch (error) {
      console.error("Failed to fetch voices:", error);
    }
  };

  const handleCreateVoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVoice.name || !newVoice.eleven_labs_id) return;

    setIsCreating(true);
    try {
      let profileImageUrl = null;
      if (newVoice.profile_image) {
        const formData = new FormData();
        formData.append("file", newVoice.profile_image);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        profileImageUrl = uploadData.url;
      }

      let previewUrl = newVoice.preview_url || null;
      if (newVoice.preview_audio) {
        // Upload preview audio to R2
        const urlRes = await fetch("/api/admin/upload-media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: newVoice.preview_audio.name,
            contentType: newVoice.preview_audio.type,
            type: "music", // Use music folder for voice previews
          }),
        });
        const { uploadUrl, publicUrl } = await urlRes.json();
        await fetch(uploadUrl, {
          method: "PUT",
          body: newVoice.preview_audio,
          headers: { "Content-Type": newVoice.preview_audio.type },
        });
        previewUrl = publicUrl;
      }

      const response = await fetch("/api/admin/voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newVoice.name,
          eleven_labs_id: newVoice.eleven_labs_id,
          description: newVoice.description,
          profile_image_url: profileImageUrl,
          preview_url: previewUrl,
        }),
      });

      if (response.ok) {
        fetchVoices();
        setShowNewVoice(false);
        setNewVoice({ name: "", eleven_labs_id: "", description: "", profile_image: null, preview_audio: null, preview_url: "" });
      }
    } catch (error) {
      console.error("Failed to create voice:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleDefault = async (voiceId: string, currentDefault: boolean) => {
    try {
      await fetch(`/api/admin/voices/${voiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: !currentDefault }),
      });
      fetchVoices();
    } catch (error) {
      console.error("Failed to toggle default:", error);
    }
  };

  const handleDeleteVoice = async (voiceId: string) => {
    if (!confirm("Delete this voice?")) return;
    try {
      await fetch(`/api/admin/voices/${voiceId}`, { method: "DELETE" });
      fetchVoices();
    } catch (error) {
      console.error("Failed to delete voice:", error);
    }
  };

  // =============== PROMO CODES ===============
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
    if (!newCode.code || !newCode.credits) return;

    setIsCreatingCode(true);
    try {
      const response = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newCode.code.toUpperCase(),
          credits: parseInt(newCode.credits),
          max_uses: newCode.max_uses ? parseInt(newCode.max_uses) : null,
          expires_at: newCode.expires_at || null,
        }),
      });

      if (response.ok) {
        fetchPromoCodes();
        setShowNewCode(false);
        setNewCode({ code: "", credits: "5", max_uses: "", expires_at: "" });
      }
    } catch (error) {
      console.error("Failed to create promo code:", error);
    } finally {
      setIsCreatingCode(false);
    }
  };

  const handleToggleCodeActive = async (codeId: string, currentActive: boolean) => {
    try {
      await fetch(`/api/admin/promo-codes/${codeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !currentActive }),
      });
      fetchPromoCodes();
    } catch (error) {
      console.error("Failed to toggle code:", error);
    }
  };

  const handleDeleteCode = async (codeId: string) => {
    if (!confirm("Delete this promo code?")) return;
    try {
      await fetch(`/api/admin/promo-codes/${codeId}`, { method: "DELETE" });
      fetchPromoCodes();
    } catch (error) {
      console.error("Failed to delete code:", error);
    }
  };

  // =============== CLIPS ===============
  const fetchClips = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/clips");
      if (response.ok) {
        const data = await response.json();
        const processedClips = (data.clips || []).map((clip: any) => {
          const link = clip.clip_link || "";
          const isGDrive = link.includes("drive.google.com") || link.includes("docs.google.com");
          const isR2 = link.includes("r2.cloudflarestorage") || link.includes(process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "pub-");
          return {
            ...clip,
            linkType: isGDrive ? "gdrive" : isR2 ? "r2" : "other",
            needsMigration: isGDrive,
          };
        });
        setClips(processedClips);
      }
    } catch (error) {
      console.error("Failed to fetch clips:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getGDriveClipsNeedingMigration = () => clips.filter(c => c.needsMigration);

  const handleMigrateClips = async () => {
    if (!confirm("Migrate all Google Drive clips to R2? This may take a while.")) return;
    setIsMigrating(true);
    setMigrationResults(null);
    try {
      const response = await fetch("/api/admin/clips/migrate", { method: "POST" });
      const data = await response.json();
      setMigrationResults(data);
      fetchClips();
    } catch (error) {
      console.error("Migration failed:", error);
    } finally {
      setIsMigrating(false);
    }
  };

  const handleGenerateThumbnails = async () => {
    if (!confirm("Generate thumbnails for all clips without one?")) return;
    setIsGeneratingThumbnails(true);
    try {
      const res = await fetch("/api/admin/clips/generate-thumbnails", { method: "POST" });
      const data = await res.json();
      alert(data.message || "Thumbnails generated!");
      fetchClips();
    } catch {
      alert("Failed to generate thumbnails");
    } finally {
      setIsGeneratingThumbnails(false);
    }
  };

  // Handle adding files to the pending list
  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const newPendingClips: PendingClip[] = [];
    
    Array.from(files).forEach((file) => {
      const pendingClip: PendingClip = {
        file,
        duration: null,
        description: "",
        selectedTagIds: [],
        keywords: "",
        source_resolution: "4k",
        status: "pending",
        expanded: true, // First clip expanded by default
      };
      
      // Auto-detect duration
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        const duration = Math.floor(video.duration * 10) / 10;
        setPendingClips(prev => prev.map(clip => 
          clip.file === file ? { ...clip, duration } : clip
        ));
        URL.revokeObjectURL(video.src);
      };
      video.src = URL.createObjectURL(file);
      
      newPendingClips.push(pendingClip);
    });
    
    setPendingClips(prev => [...prev, ...newPendingClips]);
    if (clipFileRef.current) clipFileRef.current.value = "";
  };

  // Remove a pending clip
  const removePendingClip = (index: number) => {
    setPendingClips(prev => prev.filter((_, i) => i !== index));
  };

  // Update a specific pending clip
  const updatePendingClip = (index: number, updates: Partial<PendingClip>) => {
    setPendingClips(prev => prev.map((clip, i) => 
      i === index ? { ...clip, ...updates } : clip
    ));
  };

  // Toggle clip form expansion
  const toggleClipExpanded = (index: number) => {
    setPendingClips(prev => prev.map((clip, i) => 
      i === index ? { ...clip, expanded: !clip.expanded } : clip
    ));
  };

  // Upload all pending clips
  const handleUploadAllClips = async () => {
    const clipsToUpload = pendingClips.filter(c => c.status === "pending" && c.duration !== null);
    
    if (clipsToUpload.length === 0) {
      alert("No clips ready to upload. Make sure duration is detected for all clips.");
      return;
    }

    setIsUploadingClip(true);
    setUploadProgress({ current: 0, total: clipsToUpload.length });

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < pendingClips.length; i++) {
      const clip = pendingClips[i];
      if (clip.status !== "pending" || clip.duration === null) continue;

      // Update status to uploading
      setPendingClips(prev => prev.map((c, idx) => 
        idx === i ? { ...c, status: "uploading" } : c
      ));

      try {
        // Step 1: Get presigned URL
        const urlRes = await fetch("/api/admin/clips/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: clip.file.name,
            contentType: clip.file.type,
          }),
        });

        if (!urlRes.ok) {
          throw new Error("Failed to get upload URL");
        }

        const { uploadUrl, publicUrl } = await urlRes.json();
        
        // Step 2: Upload to R2
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          body: clip.file,
          headers: { "Content-Type": clip.file.type },
        });

        if (!uploadRes.ok) {
          throw new Error(`R2 upload failed: ${uploadRes.status}`);
        }

        // Step 3: Create clip in database
        const createRes = await fetch("/api/admin/clips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clip_link: publicUrl,
            duration_seconds: clip.duration,
            description: clip.description || null,
            tagIds: clip.selectedTagIds,
            keywords: clip.keywords.split(",").map(k => k.trim()).filter(Boolean),
            source_resolution: clip.source_resolution,
          }),
        });

        if (!createRes.ok) {
          throw new Error("Failed to save to database");
        }

        // Success
        setPendingClips(prev => prev.map((c, idx) => 
          idx === i ? { ...c, status: "done" } : c
        ));
        successCount++;
      } catch (error) {
        // Error
        setPendingClips(prev => prev.map((c, idx) => 
          idx === i ? { ...c, status: "error", error: error instanceof Error ? error.message : "Unknown error" } : c
        ));
        errorCount++;
      }

      setUploadProgress(prev => ({ ...prev, current: prev.current + 1 }));
    }

    setIsUploadingClip(false);
    fetchClips();
    
    // Show summary
    alert(`Upload complete!\n✅ ${successCount} clips uploaded successfully\n${errorCount > 0 ? `❌ ${errorCount} clips failed` : ""}`);
    
    // Clear successful uploads
    if (successCount > 0) {
      setPendingClips(prev => prev.filter(c => c.status !== "done"));
    }
  };

  // State for duration fix modal
  const [showDurationModal, setShowDurationModal] = useState(false);
  const [durationInputs, setDurationInputs] = useState<Record<string, string>>({});
  const [savingDurations, setSavingDurations] = useState(false);

  // Process all clips - show modal for manual duration entry
  const handleProcessAllClips = () => {
    const clipsNeedingDuration = clips.filter(c => !c.duration_seconds || c.duration_seconds === 0);
    
    if (clipsNeedingDuration.length === 0) {
      alert("All clips have durations set!");
      return;
    }
    
    // Initialize duration inputs
    const inputs: Record<string, string> = {};
    clipsNeedingDuration.forEach(clip => {
      inputs[clip.id] = "";
    });
    setDurationInputs(inputs);
    setShowDurationModal(true);
  };

  const handleSaveDurations = async () => {
    setSavingDurations(true);
    
    try {
      // Build updates array
      const updates: Array<{ clipId: string; duration: number }> = [];
      
      for (const [clipId, duration] of Object.entries(durationInputs)) {
        if (!duration || parseFloat(duration) <= 0) continue;
        updates.push({ clipId, duration: parseFloat(duration) });
      }
      
      if (updates.length === 0) {
        alert("No valid durations to save. Enter duration values first.");
        return;
      }
      
      console.log(`Saving ${updates.length} durations...`);
      
      // Use batch update endpoint
      const res = await fetch("/api/admin/clips/update-duration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Update failed");
      }
      
      let message = `✅ Saved ${data.success} durations`;
      if (data.failed > 0) {
        message += `\n❌ ${data.failed} failed`;
        const failedResults = data.results?.filter((r: any) => !r.success) || [];
        if (failedResults.length > 0) {
          message += `\n\nErrors:\n${failedResults.slice(0, 5).map((r: any) => `• ${r.clipId.slice(0, 8)}: ${r.error}`).join("\n")}`;
        }
      }
      
      alert(message);
      
      if (data.success > 0) {
        setShowDurationModal(false);
        fetchClips();
      }
    } catch (error) {
      console.error("Save durations failed:", error);
      alert(error instanceof Error ? error.message : "Failed to save durations");
    } finally {
      setSavingDurations(false);
    }
  };

  // Detect duration by playing video in hidden element
  const detectDurationForClip = async (clipId: string, clipUrl: string) => {
    try {
      // Use a proxy approach - embed video and get duration
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      
      return new Promise<number>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 15000);
        
        video.onloadedmetadata = () => {
          clearTimeout(timeout);
          resolve(Math.floor(video.duration * 10) / 10);
        };
        
        video.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("Load failed"));
        };
        
        // Try direct load without crossOrigin for same-origin or CORS-enabled URLs
        video.src = clipUrl;
        video.load();
      });
    } catch {
      return null;
    }
  };

  // Bulk upload from /public/upload-clips
  const handleBulkUpload = async () => {
    if (!confirm("This will upload all videos from public/upload-clips folder with predefined tags. Continue?")) {
      return;
    }
    
    setIsBulkUploading(true);
    setBulkUploadProgress("Starting...");
    
    try {
      const res = await fetch("/api/admin/clips/bulk-upload", {
        method: "POST",
      });
      
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Bulk upload failed");
      }
      
      const data = await res.json();
      
      // Show results
      let message = `Bulk Upload Complete!\n\n`;
      message += `✅ Success: ${data.summary.success}\n`;
      message += `❌ Errors: ${data.summary.errors}\n`;
      message += `⏭️ Skipped: ${data.summary.skipped}\n\n`;
      
      if (data.summary.errors > 0) {
        const errors = data.results.filter((r: any) => r.status === "error");
        message += `Errors:\n${errors.map((e: any) => `- ${e.filename}: ${e.message}`).join("\n")}`;
      }
      
      alert(message);
      fetchClips();
      
    } catch (error) {
      console.error("Bulk upload failed:", error);
      alert(error instanceof Error ? error.message : "Bulk upload failed");
    } finally {
      setIsBulkUploading(false);
      setBulkUploadProgress("");
    }
  };

  const handleDeleteClip = async (clipId: string) => {
    if (!confirm("Delete this clip?")) return;
    try {
      await fetch(`/api/admin/clips/${clipId}`, { method: "DELETE" });
      fetchClips();
    } catch (error) {
      console.error("Failed to delete clip:", error);
    }
  };

  // =============== MUSIC ===============
  const fetchMusic = async () => {
    try {
      const response = await fetch("/api/admin/music");
      if (response.ok) {
        const data = await response.json();
        setMusicTracks(data.tracks || []);
      }
    } catch (error) {
      console.error("Failed to fetch music:", error);
    }
  };

  const handleDeleteMusic = async (id: string) => {
    if (!confirm("Delete this music track?")) return;
    try {
      const res = await fetch(`/api/admin/music?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchMusic();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete music");
      }
    } catch (error) {
      console.error("Failed to delete music:", error);
    }
  };

  // =============== SOUND EFFECTS ===============
  const fetchSoundEffects = async () => {
    try {
      const response = await fetch("/api/admin/sound-effects");
      if (response.ok) {
        const data = await response.json();
        setSoundEffects(data.effects || []);
      }
    } catch (error) {
      console.error("Failed to fetch sound effects:", error);
    }
  };

  const handleDeleteSfx = async (id: string) => {
    if (!confirm("Delete this sound effect?")) return;
    try {
      const res = await fetch(`/api/admin/sound-effects?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchSoundEffects();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete sound effect");
      }
    } catch (error) {
      console.error("Failed to delete sfx:", error);
    }
  };

  // =============== OVERLAYS ===============
  const fetchOverlays = async () => {
    try {
      const response = await fetch("/api/admin/overlays");
      if (response.ok) {
        const data = await response.json();
        setOverlays(data.overlays || []);
      }
    } catch (error) {
      console.error("Failed to fetch overlays:", error);
    }
  };

  const handleDeleteOverlay = async (id: string) => {
    if (!confirm("Delete this overlay?")) return;
    try {
      const res = await fetch(`/api/admin/overlays?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchOverlays();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete overlay");
      }
    } catch (error) {
      console.error("Failed to delete overlay:", error);
    }
  };

  // =============== LOGIN SCREEN ===============
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Admin Access</CardTitle>
            <CardDescription>Enter your credentials to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              {loginError && (
                <p className="text-sm text-destructive">{loginError}</p>
              )}
              <Button type="submit" className="w-full">
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // =============== SIDEBAR NAV ITEMS ===============
  const navItems: { key: Section; label: string; icon: any; count?: number }[] = [
    { key: "clips", label: "B-Roll Clips", icon: Film, count: clips.length },
    { key: "music", label: "Music", icon: Music, count: musicTracks.length },
    { key: "sfx", label: "Sound Effects", icon: Volume2, count: soundEffects.length },
    { key: "overlays", label: "Overlays", icon: ImageIcon, count: overlays.length },
    { key: "voices", label: "Voices", icon: Mic, count: voices.length },
    { key: "promo", label: "Promo Codes", icon: Gift, count: promoCodes.length },
    { key: "tags", label: "Clip Tags", icon: Tag, count: clipTags.tags.length },
  ];

  // =============== RENDER CONTENT ===============
  const renderContent = () => {
    switch (activeSection) {
      case "clips":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">B-Roll Clips</h2>
                <p className="text-muted-foreground">Manage video clips for AI video generation</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchClips}>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Refresh
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleGenerateThumbnails}
                  disabled={isGeneratingThumbnails}
                >
                  {isGeneratingThumbnails ? (
                    <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Generating...</>
                  ) : (
                    <><ImageIcon className="w-4 h-4 mr-1" /> Generate Thumbnails</>
                  )}
                </Button>
                <Button size="sm" onClick={() => setShowNewClip(!showNewClip)}>
                  {showNewClip ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                  {showNewClip ? "Cancel" : "Add Clip"}
                </Button>
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={handleBulkUpload}
                  disabled={isBulkUploading}
                >
                  {isBulkUploading ? (
                    <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Uploading {bulkUploadProgress}...</>
                  ) : (
                    <><Upload className="w-4 h-4 mr-1" /> Bulk Upload</>
                  )}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleProcessAllClips}
                >
                  <RefreshCw className="w-4 h-4 mr-1" /> 
                  Fix Durations ({clips.filter(c => !c.duration_seconds || c.duration_seconds === 0).length})
                </Button>
              </div>
            </div>

            {/* Migration Warning */}
            {getGDriveClipsNeedingMigration().length > 0 && (
              <Card className="border-orange-500/50 bg-orange-500/5">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-orange-500">Migration Needed</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {getGDriveClipsNeedingMigration().length} clips use Google Drive links which may fail.
                      </p>
                      <Button
                        className="mt-3"
                        variant="outline"
                        size="sm"
                        onClick={handleMigrateClips}
                        disabled={isMigrating}
                      >
                        {isMigrating ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Migrating...</>
                        ) : (
                          <>Migrate All to R2</>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Batch Upload Form */}
            {showNewClip && (
              <div className="space-y-4">
                {/* File selector */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Upload Clips</span>
                      {pendingClips.length > 0 && (
                        <Badge variant="secondary">{pendingClips.length} clip{pendingClips.length > 1 ? "s" : ""} queued</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Add Video Files</Label>
                      <Input
                        ref={clipFileRef}
                        type="file"
                        accept="video/*,.mp4,.mov,.webm,.avi,.mkv"
                        multiple
                        onChange={(e) => handleFilesSelected(e.target.files)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Select one or multiple files. Duration is auto-detected.
                      </p>
                    </div>

                    {/* Upload progress */}
                    {isUploadingClip && (
                      <div className="space-y-2 p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">Uploading...</span>
                          <span>{uploadProgress.current} / {uploadProgress.total}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {pendingClips.length > 0 && (
                      <div className="flex gap-2 justify-end pt-2 border-t">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowNewClip(false);
                            setPendingClips([]);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          onClick={handleUploadAllClips}
                          disabled={isUploadingClip || pendingClips.filter(c => c.status === "pending" && c.duration !== null).length === 0}
                        >
                          {isUploadingClip ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
                          ) : (
                            <><Upload className="w-4 h-4 mr-2" /> Upload All ({pendingClips.filter(c => c.status === "pending").length})</>
                          )}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Individual clip forms */}
                {pendingClips.map((clip, index) => (
                  <Card 
                    key={index}
                    className={cn(
                      clip.status === "done" && "border-green-300 bg-green-50",
                      clip.status === "error" && "border-red-300 bg-red-50",
                      clip.status === "uploading" && "border-blue-300 bg-blue-50"
                    )}
                  >
                    <CardHeader className="py-3">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => toggleClipExpanded(index)}
                          className="flex items-center gap-2 text-left flex-1"
                        >
                          {clip.expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          <Film className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium truncate max-w-[250px]">{clip.file.name}</span>
                          {clip.duration !== null ? (
                            <Badge variant="outline" className="text-xs ml-2">{clip.duration}s</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs ml-2">
                              <Loader2 className="w-3 h-3 animate-spin mr-1" />
                              Detecting...
                            </Badge>
                          )}
                          {clip.status === "uploading" && <Badge className="bg-blue-500 text-xs ml-2">Uploading...</Badge>}
                          {clip.status === "done" && <Badge className="bg-green-500 text-xs ml-2">✓ Done</Badge>}
                          {clip.status === "error" && <Badge variant="destructive" className="text-xs ml-2">✗ {clip.error}</Badge>}
                        </button>
                        {clip.status === "pending" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => removePendingClip(index)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>

                    {clip.expanded && clip.status === "pending" && (
                      <CardContent className="pt-0 space-y-4">
                        {/* Resolution & Duration */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Resolution *</Label>
                            <Select
                              value={clip.source_resolution}
                              onValueChange={(v) => updatePendingClip(index, { source_resolution: v as "4k" | "1080p" | "720p" })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="4k">4K (2160p)</SelectItem>
                                <SelectItem value="1080p">1080p</SelectItem>
                                <SelectItem value="720p">720p</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Duration {clip.duration && <span className="text-xs text-green-600">(auto-detected)</span>}</Label>
                            <Input value={clip.duration ? `${clip.duration}s` : "Detecting..."} readOnly className="bg-muted" />
                          </div>
                        </div>

                        {/* Tags - Text input per category */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label>Tags (8-15 recommended, max 20)</Label>
                            <span className={cn(
                              "text-xs font-medium",
                              clip.selectedTagIds.length < 8 ? "text-amber-500" :
                              clip.selectedTagIds.length > 20 ? "text-destructive" : "text-green-500"
                            )}>
                              {clip.selectedTagIds.length}/20
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                            {clipTags.categories.map((category) => {
                              // Get tags for this category that are selected
                              const selectedInCategory = clip.selectedTagIds
                                .map(id => clipTags.tags.find(t => t.id === id))
                                .filter(t => t && t.category === category);
                              
                              return (
                                <div key={category} className="space-y-1">
                                  <Label className="text-xs capitalize text-muted-foreground">{category}</Label>
                                  <div className="flex gap-2">
                                    <Input
                                      className="h-8 text-xs flex-1"
                                      placeholder={`e.g., ${clipTags.grouped[category]?.slice(0, 2).map(t => t.name).join(", ") || "tag1, tag2"}`}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          const input = e.currentTarget;
                                          const value = input.value.trim();
                                          if (!value) return;
                                          
                                          const tagNames = value.split(",").map(t => t.trim().toLowerCase().replace(/ /g, "_")).filter(Boolean);
                                          const errors: string[] = [];
                                          const newTagIds: string[] = [];
                                          
                                          tagNames.forEach(name => {
                                            const tag = clipTags.grouped[category]?.find(t => t.name.toLowerCase() === name);
                                            if (tag) {
                                              if (!clip.selectedTagIds.includes(tag.id)) {
                                                newTagIds.push(tag.id);
                                              }
                                            } else {
                                              errors.push(name);
                                            }
                                          });
                                          
                                          if (errors.length > 0) {
                                            alert(`Invalid ${category} tags: ${errors.join(", ")}\n\nAvailable: ${clipTags.grouped[category]?.map(t => t.name).join(", ")}`);
                                          }
                                          
                                          if (newTagIds.length > 0) {
                                            const totalAfter = clip.selectedTagIds.length + newTagIds.length;
                                            if (totalAfter > 20) {
                                              alert(`Can only add ${20 - clip.selectedTagIds.length} more tags (max 20)`);
                                              return;
                                            }
                                            updatePendingClip(index, {
                                              selectedTagIds: [...clip.selectedTagIds, ...newTagIds],
                                            });
                                            input.value = "";
                                          }
                                        }
                                      }}
                                    />
                                    {/* Selected tags for this category */}
                                    <div className="flex flex-wrap gap-1 items-center min-w-[120px]">
                                      {selectedInCategory.length > 0 ? (
                                        selectedInCategory.map((tag) => tag && (
                                          <span
                                            key={tag.id}
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
                                            style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                                          >
                                            {tag.name.replace(/_/g, " ")}
                                            <button
                                              type="button"
                                              onClick={() => updatePendingClip(index, {
                                                selectedTagIds: clip.selectedTagIds.filter(t => t !== tag.id),
                                              })}
                                              className="hover:opacity-70"
                                            >
                                              <X className="w-2.5 h-2.5" />
                                            </button>
                                          </span>
                                        ))
                                      ) : (
                                        <span className="text-[10px] text-muted-foreground italic">none</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          
                          <p className="text-[10px] text-muted-foreground">
                            Type tag names and press Enter. Use underscores or spaces (e.g., "construction_site" or "construction site").
                          </p>
                        </div>

                        {/* Keywords */}
                        <div className="space-y-2">
                          <Label>Keywords (optional, comma-separated)</Label>
                          <Input
                            value={clip.keywords}
                            onChange={(e) => updatePendingClip(index, { keywords: e.target.value })}
                            placeholder="e.g., sunset beach, california coast, golden hour"
                          />
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Textarea
                            value={clip.description}
                            onChange={(e) => updatePendingClip(index, { description: e.target.value })}
                            placeholder="Describe the clip content..."
                            rows={2}
                          />
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {/* Clips Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clips.map((clip) => (
                <Card key={clip.id} className="overflow-hidden">
                  <div className="aspect-video bg-muted relative">
                    {clip.thumbnail_url ? (
                      <img src={clip.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Film className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Badge variant="outline" className="bg-background/80">
                        {clip.source_resolution || "1080p"}
                      </Badge>
                      <Badge 
                        variant={clip.linkType === "r2" ? "default" : clip.linkType === "gdrive" ? "destructive" : "secondary"}
                      >
                        {clip.linkType === "r2" ? "R2" : clip.linkType === "gdrive" ? "GDrive" : "Other"}
                      </Badge>
                    </div>
                    {/* Renditions indicator */}
                    <div className="absolute bottom-2 left-2 flex gap-1">
                      {clip.renditions?.map((r: any) => (
                        <Badge key={r.resolution} variant="secondary" className="text-[10px] px-1.5 py-0.5">
                          {r.resolution}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <CardContent className="p-3">
                    <p className="text-sm line-clamp-2 mb-1">{clip.description || "No description"}</p>
                    {/* Tags display */}
                    {clip.clipTags && clip.clipTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {clip.clipTags.slice(0, 5).map((tag: any) => (
                          <span
                            key={tag.id}
                            className="px-1.5 py-0.5 rounded text-[10px]"
                            style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                          >
                            {tag.name.replace(/_/g, " ")}
                          </span>
                        ))}
                        {clip.clipTags.length > 5 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted">
                            +{clip.clipTags.length - 5}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs text-muted-foreground">{clip.duration_seconds}s • {clip.clipTags?.length || 0} tags</span>
                      <div className="flex gap-1">
                        {!clip.hasAllRenditions && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-xs h-7"
                            disabled={isGeneratingRenditions === clip.id}
                            onClick={async () => {
                              setIsGeneratingRenditions(clip.id);
                              try {
                                const res = await fetch(`/api/admin/clips/${clip.id}/generate-renditions`, {
                                  method: "POST",
                                });
                                const data = await res.json();
                                if (res.ok) {
                                  alert(data.message);
                                  fetchClips();
                                } else {
                                  alert(data.error || "Failed to generate renditions");
                                }
                              } catch (err) {
                                alert("Failed to generate renditions");
                              } finally {
                                setIsGeneratingRenditions(null);
                              }
                            }}
                          >
                            {isGeneratingRenditions === clip.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              "Gen Renditions"
                            )}
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteClip(clip.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );

      case "music":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Music Tracks</h2>
                <p className="text-muted-foreground">Background music for video generation</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchMusic}>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Refresh
                </Button>
                <Button size="sm" onClick={() => {
                  if (showNewMusic) {
                    setMusicEntries([]);
                  } else {
                    setMusicEntries([{ id: crypto.randomUUID(), file: null, url: "", title: "", artist: "", duration: "", mood: "", tags: "", isUploading: false }]);
                  }
                  setShowNewMusic(!showNewMusic);
                }}>
                  {showNewMusic ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                  {showNewMusic ? "Cancel" : "Add Music"}
                </Button>
              </div>
            </div>

            {/* Upload Form */}
            {showNewMusic && (
              <Card>
                <CardHeader>
                  <CardTitle>Add Music Tracks</CardTitle>
                  <CardDescription>Upload audio files or provide URLs</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {musicEntries.map((entry, idx) => (
                    <div key={entry.id} className="p-4 border rounded-lg space-y-4 relative">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Track {idx + 1}</span>
                        {musicEntries.length > 1 && (
                          <Button variant="ghost" size="icon" onClick={() => setMusicEntries(musicEntries.filter(e => e.id !== entry.id))}>
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>File</Label>
                          <Input
                            type="file"
                            accept="audio/*"
                            onChange={(e) => setMusicEntries(musicEntries.map(m => m.id === entry.id ? { ...m, file: e.target.files?.[0] || null, url: "" } : m))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Or URL</Label>
                          <Input
                            value={entry.url || ""}
                            onChange={(e) => setMusicEntries(musicEntries.map(m => m.id === entry.id ? { ...m, url: e.target.value, file: null } : m))}
                            placeholder="https://..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Title *</Label>
                          <Input
                            value={entry.title || ""}
                            onChange={(e) => setMusicEntries(musicEntries.map(m => m.id === entry.id ? { ...m, title: e.target.value } : m))}
                            placeholder="Track title"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Duration (seconds) *</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={entry.duration || ""}
                            onChange={(e) => setMusicEntries(musicEntries.map(m => m.id === entry.id ? { ...m, duration: e.target.value } : m))}
                            placeholder="120"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Artist</Label>
                          <Input
                            value={entry.artist || ""}
                            onChange={(e) => setMusicEntries(musicEntries.map(m => m.id === entry.id ? { ...m, artist: e.target.value } : m))}
                            placeholder="Artist name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Tags (comma separated)</Label>
                          <Input
                            value={entry.tags || ""}
                            onChange={(e) => setMusicEntries(musicEntries.map(m => m.id === entry.id ? { ...m, tags: e.target.value } : m))}
                            placeholder="upbeat, cinematic, inspiring"
                          />
                        </div>
                      </div>
                      {entry.isUploading && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setMusicEntries([...musicEntries, { id: crypto.randomUUID(), file: null, url: "", title: "", artist: "", duration: "", mood: "", tags: "", isUploading: false }])}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add Another
                    </Button>
                    <Button
                      onClick={async () => {
                        // Validate entries
                        const validEntries = musicEntries.filter(e => {
                          const hasSource = e.file || e.url.trim();
                          const hasTitle = e.title.trim();
                          const hasDuration = e.duration.trim() && !isNaN(parseFloat(e.duration));
                          return hasSource && hasTitle && hasDuration;
                        });
                        
                        if (validEntries.length === 0) {
                          // More specific error message
                          const issues: string[] = [];
                          musicEntries.forEach((e, i) => {
                            const missing: string[] = [];
                            if (!e.file && !e.url.trim()) missing.push("file or URL");
                            if (!e.title.trim()) missing.push("title");
                            if (!e.duration.trim() || isNaN(parseFloat(e.duration))) missing.push("duration");
                            if (missing.length > 0) {
                              issues.push(`Track ${i + 1}: missing ${missing.join(", ")}`);
                            }
                          });
                          alert(`Please complete all required fields:\n${issues.join("\n")}`);
                          return;
                        }
                        
                        for (const entry of validEntries) {
                          setMusicEntries(prev => prev.map(e => e.id === entry.id ? { ...e, isUploading: true } : e));
                          
                          try {
                            let audioUrl = "";
                            
                            if (entry.file) {
                              console.log(`Uploading file: ${entry.file.name}`);
                              const urlRes = await fetch("/api/admin/upload-media", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ filename: entry.file.name, contentType: entry.file.type, type: "music" }),
                              });
                              const uploadData = await urlRes.json();
                              console.log("Upload response:", uploadData);
                              
                              if (!uploadData.uploadUrl || !uploadData.publicUrl) {
                                throw new Error(uploadData.error || "Failed to get upload URL from R2");
                              }
                              
                              const putRes = await fetch(uploadData.uploadUrl, { 
                                method: "PUT", 
                                body: entry.file, 
                                headers: { "Content-Type": entry.file.type } 
                              });
                              
                              if (!putRes.ok) {
                                throw new Error(`Failed to upload file to R2: ${putRes.status}`);
                              }
                              
                              audioUrl = uploadData.publicUrl;
                              console.log(`File uploaded successfully: ${audioUrl}`);
                            } else if (entry.url.trim()) {
                              console.log(`Fetching from URL: ${entry.url}`);
                              const urlRes = await fetch("/api/admin/upload-media", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ fetchUrl: entry.url.trim(), type: "music" }),
                              });
                              const data = await urlRes.json();
                              console.log("URL fetch response:", data);
                              
                              if (!data.publicUrl) {
                                throw new Error(data.error || "Failed to upload from URL");
                              }
                              audioUrl = data.publicUrl;
                            }
                            
                            if (!audioUrl) {
                              throw new Error("No audio URL generated");
                            }
                            
                            console.log(`Creating music record: ${entry.title}, URL: ${audioUrl}`);
                            const musicRes = await fetch("/api/admin/music", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                title: entry.title.trim(),
                                artist: entry.artist.trim() || null,
                                audio_url: audioUrl,
                                duration_seconds: parseFloat(entry.duration),
                                mood: entry.mood.split(",").map(m => m.trim()).filter(Boolean),
                                tags: entry.tags.split(",").map(t => t.trim()).filter(Boolean),
                              }),
                            });
                            
                            if (!musicRes.ok) {
                              const errorData = await musicRes.json();
                              throw new Error(errorData.error || "Failed to create music record in database");
                            }
                            
                            console.log(`Music track created: ${entry.title}`);
                            setMusicEntries(prev => prev.filter(e => e.id !== entry.id));
                          } catch (err) {
                            console.error("Upload error:", err);
                            alert(`Failed to upload "${entry.title}": ${err instanceof Error ? err.message : "Unknown error"}`);
                            setMusicEntries(prev => prev.map(e => e.id === entry.id ? { ...e, isUploading: false } : e));
                          }
                        }
                        
                        fetchMusic();
                        if (musicEntries.length === validEntries.length) {
                          setShowNewMusic(false);
                          setMusicEntries([]);
                        }
                      }}
                      disabled={musicEntries.some(e => e.isUploading)}
                    >
                      {musicEntries.some(e => e.isUploading) ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
                      ) : (
                        <><Upload className="w-4 h-4 mr-2" /> Upload All</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Music List */}
            <div className="space-y-2">
              {musicTracks.map((track) => (
                <Card key={track.id}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded bg-purple-500/20 flex items-center justify-center shrink-0">
                      <Music className="w-6 h-6 text-purple-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{track.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {track.artist || "Unknown"} • {track.duration_seconds}s {track.genre && `• ${track.genre}`}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteMusic(track.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {musicTracks.length === 0 && (
                <Card className="text-center py-12">
                  <Music className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-medium">No music tracks</h3>
                  <p className="text-sm text-muted-foreground">Add your first background music</p>
                </Card>
              )}
            </div>
          </div>
        );

      case "sfx":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Sound Effects</h2>
                <p className="text-muted-foreground">Sound effects for video enhancement</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchSoundEffects}>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Refresh
                </Button>
                <Button size="sm" onClick={() => {
                  if (showNewSfx) {
                    setSfxEntries([]);
                  } else {
                    setSfxEntries([{ id: crypto.randomUUID(), file: null, url: "", title: "", description: "", duration: "", tags: "", isUploading: false }]);
                  }
                  setShowNewSfx(!showNewSfx);
                }}>
                  {showNewSfx ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                  {showNewSfx ? "Cancel" : "Add SFX"}
                </Button>
              </div>
            </div>

            {/* Upload Form */}
            {showNewSfx && (
              <Card>
                <CardHeader>
                  <CardTitle>Add Sound Effects</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {sfxEntries.map((entry, idx) => (
                    <div key={entry.id} className="p-4 border rounded-lg space-y-4 relative">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Effect {idx + 1}</span>
                        {sfxEntries.length > 1 && (
                          <Button variant="ghost" size="icon" onClick={() => setSfxEntries(sfxEntries.filter(e => e.id !== entry.id))}>
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>File</Label>
                          <Input
                            type="file"
                            accept="audio/*"
                            onChange={(e) => setSfxEntries(sfxEntries.map(s => s.id === entry.id ? { ...s, file: e.target.files?.[0] || null, url: "" } : s))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Or URL</Label>
                          <Input
                            value={entry.url || ""}
                            onChange={(e) => setSfxEntries(sfxEntries.map(s => s.id === entry.id ? { ...s, url: e.target.value, file: null } : s))}
                            placeholder="https://..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Title *</Label>
                          <Input
                            value={entry.title || ""}
                            onChange={(e) => setSfxEntries(sfxEntries.map(s => s.id === entry.id ? { ...s, title: e.target.value } : s))}
                            placeholder="Effect name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Duration (seconds) *</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={entry.duration || ""}
                            onChange={(e) => setSfxEntries(sfxEntries.map(s => s.id === entry.id ? { ...s, duration: e.target.value } : s))}
                            placeholder="2.5"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Input
                            value={entry.description || ""}
                            onChange={(e) => setSfxEntries(sfxEntries.map(s => s.id === entry.id ? { ...s, description: e.target.value } : s))}
                            placeholder="Short whoosh sound for transitions"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Tags (comma separated)</Label>
                          <Input
                            value={entry.tags || ""}
                            onChange={(e) => setSfxEntries(sfxEntries.map(s => s.id === entry.id ? { ...s, tags: e.target.value } : s))}
                            placeholder="whoosh, transition, quick"
                          />
                        </div>
                      </div>
                      {entry.isUploading && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setSfxEntries([...sfxEntries, { id: crypto.randomUUID(), file: null, url: "", title: "", category: "", duration: "", tags: "", isUploading: false }])}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add Another
                    </Button>
                    <Button
                      onClick={async () => {
                        // Validate entries
                        const validEntries = sfxEntries.filter(e => {
                          const hasSource = e.file || e.url.trim();
                          const hasTitle = e.title.trim();
                          const hasDuration = e.duration.trim() && !isNaN(parseFloat(e.duration));
                          return hasSource && hasTitle && hasDuration;
                        });
                        
                        if (validEntries.length === 0) {
                          const issues: string[] = [];
                          sfxEntries.forEach((e, i) => {
                            const missing: string[] = [];
                            if (!e.file && !e.url.trim()) missing.push("file or URL");
                            if (!e.title.trim()) missing.push("title");
                            if (!e.duration.trim() || isNaN(parseFloat(e.duration))) missing.push("duration");
                            if (missing.length > 0) {
                              issues.push(`Effect ${i + 1}: missing ${missing.join(", ")}`);
                            }
                          });
                          alert(`Please complete all required fields:\n${issues.join("\n")}`);
                          return;
                        }
                        
                        for (const entry of validEntries) {
                          setSfxEntries(prev => prev.map(e => e.id === entry.id ? { ...e, isUploading: true } : e));
                          
                          try {
                            let audioUrl = "";
                            
                            if (entry.file) {
                              console.log(`Uploading SFX file: ${entry.file.name}`);
                              const urlRes = await fetch("/api/admin/upload-media", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ filename: entry.file.name, contentType: entry.file.type, type: "sfx" }),
                              });
                              const uploadData = await urlRes.json();
                              
                              if (!uploadData.uploadUrl || !uploadData.publicUrl) {
                                throw new Error(uploadData.error || "Failed to get upload URL from R2");
                              }
                              
                              const putRes = await fetch(uploadData.uploadUrl, { 
                                method: "PUT", 
                                body: entry.file, 
                                headers: { "Content-Type": entry.file.type } 
                              });
                              
                              if (!putRes.ok) {
                                throw new Error(`Failed to upload file to R2: ${putRes.status}`);
                              }
                              
                              audioUrl = uploadData.publicUrl;
                            } else if (entry.url.trim()) {
                              console.log(`Fetching SFX from URL: ${entry.url}`);
                              const urlRes = await fetch("/api/admin/upload-media", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ fetchUrl: entry.url.trim(), type: "sfx" }),
                              });
                              const data = await urlRes.json();
                              
                              if (!data.publicUrl) {
                                throw new Error(data.error || "Failed to upload from URL");
                              }
                              audioUrl = data.publicUrl;
                            }
                            
                            if (!audioUrl) {
                              throw new Error("No audio URL generated");
                            }
                            
                            const sfxRes = await fetch("/api/admin/sound-effects", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                title: entry.title.trim(),
                                description: entry.description.trim() || null,
                                audio_url: audioUrl,
                                duration_seconds: parseFloat(entry.duration),
                                tags: entry.tags.split(",").map(t => t.trim()).filter(Boolean),
                              }),
                            });
                            
                            if (!sfxRes.ok) {
                              const errorData = await sfxRes.json();
                              throw new Error(errorData.error || "Failed to create sound effect record");
                            }
                            
                            setSfxEntries(prev => prev.filter(e => e.id !== entry.id));
                          } catch (err) {
                            console.error("Upload error:", err);
                            alert(`Failed to upload "${entry.title}": ${err instanceof Error ? err.message : "Unknown error"}`);
                            setSfxEntries(prev => prev.map(e => e.id === entry.id ? { ...e, isUploading: false } : e));
                          }
                        }
                        
                        fetchSoundEffects();
                        if (sfxEntries.length === validEntries.length) {
                          setShowNewSfx(false);
                          setSfxEntries([]);
                        }
                      }}
                      disabled={sfxEntries.some(e => e.isUploading)}
                    >
                      {sfxEntries.some(e => e.isUploading) ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
                      ) : (
                        <><Upload className="w-4 h-4 mr-2" /> Upload All</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* SFX List */}
            <div className="space-y-2">
              {soundEffects.map((sfx) => (
                <Card key={sfx.id}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded bg-green-500/20 flex items-center justify-center shrink-0">
                      <Volume2 className="w-6 h-6 text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{sfx.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {sfx.duration_seconds}s {sfx.category && `• ${sfx.category}`}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteSfx(sfx.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {soundEffects.length === 0 && (
                <Card className="text-center py-12">
                  <Volume2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-medium">No sound effects</h3>
                  <p className="text-sm text-muted-foreground">Add your first sound effect</p>
                </Card>
              )}
            </div>
          </div>
        );

      case "overlays":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Overlays & Graphics</h2>
                <p className="text-muted-foreground">PNG/GIF overlays for video enhancement</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchOverlays}>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Refresh
                </Button>
                <Button size="sm" onClick={() => {
                  if (showNewOverlay) {
                    setOverlayEntries([]);
                  } else {
                    setOverlayEntries([{ id: crypto.randomUUID(), file: null, url: "", title: "", description: "", width: "", height: "", tags: "", isUploading: false }]);
                  }
                  setShowNewOverlay(!showNewOverlay);
                }}>
                  {showNewOverlay ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                  {showNewOverlay ? "Cancel" : "Add Overlay"}
                </Button>
              </div>
            </div>

            {/* Upload Form */}
            {showNewOverlay && (
              <Card>
                <CardHeader>
                  <CardTitle>Add Overlays</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {overlayEntries.map((entry, idx) => (
                    <div key={entry.id} className="p-4 border rounded-lg space-y-4 relative">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Overlay {idx + 1}</span>
                        {overlayEntries.length > 1 && (
                          <Button variant="ghost" size="icon" onClick={() => setOverlayEntries(overlayEntries.filter(e => e.id !== entry.id))}>
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>File</Label>
                          <Input
                            type="file"
                            accept="image/png,image/gif,image/webp"
                            onChange={(e) => setOverlayEntries(overlayEntries.map(o => o.id === entry.id ? { ...o, file: e.target.files?.[0] || null, url: "" } : o))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Or URL</Label>
                          <Input
                            value={entry.url || ""}
                            onChange={(e) => setOverlayEntries(overlayEntries.map(o => o.id === entry.id ? { ...o, url: e.target.value, file: null } : o))}
                            placeholder="https://..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Title *</Label>
                          <Input
                            value={entry.title || ""}
                            onChange={(e) => setOverlayEntries(overlayEntries.map(o => o.id === entry.id ? { ...o, title: e.target.value } : o))}
                            placeholder="Overlay name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Input
                            value={entry.description || ""}
                            onChange={(e) => setOverlayEntries(overlayEntries.map(o => o.id === entry.id ? { ...o, description: e.target.value } : o))}
                            placeholder="Animated subscribe button with bell"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Tags (comma separated)</Label>
                          <Input
                            value={entry.tags || ""}
                            onChange={(e) => setOverlayEntries(overlayEntries.map(o => o.id === entry.id ? { ...o, tags: e.target.value } : o))}
                            placeholder="subscribe, notification, animated"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Width (px)</Label>
                          <Input
                            type="number"
                            value={entry.width || ""}
                            onChange={(e) => setOverlayEntries(overlayEntries.map(o => o.id === entry.id ? { ...o, width: e.target.value } : o))}
                            placeholder="300"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Height (px)</Label>
                          <Input
                            type="number"
                            value={entry.height || ""}
                            onChange={(e) => setOverlayEntries(overlayEntries.map(o => o.id === entry.id ? { ...o, height: e.target.value } : o))}
                            placeholder="200"
                          />
                        </div>
                      </div>
                      {entry.isUploading && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setOverlayEntries([...overlayEntries, { id: crypto.randomUUID(), file: null, url: "", title: "", description: "", width: "", height: "", tags: "", isUploading: false }])}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add Another
                    </Button>
                    <Button
                      onClick={async () => {
                        // Validate entries - overlays only need title and file/URL
                        const validEntries = overlayEntries.filter(e => {
                          const hasSource = e.file || e.url.trim();
                          const hasTitle = e.title.trim();
                          return hasSource && hasTitle;
                        });
                        
                        if (validEntries.length === 0) {
                          const issues: string[] = [];
                          overlayEntries.forEach((e, i) => {
                            const missing: string[] = [];
                            if (!e.file && !e.url.trim()) missing.push("file or URL");
                            if (!e.title.trim()) missing.push("title");
                            if (missing.length > 0) {
                              issues.push(`Overlay ${i + 1}: missing ${missing.join(", ")}`);
                            }
                          });
                          alert(`Please complete all required fields:\n${issues.join("\n")}`);
                          return;
                        }
                        
                        for (const entry of validEntries) {
                          setOverlayEntries(prev => prev.map(e => e.id === entry.id ? { ...e, isUploading: true } : e));
                          
                          try {
                            let imageUrl = "";
                            
                            if (entry.file) {
                              console.log(`Uploading overlay file: ${entry.file.name}`);
                              const urlRes = await fetch("/api/admin/upload-media", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ filename: entry.file.name, contentType: entry.file.type, type: "overlay" }),
                              });
                              const uploadData = await urlRes.json();
                              
                              if (!uploadData.uploadUrl || !uploadData.publicUrl) {
                                throw new Error(uploadData.error || "Failed to get upload URL from R2");
                              }
                              
                              const putRes = await fetch(uploadData.uploadUrl, { 
                                method: "PUT", 
                                body: entry.file, 
                                headers: { "Content-Type": entry.file.type } 
                              });
                              
                              if (!putRes.ok) {
                                throw new Error(`Failed to upload file to R2: ${putRes.status}`);
                              }
                              
                              imageUrl = uploadData.publicUrl;
                            } else if (entry.url.trim()) {
                              console.log(`Fetching overlay from URL: ${entry.url}`);
                              const urlRes = await fetch("/api/admin/upload-media", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ fetchUrl: entry.url.trim(), type: "overlay" }),
                              });
                              const data = await urlRes.json();
                              
                              if (!data.publicUrl) {
                                throw new Error(data.error || "Failed to upload from URL");
                              }
                              imageUrl = data.publicUrl;
                            }
                            
                            if (!imageUrl) {
                              throw new Error("No image URL generated");
                            }
                            
                            const overlayRes = await fetch("/api/admin/overlays", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                title: entry.title.trim(),
                                description: entry.description.trim() || null,
                                image_url: imageUrl,
                                width: entry.width ? parseInt(entry.width) : null,
                                height: entry.height ? parseInt(entry.height) : null,
                                tags: entry.tags.split(",").map(t => t.trim()).filter(Boolean),
                              }),
                            });
                            
                            if (!overlayRes.ok) {
                              const errorData = await overlayRes.json();
                              throw new Error(errorData.error || "Failed to create overlay record");
                            }
                            
                            setOverlayEntries(prev => prev.filter(e => e.id !== entry.id));
                          } catch (err) {
                            console.error("Upload error:", err);
                            alert(`Failed to upload "${entry.title}": ${err instanceof Error ? err.message : "Unknown error"}`);
                            setOverlayEntries(prev => prev.map(e => e.id === entry.id ? { ...e, isUploading: false } : e));
                          }
                        }
                        
                        fetchOverlays();
                        if (overlayEntries.length === validEntries.length) {
                          setShowNewOverlay(false);
                          setOverlayEntries([]);
                        }
                      }}
                      disabled={overlayEntries.some(e => e.isUploading)}
                    >
                      {overlayEntries.some(e => e.isUploading) ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
                      ) : (
                        <><Upload className="w-4 h-4 mr-2" /> Upload All</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Overlays Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {overlays.map((overlay) => (
                <Card key={overlay.id} className="overflow-hidden">
                  <div className="aspect-square bg-[url('/checkered.png')] bg-repeat bg-[length:20px_20px] relative">
                    {overlay.image_url && (
                      <img src={overlay.image_url} alt="" className="w-full h-full object-contain" />
                    )}
                  </div>
                  <CardContent className="p-3">
                    <p className="font-medium truncate text-sm">{overlay.title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">
                        {overlay.width && overlay.height ? `${overlay.width}×${overlay.height}` : "No size"}
                      </span>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteOverlay(overlay.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {overlays.length === 0 && (
                <Card className="col-span-full text-center py-12">
                  <ImageIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-medium">No overlays</h3>
                  <p className="text-sm text-muted-foreground">Add your first overlay graphic</p>
                </Card>
              )}
            </div>
          </div>
        );

      case "voices":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Voices</h2>
                <p className="text-muted-foreground">ElevenLabs voice configurations</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchVoices}>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Refresh
                </Button>
                <Button size="sm" onClick={() => setShowNewVoice(!showNewVoice)}>
                  {showNewVoice ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                  {showNewVoice ? "Cancel" : "Add Voice"}
                </Button>
              </div>
            </div>

            {/* Add Voice Form */}
            {showNewVoice && (
              <Card>
                <CardHeader>
                  <CardTitle>Add New Voice</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateVoice} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Name *</Label>
                        <Input
                          value={newVoice.name}
                          onChange={(e) => setNewVoice({ ...newVoice, name: e.target.value })}
                          placeholder="Voice name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>ElevenLabs ID *</Label>
                        <Input
                          value={newVoice.eleven_labs_id}
                          onChange={(e) => setNewVoice({ ...newVoice, eleven_labs_id: e.target.value })}
                          placeholder="voice_id_from_elevenlabs"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Profile Image</Label>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setNewVoice({ ...newVoice, profile_image: e.target.files?.[0] || null })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Preview Audio File</Label>
                        <Input
                          type="file"
                          accept="audio/*"
                          onChange={(e) => setNewVoice({ ...newVoice, preview_audio: e.target.files?.[0] || null, preview_url: "" })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Or Preview Audio URL</Label>
                        <Input
                          value={newVoice.preview_url}
                          onChange={(e) => setNewVoice({ ...newVoice, preview_url: e.target.value, preview_audio: null })}
                          placeholder="https://..."
                          disabled={!!newVoice.preview_audio}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={newVoice.description}
                        onChange={(e) => setNewVoice({ ...newVoice, description: e.target.value })}
                        placeholder="Describe the voice..."
                        rows={2}
                      />
                    </div>
                    <Button type="submit" disabled={isCreating}>
                      {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                      Create Voice
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Voices List */}
            <div className="space-y-2">
              {voices.map((voice) => (
                <Card key={voice.id}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <Avatar className="w-12 h-12">
                      {voice.profile_image_url ? (
                        <AvatarImage src={voice.profile_image_url} />
                      ) : (
                        <AvatarFallback><Mic className="w-5 h-5" /></AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{voice.name}</p>
                        {voice.is_default && <Badge variant="secondary">Default</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{voice.description || "No description"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleDefault(voice.id, voice.is_default)}
                        title={voice.is_default ? "Remove default" : "Set as default"}
                      >
                        {voice.is_default ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteVoice(voice.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {voices.length === 0 && (
                <Card className="text-center py-12">
                  <Mic className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-medium">No voices configured</h3>
                  <p className="text-sm text-muted-foreground">Add your first ElevenLabs voice</p>
                </Card>
              )}
            </div>
          </div>
        );

      case "promo":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Promo Codes</h2>
                <p className="text-muted-foreground">Manage discount and credit codes</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchPromoCodes}>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Refresh
                </Button>
                <Button size="sm" onClick={() => setShowNewCode(!showNewCode)}>
                  {showNewCode ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                  {showNewCode ? "Cancel" : "Add Code"}
                </Button>
              </div>
            </div>

            {/* Add Code Form */}
            {showNewCode && (
              <Card>
                <CardHeader>
                  <CardTitle>Create Promo Code</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateCode} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Code *</Label>
                        <Input
                          value={newCode.code}
                          onChange={(e) => setNewCode({ ...newCode, code: e.target.value.toUpperCase() })}
                          placeholder="SUMMER2024"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Credits *</Label>
                        <Input
                          type="number"
                          value={newCode.credits}
                          onChange={(e) => setNewCode({ ...newCode, credits: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Uses (empty = unlimited)</Label>
                        <Input
                          type="number"
                          value={newCode.max_uses}
                          onChange={(e) => setNewCode({ ...newCode, max_uses: e.target.value })}
                          placeholder="100"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Expires At</Label>
                        <Input
                          type="date"
                          value={newCode.expires_at}
                          onChange={(e) => setNewCode({ ...newCode, expires_at: e.target.value })}
                        />
                      </div>
                    </div>
                    <Button type="submit" disabled={isCreatingCode}>
                      {isCreatingCode ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                      Create Code
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Codes List */}
            <div className="space-y-2">
              {promoCodes.map((code) => (
                <Card key={code.id}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded bg-yellow-500/20 flex items-center justify-center shrink-0">
                      <Gift className="w-6 h-6 text-yellow-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-mono font-bold">{code.code}</p>
                        <Badge variant={code.is_active ? "default" : "secondary"}>
                          {code.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {code.credits} credits • {code.current_uses}/{code.max_uses || "∞"} uses
                        {code.expires_at && ` • Expires ${new Date(code.expires_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleCodeActive(code.id, code.is_active)}
                      >
                        {code.is_active ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteCode(code.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {promoCodes.length === 0 && (
                <Card className="text-center py-12">
                  <Gift className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-medium">No promo codes</h3>
                  <p className="text-sm text-muted-foreground">Create your first promo code</p>
                </Card>
              )}
            </div>
          </div>
        );

      case "tags":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Clip Tags</h2>
                <p className="text-muted-foreground">
                  Manage tags for organizing clips. Tags help the AI understand which clips to use.
                </p>
              </div>
              <Button onClick={() => setShowNewTag(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Tag
              </Button>
            </div>

            {/* New Tag Form */}
            {showNewTag && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Add New Tag</CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!newTag.name || !newTag.description) {
                        alert("Name and description are required");
                        return;
                      }
                      setIsAddingTag(true);
                      try {
                        const res = await fetch("/api/tags", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(newTag),
                        });
                        if (res.ok) {
                          fetchClipTags();
                          setShowNewTag(false);
                          setNewTag({ name: "", category: "setting", description: "", color: "#3B82F6" });
                        } else {
                          const data = await res.json();
                          alert(data.error || "Failed to create tag");
                        }
                      } catch (error) {
                        console.error("Failed to create tag:", error);
                      } finally {
                        setIsAddingTag(false);
                      }
                    }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tag Name *</Label>
                        <Input
                          value={newTag.name}
                          onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                          placeholder="e.g., corporate, minimalist"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Category *</Label>
                        <Select
                          value={newTag.category}
                          onValueChange={(v) => setNewTag({ ...newTag, category: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="subject">Subject - What the clip is about</SelectItem>
                            <SelectItem value="setting">Setting - Where it takes place</SelectItem>
                            <SelectItem value="industry">Industry - Business vertical/niche</SelectItem>
                            <SelectItem value="action">Action - What's happening</SelectItem>
                            <SelectItem value="mood">Mood - Emotional tone</SelectItem>
                            <SelectItem value="camera">Camera - Filming style/movement</SelectItem>
                            <SelectItem value="style">Style - Visual aesthetic</SelectItem>
                            <SelectItem value="objects">Objects - Notable items in frame</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Description (for AI) *</Label>
                      <Textarea
                        value={newTag.description}
                        onChange={(e) => setNewTag({ ...newTag, description: e.target.value })}
                        placeholder="Describe what this tag means so AI knows when to use clips with this tag..."
                        rows={2}
                      />
                      <p className="text-xs text-muted-foreground">
                        This description helps the AI understand when to use clips with this tag.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Color (optional)</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={newTag.color}
                          onChange={(e) => setNewTag({ ...newTag, color: e.target.value })}
                          className="w-16 h-10 p-1"
                        />
                        <Input
                          value={newTag.color}
                          onChange={(e) => setNewTag({ ...newTag, color: e.target.value })}
                          placeholder="#3B82F6"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={isAddingTag}>
                        {isAddingTag ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                        Add Tag
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setShowNewTag(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Tags by Category */}
            <div className="space-y-6">
              {clipTags.categories.map((category) => (
                <Card key={category}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg capitalize flex items-center gap-2">
                      {category}
                      <Badge variant="secondary">{clipTags.grouped[category]?.length || 0}</Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {typeof clipTags.categoryDescriptions?.[category] === 'object'
                        ? (clipTags.categoryDescriptions[category] as { description: string }).description
                        : clipTags.categoryDescriptions?.[category] || ""}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {clipTags.grouped[category]?.map((tag) => (
                        <div
                          key={tag.id}
                          className="group flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
                          style={{ backgroundColor: `${tag.color}20`, borderColor: tag.color, borderWidth: 1 }}
                          title={tag.description}
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span>{tag.name}</span>
                          <button
                            onClick={async () => {
                              if (!confirm(`Delete tag "${tag.name}"?`)) return;
                              await fetch(`/api/tags?id=${tag.id}`, { method: "DELETE" });
                              fetchClipTags();
                            }}
                            className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {(!clipTags.grouped[category] || clipTags.grouped[category].length === 0) && (
                        <p className="text-sm text-muted-foreground">No tags in this category</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Tag Guidelines */}
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="text-lg">Tag Guidelines</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm dark:prose-invert">
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li><strong>2-5 tags per clip</strong> - Don't over-tag. Choose the most relevant tags.</li>
                  <li><strong>Be specific</strong> - "corporate_office" is better than just "office".</li>
                  <li><strong>Write good descriptions</strong> - The AI uses descriptions to understand context.</li>
                  <li><strong>Use industry tags</strong> - Help AI find clips for specific business types.</li>
                  <li><strong>Avoid redundancy</strong> - Don't create tags that mean the same thing.</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  // =============== MAIN LAYOUT ===============
  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col shrink-0">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold">Admin Panel</h1>
        </div>
        
        <ScrollArea className="flex-1">
          <nav className="p-2 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveSection(item.key)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                  activeSection === item.key
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.count !== undefined && (
                  <Badge variant={activeSection === item.key ? "secondary" : "outline"} className="ml-auto">
                    {item.count}
                  </Badge>
                )}
              </button>
            ))}
          </nav>
        </ScrollArea>

        <div className="p-4 border-t">
          <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-6 max-w-6xl">
            {renderContent()}
          </div>
        </ScrollArea>
      </main>

      {/* Duration Fix Modal */}
      {showDurationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col">
            <CardHeader>
              <CardTitle>Fix Missing Durations</CardTitle>
              <p className="text-sm text-muted-foreground">
                Enter duration in seconds for each clip. Play the video to check duration.
              </p>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {clips
                    .filter(c => !c.duration_seconds || c.duration_seconds === 0)
                    .map((clip) => (
                      <div key={clip.id} className="flex items-start gap-4 p-3 border rounded-lg">
                        <div className="w-32 h-20 bg-muted rounded overflow-hidden shrink-0">
                          {clip.thumbnail_url ? (
                            <img src={clip.thumbnail_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <video 
                              src={clip.clip_link} 
                              className="w-full h-full object-cover"
                              muted
                              playsInline
                              onLoadedMetadata={(e) => {
                                const video = e.target as HTMLVideoElement;
                                if (video.duration && !durationInputs[clip.id]) {
                                  setDurationInputs(prev => ({
                                    ...prev,
                                    [clip.id]: String(Math.floor(video.duration * 10) / 10)
                                  }));
                                }
                              }}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                          <p className="text-sm truncate font-medium">
                            {clip.description || clip.clip_link.split("/").pop()}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {clip.source_resolution || "Unknown"} resolution
                          </p>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              placeholder="Duration (seconds)"
                              value={durationInputs[clip.id] || ""}
                              onChange={(e) => setDurationInputs(prev => ({
                                ...prev,
                                [clip.id]: e.target.value
                              }))}
                              className="w-32 h-8"
                            />
                            <span className="text-sm text-muted-foreground">seconds</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(clip.clip_link, "_blank")}
                            >
                              <Play className="w-3 h-3 mr-1" />
                              Play
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </CardContent>
            <div className="p-4 border-t flex justify-between">
              <p className="text-sm text-muted-foreground">
                {Object.values(durationInputs).filter(v => v && parseFloat(v) > 0).length} of{" "}
                {clips.filter(c => !c.duration_seconds || c.duration_seconds === 0).length} durations entered
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowDurationModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveDurations} disabled={savingDurations}>
                  {savingDurations ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Save Durations
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
