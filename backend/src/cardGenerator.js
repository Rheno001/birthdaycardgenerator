const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

const DEFAULT_CPP_LOGO_PATH = path.join(__dirname, '../assets/cpp-log.png');

/**
 * Generates a PNG Buffer of the Birthday Card matching the CPP reference design.
 * @param {Object} options
 * @param {string} options.name - Team member name
 * @param {string} options.designation - Team member title/role
 * @param {string} options.picture - Team member picture URL or base64
 * @param {string} [options.quote] - Custom birthday wish quote
 * @param {string} [options.logoUrl] - Custom logo URL
 */
async function generateBirthdayCard({ name, designation, picture, quote, logoUrl }) {
  const width = 1000;
  const height = 800;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // CPP Brand Colors
  const cppBrandGreen = '#9abf49';
  const cppDarkText = '#1f2415';
  const quoteColor = '#555555';

  // 1. Background Fill - Soft light grey/cream gradient
  const bgGradient = ctx.createLinearGradient(0, 0, width, height);
  bgGradient.addColorStop(0, '#f9fafb');
  bgGradient.addColorStop(1, '#eef2f5');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  // Decorative subtle dot grid (left and right sides)
  ctx.fillStyle = 'rgba(154, 191, 73, 0.25)';
  for (let x = 30; x < 90; x += 12) {
    for (let y = 180; y < 300; y += 12) {
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let x = 920; x < 970; x += 12) {
    for (let y = 200; y < 320; y += 12) {
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Decorative subtle background ring icons
  ctx.strokeStyle = 'rgba(154, 191, 73, 0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(65, 120, 12, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(460, 515, 10, 0, Math.PI * 2);
  ctx.stroke();

  // 2. Logo Section (Top Left - Compliance Professionals PLC)
  const targetLogoSrc = logoUrl || DEFAULT_CPP_LOGO_PATH;
  if (targetLogoSrc && (targetLogoSrc.startsWith('http') || fs.existsSync(targetLogoSrc))) {
    try {
      const logoImg = await loadImage(targetLogoSrc);
      // Aspect ratio fit inside top-left box
      const logoW = 280;
      const logoH = 65;
      ctx.drawImage(logoImg, 65, 75, logoW, logoH);
    } catch (e) {
      drawFallbackLogo(ctx, cppBrandGreen);
    }
  } else {
    drawFallbackLogo(ctx, cppBrandGreen);
  }

  // 3. Center Left Text ("happy BIRTHDAY")
  // "happy" cursive script
  ctx.font = 'italic 72px "Georgia", "Brush Script MT", "Times New Roman", cursive, serif';
  ctx.fillStyle = '#1c1c1c';
  ctx.textAlign = 'left';
  ctx.fillText('happy', 145, 395);

  // "BIRTHDAY" bold uppercase CPP green text
  ctx.font = '900 68px "Arial Black", "Trebuchet MS", sans-serif';
  ctx.fillStyle = cppBrandGreen;
  ctx.fillText('BIRTHDAY', 65, 450);

  // 4. Quote Section
  const currentQuote = quote || "Wishing you a beautiful day with good health and happiness forever.";
  
  ctx.fillStyle = cppBrandGreen;
  ctx.font = 'bold 50px "Georgia", serif';
  ctx.fillText('“', 225, 545);

  ctx.font = 'bold 22px "Arial", sans-serif';
  ctx.fillStyle = quoteColor;
  ctx.textAlign = 'center';

  const maxQuoteWidth = 360;
  const quoteLines = getWrappedLines(ctx, currentQuote, maxQuoteWidth);
  let lineY = 575;
  quoteLines.forEach(line => {
    ctx.fillText(line, 235, lineY);
    lineY += 30;
  });

  // 5. Right Section - Member Portrait Photo & Accents
  const photoX = 515;
  const photoY = 40;
  const photoW = 400;
  const photoH = 610;

  // White border frame behind photo
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(photoX - 8, photoY - 8, photoW + 16, photoH + 16);

  // Member photo drawing
  if (picture) {
    try {
      const img = await loadImage(picture);
      ctx.save();
      ctx.beginPath();
      ctx.rect(photoX, photoY, photoW, photoH);
      ctx.clip();
      
      const imgRatio = img.width / img.height;
      const targetRatio = photoW / photoH;
      let drawW, drawH, dx, dy;

      if (imgRatio > targetRatio) {
        drawH = photoH;
        drawW = photoH * imgRatio;
        dx = photoX - (drawW - photoW) / 2;
        dy = photoY;
      } else {
        drawW = photoW;
        drawH = photoW / imgRatio;
        dx = photoX;
        dy = photoY - (drawH - photoH) / 2;
      }
      ctx.drawImage(img, dx, dy, drawW, drawH);
      ctx.restore();
    } catch (err) {
      drawPhotoPlaceholder(ctx, photoX, photoY, photoW, photoH);
    }
  } else {
    drawPhotoPlaceholder(ctx, photoX, photoY, photoW, photoH);
  }

  // Geometric Triangle accent near top right
  ctx.strokeStyle = '#b0b5be';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(930, 180);
  ctx.lineTo(942, 202);
  ctx.lineTo(918, 202);
  ctx.closePath();
  ctx.stroke();

  // 6. Member Name & Designation Badge Overlay (CPP Green Theme)
  const badgeX = 605;
  const badgeY = 590;
  const badgeW = 365;
  const badgeH = 110;

  ctx.fillStyle = cppBrandGreen;
  ctx.fillRect(badgeX, badgeY, badgeW, badgeH);

  // Name (Bold Uppercase)
  ctx.fillStyle = cppDarkText;
  ctx.font = '900 24px "Arial Black", "Arial", sans-serif';
  ctx.textAlign = 'center';
  const nameText = (name || 'TEAM MEMBER').toUpperCase();
  ctx.fillText(nameText, badgeX + badgeW / 2, badgeY + 48);

  // Designation (White Uppercase)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 17px "Arial", sans-serif';
  const desigText = (designation || 'SPECIALIST').toUpperCase();
  ctx.fillText(desigText, badgeX + badgeW / 2, badgeY + 80);

  // 7. Bottom CPP Green Accent Line Bar
  ctx.fillStyle = cppBrandGreen;
  ctx.beginPath();
  ctx.roundRect(360, 770, 280, 8, 4);
  ctx.fill();

  return canvas.toBuffer('image/png');
}

function drawFallbackLogo(ctx, cppBrandGreen) {
  ctx.fillStyle = cppBrandGreen;
  ctx.font = 'bold 24px "Arial Black", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('COMPLIANCE', 65, 105);
  ctx.fillText('PROFESSIONALS PLC', 65, 135);
}

function drawPhotoPlaceholder(ctx, x, y, w, h) {
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NO PHOTO', x + w / 2, y + h / 2);
}

function getWrappedLines(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + " " + word).width;
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}

module.exports = { generateBirthdayCard };
