"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Send, Sparkles, Film, Loader2, ChevronRight, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timeline?: AITimeline | null;
}

interface AITimeline {
  title: string;
  voiceover?: string;
  scenes: {
    clipId: string;
    description: string;
    inSec: number;
    outSec: number;
  }[];
}

interface Voice {
  id: string;
  name: string;
  eleven_labs_id: string;
  profile_image_url: string | null;
  is_default: boolean;
}

export default function NewVideoPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTimeline, setCurrentTimeline] = useState<AITimeline | null>(null);
  
  // Voiceover settings
  const [voices, setVoices] = useState<Voice[]>([]);
  const [includeVoiceover, setIncludeVoiceover] = useState(true);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Fetch available voices
    fetchVoices();
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus();
  }, []);

  const fetchVoices = async () => {
    try {
      const response = await fetch("/api/voices");
      if (response.ok) {
        const data = await response.json();
        setVoices(data.voices || []);
        
        // Set default voice
        const defaultVoice = data.voices?.find((v: Voice) => v.is_default);
        if (defaultVoice) {
          setSelectedVoiceId(defaultVoice.eleven_labs_id);
        } else if (data.voices?.length > 0) {
          setSelectedVoiceId(data.voices[0].eleven_labs_id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch voices:", error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setCurrentTimeline(null);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
          searchClips: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get AI response");
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message,
        timeline: data.timeline,
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data.timeline) {
        setCurrentTimeline(data.timeline);
        // Don't auto-generate - let user choose voiceover settings first
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Failed to get AI response");
    } finally {
      setIsLoading(false);
    }
  };

  const generateVideo = async () => {
    if (!currentTimeline) return;
    
    setIsGenerating(true);
    toast.info("Creating your video...");

    try {
      const response = await fetch("/api/ai/generate-timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeline: currentTimeline,
          projectTitle: currentTimeline.title,
          includeVoiceover,
          voiceId: includeVoiceover ? selectedVoiceId : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate timeline");
      }

      const { projectId } = await response.json();

      // Start the render
      const renderResponse = await fetch(`/api/projects/${projectId}/render`, {
        method: "POST",
      });

      if (!renderResponse.ok) {
        const renderError = await renderResponse.json();
        if (renderResponse.status === 402) {
          toast.error("Insufficient credits. Add credits in Billing.");
          router.push("/app/billing");
          return;
        }
        toast.warning("Project created but render failed to start");
      } else {
        toast.success("Video rendering started!");
      }

      router.push(`/app/projects/${projectId}`);
    } catch (error) {
      console.error("Generate error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate video");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatMessage = (content: string) => {
    // Remove the timeline JSON block from display
    return content.replace(/```timeline\n[\s\S]*?\n```/g, "").trim();
  };

  const totalDuration = currentTimeline?.scenes.reduce((sum, s) => sum + (s.outSec - s.inSec), 0) || 0;

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="shrink-0 border-b bg-background/80 backdrop-blur-sm px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Create with AI</h1>
            <p className="text-sm text-muted-foreground">
              Describe your video and I&apos;ll curate the perfect clips
            </p>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <ScrollArea className="flex-1 h-full p-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                  <Film className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">What video do you want to create?</h2>
                <p className="text-muted-foreground max-w-md mb-8">
                  Tell me about your vision and I&apos;ll search our b-roll library to curate the perfect clips for your video.
                </p>
                <div className="grid gap-2 w-full max-w-md">
                  {[
                    "30-second tech product showcase with modern visuals",
                    "Inspiring 45-second motivational video about success",
                    "Quick 20-second social media ad for a startup",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="text-left px-4 py-3 rounded-lg border bg-card hover:bg-accent transition-colors text-sm"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6 max-w-3xl mx-auto">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-3 max-w-[80%]",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-card border"
                      )}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {formatMessage(message.content)}
                      </p>
                      {message.timeline && (
                        <Card className="mt-4 p-4 bg-accent/50">
                          <div className="flex items-center gap-2 mb-3">
                            <Film className="w-4 h-4 text-primary" />
                            <span className="font-medium">{message.timeline.title}</span>
                            <Badge variant="secondary" className="ml-auto">
                              {message.timeline.scenes.length} clips
                            </Badge>
                          </div>
                          {message.timeline.voiceover && (
                            <div className="mb-3 p-3 rounded-lg bg-background/50 border">
                              <p className="text-xs font-medium text-muted-foreground mb-1">🎙️ Voiceover Script</p>
                              <p className="text-sm italic">&ldquo;{message.timeline.voiceover}&rdquo;</p>
                            </div>
                          )}
                          <div className="space-y-2">
                            {message.timeline.scenes.slice(0, 3).map((scene, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                                <ChevronRight className="w-3 h-3" />
                                <span>{scene.description.slice(0, 50)}...</span>
                                <span className="ml-auto">{scene.outSec - scene.inSec}s</span>
                              </div>
                            ))}
                            {message.timeline.scenes.length > 3 && (
                              <p className="text-xs text-muted-foreground pl-5">
                                +{message.timeline.scenes.length - 3} more clips
                              </p>
                            )}
                          </div>
                        </Card>
                      )}
                    </div>
                    {message.role === "user" && (
                      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                        <span className="text-xs font-medium text-primary-foreground">You</span>
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4 text-primary" />
                    </div>
                    <div className="rounded-2xl px-4 py-3 bg-card border">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">
                          Finding the perfect clips...
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input Area */}
          <div className="shrink-0 border-t bg-background p-4">
            <div className="max-w-3xl mx-auto">
              {isGenerating ? (
                <div className="p-6 rounded-xl bg-primary/5 border border-primary/20 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
                  <p className="font-medium">Creating your video...</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {includeVoiceover ? "Generating voiceover and preparing render" : "Preparing render"}
                  </p>
                </div>
              ) : currentTimeline ? (
                <div className="space-y-4">
                  {/* Voiceover Settings */}
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {includeVoiceover ? (
                          <Mic className="w-5 h-5 text-primary" />
                        ) : (
                          <MicOff className="w-5 h-5 text-muted-foreground" />
                        )}
                        <div>
                          <Label htmlFor="voiceover-toggle" className="font-medium">
                            Include Voiceover
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            AI-generated voice narration for your video
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="voiceover-toggle"
                        checked={includeVoiceover}
                        onCheckedChange={setIncludeVoiceover}
                      />
                    </div>

                    {includeVoiceover && (
                      <div className="space-y-3">
                        <Label className="text-sm text-muted-foreground">Choose Voice</Label>
                        {voices.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">
                            No voices configured. Add voices in the admin panel.
                          </p>
                        ) : (
                          <Select value={selectedVoiceId} onValueChange={setSelectedVoiceId}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select a voice" />
                            </SelectTrigger>
                            <SelectContent>
                              {voices.map((voice) => (
                                <SelectItem key={voice.id} value={voice.eleven_labs_id}>
                                  <div className="flex items-center gap-2">
                                    <Avatar className="w-6 h-6">
                                      <AvatarImage src={voice.profile_image_url || undefined} />
                                      <AvatarFallback className="text-[10px]">
                                        {voice.name.slice(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span>{voice.name}</span>
                                    {voice.is_default && (
                                      <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                        Default
                                      </Badge>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        {currentTimeline.voiceover && (
                          <div className="p-3 rounded-lg bg-muted/50 text-sm">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Script preview:</p>
                            <p className="italic text-muted-foreground line-clamp-2">
                              &ldquo;{currentTimeline.voiceover}&rdquo;
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>

                  {/* Generate Button */}
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">{currentTimeline.scenes.length}</span> clips •{" "}
                      <span className="font-medium">{Math.round(totalDuration)}</span>s total
                    </div>
                    <Button
                      onClick={generateVideo}
                      size="lg"
                      disabled={includeVoiceover && (!selectedVoiceId || voices.length === 0)}
                    >
                      <Film className="w-4 h-4 mr-2" />
                      Generate Video
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex gap-3">
                    <Textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Describe the video you want to create..."
                      className="min-h-[52px] max-h-32 resize-none"
                      rows={1}
                      disabled={isLoading}
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={!input.trim() || isLoading}
                      size="icon"
                      className="h-[52px] w-[52px] shrink-0"
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Describe your video → Choose voiceover settings → Generate
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
