/**
 * ElevenLabs Text-to-Speech Integration
 */

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";

interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

interface GenerateVoiceoverOptions {
  text: string;
  voiceId: string;
  modelId?: string;
  voiceSettings?: Partial<VoiceSettings>;
}

/**
 * Generate voiceover audio using ElevenLabs API
 * Returns the audio as a Buffer
 */
export async function generateVoiceover({
  text,
  voiceId,
  modelId = "eleven_monolingual_v1",
  voiceSettings,
}: GenerateVoiceoverOptions): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }

  const settings: VoiceSettings = {
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0,
    use_speaker_boost: true,
    ...voiceSettings,
  };

  const response = await fetch(
    `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: settings,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Get available voices from ElevenLabs
 */
export async function getElevenLabsVoices(): Promise<{ voice_id: string; name: string }[]> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }

  const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
    headers: {
      "xi-api-key": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch voices: ${response.status}`);
  }

  const data = await response.json();
  return data.voices || [];
}

/**
 * Estimate speech duration based on text
 * Average speaking rate is ~150 words per minute
 */
export function estimateSpeechDuration(text: string): number {
  const words = text.trim().split(/\s+/).length;
  const wordsPerMinute = 150;
  return (words / wordsPerMinute) * 60; // Returns seconds
}

