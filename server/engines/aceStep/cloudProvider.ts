import { Client } from '@gradio/client';
import { ACEStepGenerateOptions, ACEStepGenerationResult, EngineStatus } from './types';

export interface CloudDiagnosticLog {
  provider: string;
  spaceUrl: string;
  stage: string;
  status: number;
  contentType: string;
  responseTimeMs: number;
  errorBody?: string;
}

export function logCloudDiagnostic(log: CloudDiagnosticLog): void {
  const timestamp = new Date().toISOString();
  console.error(`
=== [ACE-Step Cloud Diagnostic ${timestamp}] ===
Provider:     ${log.provider}
Space URL:    ${log.spaceUrl}
Stage:        ${log.stage}
HTTP Status:  ${log.status || 'N/A (Client/Network Exception)'}
Content-Type: ${log.contentType || 'N/A'}
Response Time:${log.responseTimeMs}ms
Error Body:   ${log.errorBody || 'None'}
================================================
`);
}

/**
 * Strips tokens, cookies, auth headers and truncates text to avoid exposing credentials.
 */
export function sanitizeText(raw: string, maxLen: number = 250): string {
  if (!raw) return '';
  return raw
    .replace(/hf_[a-zA-Z0-9]{20,}/g, '[REDACTED_TOKEN]')
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/Cookie:\s*[^;\n]+/gi, 'Cookie: [REDACTED_COOKIE]')
    .replace(/set-cookie:[^\n]+/gi, 'set-cookie: [REDACTED]')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function parseCloudError(status: number, rawBody: string, stage: string = 'generation'): string {
  const safeBody = sanitizeText(rawBody, 250);
  const lowerBody = (rawBody + ' ' + safeBody).toLowerCase();

  if (status === 429 || lowerBody.includes('quota') || lowerBody.includes('rate limit') || lowerBody.includes('zerogpu')) {
    return 'ACE_STEP_CLOUD_QUOTA_EXCEEDED: Hugging Face Cloud is rate limited or GPU quota is exceeded. Please configure HF_TOKEN or try again later.';
  }

  if (status === 503 || lowerBody.includes('unavailable') || lowerBody.includes('busy') || lowerBody.includes('loading') || lowerBody.includes('waking up')) {
    return 'ACE_STEP_CLOUD_UNAVAILABLE: Hugging Face ACE-Step Space is currently unavailable or loading (HTTP 503). Please try again shortly.';
  }

  if (status === 500 || lowerBody.includes('a server error') || lowerBody.includes('internal server error')) {
    return 'ACE_STEP_CLOUD_SERVER_ERROR: Hugging Face ACE-Step returned a server error (HTTP 500). The model space may be restarting.';
  }

  if (status === 401 || status === 403 || lowerBody.includes('unauthorized') || lowerBody.includes('forbidden')) {
    return 'ACE_STEP_CLOUD_AUTH_ERROR: Hugging Face authorization failed (HTTP 401/403). Please verify your HF_TOKEN.';
  }

  if (lowerBody.includes('unexpected token') || lowerBody.includes('is not valid json') || lowerBody.includes('syntaxerror')) {
    return `ACE_STEP_CLOUD_UNAVAILABLE: Hugging Face Space returned a non-JSON response on stage '${stage}' (e.g. "A server error occurred"). The Space may be starting up or under load.`;
  }

  if (status > 0) {
    const snippet = safeBody ? `: ${safeBody}` : '';
    return `ACE_STEP_CLOUD_FAILED: Hugging Face Cloud returned HTTP ${status} on stage '${stage}'${snippet}`;
  }

  return `ACE_STEP_CLOUD_FAILED: Hugging Face Cloud stage '${stage}' failed: ${safeBody || 'Unknown service error'}`;
}

/**
 * Safely executes HTTP requests inspecting response status and content-type before reading JSON.
 */
