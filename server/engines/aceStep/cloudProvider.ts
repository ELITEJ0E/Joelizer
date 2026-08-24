import { Client } from '@gradio/client';
import { ACEStepGenerateOptions, ACEStepGenerationResult, EngineStatus } from './types';

export class AceStepCloudProvider {
  private spaceId: string = 'ACE-Step/Ace-Step-v1.5';

  public getSpaceId(): string {
    return this.spaceId;
  }

  public async checkHealth(): Promise<EngineStatus> {
    const hasHfToken = !!process.env.HF_TOKEN;
    try {
      return {
        connected: true,
        endpoint: this.spaceId,
        engineType: 'ace-step-cloud',
        modelLoaded: true,
        gpuAvailable: true,
        gpuDeviceName: hasHfToken ? 'Hugging Face ZeroGPU / T4' : 'Hugging Face Free Tier',
        activeJobs: 0,
        version: 'ACE-Step v1.5 Cloud Space'
      };
    } catch (err: any) {
      return {
        connected: false,
        endpoint: this.spaceId,
        engineType: 'ace-step-cloud',
        modelLoaded: false,
        gpuAvailable: false,
        error: `Hugging Face Space check error: ${err.message}`
      };
    }
  }

  public async generate(
    options: ACEStepGenerateOptions,
    abortSignal?: AbortSignal
  ): Promise<ACEStepGenerationResult> {
    const {
      prompt,
      lyrics = '',
      duration = 30,
      bpm = 0,
      keySignature = '',
      timeSignature = '',
      vocalLanguage = 'unknown',
      isInstrumental = false,
      onProgress
    } = options;

    const hfToken = process.env.HF_TOKEN || undefined;

    onProgress?.('Connecting to ACE-Step Cloud Space (Hugging Face)...', 10);

    let client: any = null;
    try {
      client = await Client.connect(this.spaceId, {
        token: (hfToken as `hf_${string}`) || undefined,
        status_callback: (status: any) => {
          if (abortSignal?.aborted) return;
          if (status?.stage === 'waking_up') {
            onProgress?.('Waking up Hugging Face model space (cold start)...', 25);
          } else if (status?.stage === 'pending') {
            onProgress?.(`Queued in HF Space (position ${status?.position || 1})...`, 40);
          } else if (status?.stage === 'running') {
            onProgress?.('Synthesizing with ACE-Step DiT diffusion model...', 70);
          } else if (status?.message) {
            onProgress?.(status.message, 55);
          }
        }
      });
    } catch (connectErr: any) {
      const errMsg = connectErr?.message || String(connectErr);
      if (errMsg.includes('quota') || errMsg.includes('429') || errMsg.includes('rate limit')) {
        throw new Error('ACE_STEP_CLOUD_QUOTA_EXCEEDED: Hugging Face GPU quota exceeded. Please configure HF_TOKEN or try again later.');
      }
      if (errMsg.includes('busy') || errMsg.includes('queue') || errMsg.includes('503')) {
        throw new Error('ACE_STEP_CLOUD_BUSY: Hugging Face Space is currently busy. Please try again shortly.');
      }
      throw new Error(`ACE_STEP_CLOUD_FAILED: Failed to connect to Hugging Face Space (${errMsg})`);
    }

    if (abortSignal?.aborted) {
      throw new Error('Generation cancelled by user');
    }

    onProgress?.('Processing prompt with ACE-Step DiT transformer...', 60);

    // 54-parameter array expected by /generation_wrapper
    const ditParams = [
      "acestep-v15-xl-turbo", // 0: selected_model
      "custom",               // 1: generation_mode
      null,                   // 2: simple_query_input
      vocalLanguage,          // 3: simple_vocal_language
      prompt.trim(),          // 4: Prompt
      isInstrumental ? "" : (lyrics ? lyrics.trim() : ""), // 5: Lyrics
      bpm || 0,               // 6: BPM
      keySignature || "",     // 7: Key Signature
      timeSignature || "",    // 8: Time Signature
      vocalLanguage,          // 9: Vocal Language
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

    try {
      const result: any = await client.predict('/generation_wrapper', ditParams as any);

      if (abortSignal?.aborted) {
        throw new Error('Generation cancelled by user');
      }

      if (!result || !Array.isArray(result.data) || result.data.length === 0) {
        throw new Error('ACE_STEP_CLOUD_FAILED: Hugging Face Space returned an empty generation response.');
      }

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

      if (!finalAudioUrl) {
        throw new Error('ACE_STEP_CLOUD_FAILED: Could not extract valid audio URL from Space output.');
      }

      onProgress?.('Cloud ACE-Step generation complete!', 100);

      const generationId = `cloud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const format = finalAudioUrl.endsWith('.wav') ? 'wav' : 'mp3';

      return {
        audioUrl: finalAudioUrl,
        duration: duration || 30,
        title: prompt.slice(0, 32).trim() || 'ACE-Step Cloud Track',
        engine: 'ace-step-cloud',
        provider: 'huggingface',
        sourceUrl: finalAudioUrl,
        format,
        generationId
      };
    } catch (predictErr: any) {
      if (predictErr.name === 'AbortError' || abortSignal?.aborted) {
        throw new Error('Generation cancelled by user');
      }
      const pMsg = predictErr?.message || String(predictErr);
      if (pMsg.includes('quota') || pMsg.includes('429')) {
        throw new Error('ACE_STEP_CLOUD_QUOTA_EXCEEDED: Hugging Face GPU quota exceeded. Please configure HF_TOKEN or try again later.');
      }
      if (pMsg.includes('busy') || pMsg.includes('queue') || pMsg.includes('503')) {
        throw new Error('ACE_STEP_CLOUD_BUSY: Hugging Face Space is currently busy. Please try again shortly.');
      }
      if (pMsg.startsWith('ACE_STEP_CLOUD_')) {
        throw predictErr;
      }
      throw new Error(`ACE_STEP_CLOUD_FAILED: Hugging Face Space error (${pMsg})`);
    }
  }
}

export const cloudProviderInstance = new AceStepCloudProvider();
