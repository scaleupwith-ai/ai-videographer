import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { TimelineV1, Scene, TextOverlay, TransitionPreset, AnimationPreset } from "@/lib/timeline/v1";
import { updateScene, deleteScene, addScene, reorderScenes, normalizeTimeline, createTextOverlay } from "@/lib/timeline/v1";

// Selection types
export type SelectedItemType = "scene" | "text" | null;
export interface SelectedItem {
  id: string;
  type: SelectedItemType;
  sceneIndex?: number;
  textIndex?: number;
}

interface EditorState {
  // Project data
  projectId: string | null;
  timeline: TimelineV1 | null;
  originalTimeline: TimelineV1 | null; // For dirty checking
  
  // UI state
  selectedSceneId: string | null;
  selectedItem: SelectedItem | null; // New unified selection
  isPlaying: boolean;
  currentTimeSec: number;
  isSaving: boolean;
  lastSavedAt: Date | null;
  
  // Actions
  setProject: (projectId: string, timeline: TimelineV1) => void;
  setTimeline: (timeline: TimelineV1) => void;
  selectScene: (sceneId: string | null) => void;
  setSelectedItem: (item: SelectedItem | null) => void;
  
  // Scene operations
  updateSceneById: (sceneId: string, updates: Partial<Scene>) => void;
  deleteSceneById: (sceneId: string) => void;
  addNewScene: (scene: Scene, index?: number) => void;
  reorderScenesAction: (fromIndex: number, toIndex: number) => void;
  updateSceneTransition: (sceneId: string, transition: TransitionPreset | null) => void;
  updateSceneAnimation: (sceneId: string, animation: AnimationPreset) => void;
  duplicateScene: (sceneId: string) => void;
  
  // Text overlay operations
  addTextOverlay: (text: string, startTime: number, duration?: number) => void;
  updateTextOverlay: (textId: string, updates: Partial<TextOverlay>) => void;
  deleteTextOverlay: (textId: string) => void;
  
  // Global settings
  updateGlobalMusic: (updates: Partial<TimelineV1["global"]["music"]>) => void;
  updateGlobalVoiceover: (updates: Partial<TimelineV1["global"]["voiceover"]>) => void;
  updateGlobalBrand: (updates: Partial<TimelineV1["global"]["brand"]>) => void;
  updateGlobalExport: (updates: Partial<TimelineV1["global"]["export"]>) => void;
  updateGlobalCaptions: (updates: Partial<TimelineV1["global"]["captions"]>) => void;
  
  // Playback
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (timeSec: number) => void;
  
  // Saving
  setSaving: (saving: boolean) => void;
  markSaved: () => void;
  
  // State checks
  isDirty: () => boolean;
  reset: () => void;
}

