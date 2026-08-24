import { GenerationJob, ACEStepGenerateOptions, ACEEngineId, ACEProviderName } from './types';
import { localProviderInstance } from './localProvider';
import { cloudProviderInstance } from './cloudProvider';

const jobs: Map<string, GenerationJob> = new Map();
const abortControllers: Map<string, AbortController> = new Map();

export function createGenerationJob(options: ACEStepGenerateOptions): GenerationJob {
  const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const controller = new AbortController();
  abortControllers.set(jobId, controller);

  const selectedEngine: ACEEngineId = options.engine === 'ace-step-local' ? 'ace-step-local' : 'ace-step-cloud';
  const providerName: ACEProviderName = selectedEngine === 'ace-step-local' ? 'local' : 'huggingface';

  const job: GenerationJob = {
    id: jobId,
    status: 'queued',
    stageMessage: `Queued for ${selectedEngine === 'ace-step-local' ? 'ACE-Step Local' : 'ACE-Step Cloud (Hugging Face)'}...`,
    progress: 0,
    prompt: options.prompt,
    lyrics: options.lyrics,
    duration: options.duration || 30,
    bpm: options.bpm,
    key: options.keySignature,
    createdAt: Date.now(),
    model: options.model || 'ACE-Step v1.5',
    engine: selectedEngine,
    provider: providerName
  };

  jobs.set(jobId, job);

  // Process asynchronously without blocking HTTP response
  processJob(jobId, options, controller.signal).catch(err => {
    console.error(`Generation job ${jobId} failed:`, err);
  });

  return job;
}

async function processJob(jobId: string, options: ACEStepGenerateOptions, abortSignal: AbortSignal) {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = 'generating';
  const engineName = job.engine === 'ace-step-local' ? 'ACE-Step Local' : 'ACE-Step Cloud (Hugging Face)';
  job.stageMessage = `Connecting to ${engineName}...`;
  job.progress = 5;

  const onProgress = (stage: string, percentage: number) => {
    if (jobs.has(jobId)) {
      const current = jobs.get(jobId)!;
      if (current.status !== 'cancelled' && current.status !== 'failed') {
        current.stageMessage = stage;
        current.progress = percentage;
      }
    }
  };

  try {
    let result;

    if (job.engine === 'ace-step-local') {
      // EXPLICIT LOCAL ONLY - NO FALLBACK TO CLOUD OR SYNTH
      result = await localProviderInstance.generate({ ...options, onProgress }, abortSignal);
    } else {
      // EXPLICIT CLOUD ONLY - NO FALLBACK TO LOCAL OR SYNTH
      result = await cloudProviderInstance.generate({ ...options, onProgress }, abortSignal);
    }

    if (abortSignal.aborted) {
      job.status = 'cancelled';
      job.stageMessage = 'Generation cancelled by user.';
      return;
    }

    // Strict validation of returned asset
    if (!result.audioUrl || typeof result.audioUrl !== 'string') {
      throw new Error('Generation returned no valid audio URL.');
    }

    job.status = 'completed';
    job.stageMessage = `Generated with: ${job.engine === 'ace-step-local' ? 'ACE-Step Local' : 'ACE-Step Cloud'}`;
    job.progress = 100;
    job.audioUrl = result.audioUrl;
    job.sourceUrl = result.sourceUrl;
    job.duration = result.duration;
    job.engine = result.engine;
    job.provider = result.provider;
    job.format = result.format;
    job.completedAt = Date.now();
  } catch (err: any) {
    if (abortSignal.aborted) {
      job.status = 'cancelled';
      job.stageMessage = 'Generation cancelled.';
      return;
    }

    job.status = 'failed';
    const rawMsg = err?.message || String(err);
    job.stageMessage = 'Generation failed';
    job.error = rawMsg;
    
    // Extract error code if present
    if (rawMsg.startsWith('ACE_STEP_')) {
      const parts = rawMsg.split(':');
      job.errorCode = parts[0].trim();
      job.error = parts.slice(1).join(':').trim() || rawMsg;
    }
  } finally {
    abortControllers.delete(jobId);
  }
}

export function getGenerationJob(jobId: string): GenerationJob | undefined {
  return jobs.get(jobId);
}

export function cancelGenerationJob(jobId: string): boolean {
  const controller = abortControllers.get(jobId);
  if (controller) {
    controller.abort();
    abortControllers.delete(jobId);
  }

  const job = jobs.get(jobId);
  if (job && (job.status === 'queued' || job.status === 'generating' || job.status === 'preparing')) {
    job.status = 'cancelled';
    job.stageMessage = 'Job cancelled by user';
    return true;
  }
  return false;
}

export function getAllGenerationJobs(): GenerationJob[] {
  return Array.from(jobs.values()).sort((a, b) => b.createdAt - a.createdAt);
}