export async function safeFetch(
  url: string,
  options?: RequestInit,
  stage: string = 'http_request'
): Promise<{ ok: boolean; status: number; contentType: string; data?: any; rawText?: string }> {
  const startTime = Date.now();
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (netErr: any) {
    const duration = Date.now() - startTime;
    const errMsg = netErr?.message || String(netErr);
    logCloudDiagnostic({
      provider: 'ACE-Step Cloud',
      spaceUrl: url,
      stage,
      status: 0,
      contentType: 'network_error',
      responseTimeMs: duration,
      errorBody: errMsg
    });
    throw new Error(parseCloudError(0, errMsg, stage));
  }

  const duration = Date.now() - startTime;
  const status = res.status;
  const contentType = res.headers.get('content-type') || '';

  if (!res.ok) {
    const textBody = await res.text().catch(() => '');
    logCloudDiagnostic({
      provider: 'ACE-Step Cloud',
      spaceUrl: url,
      stage,
      status,
      contentType,
      responseTimeMs: duration,
      errorBody: textBody
    });
    throw new Error(parseCloudError(status, textBody, stage));
  }

  if (contentType.includes('application/json')) {
    try {
      const data = await res.json();
      return { ok: true, status, contentType, data };
    } catch (jsonErr: any) {
      const textBody = await res.text().catch(() => '');
      logCloudDiagnostic({
        provider: 'ACE-Step Cloud',
        spaceUrl: url,
        stage,
        status,
        contentType,
        responseTimeMs: duration,
        errorBody: `Invalid JSON body: ${textBody}`
      });
      throw new Error(parseCloudError(status, textBody, stage));
    }
  } else {
    const textBody = await res.text().catch(() => '');
    return { ok: true, status, contentType, rawText: textBody };
  }
}

export class AceStepCloudProvider {
  private spaceId: string = 'ACE-Step/Ace-Step-v1.5';
  private spaceMetadataUrl: string = 'https://huggingface.co/api/spaces/ACE-Step/Ace-Step-v1.5';

  public getSpaceId(): string {
    return this.spaceId;
  }

