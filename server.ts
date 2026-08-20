import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import multer from 'multer';
import OpenAI from 'openai';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';

// Point fluent-ffmpeg at the statically bundled ffmpeg binary
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath as unknown as string);
}

// DeepInfra's transcription upload limit configuration
const DEEPINFRA_MAX_UPLOAD_BYTES = 24 * 1024 * 1024;
const CHUNK_DURATION_SECONDS = 40 * 60;

// Helper function to generate UUID v4 for transcription IDs
const generateUUID = (): string => {
  return crypto.randomUUID();
};

// Maps language options exposed in the UI to ISO-639-1 codes
const LANGUAGE_CODE_MAP: Record<string, string> = {
  English: 'en',
  Spanish: 'es',
  French: 'fr',
  German: 'de',
  Japanese: 'ja',
  Arabic: 'ar',
  Chinese: 'zh',
};

// Helper to instantiate Supabase client on server
const getSupabaseServerClient = () => {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }
  return createClient(supabaseUrl, supabaseKey);
};

const isValidUuid = (value?: string): boolean => {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
};

// Monthly transcription caps
const FREE_MONTHLY_TRANSCRIPTION_LIMIT = 5;
const PREMIUM_MONTHLY_TRANSCRIPTION_LIMIT = 90;

const currentPeriod = () => {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
};

const verifyRequestUser = async (req: express.Request) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
};

