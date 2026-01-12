"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Film,
  Building2,
  HardHat,
  MessageSquare,
  Megaphone,
  ShoppingBag,
  Monitor,
  Smartphone,
  Square,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Loader2,
  Upload,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Form schema
const wizardSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  type: z.enum(["product_promo", "real_estate", "construction", "testimonial", "announcement"]),
  aspectRatio: z.enum(["landscape", "vertical", "square"]),
  script: z.string().optional(),
  brandPresetId: z.string().optional(),
});

type WizardData = z.infer<typeof wizardSchema>;

const VIDEO_TYPES = [
  { id: "product_promo", label: "Product Promo", icon: ShoppingBag, description: "Showcase your product features" },
  { id: "real_estate", label: "Real Estate", icon: Building2, description: "Property tours and listings" },
  { id: "construction", label: "Construction", icon: HardHat, description: "Project progress and updates" },
  { id: "testimonial", label: "Testimonial", icon: MessageSquare, description: "Customer stories and reviews" },
  { id: "announcement", label: "Announcement", icon: Megaphone, description: "News and updates" },
];

const ASPECT_RATIOS = [
  { id: "landscape", label: "Landscape", icon: Monitor, description: "16:9 - YouTube, TV" },
  { id: "vertical", label: "Vertical", icon: Smartphone, description: "9:16 - TikTok, Reels" },
  { id: "square", label: "Square", icon: Square, description: "1:1 - Instagram, Facebook" },
];

export default function NewVideoPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const form = useForm<WizardData>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      title: "",
      type: "product_promo",
      aspectRatio: "landscape",
      script: "",
    },
  });

  const { watch, setValue, handleSubmit } = form;
  const selectedType = watch("type");
  const selectedAspectRatio = watch("aspectRatio");

  const handleGenerate = async (data: WizardData) => {
    setLoading(true);
    try {
      // Create project
      const createRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          type: data.type,
          aspectRatio: data.aspectRatio,
        }),
      });

      if (!createRes.ok) {
        throw new Error("Failed to create project");
      }

      const { project } = await createRes.json();

      // Generate plan (AI stub)
      const planRes = await fetch(`/api/projects/${project.id}/generate-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: data.script,
          assetIds: [], // No assets selected for MVP
        }),
      });

      if (!planRes.ok) {
        throw new Error("Failed to generate plan");
      }

      toast.success("Project created! Add assets and generate your video.");
      router.push(`/app/projects/${project.id}/edit`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && !selectedType) {
      toast.error("Please select a video type");
      return;
    }
    if (step === 2 && !selectedAspectRatio) {
      toast.error("Please select a format");
      return;
    }
    if (step === 3 && !watch("title")) {
      toast.error("Please enter a title");
      return;
    }
    setStep((s) => Math.min(s + 1, 4));
  };

  const prevStep = () => {
    setStep((s) => Math.max(s - 1, 1));
  };

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-4 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Create New Video</h1>
            <p className="text-sm text-muted-foreground">Step {step} of 4</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        <form onSubmit={handleSubmit(handleGenerate)}>
          {/* Step 1: Video Type */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-semibold mb-2">What type of video?</h2>
                <p className="text-muted-foreground">Choose a template that fits your content</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {VIDEO_TYPES.map((type) => (
                  <Card
                    key={type.id}
                    className={cn(
                      "cursor-pointer transition-all hover:border-primary/50",
                      selectedType === type.id && "border-primary bg-primary/5"
                    )}
                    onClick={() => setValue("type", type.id as WizardData["type"])}
                  >
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          selectedType === type.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}>
                          <type.icon className="w-5 h-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{type.label}</CardTitle>
                          <CardDescription className="text-xs">{type.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Aspect Ratio */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-semibold mb-2">Choose your format</h2>
                <p className="text-muted-foreground">Select the aspect ratio for your video</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
                {ASPECT_RATIOS.map((ratio) => (
                  <Card
                    key={ratio.id}
                    className={cn(
                      "cursor-pointer transition-all hover:border-primary/50",
                      selectedAspectRatio === ratio.id && "border-primary bg-primary/5"
                    )}
                    onClick={() => setValue("aspectRatio", ratio.id as WizardData["aspectRatio"])}
                  >
                    <CardContent className="pt-6 text-center">
                      <div className={cn(
                        "w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4",
                        selectedAspectRatio === ratio.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}>
                        <ratio.icon className="w-8 h-8" />
                      </div>
                      <h3 className="font-medium mb-1">{ratio.label}</h3>
                      <p className="text-xs text-muted-foreground">{ratio.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Title & Script */}
          {step === 3 && (
            <div className="space-y-6 max-w-xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-semibold mb-2">Add details</h2>
                <p className="text-muted-foreground">Give your video a title and optional script</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Video Title</Label>
                  <Input
                    id="title"
                    placeholder="My Awesome Video"
                    {...form.register("title")}
                  />
                  {form.formState.errors.title && (
                    <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="script">Script or Bullet Points (optional)</Label>
                  <Textarea
                    id="script"
                    placeholder="Enter your script, key points, or leave blank for AI to generate based on your assets..."
                    rows={6}
                    {...form.register("script")}
                  />
                  <p className="text-xs text-muted-foreground">
                    The AI will use this to structure your video and create overlay text.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review & Generate */}
          {step === 4 && (
            <div className="space-y-6 max-w-xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-semibold mb-2">Ready to create</h2>
                <p className="text-muted-foreground">Review your settings and generate your video</p>
              </div>

              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-muted-foreground">Title</span>
                    <span className="font-medium">{watch("title") || "Untitled"}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium">
                      {VIDEO_TYPES.find((t) => t.id === selectedType)?.label}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-muted-foreground">Format</span>
                    <span className="font-medium">
                      {ASPECT_RATIOS.find((r) => r.id === selectedAspectRatio)?.label}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">Script</span>
                    <span className="font-medium text-sm max-w-[200px] truncate">
                      {watch("script") || "None provided"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                      <Upload className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium mb-1">Next: Add your media</h4>
                      <p className="text-sm text-muted-foreground">
                        After creating the project, you&apos;ll be able to upload your b-roll footage, 
                        product shots, and other assets in the editor.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={prevStep}
              disabled={step === 1}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            {step < 4 ? (
              <Button type="button" onClick={nextStep}>
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button type="submit" disabled={loading} className="gap-2">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Create Project
                  </>
                )}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

