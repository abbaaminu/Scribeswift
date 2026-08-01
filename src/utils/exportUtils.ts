import { TranscriptionData } from '../types';

export function formatSecondsToSrtTime(seconds: number): string {
  const pad = (num: number, size = 2) => String(num).padStart(size, '0');
  const padMs = (num: number) => String(Math.floor(num)).padStart(3, '0');

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = (seconds % 1) * 1000;

  return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${padMs(ms)}`;
}

export function formatSecondsToVttTime(seconds: number): string {
  return formatSecondsToSrtTime(seconds).replace(',', '.');
}

export function exportToTxt(data: TranscriptionData) {
  let content = `====================================================\n`;
  content += `SCRIBESWIFT TRANSCRIPTION REPORT\n`;
  content += `====================================================\n\n`;
  content += `Title: ${data.title}\n`;
  content += `File Name: ${data.fileName}\n`;
  content += `Duration: ${Math.floor(data.durationSeconds / 60)}m ${Math.floor(data.durationSeconds % 60)}s\n`;
  content += `Language: ${data.language}\n`;
  content += `Date: ${new Date(data.createdAt).toLocaleString()}\n\n`;

  if (data.summary) {
    content += `----------------------------------------------------\n`;
    content += `SUMMARY & OVERVIEW\n`;
    content += `----------------------------------------------------\n`;
    content += `${data.summary.overview}\n\n`;

    if (data.summary.keyPoints?.length > 0) {
      content += `KEY TAKEAWAYS:\n`;
      data.summary.keyPoints.forEach((kp) => (content += `• ${kp}\n`));
      content += `\n`;
    }

    if (data.summary.actionItems?.length > 0) {
      content += `ACTION ITEMS:\n`;
      data.summary.actionItems.forEach((ai) => (content += `[ ] ${ai}\n`));
      content += `\n`;
    }
  }

  content += `----------------------------------------------------\n`;
  content += `FULL TIMED TRANSCRIPT\n`;
  content += `----------------------------------------------------\n\n`;

  data.segments.forEach((seg) => {
    content += `[${seg.timestamp}] ${seg.speaker}:\n${seg.text}\n\n`;
  });

  downloadFile(`${data.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_transcript.txt`, content, 'text/plain');
}

export function exportToSrt(data: TranscriptionData) {
  let content = '';
  data.segments.forEach((seg, idx) => {
    content += `${idx + 1}\n`;
    content += `${formatSecondsToSrtTime(seg.startTime)} --> ${formatSecondsToSrtTime(seg.endTime)}\n`;
    content += `${seg.speaker}: ${seg.text}\n\n`;
  });

  downloadFile(`${data.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.srt`, content, 'text/plain');
}

export function exportToVtt(data: TranscriptionData) {
  let content = `WEBVTT - ScribeSwift Auto Generated Subtitles\n\n`;
  data.segments.forEach((seg) => {
    content += `${formatSecondsToVttTime(seg.startTime)} --> ${formatSecondsToVttTime(seg.endTime)}\n`;
    content += `<v ${seg.speaker}>${seg.text}\n\n`;
  });

  downloadFile(`${data.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.vtt`, content, 'text/vtt');
}

export function exportToJson(data: TranscriptionData) {
  const content = JSON.stringify(data, null, 2);
  downloadFile(`${data.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_data.json`, content, 'application/json');
}

export function triggerPrintTranscript(data: TranscriptionData) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print the transcription.');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${data.title} - ScribeSwift Print Report</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #111827; padding: 40px; max-width: 800px; margin: 0 auto; }
          h1 { color: #4f46e5; font-size: 24px; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 8px; }
          .meta { font-size: 13px; color: #6b7280; margin-bottom: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #f9fafb; padding: 12px; border-radius: 8px; }
          .summary-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0; }
          .summary-box h3 { margin-top: 0; color: #1e40af; font-size: 16px; }
          .segment { margin-bottom: 16px; page-break-inside: avoid; }
          .segment-header { font-weight: 600; font-size: 14px; color: #4338ca; margin-bottom: 4px; }
          .timestamp { font-size: 12px; color: #6b7280; font-weight: normal; margin-left: 8px; }
          .segment-text { font-size: 15px; color: #1f2937; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h1>ScribeSwift Report</h1>
          <button class="no-print" onclick="window.print()" style="background: #4f46e5; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600;">Print Now</button>
        </div>
        <h2>${data.title}</h2>
        <div class="meta">
          <div><strong>File:</strong> ${data.fileName}</div>
          <div><strong>Duration:</strong> ${Math.floor(data.durationSeconds / 60)}m ${Math.floor(data.durationSeconds % 60)}s</div>
          <div><strong>Language:</strong> ${data.language}</div>
          <div><strong>Generated:</strong> ${new Date(data.createdAt).toLocaleDateString()}</div>
        </div>

        ${
          data.summary
            ? `
          <div class="summary-box">
            <h3>Executive Summary</h3>
            <p>${data.summary.overview}</p>
            ${
              data.summary.keyPoints?.length
                ? `
              <p><strong>Key Takeaways:</strong></p>
              <ul>
                ${data.summary.keyPoints.map((k) => `<li>${k}</li>`).join('')}
              </ul>
            `
                : ''
            }
          </div>
        `
            : ''
        }

        <h3>Full Transcript</h3>
        ${data.segments
          .map(
            (seg) => `
          <div class="segment">
            <div class="segment-header">
              ${seg.speaker} <span class="timestamp">[${seg.timestamp}]</span>
            </div>
            <div class="segment-text">${seg.text}</div>
          </div>
        `
          )
          .join('')}

        <script>
          window.onload = () => {
            setTimeout(() => window.print(), 500);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

function downloadFile(filename: string, text: string, mimeType: string) {
  const element = document.createElement('a');
  const file = new Blob([text], { type: mimeType });
  element.href = URL.createObjectURL(file);
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
  URL.revokeObjectURL(element.href);
}