  public async checkHealth(): Promise<EngineStatus> {
    const hasHfToken = !!process.env.HF_TOKEN;
    const startTime = Date.now();
    try {
      const { status, contentType, data } = await safeFetch(this.spaceMetadataUrl, undefined, 'health_check');
      const duration = Date.now() - startTime;

      const runtimeStage = data?.runtime?.stage || 'UNKNOWN';
      const isRunning = runtimeStage === 'RUNNING' || runtimeStage === 'PAUSED';

      if (!isRunning) {
        logCloudDiagnostic({
          provider: 'ACE-Step Cloud',
          spaceUrl: this.spaceMetadataUrl,
          stage: 'health_check',
          status,
          contentType,
          responseTimeMs: duration,
          errorBody: `Space runtime stage is '${runtimeStage}'`
        });
      }

      return {
        connected: isRunning,
        endpoint: this.spaceId,
        engineType: 'ace-step-cloud',
        modelLoaded: isRunning,
        gpuAvailable: isRunning,
        gpuDeviceName: hasHfToken ? 'Hugging Face ZeroGPU / T4' : 'Hugging Face Free Tier',
        activeJobs: 0,
        version: `ACE-Step v1.5 Cloud Space (${runtimeStage})`,
        error: isRunning ? undefined : `Space status: ${runtimeStage}`
      };
    } catch (err: any) {
      return {
        connected: false,
        endpoint: this.spaceId,
        engineType: 'ace-step-cloud',
        modelLoaded: false,
        gpuAvailable: false,
        error: err.message || 'Hugging Face Space health check failed'
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

    // Stage 1: Space Connection & Preflight Verification
    onProgress?.('Connecting to ACE-Step Cloud Space (Hugging Face)...', 10);
    const connStartTime = Date.now();

    // Verify Space state prior to connecting
    try {
      const metaRes = await safeFetch(this.spaceMetadataUrl, undefined, 'space_connection');
      const stage = metaRes.data?.runtime?.stage;
      if (stage && stage !== 'RUNNING') {
        const msg = `Space is in state '${stage}'.`;
        logCloudDiagnostic({
          provider: 'ACE-Step Cloud',
          spaceUrl: this.spaceMetadataUrl,
          stage: 'space_connection',
          status: metaRes.status,
          contentType: metaRes.contentType,
          responseTimeMs: Date.now() - connStartTime,
          errorBody: msg
        });
        if (stage === 'BUILDING' || stage === 'RUNNING_BUILDING') {
          throw new Error('ACE_STEP_CLOUD_UNAVAILABLE: Hugging Face ACE-Step Space is currently building/starting up. Please wait 1-2 minutes and try again.');
        }
        if (stage === 'SLEEPING') {
          onProgress?.('Waking up sleeping Hugging Face model space (cold start)...', 20);
        }
      }
    } catch (preflightErr: any) {
      if (preflightErr.message?.startsWith('ACE_STEP_CLOUD_')) {
        throw preflightErr;
      }
      console.warn('Preflight space check warning:', preflightErr.message);
    }

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
      const duration = Date.now() - connStartTime;
      const rawErr = connectErr?.message || String(connectErr);
      logCloudDiagnostic({
        provider: 'ACE-Step Cloud',
        spaceUrl: this.spaceId,
        stage: 'space_connection',
        status: 503,
        contentType: 'text/plain',
        responseTimeMs: duration,
        errorBody: rawErr
      });
      throw new Error(parseCloudError(503, rawErr, 'space_connection'));
    }

    if (abortSignal?.aborted) {
      throw new Error('Generation cancelled by user');
    }

    // Stage 2: Queue Submission & Generation Wrapper
    onProgress?.('Processing prompt with ACE-Step DiT transformer...', 60);
    const genStartTime = Date.now();

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

    let result: any = null;
    try {
      result = await client.predict('/generation_wrapper', ditParams as any);
    } catch (predictErr: any) {
      const duration = Date.now() - genStartTime;
      const rawErr = predictErr?.message || String(predictErr);
      logCloudDiagnostic({
        provider: 'ACE-Step Cloud',
        spaceUrl: `${this.spaceId}/generation_wrapper`,
        stage: 'generation_wrapper',
        status: 500,
        contentType: 'text/plain',
        responseTimeMs: duration,
        errorBody: rawErr
      });
      throw new Error(parseCloudError(500, rawErr, 'generation_wrapper'));
    }

    if (abortSignal?.aborted) {
      throw new Error('Generation cancelled by user');
    }

    if (!result || !Array.isArray(result.data) || result.data.length === 0) {
      logCloudDiagnostic({
        provider: 'ACE-Step Cloud',
        spaceUrl: `${this.spaceId}/generation_wrapper`,
        stage: 'generation_wrapper',
        status: 200,
        contentType: 'application/json',
        responseTimeMs: Date.now() - genStartTime,
        errorBody: 'Result data array was empty or missing'
      });
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
      logCloudDiagnostic({
        provider: 'ACE-Step Cloud',
        spaceUrl: `${this.spaceId}/generation_wrapper`,
        stage: 'generation_wrapper',
        status: 200,
        contentType: 'application/json',
        responseTimeMs: Date.now() - genStartTime,
        errorBody: `Could not parse audio URL from items: ${JSON.stringify(result.data).slice(0, 200)}`
      });
      throw new Error('ACE_STEP_CLOUD_FAILED: Could not extract valid audio URL from Space output.');
    }

    // Stage 3: Audio Retrieval & Asset Validation
    onProgress?.('Verifying generated audio asset...', 90);
    const audioCheckStart = Date.now();

    if (finalAudioUrl.startsWith('http')) {
      try {
        const headCheck = await safeFetch(finalAudioUrl, { method: 'HEAD' }, 'audio_retrieval');
        const cType = headCheck.contentType.toLowerCase();
        if (cType.includes('text/html') || cType.includes('text/plain') || headCheck.status >= 400) {
          logCloudDiagnostic({
            provider: 'ACE-Step Cloud',
            spaceUrl: finalAudioUrl,
            stage: 'audio_retrieval',
            status: headCheck.status,
            contentType: cType,
            responseTimeMs: Date.now() - audioCheckStart,
            errorBody: 'Audio asset URL returned non-audio response'
          });
          throw new Error(`ACE_STEP_CLOUD_FAILED: Audio asset URL returned non-audio response (${cType || 'invalid content-type'})`);
        }
      } catch (audioErr: any) {
        if (audioErr.message?.startsWith('ACE_STEP_CLOUD_')) {
          throw audioErr;
        }
        console.warn('Audio URL HEAD check warning:', audioErr.message);
      }
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
  }
}

export const cloudProviderInstance = new AceStepCloudProvider();

