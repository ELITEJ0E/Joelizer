import { ACEStepGenerateOptions, ACEStepGenerationResult, EngineStatus } from './types';
import fs from 'fs';
import path from 'path';

export class AceStepLocalProvider {
  private endpoint: string;

  constructor() {
    this.endpoint = (process.env.ACE_STEP_URL || 'http://127.0.0.1:8001').trim().replace(/\/$/, '');
  }

  public setEndpoint(url: string) {
    this.endpoint = url.trim().replace(/\/$/, '');
  }

  public getEndpoint(): string {
    return this.endpoint;
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = process.env.ACE_STEP_API_KEY || process.env.ACE_STEP_TOKEN;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  public async checkHealth(): Promise<EngineStatus> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`${this.endpoint}/health`, {
        headers: this.getAuthHeaders(),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!res.ok) {
        return {
          connected: false,
          endpoint: this.endpoint,
          engineType: 'ace-step-local',
          modelLoaded: false,
          gpuAvailable: false,
          error: `Local server returned status ${res.status} on /health`
        };
      }

      const healthData = await res.json().catch(() => ({}));
      
      // Let's also check for available models on /v1/models
      let models: string[] = [];
      try {
        const modelsRes = await fetch(`${this.endpoint}/v1/models`, {
          headers: this.getAuthHeaders()
        });
        if (modelsRes.ok) {
          const modelsData = await modelsRes.json().catch(() => ({}));
          if (Array.isArray(modelsData)) {
            models = modelsData.map(m => typeof m === 'string' ? m : m?.id || m?.name).filter(Boolean);
          } else if (modelsData && Array.isArray(modelsData.data)) {
            models = modelsData.data.map((m: any) => m?.id || m?.name || m).filter(Boolean);
          } else if (modelsData && Array.isArray(modelsData.models)) {
            models = modelsData.models.map((m: any) => typeof m === 'string' ? m : m?.id || m?.name).filter(Boolean);
          } else if (modelsData && typeof modelsData === 'object') {
            const singleModel = modelsData.model || modelsData.id || modelsData.name;
            if (singleModel) models.push(String(singleModel));
          }
        }
      } catch (err: any) {
        console.warn('Failed to retrieve models during local health check:', err.message);
      }

      return {
        connected: true,
        endpoint: this.endpoint,
        engineType: 'ace-step-local',
        modelLoaded: models.length > 0 || healthData.modelLoaded || true,
        gpuAvailable: healthData.gpuAvailable ?? true,
        gpuDeviceName: healthData.gpuName || 'Local PyTorch CUDA Device',
        activeJobs: healthData.activeJobs || 0,
        version: healthData.version || 'ACE-Step v1.5 Local',
        models: models.length > 0 ? models : undefined
      };
    } catch (err: any) {
      return {
        connected: false,
        endpoint: this.endpoint,
        engineType: 'ace-step-local',
        modelLoaded: false,
        gpuAvailable: false,
        error: `ACE-Step Local is offline (endpoint not reachable at ${this.endpoint})`
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

    onProgress?.('Verifying connection to ACE-Step Local...', 10);

    // 1. Health check to confirm local server is alive and reachable
    const health = await this.checkHealth();
    if (!health.connected) {
      throw new Error(
        `ACE_STEP_LOCAL_OFFLINE: ACE-Step Local is offline (endpoint not reachable at ${this.endpoint}). Please ensure your local PyTorch ACE-Step runtime is active.`
      );
    }

    onProgress?.('Submitting prompt to Local ACE-Step DiT engine...', 25);

    try {
      // Choose model from options or from health check models list
      const chosenModel = options.model || (health.models && health.models[0]) || 'ACE-Step v1.5';

      // 2. Submit task via POST /release_task
      const releaseRes = await fetch(`${this.endpoint}/release_task`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          prompt: prompt.trim(),
          lyrics: isInstrumental ? '' : lyrics.trim(),
          duration: Number(duration),
          audio_duration: Number(duration),
          bpm: Number(bpm) || 0,
          key: keySignature || '',
          key_scale: keySignature || '',
          time_signature: timeSignature || '',
          vocal_language: vocalLanguage || 'unknown',
          is_instrumental: !!isInstrumental,
          isInstrumental: !!isInstrumental,
          model: chosenModel
        }),
        signal: abortSignal
      });

      if (!releaseRes.ok) {
        let errDetail = '';
        try {
          const errData = await releaseRes.json();
          errDetail = errData.error || errData.message || JSON.stringify(errData);
        } catch {
          errDetail = await releaseRes.text().catch(() => '');
        }
        throw new Error(
          `ACE_STEP_LOCAL_FAILED: /release_task returned HTTP ${releaseRes.status}${errDetail ? ` (${errDetail})` : ''}`
        );
      }

      const releaseData = await releaseRes.json();
      const taskId = releaseData.task_id || releaseData.taskId || releaseData.data?.task_id || releaseData.data?.taskId || releaseData.id;

      if (!taskId) {
        throw new Error('ACE_STEP_LOCAL_FAILED: /release_task did not return a valid task_id.');
      }

      onProgress?.('Music generation job queued and processing...', 40);

      // 3. Poll status via POST /query_result
      let isDone = false;
      let attempts = 0;
      const maxAttempts = 180; // 180 * 1.5s = 270s max timeout
      let returnedPath = '';
      let taskMeta: any = null;

