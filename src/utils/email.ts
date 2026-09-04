import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_APP_PASSWORD;

  if (!user || !pass) return null; // email not configured — caller falls back gracefully

  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }
  return transporter;
}

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends an email if EMAIL_USER/EMAIL_APP_PASSWORD are configured in .env.
 * If not configured, logs to the console instead so local development never
 * breaks just because email hasn't been set up yet (same pattern as the OTP
 * dev-mode fallback).
 */
export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  const t = getTransporter();

  if (!t) {
    console.log(`[DEV] Email not configured — would have sent to ${to}: "${subject}"`);
    return;
  }

  try {
    await t.sendMail({
      from: `"Smart Library" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
  } catch (error) {
    // Email failures should never crash the request that triggered them
    // (e.g. a booking succeeding but the confirmation email failing).
    console.error(`Failed to send email to ${to}:`, error);
  }
}

const wrapper = (title: string, bodyHtml: string) => `
  <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #14213D;">
    <h2 style="margin: 0 0 16px; font-size: 18px;">${title}</h2>
    <div style="font-size: 14px; line-height: 1.6; color: #333;">${bodyHtml}</div>
    <p style="margin-top: 24px; font-size: 12px; color: #888;">— Smart Library System</p>
  </div>
`;

export function bookingConfirmationEmail(params: {
  studentName: string;
  zoneName: string;
  seatNumber: string;
  startTime: Date;
  endTime: Date;
}): { subject: string; html: string } {
  const { studentName, zoneName, seatNumber, startTime, endTime } = params;
  return {
    subject: "Seat booking confirmed",
    html: wrapper(
      "Your seat is booked",
      `<p>Hi ${studentName},</p>
       <p>Your booking is confirmed:</p>
       <p><b>${zoneName}</b> — Seat <b>${seatNumber}</b><br/>
       ${startTime.toLocaleString()} → ${endTime.toLocaleString()}</p>
       <p>We'll remind you 10 minutes before your slot starts. Show your QR code at the entrance to check in.</p>`
    ),
  };
}

export function bookingReminderEmail(params: {
  studentName: string;
  zoneName: string;
  seatNumber: string;
  startTime: Date;
}): { subject: string; html: string } {
  const { studentName, zoneName, seatNumber, startTime } = params;
  return {
    subject: "Your seat booking starts in 10 minutes",
    html: wrapper(
      "Reminder: your slot is starting soon",
      `<p>Hi ${studentName},</p>
       <p>Your booking for <b>${zoneName}</b> — Seat <b>${seatNumber}</b> starts at
       <b>${startTime.toLocaleTimeString()}</b>. Please check in with your QR code within the
       grace period, or the booking will be released automatically.</p>`
    ),
  };
}

export function borrowConfirmationEmail(params: {
  studentName: string;
  bookTitle: string;
  dueDate: Date;
}): { subject: string; html: string } {
  const { studentName, bookTitle, dueDate } = params;
  return {
    subject: `You borrowed "${bookTitle}"`,
    html: wrapper(
      "Borrow confirmed",
      `<p>Hi ${studentName},</p>
       <p>You've borrowed <b>${bookTitle}</b>. It's due back by
       <b>${dueDate.toLocaleDateString()}</b> — a fine of Tk 5/day applies after that.</p>
       <p>We'll remind you 3 days before the due date.</p>`
    ),
  };
}

export function dueDateReminderEmail(params: {
  studentName: string;
  bookTitle: string;
  dueDate: Date;
}): { subject: string; html: string } {
  const { studentName, bookTitle, dueDate } = params;
  return {
    subject: `"${bookTitle}" is due in 3 days`,
    html: wrapper(
      "Return reminder",
      `<p>Hi ${studentName},</p>
       <p><b>${bookTitle}</b> is due on <b>${dueDate.toLocaleDateString()}</b>.
       Return or renew it before then to avoid a late fine (Tk 5/day).</p>`
    ),
  };
}

export function returnConfirmationEmail(params: {
  studentName: string;
  bookTitle: string;
  onTime: boolean;
  fine: number;
}): { subject: string; html: string } {
  const { studentName, bookTitle, onTime, fine } = params;
  return {
    subject: `"${bookTitle}" marked as returned`,
    html: wrapper(
      "Return confirmed",
      `<p>Hi ${studentName},</p>
       ${
         onTime
           ? `<p>Thanks for returning <b>${bookTitle}</b> on time — no fine applied.</p>`
           : `<p><b>${bookTitle}</b> has been marked as returned. A late fine of
              <b>Tk ${fine}</b> applies — please clear it before borrowing another book.</p>`
       }`
    ),
  };
}
