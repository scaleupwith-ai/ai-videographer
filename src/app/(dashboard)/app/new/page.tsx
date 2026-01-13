"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Send, Sparkles, Film, Loader2, Play, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
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
  scenes: {
    clipId: string;
    description: string;
    inSec: number;
    outSec: number;
  }[];
}

export default function NewVideoPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTimeline, setCurrentTimeline] = useState<AITimeline | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus();
  }, []);

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
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Failed to get AI response");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const generateVideo = async () => {
    if (!currentTimeline) {
      toast.error("No timeline to generate");
      return;
    }

    setIsGenerating(true);

    try {
      // Generate the timeline and create project
      const response = await fetch("/api/ai/generate-timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeline: currentTimeline,
          projectTitle: currentTimeline.title,
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
        // Project created but render failed - still redirect
        toast.warning("Project created but render failed to start");
      } else {
        toast.success("Video generation started!");
      }

      router.push(`/app/projects/${projectId}`);
    } catch (error) {
      console.error("Generate error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate video");
    } finally {
      setIsGenerating(false);
    }
  };

  const formatMessage = (content: string) => {
    // Remove the timeline JSON block from display
    return content.replace(/```timeline\n[\s\S]*?\n```/g, "").trim();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="border-b bg-background/80 backdrop-blur-sm px-6 py-4">
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
      <div className="flex-1 flex overflow-hidden">
        {/* Messages */}
        <div className="flex-1 flex flex-col">
          <ScrollArea ref={scrollRef} className="flex-1 p-6">
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
                    "Create a 30-second tech product showcase",
                    "Make an inspiring motivational video about success",
                    "Build a travel montage of city life",
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
                        <span className="text-sm text-muted-foreground">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t bg-background p-4">
            <div className="max-w-3xl mx-auto">
              {currentTimeline && (
                <div className="mb-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Play className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{currentTimeline.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {currentTimeline.scenes.length} clips ready to render
                        </p>
                      </div>
                    </div>
                    <Button 
                      onClick={generateVideo} 
                      disabled={isGenerating}
                      className="gap-2"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Generate Video
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe the video you want to create..."
                  className="min-h-[52px] max-h-32 resize-none"
                  rows={1}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="h-[52px] w-[52px] shrink-0"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                AI will search your clip library and suggest the best b-roll for your video
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
