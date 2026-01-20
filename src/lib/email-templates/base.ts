/**
 * Base email template with responsive design and branding support
 */

export interface BrandingConfig {
  companyName: string;
  logoUrl?: string;
  primaryColor: string;
  supportEmail: string;
  supportPhone?: string;
  websiteUrl: string;
  address?: string;
}

const defaultBranding: BrandingConfig = {
  companyName: process.env.DEFAULT_COMPANY_NAME || "Dispute2Go",
  primaryColor: "#7c3aed",
  supportEmail: process.env.DEFAULT_SUPPORT_EMAIL || "support@dispute2go.com",
  supportPhone: process.env.DEFAULT_SUPPORT_PHONE,
  websiteUrl: process.env.APP_URL || "http://localhost:3000",
};

/**
 * Wrap email content in the base template
 */
export function wrapInTemplate(
  content: string,
  options: {
    preheader?: string;
    branding?: Partial<BrandingConfig>;
  } = {}
): string {
  const brand = { ...defaultBranding, ...options.branding };
  const year = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${brand.companyName}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset styles */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }

    /* Responsive styles */
    @media screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 20px !important; }
      .content { padding: 20px !important; }
      .button { width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  ${options.preheader ? `<div style="display: none; max-height: 0; overflow: hidden;">${options.preheader}</div>` : ""}

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="container" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              ${brand.logoUrl
                ? `<img src="${brand.logoUrl}" alt="${brand.companyName}" height="40" style="height: 40px; width: auto;">`
                : `<span style="font-size: 24px; font-weight: 700; color: ${brand.primaryColor};">${brand.companyName}</span>`
              }
            </td>
          </tr>

          <!-- Content Card -->
          <tr>
            <td>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                <tr>
                  <td class="content" style="padding: 40px;">
                    ${content}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 32px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 14px; color: #71717a;">
                ${brand.companyName}
              </p>
              ${brand.address ? `<p style="margin: 0 0 8px; font-size: 12px; color: #a1a1aa;">${brand.address}</p>` : ""}
              <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
                <a href="mailto:${brand.supportEmail}" style="color: #71717a; text-decoration: underline;">${brand.supportEmail}</a>
                ${brand.supportPhone ? ` &bull; ${brand.supportPhone}` : ""}
              </p>
              <p style="margin: 16px 0 0; font-size: 11px; color: #a1a1aa;">
                &copy; ${year} ${brand.companyName}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Create a styled button
 */
export function createButton(
  text: string,
  url: string,
  color: string = "#7c3aed"
): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 24px 0;">
      <tr>
        <td align="center" style="border-radius: 8px; background-color: ${color};">
          <a href="${url}" target="_blank" class="button" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Create a status badge
 */
export function createBadge(
  text: string,
  type: "success" | "warning" | "error" | "info" = "info"
): string {
  const colors = {
    success: { bg: "#dcfce7", text: "#166534" },
    warning: { bg: "#fef3c7", text: "#92400e" },
    error: { bg: "#fee2e2", text: "#991b1b" },
    info: { bg: "#dbeafe", text: "#1e40af" },
  };
  const { bg, text: textColor } = colors[type];

  return `<span style="display: inline-block; padding: 4px 12px; font-size: 12px; font-weight: 600; color: ${textColor}; background-color: ${bg}; border-radius: 9999px;">${text}</span>`;
}

/**
 * Create a data table row
 */
export function createTableRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding: 8px 0; color: #71717a; font-size: 14px; border-bottom: 1px solid #f4f4f5;">${label}</td>
      <td style="padding: 8px 0; color: #18181b; font-size: 14px; font-weight: 500; text-align: right; border-bottom: 1px solid #f4f4f5;">${value}</td>
    </tr>
  `;
}

/**
 * Create a data table
 */
export function createTable(rows: Array<{ label: string; value: string }>): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 16px 0;">
      ${rows.map((row) => createTableRow(row.label, row.value)).join("")}
    </table>
  `;
}

/**
 * Create a divider
 */
export function createDivider(): string {
  return `<hr style="margin: 24px 0; border: none; border-top: 1px solid #e4e4e7;">`;
}

/**
 * Style text
 */
export const text = {
  heading: (content: string) =>
    `<h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #18181b; line-height: 1.3;">${content}</h1>`,
  subheading: (content: string) =>
    `<h2 style="margin: 0 0 12px; font-size: 18px; font-weight: 600; color: #27272a; line-height: 1.4;">${content}</h2>`,
  paragraph: (content: string) =>
    `<p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46; line-height: 1.6;">${content}</p>`,
  small: (content: string) =>
    `<p style="margin: 0 0 12px; font-size: 14px; color: #71717a; line-height: 1.5;">${content}</p>`,
  link: (content: string, url: string) =>
    `<a href="${url}" style="color: #7c3aed; text-decoration: underline;">${content}</a>`,
  bold: (content: string) =>
    `<strong style="font-weight: 600; color: #18181b;">${content}</strong>`,
};