export const useEditorStore = create<EditorState>()(
  devtools(
    (set, get) => ({
      projectId: null,
      timeline: null,
      originalTimeline: null,
      selectedSceneId: null,
      selectedItem: null,
      isPlaying: false,
      currentTimeSec: 0,
      isSaving: false,
      lastSavedAt: null,

      setProject: (projectId, timeline) => {
        const normalized = normalizeTimeline(timeline);
        set({
          projectId,
          timeline: normalized,
          originalTimeline: JSON.parse(JSON.stringify(normalized)),
          selectedSceneId: normalized.scenes[0]?.id || null,
          selectedItem: normalized.scenes[0] ? {
            id: normalized.scenes[0].id,
            type: "scene",
            sceneIndex: 0,
          } : null,
          currentTimeSec: 0,
          isPlaying: false,
          lastSavedAt: new Date(),
        });
      },

      setTimeline: (timeline) => {
        set({ timeline: normalizeTimeline(timeline) });
      },

      selectScene: (sceneId) => {
        const { timeline } = get();
        const sceneIndex = timeline?.scenes.findIndex(s => s.id === sceneId) ?? -1;
        set({ 
          selectedSceneId: sceneId,
          selectedItem: sceneId && sceneIndex >= 0 ? {
            id: sceneId,
            type: "scene",
            sceneIndex,
          } : null,
        });
      },

      setSelectedItem: (item) => {
        set({ 
          selectedItem: item,
          selectedSceneId: item?.type === "scene" ? item.id : null,
        });
      },

      updateSceneById: (sceneId, updates) => {
        const { timeline } = get();
        if (!timeline) return;
        set({ timeline: updateScene(timeline, sceneId, updates) });
      },

      deleteSceneById: (sceneId) => {
        const { timeline, selectedSceneId, selectedItem } = get();
        if (!timeline) return;
        const newTimeline = deleteScene(timeline, sceneId);
        set({
          timeline: newTimeline,
          selectedSceneId: selectedSceneId === sceneId
            ? newTimeline.scenes[0]?.id || null
            : selectedSceneId,
          selectedItem: selectedItem?.id === sceneId
            ? (newTimeline.scenes[0] ? {
                id: newTimeline.scenes[0].id,
                type: "scene",
                sceneIndex: 0,
              } : null)
            : selectedItem,
        });
      },

      addNewScene: (scene, index) => {
        const { timeline } = get();
        if (!timeline) return;
        const newTimeline = addScene(timeline, scene, index);
        const sceneIndex = newTimeline.scenes.findIndex(s => s.id === scene.id);
        set({
          timeline: newTimeline,
          selectedSceneId: scene.id,
          selectedItem: {
            id: scene.id,
            type: "scene",
            sceneIndex,
          },
        });
      },

      reorderScenesAction: (fromIndex, toIndex) => {
        const { timeline } = get();
        if (!timeline) return;
        set({ timeline: reorderScenes(timeline, fromIndex, toIndex) });
      },

      updateSceneTransition: (sceneId, transition) => {
        const { timeline } = get();
        if (!timeline) return;
        set({ timeline: updateScene(timeline, sceneId, { transition }) });
      },

      updateSceneAnimation: (sceneId, animation) => {
        const { timeline } = get();
        if (!timeline) return;
        set({ timeline: updateScene(timeline, sceneId, { animation }) });
      },

      duplicateScene: (sceneId) => {
        const { timeline } = get();
        if (!timeline) return;
        const sceneIndex = timeline.scenes.findIndex(s => s.id === sceneId);
        if (sceneIndex < 0) return;
        
        const originalScene = timeline.scenes[sceneIndex];
        const duplicatedScene: Scene = {
          ...originalScene,
          id: `scene-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
        
        const newTimeline = addScene(timeline, duplicatedScene, sceneIndex + 1);
        set({
          timeline: newTimeline,
          selectedSceneId: duplicatedScene.id,
          selectedItem: {
            id: duplicatedScene.id,
            type: "scene",
            sceneIndex: sceneIndex + 1,
          },
        });
      },

      // Text overlay operations
      addTextOverlay: (text, startTime, duration) => {
        const { timeline } = get();
        if (!timeline) return;
        
        const newOverlay = createTextOverlay({
          id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          text,
          startTime,
          duration,
        });
        
        const textOverlays = [...(timeline.textOverlays || []), newOverlay];
        set({
          timeline: { ...timeline, textOverlays },
          selectedItem: {
            id: newOverlay.id,
            type: "text",
            textIndex: textOverlays.length - 1,
          },
        });
      },

      updateTextOverlay: (textId, updates) => {
        const { timeline } = get();
        if (!timeline?.textOverlays) return;
        
        const textOverlays = timeline.textOverlays.map(t =>
          t.id === textId ? { ...t, ...updates } : t
        );
        set({ timeline: { ...timeline, textOverlays } });
      },

      deleteTextOverlay: (textId) => {
        const { timeline, selectedItem } = get();
        if (!timeline?.textOverlays) return;
        
        const textOverlays = timeline.textOverlays.filter(t => t.id !== textId);
        set({
          timeline: { ...timeline, textOverlays },
          selectedItem: selectedItem?.id === textId ? null : selectedItem,
        });
      },

      updateGlobalMusic: (updates) => {
        const { timeline } = get();
        if (!timeline) return;
        set({
          timeline: {
            ...timeline,
            global: {
              ...timeline.global,
              music: { ...timeline.global.music, ...updates },
            },
          },
        });
      },

      updateGlobalVoiceover: (updates) => {
        const { timeline } = get();
        if (!timeline) return;
        set({
          timeline: {
            ...timeline,
            global: {
              ...timeline.global,
              voiceover: { ...timeline.global.voiceover, ...updates },
            },
          },
        });
      },

      updateGlobalBrand: (updates) => {
        const { timeline } = get();
        if (!timeline) return;
        set({
          timeline: {
            ...timeline,
            global: {
              ...timeline.global,
              brand: { ...timeline.global.brand, ...updates },
            },
          },
        });
      },

      updateGlobalExport: (updates) => {
        const { timeline } = get();
        if (!timeline) return;
        set({
          timeline: {
            ...timeline,
            global: {
              ...timeline.global,
              export: { ...timeline.global.export, ...updates },
            },
          },
        });
      },

      updateGlobalCaptions: (updates) => {
        const { timeline } = get();
        if (!timeline) return;
        set({
          timeline: {
            ...timeline,
            global: {
              ...timeline.global,
              captions: { ...timeline.global.captions, ...updates },
            },
          },
        });
      },

      setPlaying: (playing) => {
        set({ isPlaying: playing });
      },

      setCurrentTime: (timeSec) => {
        set({ currentTimeSec: timeSec });
      },

      setSaving: (saving) => {
        set({ isSaving: saving });
      },

      markSaved: () => {
        const { timeline } = get();
        set({
          originalTimeline: timeline ? JSON.parse(JSON.stringify(timeline)) : null,
          lastSavedAt: new Date(),
          isSaving: false,
        });
      },

      isDirty: () => {
        const { timeline, originalTimeline } = get();
        if (!timeline || !originalTimeline) return false;
        return JSON.stringify(timeline) !== JSON.stringify(originalTimeline);
      },

      reset: () => {
        set({
          projectId: null,
          timeline: null,
          originalTimeline: null,
          selectedSceneId: null,
          selectedItem: null,
          isPlaying: false,
          currentTimeSec: 0,
          isSaving: false,
          lastSavedAt: null,
        });
      },
    }),
    { name: "editor-store" }
  )
);





