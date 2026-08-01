var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_config = require("dotenv/config");
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_os = __toESM(require("os"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var import_multer = __toESM(require("multer"), 1);
var import_groq_sdk = __toESM(require("groq-sdk"), 1);
var import_fluent_ffmpeg = __toESM(require("fluent-ffmpeg"), 1);
var import_ffmpeg_static = __toESM(require("ffmpeg-static"), 1);
var import_vite = require("vite");
var import_supabase_js = require("@supabase/supabase-js");
if (import_ffmpeg_static.default) {
  import_fluent_ffmpeg.default.setFfmpegPath(import_ffmpeg_static.default);
}
var GROQ_MAX_UPLOAD_BYTES = 24 * 1024 * 1024;
var CHUNK_DURATION_SECONDS = 40 * 60;
var LANGUAGE_CODE_MAP = {
  English: "en",
  Spanish: "es",
  French: "fr",
  German: "de",
  Japanese: "ja",
  Arabic: "ar",
  Chinese: "zh"
};
var getSupabaseServerClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }
  return (0, import_supabase_js.createClient)(supabaseUrl, supabaseKey);
};
var uploadsDir = import_path.default.join(process.cwd(), "uploads");
if (!import_fs.default.existsSync(uploadsDir)) {
  import_fs.default.mkdirSync(uploadsDir, { recursive: true });
}
var upload = (0, import_multer.default)({
  dest: uploadsDir,
  limits: {
    fileSize: 100 * 1024 * 1024
    // 100MB limit
  }
});
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(
    import_express.default.json({
      limit: "10mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  const verifyPaddleSignature = (req) => {
    const secret = process.env.PADDLE_NOTIFICATION_WEBHOOK_SECRET;
    if (!secret) {
      console.warn("[Paddle Webhook] PADDLE_NOTIFICATION_WEBHOOK_SECRET is not set \u2014 rejecting webhook.");
      return false;
    }
    const signatureHeader = req.headers["paddle-signature"];
    if (!signatureHeader || !req.rawBody) return false;
    const parts = Object.fromEntries(
      String(signatureHeader).split(";").map((p) => p.split("="))
    );
    const ts = parts.ts;
    const h1 = parts.h1;
    if (!ts || !h1) return false;
    const signedPayload = `${ts}:${req.rawBody.toString("utf8")}`;
    const expected = import_crypto.default.createHmac("sha256", secret).update(signedPayload).digest("hex");
    try {
      return import_crypto.default.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(h1, "hex"));
    } catch {
      return false;
    }
  };
  const getGroqClient = () => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("Groq API key is not configured");
    }
    return new import_groq_sdk.default({ apiKey });
  };
  const runFfmpeg = (configure) => {
    return new Promise((resolve, reject) => {
      const command = (0, import_fluent_ffmpeg.default)();
      configure(command);
      command.on("end", () => resolve()).on("error", (err) => reject(err)).run();
    });
  };
  const extractCompressedAudio = async (inputPath, outputPath) => {
    await runFfmpeg((cmd) => {
      cmd.input(inputPath).noVideo().audioChannels(1).audioFrequency(16e3).audioBitrate("64k").audioCodec("libmp3lame").format("mp3").output(outputPath);
    });
  };
  const splitAudioIntoChunks = async (inputPath, outDir) => {
    const pattern = import_path.default.join(outDir, "chunk_%03d.mp3");
    await runFfmpeg((cmd) => {
      cmd.input(inputPath).outputOptions([
        "-f",
        "segment",
        "-segment_time",
        String(CHUNK_DURATION_SECONDS),
        "-reset_timestamps",
        "1",
        "-c",
        "copy"
      ]).output(pattern);
    });
    return import_fs.default.readdirSync(outDir).filter((f) => f.startsWith("chunk_") && f.endsWith(".mp3")).sort().map((f) => import_path.default.join(outDir, f));
  };
  const transcribeChunkWithGroq = async (groq, filePath, language) => {
    const langCode = LANGUAGE_CODE_MAP[language];
    const response = await groq.audio.transcriptions.create({
      file: import_fs.default.createReadStream(filePath),
      model: "whisper-large-v3-turbo",
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
      ...langCode ? { language: langCode } : {}
    });
    const segments = (response.segments || []).map((seg) => ({
      start: typeof seg.start === "number" ? seg.start : 0,
      end: typeof seg.end === "number" ? seg.end : 0,
      text: (seg.text || "").trim()
    }));
    return {
      text: (response.text || "").trim(),
      duration: typeof response.duration === "number" ? response.duration : 0,
      segments
    };
  };
  const generateSpeakersAndSummary = async (groq, segments, detectedLanguage) => {
    const fallback = {
      speakers: segments.map(() => "Speaker 1"),
      summary: {
        overview: "Transcription complete.",
        keyPoints: [],
        actionItems: [],
        keywords: []
      }
    };
    if (segments.length === 0) return fallback;
    try {
      const transcriptForPrompt = segments.map((seg, idx) => `[${idx}] (${seg.startTime.toFixed(1)}s-${seg.endTime.toFixed(1)}s) ${seg.text}`).join("\n");
      const completion = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are ScribeSwift, a world-class transcript analyst. You infer speaker turns from context and produce concise executive summaries. Always respond with strict JSON only, matching the requested schema exactly."
          },
          {
            role: "user",
            content: `The transcript below (language: ${detectedLanguage}) is a numbered list of timestamped segments from a single audio/video recording. Segments are in chronological order and indices are 0-based and contiguous.

Tasks:
1. Infer who is speaking in each segment based on context, turn-taking, and any self-identification in the speech (e.g. names mentioned). Label speakers generically as "Speaker 1", "Speaker 2", etc., unless a speaker's real name is clearly stated in the dialogue, in which case use that name. If the whole recording is a single narrator/presenter, label every segment "Speaker 1".
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

The "speakers" array MUST have exactly ${segments.length} entries, one per segment index, in order.`
          }
        ]
      });
      const raw = completion.choices?.[0]?.message?.content;
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      const speakers = Array.isArray(parsed.speakers) ? parsed.speakers : [];
      return {
        speakers: speakers.length === segments.length ? speakers.map((s) => typeof s === "string" && s.trim() ? s.trim() : "Speaker 1") : fallback.speakers,
        summary: {
          overview: parsed.summary?.overview || fallback.summary.overview,
          keyPoints: Array.isArray(parsed.summary?.keyPoints) ? parsed.summary.keyPoints : [],
          actionItems: Array.isArray(parsed.summary?.actionItems) ? parsed.summary.actionItems : [],
          keywords: Array.isArray(parsed.summary?.keywords) ? parsed.summary.keywords : []
        }
      };
    } catch (err) {
      console.error("[ScribeSwift] Speaker/summary generation failed, using fallback:", err);
      return fallback;
    }
  };
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", maxUploadSizeMb: 100, service: "ScribeSwift API" });
  });
  app.get("/api/webhooks/paddle", (req, res) => {
    res.json({
      status: "active",
      endpoint: "/api/webhooks/paddle",
      description: "Listens for subscription.created, subscription.updated, and subscription.canceled Paddle events to update Supabase profiles.is_premium."
    });
  });
  app.post("/api/webhooks/paddle", async (req, res) => {
    try {
      if (!verifyPaddleSignature(req)) {
        console.warn("[Paddle Webhook] Rejected request with invalid or missing signature.");
        return res.status(401).json({ error: "Invalid webhook signature" });
      }
      const payload = req.body || {};
      const eventType = payload.event_type || payload.alert_name || payload.event_name || "unknown";
      console.log(`[Paddle Webhook] Received event: ${eventType}`);
      const data = payload.data || payload;
      const customData = data.custom_data || payload.custom_data || (payload.passthrough ? typeof payload.passthrough === "string" ? JSON.parse(payload.passthrough) : payload.passthrough : {});
      const userId = customData.userId || customData.user_id || data.userId || data.user_id || payload.userId;
      if (!userId) {
        console.warn("[Paddle Webhook] No userId found in webhook payload customData. Payload:", JSON.stringify(payload));
        return res.json({ status: "ok", warning: "No userId found in webhook payload" });
      }
      const supabaseServer = getSupabaseServerClient();
      if (!supabaseServer) {
        console.warn("[Paddle Webhook] Supabase credentials missing on server. Unable to update profiles table.");
        return res.json({ status: "ok", warning: "Supabase credentials missing on server" });
      }
      let isPremium = false;
      const activeEvents = [
        "subscription.created",
        "subscription.updated",
        "subscription_created",
        "subscription_updated",
        "transaction.completed",
        "payment_succeeded"
      ];
      const cancelEvents = [
        "subscription.canceled",
        "subscription.cancelled",
        "subscription_canceled",
        "subscription.paused",
        "subscription_paused"
      ];
      if (activeEvents.includes(eventType)) {
        isPremium = true;
      } else if (cancelEvents.includes(eventType)) {
        isPremium = false;
      } else {
        const status = data.status || payload.status;
        if (status === "active" || status === "trailing") {
          isPremium = true;
        }
      }
      console.log(`[Paddle Webhook] Updating user ${userId} -> is_premium: ${isPremium} (event: ${eventType})`);
      const { error } = await supabaseServer.from("profiles").upsert(
        {
          id: userId,
          is_premium: isPremium,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        },
        { onConflict: "id" }
      );
      if (error) {
        console.error("[Paddle Webhook] Error updating profiles in Supabase:", error.message);
        return res.status(500).json({ error: error.message });
      }
      return res.json({
        status: "success",
        userId,
        is_premium: isPremium,
        eventType
      });
    } catch (err) {
      console.error("[Paddle Webhook Error]:", err);
      return res.status(500).json({ error: err.message || "Webhook processing failed" });
    }
  });
  app.get("/api/sample-transcription", (req, res) => {
    const sampleType = req.query.type || "keynote";
    if (sampleType === "podcast") {
      return res.json({
        id: "sample-podcast-001",
        title: "Tech Talk Daily - AI Innovations in 2026",
        fileName: "tech_talk_daily_ep42.mp3",
        fileSize: 1845e4,
        fileType: "audio/mp3",
        durationSeconds: 194,
        fullText: "Welcome back to Tech Talk Daily! Today we're diving deep into the massive shifts in artificial intelligence, multimodal models, and how on-device acceleration is reshaping software engineering. I'm your host Alex, and today with me is Dr. Elena Rostova, lead AI Researcher. Dr. Elena, welcome! Thanks Alex, excited to be here. The jump from standard text models to native real-time audio and video processing has been remarkable. We are now seeing real-time transcription, translation, and structured extraction in milliseconds instead of minutes.",
        language: "English (US)",
        segments: [
          {
            id: "seg-1",
            startTime: 0,
            endTime: 12,
            timestamp: "00:00",
            speaker: "Alex (Host)",
            text: "Welcome back to Tech Talk Daily! Today we're diving deep into the massive shifts in artificial intelligence, multimodal models, and how on-device acceleration is reshaping software engineering."
          },
          {
            id: "seg-2",
            startTime: 12,
            endTime: 22,
            timestamp: "00:12",
            speaker: "Alex (Host)",
            text: "I'm your host Alex, and today with me is Dr. Elena Rostova, lead AI Researcher. Dr. Elena, welcome to the show!"
          },
          {
            id: "seg-3",
            startTime: 22,
            endTime: 38,
            timestamp: "00:22",
            speaker: "Dr. Elena Rostova",
            text: "Thanks Alex, excited to be here. The jump from standard text models to native real-time audio and video processing has been remarkable."
          },
          {
            id: "seg-4",
            startTime: 38,
            endTime: 65,
            timestamp: "00:38",
            speaker: "Dr. Elena Rostova",
            text: "We are now seeing real-time transcription, translation, and structured extraction in milliseconds instead of minutes, empowering applications to process up to 100MB media files effortlessly."
          }
        ],
        summary: {
          overview: "A discussion on recent breakthroughs in multimodal AI, native audio/video processing capabilities, and how scaling file upload thresholds to 100MB unlocks rich meeting and podcast transcriptions.",
          keyPoints: [
            "Transition from pure text models to multimodal native processing",
            "Latency reduced to milliseconds for real-time transcription",
            "Support for large media file processing up to 100MB"
          ],
          actionItems: [
            "Explore multi-speaker diarization for podcast audio",
            "Benchmark transcription accuracy across non-English accents"
          ],
          keywords: ["AI Innovations", "Multimodal", "100MB Uploads", "Real-time", "Transcription Engine"]
        },
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    res.json({
      id: "sample-keynote-002",
      title: "ScribeSwift Product Launch Keynote",
      fileName: "scribeswift_launch_presentation.mp4",
      fileSize: 482e5,
      fileType: "video/mp4",
      durationSeconds: 240,
      fullText: "Good morning everyone! Today, we are thrilled to introduce the newly upgraded ScribeSwift engine. We heard your feedback loud and clear: 20MB limits were not enough for high-definition video files, webinars, and full podcast episodes. Today, we are officially boosting file upload capacity up to 100MB. With ScribeSwift, you can now upload full video lectures, multi-hour meetings, and high-fidelity audio tracks without tedious compression. Plus, our tier system gives free users full transcription access while Premium members unlock unlimited exports, copy-paste capabilities, and print-ready formatting for just $1 per month.",
      language: "English (US)",
      segments: [
        {
          id: "k-1",
          startTime: 0,
          endTime: 15,
          timestamp: "00:00",
          speaker: "Presenter",
          text: "Good morning everyone! Today, we are thrilled to introduce the newly upgraded ScribeSwift engine."
        },
        {
          id: "k-2",
          startTime: 15,
          endTime: 35,
          timestamp: "00:15",
          speaker: "Presenter",
          text: "We heard your feedback loud and clear: 20MB limits were not enough for high-definition video files, webinars, and full podcast episodes."
        },
        {
          id: "k-3",
          startTime: 35,
          endTime: 60,
          timestamp: "00:35",
          speaker: "Presenter",
          text: "Today, we are officially boosting file upload capacity up to 100MB."
        },
        {
          id: "k-4",
          startTime: 60,
          endTime: 95,
          timestamp: "01:00",
          speaker: "Presenter",
          text: "With ScribeSwift, you can now upload full video lectures, multi-hour meetings, and high-fidelity audio tracks without tedious compression."
        },
        {
          id: "k-5",
          startTime: 95,
          endTime: 130,
          timestamp: "01:35",
          speaker: "Presenter",
          text: "Plus, our tier system gives free users full transcription access while Premium members unlock unlimited exports, copy-paste capabilities, and print-ready formatting for just $1 per month."
        }
      ],
      summary: {
        overview: "Announcement of ScribeSwift major upgrades: 100MB File API integration for large audio and video uploads, alongside the $1/month Premium tier for full export rights.",
        keyPoints: [
          "Upgraded file size cap from 20MB to 100MB",
          "Asynchronous large-file upload pipeline",
          "Asynchronous processing with live progress status",
          "Free Tier with transcription preview & $1/mo Premium with full copy/export rights"
        ],
        actionItems: [
          "Upgrade file pipeline to handle large 100MB audio/video binaries",
          "Implement client-side protection against unauthorized highlighting on Free Tier",
          "Add $1/month payment checkout flow with instant state unlock"
        ],
        keywords: ["ScribeSwift", "100MB Uploads", "Transcription", "Premium Tier", "Export Features"]
      },
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app.post("/api/transcribe", upload.single("file"), async (req, res) => {
    let tempFilePath = null;
    let workDir = null;
    try {
      if (!process.env.GROQ_API_KEY) {
        return res.status(500).json({ error: "Groq API key is not configured" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "No media file uploaded. Please select an audio or video file up to 100MB." });
      }
      tempFilePath = req.file.path;
      const fileSizeMb = (req.file.size / (1024 * 1024)).toFixed(2);
      console.log(`[ScribeSwift] Received file: ${req.file.originalname} (${fileSizeMb} MB, type: ${req.file.mimetype})`);
      if (req.file.size > 100 * 1024 * 1024) {
        return res.status(400).json({ error: "File size exceeds maximum allowed capacity of 100MB." });
      }
      const groq = getGroqClient();
      const targetLanguage = req.body.language || "Auto-detect";
      workDir = import_fs.default.mkdtempSync(import_path.default.join(import_os.default.tmpdir(), "scribeswift-"));
      const compressedAudioPath = import_path.default.join(workDir, "audio.mp3");
      console.log("[ScribeSwift] Extracting & compressing audio track with ffmpeg...");
      await extractCompressedAudio(tempFilePath, compressedAudioPath);
      const compressedSize = import_fs.default.statSync(compressedAudioPath).size;
      console.log(`[ScribeSwift] Compressed audio size: ${(compressedSize / (1024 * 1024)).toFixed(2)} MB`);
      let chunkPaths;
      if (compressedSize <= GROQ_MAX_UPLOAD_BYTES) {
        chunkPaths = [compressedAudioPath];
      } else {
        console.log("[ScribeSwift] Audio exceeds single-request limit, splitting into chunks...");
        const chunkDir = import_path.default.join(workDir, "chunks");
        import_fs.default.mkdirSync(chunkDir, { recursive: true });
        chunkPaths = await splitAudioIntoChunks(compressedAudioPath, chunkDir);
        console.log(`[ScribeSwift] Split into ${chunkPaths.length} chunk(s).`);
      }
      let cumulativeOffset = 0;
      let fullText = "";
      let detectedLanguage = targetLanguage;
      const rawSegments = [];
      for (let i = 0; i < chunkPaths.length; i++) {
        console.log(`[ScribeSwift] Transcribing chunk ${i + 1}/${chunkPaths.length} with whisper-large-v3-turbo...`);
        const result = await transcribeChunkWithGroq(groq, chunkPaths[i], targetLanguage);
        for (const seg of result.segments) {
          rawSegments.push({
            startTime: cumulativeOffset + seg.start,
            endTime: cumulativeOffset + seg.end,
            text: seg.text
          });
        }
        fullText += (fullText ? " " : "") + result.text;
        cumulativeOffset += result.duration || CHUNK_DURATION_SECONDS;
      }
      const durationSeconds = rawSegments.length ? rawSegments[rawSegments.length - 1].endTime : cumulativeOffset;
      if (targetLanguage === "Auto-detect") {
        detectedLanguage = "Auto-detected";
      }
      console.log("[ScribeSwift] Generating speaker labels & executive summary with Groq LLM...");
      const { speakers, summary } = await generateSpeakersAndSummary(groq, rawSegments, detectedLanguage);
      const formatTimestamp = (seconds) => {
        const total = Math.max(0, Math.floor(seconds));
        const h = Math.floor(total / 3600);
        const m = Math.floor(total % 3600 / 60);
        const s = total % 60;
        const mm = String(m).padStart(2, "0");
        const ss = String(s).padStart(2, "0");
        return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
      };
      const formattedSegments = rawSegments.map((seg, idx) => ({
        id: `seg-${Date.now()}-${idx}`,
        startTime: seg.startTime,
        endTime: seg.endTime,
        timestamp: formatTimestamp(seg.startTime),
        speaker: speakers[idx] || "Speaker 1",
        text: seg.text
      }));
      const transcriptionResult = {
        id: `transcription-${Date.now()}`,
        title: req.file.originalname.replace(/\.[^/.]+$/, ""),
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        durationSeconds: durationSeconds || 0,
        fullText: fullText || "",
        language: detectedLanguage,
        segments: formattedSegments,
        summary,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      res.json(transcriptionResult);
    } catch (err) {
      console.error("[ScribeSwift Error]:", err);
      res.status(500).json({
        error: err.message || "Failed to process audio/video file with Groq Whisper API."
      });
    } finally {
      if (tempFilePath && import_fs.default.existsSync(tempFilePath)) {
        try {
          import_fs.default.unlinkSync(tempFilePath);
          console.log("[ScribeSwift] Cleaned up temp upload file.");
        } catch (e) {
          console.error("Failed to unlink temp file:", e);
        }
      }
      if (workDir && import_fs.default.existsSync(workDir)) {
        try {
          import_fs.default.rmSync(workDir, { recursive: true, force: true });
          console.log("[ScribeSwift] Cleaned up audio scratch directory.");
        } catch (e) {
          console.error("Failed to clean up scratch directory:", e);
        }
      }
    }
  });
  app.use((err, req, res, next) => {
    if (err && err.name === "MulterError") {
      const message = err.code === "LIMIT_FILE_SIZE" ? "File size exceeds the maximum allowed capacity of 100MB." : `Upload error: ${err.message}`;
      console.error("[ScribeSwift] Multer error:", err.code, err.message);
      return res.status(400).json({ error: message });
    }
    console.error("[ScribeSwift] Unhandled server error:", err);
    return res.status(500).json({ error: err?.message || "Unexpected server error." });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[ScribeSwift Server] Listening on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
