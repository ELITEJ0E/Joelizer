import { Client } from '@gradio/client';

export interface GenerateMusicParams {
  prompt: string;
  lyrics?: string;
  duration?: number;
  onStatusUpdate?: (status: string) => void;
}

export interface GenerateMusicResult {
  audioUrl: string;
  duration: number;
  title: string;
  source: string;
}

export async function generateMusic({
  prompt,
  lyrics = '',
  duration = 30,
  onStatusUpdate
}: GenerateMusicParams): Promise<GenerateMusicResult> {
  const hfToken = process.env.HF_TOKEN || undefined;

  if (onStatusUpdate) {
    onStatusUpdate('Connecting to ACE-Step v1.5 Model Space...');
  }

  try {
    const client = await Client.connect('ACE-Step/Ace-Step-v1.5', {
      token: (hfToken as `hf_${string}`) || undefined,
      status_callback: (status: any) => {
        if (!onStatusUpdate) return;
        if (status?.stage === 'waking_up') {
          onStatusUpdate('Waking up Hugging Face model space (cold start)...');
        } else if (status?.stage === 'pending') {
          onStatusUpdate(`Queued in HF Space (position ${status?.position || 1})...`);
        } else if (status?.stage === 'running') {
          onStatusUpdate('Generating synth & vocal stems with DiT transformer...');
        } else if (status?.message) {
          onStatusUpdate(status.message);
        }
      }
    });

    if (onStatusUpdate) {
      onStatusUpdate('Processing prompt & lyrics generation...');
    }

    // Default 54 parameter array matching /generation_wrapper schema
    const defaultParams = [
      "acestep-v15-xl-turbo", // 0: selected_model
      "custom",               // 1: generation_mode
      null,                   // 2: simple_query_input
      "unknown",              // 3: simple_vocal_language
      prompt,                 // 4: Prompt
      lyrics || "",           // 5: Lyrics
      0,                      // 6: BPM
      "",                     // 7: Key Signature
      "",                     // 8: Time Signature
      "unknown",              // 9: Vocal Language
      8,                      // 10: DiT Inference Steps
      7,                      // 11
      true,                   // 12: Random Seed
      "-1",                   // 13: Seed
      null,                   // 14: Reference Audio
      duration || 30,         // 15: Audio Duration
      1,                      // 16: batch size
      null,                   // 17: Source Audio
      null,                   // 18: Audio Codes
      0,                      // 19: Start
      -1,                     // 20: End
      "Fill the audio semantic mask based on the given conditions:", // 21
      1,                      // 22
      "text2music",           // 23
      false,                  // 24
      0,                      // 25
      1,                      // 26
      3,                      // 27: Shift
      "ode",                  // 28: Inference Method
      "",                     // 29: Custom Timesteps
      "mp3",                  // 30: Audio Format
      0.85,                   // 31: LM Temperature
      true,                   // 32: Thinking
      2,                      // 33: LM CFG Scale
      0,                      // 34: LM Top-K
      0.9,                    // 35: LM Top-P
      "NO USER INPUT",        // 36: LM Negative Prompt
      true,                   // 37
      true,                   // 38
      true,                   // 39
      null,                   // 40
      false,                  // 41
      true,                   // 42
      false,                  // 43: Get Scores
      false,                  // 44: Get LRC
      0.5,                    // 45
      8,                      // 46
      null,                   // 47
      [],                     // 48
      false,                  // 49
      null,                   // 50
      null,                   // 51
      null,                   // 52
      null                    // 53
    ];

    let result: any = null;
    try {
      result = await client.predict('/generation_wrapper', defaultParams as any);
    } catch (e: any) {
      throw new Error(`ACE-Step Space predict error: ${e?.message || e}`);
    }

    if (result && Array.isArray(result.data) && result.data.length > 0) {
      let finalAudioUrl = '';
      for (const item of result.data) {
        if (typeof item === 'string' && (item.endsWith('.mp3') || item.endsWith('.wav') || item.startsWith('http'))) {
          finalAudioUrl = item;
          break;
        } else if (item?.url) {
          finalAudioUrl = item.url;
          break;
        } else if (item?.path) {
          finalAudioUrl = item.path;
          break;
        }
      }

      if (finalAudioUrl) {
        return {
          audioUrl: finalAudioUrl,
          duration: duration || 30,
          title: prompt.slice(0, 32) || 'ACE-Step AI Track',
          source: 'ace-step'
        };
      }
    }

    throw new Error('ACE-Step Space returned no audio output.');
  } catch (err: any) {
    console.error('ACE-Step Space connection error:', err?.message || err);
    throw new Error(err?.message || 'Failed to connect to ACE-Step model Space.');
  }
}
