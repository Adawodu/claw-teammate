import { Type } from "@sinclair/typebox";
import { YoutubeTranscript } from "youtube-transcript";

function json(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    details: data,
  };
}

/** Extract a YouTube video ID from various URL formats or a bare ID. */
function extractVideoId(input: string): string | null {
  const trimmed = input.trim();

  // Bare video ID (11 chars, alphanumeric + dash + underscore)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    // youtube.com/watch?v=ID
    if (url.searchParams.has("v")) return url.searchParams.get("v");
    // youtu.be/ID
    if (url.hostname === "youtu.be") return url.pathname.slice(1).split("/")[0];
    // youtube.com/embed/ID or youtube.com/v/ID or youtube.com/shorts/ID
    const pathMatch = url.pathname.match(
      /\/(embed|v|shorts|live)\/([a-zA-Z0-9_-]{11})/,
    );
    if (pathMatch) return pathMatch[2];
  } catch {
    // Not a valid URL
  }

  return null;
}

const youtubeTranscriberPlugin = {
  id: "youtube-transcriber",
  name: "YouTube Transcriber",
  description:
    "Extract transcripts from YouTube videos for content repurposing",
  configSchema: {
    type: "object" as const,
    properties: {},
    required: [] as string[],
  },
  register(pluginApi: any) {
    pluginApi.registerTool({
      name: "youtube_transcribe",
      label: "YouTube Transcribe",
      description:
        "Extract the transcript (captions) from a YouTube video. Works with auto-generated " +
        "and manually uploaded captions. Accepts any YouTube URL format or a bare video ID. " +
        "Returns the full transcript text with optional timestamps. " +
        "Use this to repurpose video content into articles, newsletters, social posts, etc.",
      parameters: Type.Object({
        url: Type.String({
          description:
            "YouTube video URL or video ID. Accepts: full URL (https://www.youtube.com/watch?v=...), " +
            "short URL (https://youtu.be/...), embed URL, or bare 11-character video ID.",
        }),
        lang: Type.Optional(
          Type.String({
            description:
              'Language code for the transcript (e.g. "en", "es", "fr"). ' +
              "Defaults to the video's primary language. Falls back to auto-generated captions.",
          }),
        ),
        timestamps: Type.Optional(
          Type.Boolean({
            description:
              "Include timestamps in the output (default: false). " +
              "When true, each line is prefixed with [MM:SS].",
          }),
        ),
      }),
      async execute(_toolCallId: string, params: any) {
        try {
          const videoId = extractVideoId(params.url);
          if (!videoId) {
            return json({
              error: "Invalid YouTube URL or video ID",
              hint: "Provide a full YouTube URL (e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ) or an 11-character video ID.",
            });
          }

          const config: any = {};
          if (params.lang) config.lang = params.lang;

          const segments = await YoutubeTranscript.fetchTranscript(
            videoId,
            config,
          );

          if (!segments || segments.length === 0) {
            return json({
              error: "No transcript available for this video",
              videoId,
              hint: "This video may not have captions (auto-generated or manual).",
            });
          }

          const includeTimestamps = params.timestamps === true;

          const lines = segments.map((seg: any) => {
            const text = seg.text.replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
            if (includeTimestamps) {
              const totalSec = Math.floor(seg.offset / 1000);
              const min = Math.floor(totalSec / 60);
              const sec = totalSec % 60;
              const ts = `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
              return `[${ts}] ${text}`;
            }
            return text;
          });

          const transcript = lines.join("\n");
          const totalDurationSec = segments.length > 0
            ? Math.floor(
                (segments[segments.length - 1].offset +
                  segments[segments.length - 1].duration) /
                  1000,
              )
            : 0;
          const durationMin = Math.floor(totalDurationSec / 60);
          const durationSec = totalDurationSec % 60;

          return json({
            videoId,
            videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
            segmentCount: segments.length,
            duration: `${durationMin}m ${durationSec}s`,
            characterCount: transcript.length,
            wordCount: transcript.split(/\s+/).length,
            transcript,
          });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : String(err);

          // Provide helpful hints for common errors
          if (message.includes("disabled")) {
            return json({
              error: "Transcripts are disabled for this video",
              hint: "The video owner has disabled captions/transcripts.",
            });
          }

          return json({
            error: message,
          });
        }
      },
    });
  },
};

export default youtubeTranscriberPlugin;