const checkAndIncrementUsageCap = async (userId: string) => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { allowed: true, limit: 0, used: 0 };

  let isPremium = false;
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_premium')
      .eq('id', userId)
      .maybeSingle();
    isPremium = Boolean(profile?.is_premium);
  } catch {}

  const period = currentPeriod();

  try {
    const { data, error } = await supabase.rpc(
      'check_and_increment_transcription_usage',
      {
        user_id: userId,
        period_string: period,
        is_premium: isPremium,
      }
    );

    if (error || !data?.[0]) {
      console.error('[UsageCap] Error checking usage:', error);
      return { allowed: false, limit: 0, used: 0 };
    }

    const result = data[0];
    return {
      allowed: result.allowed,
      limit: result.limit_count,
      used: result.used_count,
    };
  } catch (e) {
    console.error('[UsageCap] Exception checking usage:', e);
    return { allowed: false, limit: 0, used: 0 };
  }
};

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure Multer for up to 100MB file uploads
const upload = multer({
  dest: uploadsDir,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

async function startServer() {
  const app = express();

  const withTimeout = async <T>(
    promise: Promise<T>,
    timeoutMs: number = 30000,
    operationName: string = 'Operation'
  ): Promise<T> => {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    );
    return Promise.race([promise, timeoutPromise]);
  };

  const withRetry = async <T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    delayMs: number = 1000,
    operationName: string = 'Operation'
  ): Promise<T> => {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`[${operationName}] Attempt ${attempt}/${maxAttempts}`);
        return await fn();
      } catch (err: any) {
        lastError = err;
        console.warn(`[${operationName}] Attempt ${attempt} failed:`, err.message);

        if (attempt < maxAttempts) {
          const delay = delayMs * Math.pow(2, attempt - 1);
          console.log(`[${operationName}] Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error(`${operationName} failed after ${maxAttempts} attempts`);
  };

  app.use(
    express.json({
      limit: '10mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  const verifyPaddleSignature = (req: any): boolean => {
    const secret = process.env.PADDLE_NOTIFICATION_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[CRITICAL] PADDLE_NOTIFICATION_WEBHOOK_SECRET not set. Webhooks will be rejected.');
      return false;
    }

    const signatureHeader = req.headers['paddle-signature'];
    if (!signatureHeader || !req.rawBody) {
      console.warn('[Paddle Webhook] Missing signature header or raw body');
      return false;
    }

    const parts = Object.fromEntries(
      String(signatureHeader)
        .split(';')
        .filter(Boolean)
        .map((p) => {
          const [key, value] = p.split('=');
          return [key?.trim(), value?.trim()];
        })
    );

    const ts = parts.ts ? parseInt(parts.ts) : null;
    const h1 = parts.h1;

    if (!ts || !h1) {
      console.warn('[Paddle Webhook] Invalid signature format');
      return false;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const ageDifference = Math.abs(nowSeconds - ts);
    const maxAgeSeconds = 300;

    if (ageDifference > maxAgeSeconds) {
      console.warn(`[Paddle Webhook] Timestamp too old: ${ageDifference} seconds.`);
      return false;
    }

    const rawBodyStr = req.rawBody.toString('utf8');
    const signedPayload = `${ts}:${rawBodyStr}`;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    try {
      const result = crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(h1, 'hex')
      );
      if (result) {
        console.log('[Paddle Webhook] ✓ Signature verified successfully');
      }
      return result;
    } catch (e) {
      console.warn('[Paddle Webhook] Signature verification failed');
      return false;
    }
  };

  // Instantiate DeepInfra client via OpenAI SDK
  const getDeepInfraClient = () => {
    const apiKey = process.env.DEEPINFRA_API_KEY;
    if (!apiKey) {
      throw new Error('DeepInfra API key is not configured');
    }
    return new OpenAI({
      apiKey,
      baseURL: 'https://api.deepinfra.com/v1/openai',
    });
  };

  const runFfmpeg = (configure: (cmd: ffmpeg.FfmpegCommand) => void): Promise<void> => {
    return new Promise((resolve, reject) => {
      const command = ffmpeg();
      configure(command);
      command
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .run();
    });
  };

  const extractCompressedAudio = async (inputPath: string, outputPath: string): Promise<void> => {
    await runFfmpeg((cmd) => {
      cmd
        .input(inputPath)
        .noVideo()
        .audioChannels(1)
        .audioFrequency(16000)
        .audioBitrate('64k')
        .audioCodec('libmp3lame')
        .format('mp3')
        .output(outputPath);
    });
  };

  const splitAudioIntoChunks = async (inputPath: string, outDir: string): Promise<string[]> => {
    const pattern = path.join(outDir, 'chunk_%03d.mp3');
    await runFfmpeg((cmd) => {
      cmd
        .input(inputPath)
        .outputOptions([
          '-f',
          'segment',
          '-segment_time',
          String(CHUNK_DURATION_SECONDS),
          '-reset_timestamps',
          '1',
          '-c',
          'copy',
        ])
        .output(pattern);
    });

    return fs
      .readdirSync(outDir)
      .filter((f) => f.startsWith('chunk_') && f.endsWith('.mp3'))
      .sort()
      .map((f) => path.join(outDir, f));
  };

  // Transcribe single audio chunk with DeepInfra Whisper V3 Turbo
  const transcribeChunkWithDeepInfra = async (
    openai: OpenAI,
    filePath: string,
    language: string
  ): Promise<{ text: string; duration: number; segments: Array<{ start: number; end: number; text: string }> }> => {
    const langCode = LANGUAGE_CODE_MAP[language];

    return withRetry(
      async () => {
        const response: any = await withTimeout(
          openai.audio.transcriptions.create({
            // Add "toFile" around your stream so DeepInfra reads the form data properly
            file: await OpenAI.toFile(fs.createReadStream(filePath), path.basename(filePath)),
            model: 'openai/whisper-large-v3-turbo',
            response_format: 'verbose_json',
            timestamp_granularities: ['segment'],
            ...(langCode ? { language: langCode } : {}),
          } as any),
          40000,
          'DeepInfra transcription'
        );

        const segments = (response.segments || []).map((seg: any) => ({
          start: typeof seg.start === 'number' ? seg.start : 0,
          end: typeof seg.end === 'number' ? seg.end : 0,
          text: (seg.text || '').trim(),
        }));

        return {
          text: (response.text || '').trim(),
          duration: typeof response.duration === 'number' ? response.duration : 0,
          segments,
        };
      },
      3,
      1000,
      `DeepInfra transcription for file ${path.basename(filePath)}`
    );
  };

  // Speaker diarization and executive summary via DeepInfra Llama 3.1 8B Instruct
  const generateSpeakersAndSummary = async (
    openai: OpenAI,
    segments: Array<{ startTime: number; endTime: number; text: string }>,
    detectedLanguage: string
  ): Promise<{
    speakers: string[];
    summary: { overview: string; keyPoints: string[]; actionItems: string[]; keywords: string[] };
  }> => {
    const fallback = {
      speakers: segments.map(() => 'Speaker 1'),
      summary: {
        overview: 'Transcription complete.',
        keyPoints: [],
        actionItems: [],
        keywords: [],
      },
    };

    if (segments.length === 0) return fallback;

    try {
      const transcriptForPrompt = segments
        .map((seg, idx) => `[${idx}] (${seg.startTime.toFixed(1)}s-${seg.endTime.toFixed(1)}s) ${seg.text}`)
        .join('\n');

      const completion = await withTimeout(
        withRetry(
          async () =>
            openai.chat.completions.create({
              model: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
              temperature: 0.2,
              response_format: { type: 'json_object' },
              messages: [
                {
                  role: 'system',
                  content:
                    'You are ScribeSwift, a world-class transcript analyst. You infer speaker turns from context and produce concise executive summaries. Always respond with strict JSON only, matching the requested schema exactly.',
                },
                {
                  role: 'user',
                  content: `The transcript below (language: ${detectedLanguage}) is a numbered list of timestamped segments from a single audio/video recording. Segments are in chronological order and indices are 0-based and contiguous.

Tasks:
1. Infer who is speaking in each segment based on context, turn-taking, and any self-identification in the speech. Label speakers generically as "Speaker 1", "Speaker 2", etc., unless a speaker's real name is clearly stated.
2. Write an executive summary of the whole recording.

Transcript segments:
${transcriptForPrompt}

Respond with ONLY this JSON shape, no other text:
{
  "speakers": ["<label for segment 0>", "<label for segment 1>", ...],
  "summary": {
    "overview": "<2-4 sentence narrative overview>",
    "keyPoints": ["<key point>", ...],
    "actionItems": ["<action item, decision, or follow-up>", ...],
    "keywords": ["<topic keyword>", ...]
  }
}

The "speakers" array MUST have exactly ${segments.length} entries, one per segment index, in order.`,
                },
              ],
            }),
          2,
          500,
          'Speaker/summary generation'
        ),
        20000,
        'Speaker/summary generation'
      );

      const raw = completion.choices?.[0]?.message?.content;
      if (!raw) {
        console.warn('[ScribeSwift] No response from speaker/summary generation, using fallback');
        return fallback;
      }

      const parsed = JSON.parse(raw);
      const speakers: string[] = Array.isArray(parsed.speakers) ? parsed.speakers : [];

      return {
        speakers:
          speakers.length === segments.length
            ? speakers.map((s) => (typeof s === 'string' && s.trim() ? s.trim() : 'Speaker 1'))
            : fallback.speakers,
        summary: {
          overview: parsed.summary?.overview || fallback.summary.overview,
          keyPoints: Array.isArray(parsed.summary?.keyPoints) ? parsed.summary.keyPoints : [],
          actionItems: Array.isArray(parsed.summary?.actionItems) ? parsed.summary.actionItems : [],
          keywords: Array.isArray(parsed.summary?.keywords) ? parsed.summary.keywords : [],
        },
      };
    } catch (err) {
      console.error('[ScribeSwift] Speaker/summary generation failed, using fallback:', err);
      return fallback;
    }
  };

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', maxUploadSizeMb: 100, service: 'ScribeSwift API' });
  });

  // Paddle Webhook Info Endpoint
  app.get('/api/webhooks/paddle', (req, res) => {
    res.json({
      status: 'active',
      endpoint: '/api/webhooks/paddle',
      description: 'Listens for subscription events to update Supabase profiles.is_premium.',
    });
  });

  // Paddle Billing Webhook Handler
  app.post('/api/webhooks/paddle', async (req, res) => {
    try {
      if (!verifyPaddleSignature(req)) {
        console.warn('[Paddle Webhook] Rejected request with invalid or missing signature.');
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      const payload = req.body || {};
      const eventType = payload.event_type || payload.alert_name || payload.event_name || 'unknown';
      console.log(`[Paddle Webhook] Received event: ${eventType}`);

      const data = payload.data || payload;
      const customData =
        data.custom_data ||
        payload.custom_data ||
        (payload.passthrough
          ? typeof payload.passthrough === 'string'
            ? JSON.parse(payload.passthrough)
            : payload.passthrough
          : {});

      const userId =
        customData.userId ||
        customData.user_id ||
        data.userId ||
        data.user_id ||
        payload.userId;

      if (!userId) {
        return res.json({ status: 'ok', warning: 'No userId found in webhook payload' });
      }

      if (!isValidUuid(userId)) {
        return res.status(400).json({ error: 'Invalid userId format: expected a Supabase auth UUID.' });
      }

      const supabaseServer = getSupabaseServerClient();
      if (!supabaseServer) {
        return res.json({ status: 'ok', warning: 'Supabase credentials missing on server' });
      }

      let isPremium = false;
      const activeEvents = [
        'subscription.created',
        'subscription.updated',
        'subscription_created',
        'subscription_updated',
        'transaction.completed',
        'payment_succeeded',
      ];
      const cancelEvents = [
        'subscription.canceled',
        'subscription.cancelled',
        'subscription_canceled',
        'subscription.paused',
        'subscription_paused',
      ];

      if (activeEvents.includes(eventType)) {
        isPremium = true;
      } else if (cancelEvents.includes(eventType)) {
        isPremium = false;
      } else {
        const status = data.status || payload.status;
        if (status === 'active' || status === 'trailing') {
          isPremium = true;
        }
      }

      const { error } = await supabaseServer
        .from('profiles')
        .upsert(
          {
            id: userId,
            is_premium: isPremium,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

      if (error) {
        console.error('[Paddle Webhook] Error updating profiles in Supabase:', error.message);
        return res.status(500).json({ error: error.message });
      }

      return res.json({
        status: 'success',
        userId,
        is_premium: isPremium,
        eventType,
      });
    } catch (err: any) {
      console.error('[Paddle Webhook Error]:', err);
      return res.status(500).json({ error: err.message || 'Webhook processing failed' });
    }
  });

  // Sample Transcriptions
  app.get('/api/sample-transcription', (req, res) => {
    const sampleType = (req.query.type as string) || 'keynote';
    if (sampleType === 'podcast') {
      return res.json({
        id: generateUUID(),
        title: 'Tech Talk Daily - AI Innovations in 2026',
        fileName: 'tech_talk_daily_ep42.mp3',
        fileSize: 18450000,
        fileType: 'audio/mp3',
        durationSeconds: 194,
        fullText:
          "Welcome back to Tech Talk Daily! Today we're diving deep into the massive shifts in artificial intelligence...",
        language: 'English (US)',
        segments: [],
        summary: {
          overview: 'A discussion on recent breakthroughs in multimodal AI...',
          keyPoints: ['Transition from pure text models to multimodal native processing'],
          actionItems: ['Explore multi-speaker diarization for podcast audio'],
          keywords: ['AI Innovations', 'Multimodal', 'Transcription Engine'],
        },
        createdAt: new Date().toISOString(),
      });
    }

    res.json({
      id: generateUUID(),
      title: 'ScribeSwift Product Launch Keynote',
      fileName: 'scribeswift_launch_presentation.mp4',
      fileSize: 48200000,
      fileType: 'video/mp4',
      durationSeconds: 240,
      fullText:
        "Good morning everyone! Today, we are thrilled to introduce the newly upgraded ScribeSwift engine...",
      language: 'English (US)',
      segments: [],
      summary: {
        overview: 'Announcement of ScribeSwift major upgrades...',
        keyPoints: ['Upgraded file size cap from 20MB to 100MB'],
        actionItems: ['Upgrade file pipeline to handle large binaries'],
        keywords: ['ScribeSwift', '100MB Uploads', 'Transcription'],
      },
      createdAt: new Date().toISOString(),
    });
  });

  // Main Transcription Route
  app.post('/api/transcribe', upload.single('file'), async (req, res) => {
    let tempFilePath: string | null = null;
    let workDir: string | null = null;

    try {
      if (!process.env.DEEPINFRA_API_KEY) {
        return res.status(500).json({ error: 'DeepInfra API key is not configured' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No media file uploaded. Please select an audio or video file up to 100MB.' });
      }

      tempFilePath = req.file.path;
      const fileSizeMb = (req.file.size / (1024 * 1024)).toFixed(2);
      console.log(`[ScribeSwift] Received file: ${req.file.originalname} (${fileSizeMb} MB, type: ${req.file.mimetype})`);

      if (req.file.size > 100 * 1024 * 1024) {
        return res.status(400).json({ error: 'File size exceeds maximum allowed capacity of 100MB.' });
      }

      let authedUserId = null;
      if (getSupabaseServerClient()) {
        authedUserId = await verifyRequestUser(req);
        if (!authedUserId) {
          return res.status(401).json({ error: 'Please sign in to transcribe files.' });
        }
        const usageCap = await checkAndIncrementUsageCap(authedUserId);
        if (!usageCap.allowed) {
          return res.status(429).json({
            error: `You've reached your monthly transcription limit (${usageCap.used}/${usageCap.limit}). Upgrade to Premium for a higher limit, or try again next month.`,
          });
        }
      }

      const openai = getDeepInfraClient();
      const targetLanguage = (req.body.language as string) || 'Auto-detect';

      workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scribeswift-'));
      const compressedAudioPath = path.join(workDir, 'audio.mp3');

      console.log('[ScribeSwift] Extracting & compressing audio track with ffmpeg...');
      await extractCompressedAudio(tempFilePath, compressedAudioPath);

      const compressedSize = fs.statSync(compressedAudioPath).size;
      console.log(`[ScribeSwift] Compressed audio size: ${(compressedSize / (1024 * 1024)).toFixed(2)} MB`);

      let chunkPaths: string[];
      if (compressedSize <= DEEPINFRA_MAX_UPLOAD_BYTES) {
        chunkPaths = [compressedAudioPath];
      } else {
        console.log('[ScribeSwift] Audio exceeds single-request limit, splitting into chunks...');
        const chunkDir = path.join(workDir, 'chunks');
        fs.mkdirSync(chunkDir, { recursive: true });
        chunkPaths = await splitAudioIntoChunks(compressedAudioPath, chunkDir);
        console.log(`[ScribeSwift] Split into ${chunkPaths.length} chunk(s).`);
      }

      let cumulativeOffset = 0;
      let fullText = '';
      let detectedLanguage = targetLanguage;
      const rawSegments: Array<{ startTime: number; endTime: number; text: string }> = [];

      for (let i = 0; i < chunkPaths.length; i++) {
        console.log(`[ScribeSwift] Transcribing chunk ${i + 1}/${chunkPaths.length} with openai/whisper-large-v3-turbo...`);
        const result = await transcribeChunkWithDeepInfra(openai, chunkPaths[i], targetLanguage);

        for (const seg of result.segments) {
          rawSegments.push({
            startTime: cumulativeOffset + seg.start,
            endTime: cumulativeOffset + seg.end,
            text: seg.text,
          });
        }

        fullText += (fullText ? ' ' : '') + result.text;
        cumulativeOffset += result.duration || CHUNK_DURATION_SECONDS;
      }

      const durationSeconds = rawSegments.length
        ? rawSegments[rawSegments.length - 1].endTime
        : cumulativeOffset;

      if (targetLanguage === 'Auto-detect') {
        detectedLanguage = 'Auto-detected';
      }

      console.log('[ScribeSwift] Generating speaker labels & executive summary with DeepInfra LLM...');
      const { speakers, summary } = await generateSpeakersAndSummary(openai, rawSegments, detectedLanguage);

      const formatTimestamp = (seconds: number): string => {
        const total = Math.max(0, Math.floor(seconds));
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        const mm = String(m).padStart(2, '0');
        const ss = String(s).padStart(2, '0');
        return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
      };

      const formattedSegments = rawSegments.map((seg, idx) => ({
        id: generateUUID(),
        startTime: seg.startTime,
        endTime: seg.endTime,
        timestamp: formatTimestamp(seg.startTime),
        speaker: speakers[idx] || 'Speaker 1',
        text: seg.text,
      }));

      const transcriptionResult = {
        id: generateUUID(),
        title: req.file.originalname.replace(/\.[^/.]+$/, ''),
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        durationSeconds: durationSeconds || 0,
        fullText: fullText || '',
        language: detectedLanguage,
        segments: formattedSegments,
        summary,
        createdAt: new Date().toISOString(),
      };

      res.json(transcriptionResult);
    } catch (err: any) {
      console.error('[ScribeSwift Error]:', err);
      res.status(500).json({
        error: err.message || 'Failed to process audio/video file with DeepInfra Whisper API.',
      });
    } finally {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          console.log('[ScribeSwift] Cleaned up temp upload file.');
        } catch (e) {
          console.error('Failed to unlink temp file:', e);
        }
      }
      if (workDir && fs.existsSync(workDir)) {
        try {
          fs.rmSync(workDir, { recursive: true, force: true });
          console.log('[ScribeSwift] Cleaned up audio scratch directory.');
        } catch (e) {
          console.error('Failed to clean up scratch directory:', e);
        }
      }
    }
  });

  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err && err.name === 'MulterError') {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'File size exceeds the maximum allowed capacity of 100MB.'
          : `Upload error: ${err.message}`;
      console.error('[ScribeSwift] Multer error:', err.code, err.message);
      return res.status(400).json({ error: message });
    }
    console.error('[ScribeSwift] Unhandled server error:', err);
    return res.status(500).json({ error: err?.message || 'Unexpected server error.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = process.env.PORT || 3000;

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ScribeSwift Server] Listening on port ${PORT}`);
  });
}

startServer();
