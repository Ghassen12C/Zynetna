'use client';

/**
 * Calendar export. Builds an RFC 5545 .ics on the client — it needs no server
 * round-trip and no dependency, and it imports into Google, Apple and Outlook
 * alike.
 */
function icsStamp(iso: string): string {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeText(value: string): string {
  return value.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
}

export function AddToCalendar({
  title,
  startAt,
  endAt,
  location,
  description,
}: {
  title: string;
  startAt: string;
  endAt: string;
  location: string;
  description: string;
}) {
  function download() {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Zynetna//Booking//FR',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${crypto.randomUUID()}@zynetna.tn`,
      `DTSTAMP:${icsStamp(new Date().toISOString())}`,
      `DTSTART:${icsStamp(startAt)}`,
      `DTEND:${icsStamp(endAt)}`,
      `SUMMARY:${escapeText(title)}`,
      `LOCATION:${escapeText(location)}`,
      `DESCRIPTION:${escapeText(description)}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT2H',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(title)}`,
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ];

    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'zynetna-rendez-vous.ics';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" className="z-btn z-btn--primary z-btn--md" onClick={download}>
      Ajouter au calendrier
    </button>
  );
}
