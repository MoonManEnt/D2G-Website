import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/email";
import { createLogger } from "@/lib/logger";

const log = createLogger("enterprise-inquiry");

export const dynamic = "force-dynamic";

const inquirySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  company: z.string().min(1),
  estimatedVolume: z.string().optional(),
  teamSize: z.string().optional(),
  message: z.string().optional(),
});
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = inquirySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }
    const { name, email, company, estimatedVolume, teamSize, message } = parsed.data;

    // Log the inquiry via structured logger (no org association needed for anonymous leads)
    log.info({ name, email, company, estimatedVolume, teamSize }, "Enterprise inquiry received");
    // Send notification email to sales
    const salesEmail = process.env.SALES_EMAIL || process.env.EMAIL_FROM || "sales@dispute2go.com";
    try {
      await sendEmail({
        to: salesEmail,
        template: {
          subject: "New Enterprise Inquiry from " + name,
          html: "<h2>New Enterprise Inquiry</h2><p><strong>Name:</strong> " + name + "</p><p><strong>Email:</strong> " + email + "</p><p><strong>Company:</strong> " + company + "</p><p><strong>Volume:</strong> " + (estimatedVolume || "N/A") + "</p><p><strong>Team:</strong> " + (teamSize || "N/A") + "</p><p><strong>Message:</strong> " + (message || "N/A") + "</p>",
          text: "New Enterprise Inquiry\nName: " + name + "\nEmail: " + email + "\nCompany: " + company + "\nVolume: " + (estimatedVolume || "N/A") + "\nTeam: " + (teamSize || "N/A") + "\nMessage: " + (message || "N/A"),
        },
      });
    } catch (emailErr) {
      log.error({ err: emailErr }, "Failed to send sales notification");
    }
    // Send confirmation email to prospect
    try {
      await sendEmail({
        to: email,
        template: {
          subject: "Thanks for your interest in Dispute2Go Enterprise",
          html: "<h2>Thank you, " + name + "!</h2><p>We received your inquiry about Dispute2Go Enterprise. A member of our team will reach out within 1 business day to discuss your needs.</p><p>In the meantime, feel free to reply to this email with any additional questions.</p><p>Best regards,<br/>The Dispute2Go Team</p>",
          text: "Thank you, " + name + "! We received your inquiry about Dispute2Go Enterprise. A member of our team will reach out within 1 business day.",
        },
      });
    } catch (emailErr) {
      log.error({ err: emailErr }, "Failed to send confirmation email");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "Enterprise inquiry failed");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
