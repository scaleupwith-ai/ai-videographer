import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { TimelineV1, Scene } from "@/lib/timeline/v1";
import { updateScene, deleteScene, addScene, reorderScenes, normalizeTimeline } from "@/lib/timeline/v1";

interface EditorState {
  // Project data
  projectId: string | null;
  timeline: TimelineV1 | null;
  originalTimeline: TimelineV1 | null; // For dirty checking
  
  // UI state
  selectedSceneId: string | null;
  isPlaying: boolean;
  currentTimeSec: number;
  
  // Actions
  setProject: (projectId: string, timeline: TimelineV1) => void;
  setTimeline: (timeline: TimelineV1) => void;
  selectScene: (sceneId: string | null) => void;
  
  // Scene operations
  updateSceneById: (sceneId: string, updates: Partial<Scene>) => void;
  deleteSceneById: (sceneId: string) => void;
  addNewScene: (scene: Scene, index?: number) => void;
  reorderScenesAction: (fromIndex: number, toIndex: number) => void;
  
  // Global settings
  updateGlobalMusic: (updates: Partial<TimelineV1["global"]["music"]>) => void;
  updateGlobalVoiceover: (updates: Partial<TimelineV1["global"]["voiceover"]>) => void;
  updateGlobalBrand: (updates: Partial<TimelineV1["global"]["brand"]>) => void;
  updateGlobalExport: (updates: Partial<TimelineV1["global"]["export"]>) => void;
  updateGlobalCaptions: (updates: Partial<TimelineV1["global"]["captions"]>) => void;
  
  // Playback
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (timeSec: number) => void;
  
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
      isPlaying: false,
      currentTimeSec: 0,

      setProject: (projectId, timeline) => {
        const normalized = normalizeTimeline(timeline);
        set({
          projectId,
          timeline: normalized,
          originalTimeline: JSON.parse(JSON.stringify(normalized)),
          selectedSceneId: normalized.scenes[0]?.id || null,
          currentTimeSec: 0,
          isPlaying: false,
        });
      },

      setTimeline: (timeline) => {
        set({ timeline: normalizeTimeline(timeline) });
      },

      selectScene: (sceneId) => {
        set({ selectedSceneId: sceneId });
      },

      updateSceneById: (sceneId, updates) => {
        const { timeline } = get();
        if (!timeline) return;
        set({ timeline: updateScene(timeline, sceneId, updates) });
      },

      deleteSceneById: (sceneId) => {
        const { timeline, selectedSceneId } = get();
        if (!timeline) return;
        const newTimeline = deleteScene(timeline, sceneId);
        set({
          timeline: newTimeline,
          selectedSceneId: selectedSceneId === sceneId
            ? newTimeline.scenes[0]?.id || null
            : selectedSceneId,
        });
      },

      addNewScene: (scene, index) => {
        const { timeline } = get();
        if (!timeline) return;
        set({
          timeline: addScene(timeline, scene, index),
          selectedSceneId: scene.id,
        });
      },

      reorderScenesAction: (fromIndex, toIndex) => {
        const { timeline } = get();
        if (!timeline) return;
        set({ timeline: reorderScenes(timeline, fromIndex, toIndex) });
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
          isPlaying: false,
          currentTimeSec: 0,
        });
      },
    }),
    { name: "editor-store" }
  )
);

