const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");

async function buildProfileQrPdf(profileName, profileUrl) {
  const pngBuffer = await QRCode.toBuffer(profileUrl, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 512
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - doc.page.margins.left - doc.page.margins.right;
    const title = String(profileName || "Profile").trim() || "Profile";

    doc.fontSize(20).text(title, doc.page.margins.left, doc.page.margins.top, {
      width: contentWidth,
      align: "center"
    });

    const qrSize = Math.min(320, contentWidth);
    const qrX = doc.page.margins.left + ((contentWidth - qrSize) / 2);
    const qrY = doc.y + 24;
    doc.image(pngBuffer, qrX, qrY, { fit: [qrSize, qrSize] });

    const urlY = qrY + qrSize + 20;
    doc.fontSize(10).fillColor("#2563eb").text(profileUrl, doc.page.margins.left, urlY, {
      width: contentWidth,
      align: "center",
      link: profileUrl,
      underline: true
    });

    doc.end();
  });
}

function buildProfileQrFileName(profileName) {
  const safeName = String(profileName || "profile")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "profile";

  return `${safeName}-qr.pdf`;
}

module.exports = {
  buildProfileQrPdf,
  buildProfileQrFileName
};
