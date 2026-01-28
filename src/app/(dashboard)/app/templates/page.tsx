"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Film, Sparkles, Play, Clock, Users, ChevronRight, Loader2, Eye, X, Upload, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TemplateVariable {
  key: string;
  type: "text" | "image" | "color";
  label: string;
  default?: string;
  placeholder?: string;
}

interface Template {
  id: string;
  title: string;
  description: string | null;
  category: string;
  thumbnail_url: string | null;
  preview_url: string | null;
  variables: TemplateVariable[];
  duration_sec: number | null;
  is_featured: boolean;
  use_count: number;
}

const CATEGORIES = [
  { value: "all", label: "All Templates" },
  { value: "intro", label: "Intros" },
  { value: "outro", label: "Outros" },
  { value: "promo", label: "Promotional" },
  { value: "educational", label: "Educational" },
  { value: "social", label: "Social Media" },
];

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  
  // Use template modal
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [isCreating, setIsCreating] = useState(false);
  
  // Preview functionality
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // Image upload state
  const [uploadingImage, setUploadingImage] = useState<string | null>(null); // key being uploaded
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchTemplates();
  }, [selectedCategory]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== "all") {
        params.set("category", selectedCategory);
      }
      
      const res = await fetch(`/api/templates?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    // Initialize variable values with defaults
    const defaults: Record<string, string> = {};
    template.variables.forEach((v) => {
      defaults[v.key] = v.default || "";
    });
    setVariableValues(defaults);
  };

  const handleUseTemplate = async () => {
    if (!selectedTemplate) return;
    
    setIsCreating(true);
    try {
      const res = await fetch(`/api/templates/${selectedTemplate.id}/use`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variables: variableValues,
          title: variableValues.title || selectedTemplate.title,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create from template");
      }

      const data = await res.json();
      toast.success("Project created from template!");
      router.push(`/app/projects/${data.projectId}/edit`);
    } catch (error) {
      console.error("Template use error:", error);
      toast.error("Failed to create project from template");
    } finally {
      setIsCreating(false);
    }
  };

  const handlePreviewTemplate = async () => {
    if (!selectedTemplate) return;
    
    setIsRendering(true);
    setRenderProgress(0);
    setPreviewUrl(null);
    setShowPreview(true);
    
    try {
      // Simulate progress while waiting for render
      const progressInterval = setInterval(() => {
        setRenderProgress(prev => Math.min(prev + 5, 90));
      }, 500);
      
      const res = await fetch(`/api/templates/${selectedTemplate.id}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variables: variableValues,
        }),
      });

      clearInterval(progressInterval);

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to render preview");
      }

      const data = await res.json();
      setRenderProgress(100);
      setPreviewUrl(data.previewUrl);
      toast.success("Preview ready!");
    } catch (error) {
      console.error("Preview render error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to render preview");
      setShowPreview(false);
    } finally {
      setIsRendering(false);
    }
  };

  const closePreview = () => {
    setShowPreview(false);
    setPreviewUrl(null);
    setRenderProgress(0);
  };
  
  // Handle image upload for template variables
  const handleImageUpload = async (key: string, file: File) => {
    setUploadingImage(key);
    
    try {
      // Get upload URL
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          folder: "template-assets",
        }),
      });
      
      if (!uploadRes.ok) throw new Error("Failed to get upload URL");
      
      const { uploadUrl, publicUrl } = await uploadRes.json();
      
      // Upload file
      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      
      // Update variable value
      setVariableValues(prev => ({
        ...prev,
        [key]: publicUrl,
      }));
      
      // Store preview
      setImagePreviews(prev => ({
        ...prev,
        [key]: URL.createObjectURL(file),
      }));
      
      toast.success("Image uploaded!");
    } catch (error) {
      console.error("Image upload error:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(null);
    }
  };

  const filteredTemplates = templates;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Header */}
      <div className="shrink-0 border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Template Store</h1>
              <p className="text-muted-foreground mt-1">
                Pre-made video templates to get you started quickly
              </p>
            </div>
            <Button onClick={() => router.push("/app/new")}>
              <Sparkles className="w-4 h-4 mr-2" />
              Create from Scratch
            </Button>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="shrink-0 border-b bg-card/50">
        <div className="max-w-6xl mx-auto px-6 py-3">
          <div className="flex gap-2 overflow-x-auto">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                  selectedCategory === cat.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-20">
              <Film className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No templates available</h3>
              <p className="text-muted-foreground mb-6">
                Templates are coming soon! In the meantime, create a video from scratch.
              </p>
              <Button onClick={() => router.push("/app/new")}>
                <Sparkles className="w-4 h-4 mr-2" />
                Create Video
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map((template) => (
                <Card 
                  key={template.id} 
                  className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                  onClick={() => handleSelectTemplate(template)}
                >
                  {/* Thumbnail */}
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    {template.thumbnail_url ? (
                      <img
                        src={template.thumbnail_url}
                        alt={template.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}
                    {template.is_featured && (
                      <Badge className="absolute top-2 left-2 bg-amber-500">
                        Featured
                      </Badge>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Use Template
                      </Button>
                    </div>
                  </div>
                  
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold line-clamp-1">{template.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {template.description || "No description"}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 shrink-0 text-muted-foreground" />
                    </div>
                    
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {template.duration_sec ? `${template.duration_sec}s` : "Varies"}
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {template.use_count} uses
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {template.category}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Use Template Modal */}
      <Dialog open={!!selectedTemplate} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.title}</DialogTitle>
            <DialogDescription>
              {selectedTemplate?.description || "Customize this template for your video"}
            </DialogDescription>
          </DialogHeader>

          {selectedTemplate && selectedTemplate.variables.length > 0 && (
            <div className="space-y-4 py-4">
              {selectedTemplate.variables.map((variable) => (
                <div key={variable.key} className="space-y-2">
                  <Label>{variable.label}</Label>
                  {variable.type === "text" && (
                    <Input
                      value={variableValues[variable.key] || ""}
                      onChange={(e) => setVariableValues(prev => ({
                        ...prev,
                        [variable.key]: e.target.value,
                      }))}
                      placeholder={variable.placeholder || variable.default}
                    />
                  )}
                  {variable.type === "color" && (
                    <Input
                      type="color"
                      value={variableValues[variable.key] || variable.default || "#000000"}
                      onChange={(e) => setVariableValues(prev => ({
                        ...prev,
                        [variable.key]: e.target.value,
                      }))}
                    />
                  )}
                  {variable.type === "image" && (
                    <div className="space-y-2">
                      {/* Image preview */}
                      {(imagePreviews[variable.key] || variableValues[variable.key]) && (
                        <div className="relative w-full h-24 rounded-lg overflow-hidden bg-muted">
                          <img
                            src={imagePreviews[variable.key] || variableValues[variable.key]}
                            alt="Preview"
                            className="w-full h-full object-contain"
                          />
                          <button
                            onClick={() => {
                              setVariableValues(prev => ({ ...prev, [variable.key]: "" }));
                              setImagePreviews(prev => ({ ...prev, [variable.key]: "" }));
                            }}
                            className="absolute top-1 right-1 p-1 bg-black/50 rounded-full hover:bg-black/70"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      )}
                      
                      {/* Upload button */}
                      <div className="flex gap-2">
                        <label className="flex-1">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(variable.key, file);
                            }}
                            disabled={uploadingImage === variable.key}
                          />
                          <div className={cn(
                            "flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-dashed cursor-pointer transition-colors",
                            "hover:bg-muted",
                            uploadingImage === variable.key && "opacity-50 cursor-not-allowed"
                          )}>
                            {uploadingImage === variable.key ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4" />
                            )}
                            <span className="text-sm">
                              {uploadingImage === variable.key ? "Uploading..." : "Upload Image"}
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {selectedTemplate && selectedTemplate.variables.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">
              This template is ready to use! Click below to create your video.
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handlePreviewTemplate} 
              disabled={isRendering}
            >
              {isRendering ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Rendering...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
            <DialogDescription>
              Preview of "{selectedTemplate?.title}" with your customizations
            </DialogDescription>
          </DialogHeader>

          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            {isRendering ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
                <p className="text-white">Rendering preview...</p>
                <div className="w-48">
                  <Progress value={renderProgress} className="h-2" />
                </div>
                <p className="text-white/60 text-sm">{renderProgress}%</p>
              </div>
            ) : previewUrl ? (
              <video
                src={previewUrl}
                controls
                autoPlay
                className="w-full h-full"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-white/60">No preview available</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={closePreview}>
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

