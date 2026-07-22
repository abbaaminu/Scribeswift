import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import multer from 'multer';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';

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

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure Multer for up to 100MB file uploads
const upload = multer({
  dest: uploadsDir,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Shared Gemini Client
  const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured.');
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
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
      description: 'Listens for subscription.created, subscription.updated, and subscription.canceled Paddle events to update Supabase profiles.is_premium.',
    });
  });

  // Paddle Billing Webhook Handler
  app.post('/api/webhooks/paddle', async (req, res) => {
    try {
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
        console.warn('[Paddle Webhook] No userId found in webhook payload customData. Payload:', JSON.stringify(payload));
        return res.json({ status: 'ok', warning: 'No userId found in webhook payload' });
      }

      const supabaseServer = getSupabaseServerClient();
      if (!supabaseServer) {
        console.warn('[Paddle Webhook] Supabase credentials missing on server. Unable to update profiles table.');
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
        // Fallback status check
        const status = data.status || payload.status;
        if (status === 'active' || status === 'trailing') {
          isPremium = true;
        }
      }

      console.log(`[Paddle Webhook] Updating user ${userId} -> is_premium: ${isPremium} (event: ${eventType})`);

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

  // Sample Transcriptions for Instant Demo Testing
  app.get('/api/sample-transcription', (req, res) => {
    const sampleType = (req.query.type as string) || 'keynote';
    if (sampleType === 'podcast') {
      return res.json({
        id: 'sample-podcast-001',
        title: 'Tech Talk Daily - AI Innovations in 2026',
        fileName: 'tech_talk_daily_ep42.mp3',
        fileSize: 18450000,
        fileType: 'audio/mp3',
        durationSeconds: 194,
        fullText:
          "Welcome back to Tech Talk Daily! Today we're diving deep into the massive shifts in artificial intelligence, multimodal models, and how on-device acceleration is reshaping software engineering. I'm your host Alex, and today with me is Dr. Elena Rostova, lead AI Researcher. Dr. Elena, welcome! Thanks Alex, excited to be here. The jump from standard text models to native real-time audio and video processing has been remarkable. We are now seeing real-time transcription, translation, and structured extraction in milliseconds instead of minutes.",
        language: 'English (US)',
        segments: [
          {
            id: 'seg-1',
            startTime: 0,
            endTime: 12,
            timestamp: '00:00',
            speaker: 'Alex (Host)',
            text: "Welcome back to Tech Talk Daily! Today we're diving deep into the massive shifts in artificial intelligence, multimodal models, and how on-device acceleration is reshaping software engineering.",
          },
          {
            id: 'seg-2',
            startTime: 12,
            endTime: 22,
            timestamp: '00:12',
            speaker: 'Alex (Host)',
            text: "I'm your host Alex, and today with me is Dr. Elena Rostova, lead AI Researcher. Dr. Elena, welcome to the show!",
          },
          {
            id: 'seg-3',
            startTime: 22,
            endTime: 38,
            timestamp: '00:22',
            speaker: 'Dr. Elena Rostova',
            text: 'Thanks Alex, excited to be here. The jump from standard text models to native real-time audio and video processing has been remarkable.',
          },
          {
            id: 'seg-4',
            startTime: 38,
            endTime: 65,
            timestamp: '00:38',
            speaker: 'Dr. Elena Rostova',
            text: 'We are now seeing real-time transcription, translation, and structured extraction in milliseconds instead of minutes, empowering applications to process up to 100MB media files effortlessly.',
          },
        ],
        summary: {
          overview:
            'A discussion on recent breakthroughs in multimodal AI, native audio/video processing capabilities, and how scaling file upload thresholds to 100MB unlocks rich meeting and podcast transcriptions.',
          keyPoints: [
            'Transition from pure text models to multimodal native processing',
            'Latency reduced to milliseconds for real-time transcription',
            'Support for large media file processing up to 100MB with Gemini File API',
          ],
          actionItems: [
            'Explore multi-speaker diarization for podcast audio',
            'Benchmark transcription accuracy across non-English accents',
          ],
          keywords: ['AI Innovations', 'Multimodal', '100MB Uploads', 'Real-time', 'Gemini File API'],
        },
        createdAt: new Date().toISOString(),
      });
    }

    // Default Keynote Sample
    res.json({
      id: 'sample-keynote-002',
      title: 'ScribeSwift Product Launch Keynote',
      fileName: 'scribeswift_launch_presentation.mp4',
      fileSize: 48200000,
      fileType: 'video/mp4',
      durationSeconds: 240,
      fullText:
        "Good morning everyone! Today, we are thrilled to introduce the newly upgraded ScribeSwift engine. We heard your feedback loud and clear: 20MB limits were not enough for high-definition video files, webinars, and full podcast episodes. Today, we are officially boosting file upload capacity up to 100MB powered directly by the Google AI Studio File API. With ScribeSwift, you can now upload full video lectures, multi-hour meetings, and high-fidelity audio tracks without tedious compression. Plus, our tier system gives free users full transcription access while Premium members unlock unlimited exports, copy-paste capabilities, and print-ready formatting for just $1 per month.",
      language: 'English (US)',
      segments: [
        {
          id: 'k-1',
          startTime: 0,
          endTime: 15,
          timestamp: '00:00',
          speaker: 'Presenter',
          text: 'Good morning everyone! Today, we are thrilled to introduce the newly upgraded ScribeSwift engine.',
        },
        {
          id: 'k-2',
          startTime: 15,
          endTime: 35,
          timestamp: '00:15',
          speaker: 'Presenter',
          text: 'We heard your feedback loud and clear: 20MB limits were not enough for high-definition video files, webinars, and full podcast episodes.',
        },
        {
          id: 'k-3',
          startTime: 35,
          endTime: 60,
          timestamp: '00:35',
          speaker: 'Presenter',
          text: 'Today, we are officially boosting file upload capacity up to 100MB powered directly by the Google AI Studio File API.',
        },
        {
          id: 'k-4',
          startTime: 60,
          endTime: 95,
          timestamp: '01:00',
          speaker: 'Presenter',
          text: 'With ScribeSwift, you can now upload full video lectures, multi-hour meetings, and high-fidelity audio tracks without tedious compression.',
        },
        {
          id: 'k-5',
          startTime: 95,
          endTime: 130,
          timestamp: '01:35',
          speaker: 'Presenter',
          text: 'Plus, our tier system gives free users full transcription access while Premium members unlock unlimited exports, copy-paste capabilities, and print-ready formatting for just $1 per month.',
        },
      ],
      summary: {
        overview:
          'Announcement of ScribeSwift major upgrades: 100MB File API integration for large audio and video uploads, alongside the $1/month Premium tier for full export rights.',
        keyPoints: [
          'Upgraded file size cap from 20MB to 100MB',
          'Integration with Google AI Studio File API (ai.files.upload)',
          'Asynchronous processing with live progress status',
          'Free Tier with transcription preview & $1/mo Premium with full copy/export rights',
        ],
        actionItems: [
          'Upgrade file pipeline to handle large 100MB audio/video binaries',
          'Implement client-side protection against unauthorized highlighting on Free Tier',
          'Add $1/month payment checkout flow with instant state unlock',
        ],
        keywords: ['ScribeSwift', '100MB File API', 'Transcription', 'Premium Tier', 'Export Features'],
      },
      createdAt: new Date().toISOString(),
    });
  });

  // Main Audio/Video Transcription Route via Google AI Studio File API
  app.post('/api/transcribe', upload.single('file'), async (req, res) => {
    let tempFilePath: string | null = null;
    let uploadedFileRef: any = null;

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No media file uploaded. Please select an audio or video file up to 100MB.' });
      }

      tempFilePath = req.file.path;
      const fileSizeMb = (req.file.size / (1024 * 1024)).toFixed(2);
      console.log(`[ScribeSwift] Received file: ${req.file.originalname} (${fileSizeMb} MB, type: ${req.file.mimetype})`);

      if (req.file.size > 100 * 1024 * 1024) {
        return res.status(400).json({ error: 'File size exceeds maximum allowed capacity of 100MB.' });
      }

      const ai = getGeminiClient();

      // Step 1: Upload to Google AI Studio File API
      console.log('[ScribeSwift] Uploading to Google AI Studio File API...');
      uploadedFileRef = await ai.files.upload({
        file: tempFilePath,
        config: {
          mimeType: req.file.mimetype || 'audio/mp3',
          displayName: req.file.originalname,
        },
      });

      console.log(`[ScribeSwift] File uploaded to AI Studio File API. URI: ${uploadedFileRef.uri}, Name: ${uploadedFileRef.name}`);

      // Step 2: Poll file status until ACTIVE if necessary
      let fileState = await ai.files.get({ name: uploadedFileRef.name });
      let attempts = 0;
      while (fileState.state === 'PROCESSING' && attempts < 30) {
        console.log(`[ScribeSwift] File processing in AI Studio... attempt ${attempts + 1}`);
        await new Promise((r) => setTimeout(r, 2000));
        fileState = await ai.files.get({ name: uploadedFileRef.name });
        attempts++;
      }

      if (fileState.state === 'FAILED') {
        throw new Error('File processing failed on Google AI Studio File API.');
      }

      // Step 3: Run Gemini Model (gemini-3.6-flash) on the uploaded File URI
      const targetLanguage = (req.body.language as string) || 'Auto-detect';
      const prompt = `You are ScribeSwift, a world-class AI audio & video transcription engine.
Transcribe and analyze the uploaded audio/video file accurately.
Target Language: ${targetLanguage}.

Required Tasks:
1. Provide the complete verbatim transcription text in 'fullText'.
2. Divide the speech into chronological time-stamped segments in 'segments'.
   - Each segment must have:
     - startTime: number (in seconds, e.g. 0, 12.5)
     - endTime: number (in seconds)
     - timestamp: string (formatted MM:SS or HH:MM:SS)
     - speaker: string (e.g. "Speaker 1", "Speaker 2" or detected names)
     - text: string (exact spoken content)
3. Detect spoken language and put in 'language'.
4. Estimate total duration in seconds in 'durationSeconds'.
5. Generate an executive summary object in 'summary':
   - overview: concise narrative overview of the file content
   - keyPoints: list of key points / takeaways
   - actionItems: list of action items, decisions, or follow-ups discussed
   - keywords: array of main topic keywords`;

      console.log('[ScribeSwift] Requesting transcription from Gemini 3.6 Flash...');
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [
          uploadedFileRef,
          { text: prompt },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              fullText: { type: Type.STRING },
              language: { type: Type.STRING },
              durationSeconds: { type: Type.NUMBER },
              segments: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    startTime: { type: Type.NUMBER },
                    endTime: { type: Type.NUMBER },
                    timestamp: { type: Type.STRING },
                    speaker: { type: Type.STRING },
                    text: { type: Type.STRING },
                  },
                  required: ['startTime', 'endTime', 'timestamp', 'speaker', 'text'],
                },
              },
              summary: {
                type: Type.OBJECT,
                properties: {
                  overview: { type: Type.STRING },
                  keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                  actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
                  keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['overview', 'keyPoints', 'actionItems', 'keywords'],
              },
            },
            required: ['fullText', 'language', 'durationSeconds', 'segments', 'summary'],
          },
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error('Received empty response from Gemini model.');
      }

      const parsedData = JSON.parse(responseText);

      // Enhance segments with unique IDs
      const formattedSegments = (parsedData.segments || []).map((seg: any, idx: number) => ({
        id: `seg-${Date.now()}-${idx}`,
        startTime: seg.startTime || idx * 10,
        endTime: seg.endTime || (idx + 1) * 10,
        timestamp: seg.timestamp || '00:00',
        speaker: seg.speaker || 'Speaker 1',
        text: seg.text || '',
      }));

      const transcriptionResult = {
        id: `transcription-${Date.now()}`,
        title: req.file.originalname.replace(/\.[^/.]+$/, ''),
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        durationSeconds: parsedData.durationSeconds || 60,
        fullText: parsedData.fullText || '',
        language: parsedData.language || targetLanguage,
        segments: formattedSegments,
        summary: {
          overview: parsedData.summary?.overview || 'Transcription complete.',
          keyPoints: parsedData.summary?.keyPoints || [],
          actionItems: parsedData.summary?.actionItems || [],
          keywords: parsedData.summary?.keywords || [],
        },
        createdAt: new Date().toISOString(),
      };

      res.json(transcriptionResult);
    } catch (err: any) {
      console.error('[ScribeSwift Error]:', err);
      res.status(500).json({
        error: err.message || 'Failed to process audio/video file with Gemini File API.',
      });
    } finally {
      // Cleanup local disk temp file
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          console.log('[ScribeSwift] Cleaned up temp upload file.');
        } catch (e) {
          console.error('Failed to unlink temp file:', e);
        }
      }
      // Cleanup Gemini File API file
      if (uploadedFileRef && uploadedFileRef.name) {
        try {
          const ai = getGeminiClient();
          await ai.files.delete({ name: uploadedFileRef.name });
          console.log('[ScribeSwift] Deleted remote file from AI Studio File API.');
        } catch (e) {
          console.error('Failed to delete remote file from AI Studio File API:', e);
        }
      }
    }
  });

  // Serve Vite in development / static files in production
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ScribeSwift Server] Listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
