import { GenerationJob, ACEStepGenerateOptions } from './types';
import { executeAceStepGeneration } from './client';

const jobs: Map<string, GenerationJob> = new Map();
const abortControllers: Map<string, AbortController> = new Map();

export function createGenerationJob(options: ACEStepGenerateOptions): GenerationJob {
  const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const controller = new AbortController();
  abortControllers.set(jobId, controller);

  const job: GenerationJob = {
    id: jobId,
    status: 'queued',
    stageMessage: 'Job queued in generation pipeline...',
    progress: 0,
    prompt: options.prompt,
    lyrics: options.lyrics,
    duration: options.duration || 30,
    bpm: options.bpm,
    key: options.keySignature,
    createdAt: Date.now(),
    model: options.model || 'ACE-Step v1.5',
    engine: 'hf_space'
  };

  jobs.set(jobId, job);

  // Kick off background job execution
  processJob(jobId, options, controller.signal).catch(err => {
    console.error(`Background generation error in job ${jobId}:`, err);
  });

  return job;
}

async function processJob(jobId: string, options: ACEStepGenerateOptions, abortSignal: AbortSignal) {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = 'generating';
  job.stageMessage = 'Starting ACE-Step neural synthesis...';
  job.progress = 10;

  try {
    const result = await executeAceStepGeneration(
      {
        ...options,
        onProgress: (stage, pct) => {
          if (jobs.has(jobId)) {
            const j = jobs.get(jobId)!;
            if (j.status !== 'cancelled') {
              j.stageMessage = stage;
              j.progress = pct;
            }
          }
        }
      },
      abortSignal
    );

    if (abortSignal.aborted) {
      job.status = 'cancelled';
      job.stageMessage = 'Generation cancelled by user.';
      return;
    }

    job.status = 'completed';
    job.stageMessage = 'Generation completed successfully!';
    job.progress = 100;
    job.audioUrl = result.audioUrl;
    job.duration = result.duration;
    job.engine = result.engine;
    job.completedAt = Date.now();
  } catch (err: any) {
    if (abortSignal.aborted) {
      job.status = 'cancelled';
      job.stageMessage = 'Generation cancelled.';
      return;
    }

    job.status = 'failed';
    job.stageMessage = 'Generation failed';
    job.error = err.message || 'Unknown error occurred during AI generation';
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
