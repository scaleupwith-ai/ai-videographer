"use client";

import { useState, useEffect } from "react";
import { Search, Film, Music, Volume2, ImageIcon, Mic, Play, Pause, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type AssetType = "all" | "clips" | "music" | "sfx" | "overlays" | "voices";

interface Clip {
  id: string;
  clip_link: string;
  duration_seconds: number;
  description: string | null;
  tags: string[];
  thumbnail_url: string | null;
}

interface MusicTrack {
  id: string;
  title: string;
  artist: string | null;
  duration_seconds: number;
  audio_url: string;
  genre: string | null;
}

interface SoundEffect {
  id: string;
  title: string;
  category: string | null;
  duration_seconds: number;
  audio_url: string;
}

interface Overlay {
  id: string;
  title: string;
  category: string | null;
  image_url: string;
  width: number | null;
  height: number | null;
}

interface Voice {
  id: string;
  name: string;
  description: string | null;
  profile_image_url: string | null;
  preview_url: string | null;
  is_default: boolean;
}

export default function PublicAssetsPage() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<AssetType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  
  const [clips, setClips] = useState<Clip[]>([]);
  const [music, setMusic] = useState<MusicTrack[]>([]);
  const [sfx, setSfx] = useState<SoundEffect[]>([]);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    fetchAllAssets();
  }, []);

  const fetchAllAssets = async () => {
    setIsLoading(true);
    await Promise.all([
      fetchClips(),
      fetchMusic(),
      fetchSfx(),
      fetchOverlays(),
      fetchVoices(),
    ]);
    setIsLoading(false);
  };

  const fetchClips = async () => {
    try {
      const res = await fetch("/api/public/clips");
      if (res.ok) {
        const data = await res.json();
        setClips(data.clips || []);
      }
    } catch (e) {
      console.error("Failed to fetch clips:", e);
    }
  };

  const fetchMusic = async () => {
    try {
      const res = await fetch("/api/public/music");
      if (res.ok) {
        const data = await res.json();
        setMusic(data.tracks || []);
      }
    } catch (e) {
      console.error("Failed to fetch music:", e);
    }
  };

  const fetchSfx = async () => {
    try {
      const res = await fetch("/api/public/sound-effects");
      if (res.ok) {
        const data = await res.json();
        setSfx(data.effects || []);
      }
    } catch (e) {
      console.error("Failed to fetch sfx:", e);
    }
  };

  const fetchOverlays = async () => {
    try {
      const res = await fetch("/api/public/overlays");
      if (res.ok) {
        const data = await res.json();
        setOverlays(data.overlays || []);
      }
    } catch (e) {
      console.error("Failed to fetch overlays:", e);
    }
  };

  const fetchVoices = async () => {
    try {
      const res = await fetch("/api/voices");
      if (res.ok) {
        const data = await res.json();
        setVoices(data.voices || []);
      }
    } catch (e) {
      console.error("Failed to fetch voices:", e);
    }
  };

  const handlePlayAudio = (url: string, id: string) => {
    if (playingAudio === id) {
      audioRef?.pause();
      setPlayingAudio(null);
    } else {
      if (audioRef) {
        audioRef.pause();
      }
      const audio = new Audio(url);
      audio.play();
      audio.onended = () => setPlayingAudio(null);
      setAudioRef(audio);
      setPlayingAudio(id);
    }
  };

  // Filter logic
  const filterItems = <T extends { [key: string]: any }>(items: T[], searchFields: string[]) => {
    if (!searchQuery) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(item => 
      searchFields.some(field => {
        const value = item[field];
        if (Array.isArray(value)) {
          return value.some(v => String(v).toLowerCase().includes(query));
        }
        return value && String(value).toLowerCase().includes(query);
      })
    );
  };

  const filteredClips = filterItems(clips, ["description", "tags"]);
  const filteredMusic = filterItems(music, ["title", "artist", "genre"]);
  const filteredSfx = filterItems(sfx, ["title", "category"]);
  const filteredOverlays = filterItems(overlays, ["title", "category"]);
  const filteredVoices = filterItems(voices, ["name", "description"]);

  const getCounts = () => ({
    all: clips.length + music.length + sfx.length + overlays.length + voices.length,
    clips: clips.length,
    music: music.length,
    sfx: sfx.length,
    overlays: overlays.length,
    voices: voices.length,
  });

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const counts = getCounts();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 bg-background border-b border-border">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Public Assets</h1>
              <p className="text-sm text-muted-foreground">Browse clips, music, sound effects, and more</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchAllAssets}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
          </div>
          
          {/* Search Bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, description, tags..."
              className="pl-10"
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AssetType)}>
          <TabsList className="mb-6">
            <TabsTrigger value="all" className="gap-2">
              All <Badge variant="secondary">{counts.all}</Badge>
            </TabsTrigger>
            <TabsTrigger value="clips" className="gap-2">
              <Film className="w-4 h-4" /> Clips <Badge variant="secondary">{counts.clips}</Badge>
            </TabsTrigger>
            <TabsTrigger value="music" className="gap-2">
              <Music className="w-4 h-4" /> Music <Badge variant="secondary">{counts.music}</Badge>
            </TabsTrigger>
            <TabsTrigger value="sfx" className="gap-2">
              <Volume2 className="w-4 h-4" /> SFX <Badge variant="secondary">{counts.sfx}</Badge>
            </TabsTrigger>
            <TabsTrigger value="overlays" className="gap-2">
              <ImageIcon className="w-4 h-4" /> Overlays <Badge variant="secondary">{counts.overlays}</Badge>
            </TabsTrigger>
            <TabsTrigger value="voices" className="gap-2">
              <Mic className="w-4 h-4" /> Voices <Badge variant="secondary">{counts.voices}</Badge>
            </TabsTrigger>
          </TabsList>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading assets...</div>
          ) : (
            <>
              {/* All Assets */}
              <TabsContent value="all" className="space-y-8">
                {filteredClips.length > 0 && (
                  <section>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Film className="w-5 h-5" /> B-Roll Clips ({filteredClips.length})
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {filteredClips.slice(0, 12).map((clip) => (
                        <ClipCard key={clip.id} clip={clip} />
                      ))}
                    </div>
                  </section>
                )}
                
                {filteredMusic.length > 0 && (
                  <section>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Music className="w-5 h-5" /> Music ({filteredMusic.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filteredMusic.slice(0, 6).map((track) => (
                        <AudioCard 
                          key={track.id} 
                          item={track} 
                          type="music"
                          isPlaying={playingAudio === track.id}
                          onPlay={() => handlePlayAudio(track.audio_url, track.id)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {filteredSfx.length > 0 && (
                  <section>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Volume2 className="w-5 h-5" /> Sound Effects ({filteredSfx.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filteredSfx.slice(0, 6).map((effect) => (
                        <AudioCard 
                          key={effect.id} 
                          item={effect} 
                          type="sfx"
                          isPlaying={playingAudio === effect.id}
                          onPlay={() => handlePlayAudio(effect.audio_url, effect.id)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {filteredOverlays.length > 0 && (
                  <section>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <ImageIcon className="w-5 h-5" /> Overlays ({filteredOverlays.length})
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {filteredOverlays.slice(0, 12).map((overlay) => (
                        <OverlayCard key={overlay.id} overlay={overlay} />
                      ))}
                    </div>
                  </section>
                )}

                {filteredVoices.length > 0 && (
                  <section>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Mic className="w-5 h-5" /> Voices ({filteredVoices.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filteredVoices.slice(0, 6).map((voice) => (
                        <VoiceCard 
                          key={voice.id} 
                          voice={voice}
                          isPlaying={playingAudio === voice.id}
                          onPlay={() => voice.preview_url && handlePlayAudio(voice.preview_url, voice.id)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {counts.all === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No public assets available yet</p>
                  </div>
                )}
              </TabsContent>

              {/* Clips Tab */}
              <TabsContent value="clips">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {filteredClips.map((clip) => (
                    <ClipCard key={clip.id} clip={clip} />
                  ))}
                </div>
                {filteredClips.length === 0 && <EmptyState type="clips" />}
              </TabsContent>

              {/* Music Tab */}
              <TabsContent value="music">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredMusic.map((track) => (
                    <AudioCard 
                      key={track.id} 
                      item={track} 
                      type="music"
                      isPlaying={playingAudio === track.id}
                      onPlay={() => handlePlayAudio(track.audio_url, track.id)}
                    />
                  ))}
                </div>
                {filteredMusic.length === 0 && <EmptyState type="music" />}
              </TabsContent>

              {/* SFX Tab */}
              <TabsContent value="sfx">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredSfx.map((effect) => (
                    <AudioCard 
                      key={effect.id} 
                      item={effect} 
                      type="sfx"
                      isPlaying={playingAudio === effect.id}
                      onPlay={() => handlePlayAudio(effect.audio_url, effect.id)}
                    />
                  ))}
                </div>
                {filteredSfx.length === 0 && <EmptyState type="sfx" />}
              </TabsContent>

              {/* Overlays Tab */}
              <TabsContent value="overlays">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {filteredOverlays.map((overlay) => (
                    <OverlayCard key={overlay.id} overlay={overlay} />
                  ))}
                </div>
                {filteredOverlays.length === 0 && <EmptyState type="overlays" />}
              </TabsContent>

              {/* Voices Tab */}
              <TabsContent value="voices">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredVoices.map((voice) => (
                    <VoiceCard 
                      key={voice.id} 
                      voice={voice}
                      isPlaying={playingAudio === voice.id}
                      onPlay={() => voice.preview_url && handlePlayAudio(voice.preview_url, voice.id)}
                    />
                  ))}
                </div>
                {filteredVoices.length === 0 && <EmptyState type="voices" />}
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
}

// =============== SUB COMPONENTS ===============

function ClipCard({ clip }: { clip: Clip }) {
  return (
    <Card className="overflow-hidden group">
      <div className="aspect-video bg-muted relative">
        {clip.thumbnail_url ? (
          <img src={clip.thumbnail_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
        <Badge className="absolute bottom-1 right-1 text-xs">{clip.duration_seconds}s</Badge>
      </div>
      <CardContent className="p-2">
        <p className="text-xs line-clamp-2 text-muted-foreground">{clip.description || "No description"}</p>
      </CardContent>
    </Card>
  );
}

function AudioCard({ 
  item, 
  type, 
  isPlaying, 
  onPlay, 
}: { 
  item: MusicTrack | SoundEffect; 
  type: "music" | "sfx";
  isPlaying: boolean;
  onPlay: () => void;
}) {
  const isMusic = type === "music";
  const track = item as MusicTrack;
  const effect = item as SoundEffect;
  
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <button
          onClick={onPlay}
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors",
            isMusic ? "bg-purple-500/20 hover:bg-purple-500/30" : "bg-green-500/20 hover:bg-green-500/30"
          )}
        >
          {isPlaying ? (
            <Pause className={cn("w-5 h-5", isMusic ? "text-purple-500" : "text-green-500")} />
          ) : (
            <Play className={cn("w-5 h-5", isMusic ? "text-purple-500" : "text-green-500")} />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{isMusic ? track.title : effect.title}</p>
          <p className="text-xs text-muted-foreground">
            {isMusic && track.artist && `${track.artist} • `}
            {item.duration_seconds}s
            {!isMusic && effect.category && ` • ${effect.category}`}
            {isMusic && track.genre && ` • ${track.genre}`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function OverlayCard({ overlay }: { overlay: Overlay }) {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-square bg-[url('/checkered.png')] bg-repeat bg-[length:10px_10px] relative">
        {overlay.image_url && (
          <img src={overlay.image_url} alt="" className="w-full h-full object-contain" />
        )}
      </div>
      <CardContent className="p-2">
        <p className="text-xs font-medium truncate">{overlay.title}</p>
        <p className="text-xs text-muted-foreground">
          {overlay.width && overlay.height ? `${overlay.width}×${overlay.height}` : "No size"}
        </p>
      </CardContent>
    </Card>
  );
}

function VoiceCard({ 
  voice, 
  isPlaying, 
  onPlay, 
}: { 
  voice: Voice;
  isPlaying: boolean;
  onPlay: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <Avatar className="w-10 h-10">
          {voice.profile_image_url ? (
            <AvatarImage src={voice.profile_image_url} />
          ) : (
            <AvatarFallback><Mic className="w-4 h-4" /></AvatarFallback>
          )}
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{voice.name}</p>
            {voice.is_default && <Badge variant="secondary" className="text-xs">Default</Badge>}
          </div>
          <p className="text-xs text-muted-foreground truncate">{voice.description || "No description"}</p>
        </div>
        {voice.preview_url && (
          <Button variant="ghost" size="icon" onClick={onPlay}>
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ type }: { type: string }) {
  const icons: Record<string, any> = {
    clips: Film,
    music: Music,
    sfx: Volume2,
    overlays: ImageIcon,
    voices: Mic,
  };
  const Icon = icons[type] || Film;
  
  return (
    <div className="text-center py-12">
      <Icon className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
      <p className="text-muted-foreground">No {type} found</p>
    </div>
  );
}