      while (!isDone && attempts < maxAttempts) {
        if (abortSignal?.aborted) {
          throw new Error('Generation cancelled by user');
        }

        await new Promise(r => setTimeout(r, 1500));
        attempts++;

        const queryRes = await fetch(`${this.endpoint}/query_result`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({
            task_id: taskId,
            task_ids: [taskId]
          }),
          signal: abortSignal
        });

        if (!queryRes.ok) {
          console.warn(`Polling /query_result failed with status ${queryRes.status}. Retrying...`);
          continue;
        }

        const queryData = await queryRes.json();
        
        // Extract task result matching taskId defensively
        let taskResult: any = null;
        if (Array.isArray(queryData)) {
          taskResult = queryData.find((t: any) => t?.task_id === taskId || t?.taskId === taskId || t?.id === taskId);
        } else if (queryData && typeof queryData === 'object') {
          const resultsArr = queryData.results || queryData.data || queryData.tasks;
          if (Array.isArray(resultsArr)) {
            taskResult = resultsArr.find((t: any) => t?.task_id === taskId || t?.taskId === taskId || t?.id === taskId);
          } else if (queryData.task_id === taskId || queryData.taskId === taskId || queryData.id === taskId) {
            taskResult = queryData;
          } else if (queryData.status !== undefined) {
            taskResult = queryData;
          }
        }

        if (!taskResult) {
          continue;
        }

        // Parse status (1 = Success, 2 = Failed, others = Pending/Running)
        const status = Number(taskResult.status);

        if (status === 1) {
          isDone = true;
          returnedPath = taskResult.path || taskResult.audio_path || taskResult.file_path || taskResult.audio_url || taskResult.url || taskResult.source_url || '';
          taskMeta = taskResult.metas || taskResult.meta || null;
          if (!returnedPath) {
            throw new Error('ACE_STEP_LOCAL_FAILED: /query_result completed successfully but returned no audio path.');
          }
        } else if (status === 2) {
          isDone = true;
          const errMsg = taskResult.error || taskResult.message || 'Generation task failed inside ACE-Step Engine.';
          throw new Error(`ACE_STEP_LOCAL_FAILED: ${errMsg}`);
        } else {
          // Still processing
          const progressPct = Math.min(85, 40 + Math.floor((attempts / maxAttempts) * 45));
          onProgress?.('Generating studio-grade music stems...', progressPct);
        }
      }

      if (!isDone) {
        throw new Error('ACE_STEP_LOCAL_FAILED: Task polling timed out. Local engine may be overloaded.');
      }

      // 4. Download generated audio using GET /v1/audio?path=<path>
      onProgress?.('Retrieving completed music from local engine...', 88);
      const downloadUrl = `${this.endpoint}/v1/audio?path=${encodeURIComponent(returnedPath)}`;
      
      const audioRes = await fetch(downloadUrl, {
        headers: this.getAuthHeaders(),
        signal: abortSignal
      });

      if (!audioRes.ok) {
        throw new Error(`ACE_STEP_LOCAL_FAILED: Failed to download generated audio (status ${audioRes.status})`);
      }

      const arrayBuf = await audioRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      // 5. Real audio validation
      if (buffer.length < 1000) {
        throw new Error(`ACE_STEP_LOCAL_FAILED: Downloaded audio from engine is invalid or empty (${buffer.length} bytes)`);
      }

      // Infer audio format
      let format = 'mp3';
      if (returnedPath.toLowerCase().endsWith('.wav')) {
        format = 'wav';
      } else {
        const contentType = audioRes.headers.get('content-type');
        if (contentType?.includes('audio/wav') || contentType?.includes('audio/x-wav')) {
          format = 'wav';
        }
      }

      // 6. Save/cache the actual audio locally inside Joelizer's public folder
      const publicDir = path.join(process.cwd(), 'public');
      const generatedDir = path.join(publicDir, 'generated');
      if (!fs.existsSync(generatedDir)) {
        fs.mkdirSync(generatedDir, { recursive: true });
      }

      const fileName = `acestep-local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${format}`;
      const filePath = path.join(generatedDir, fileName);
      fs.writeFileSync(filePath, buffer);

      // Validate saved file size
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        throw new Error('ACE_STEP_LOCAL_FAILED: Saved local audio file size is 0 bytes.');
      }

      const webAudioUrl = `/generated/${fileName}`;
      onProgress?.('Local ACE-Step generation complete and validated!', 100);

      return {
        audioUrl: webAudioUrl,
        duration: Number(taskMeta?.duration || taskMeta?.audio_duration || duration),
        title: prompt.slice(0, 32).trim() || 'ACE-Step Local Track',
        engine: 'ace-step-local',
        provider: 'local',
        sourceUrl: webAudioUrl,
        format,
        generationId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      };

    } catch (err: any) {
      if (err.name === 'AbortError' || abortSignal?.aborted) {
        throw new Error('Generation cancelled by user');
      }
      if (err.message.startsWith('ACE_STEP_LOCAL_')) {
        throw err;
      }
      throw new Error(`ACE_STEP_LOCAL_FAILED: ${err.message || 'Failed to complete local ACE-Step 1.5 task workflow'}`);
    }
  }
}

export const localProviderInstance = new AceStepLocalProvider();

