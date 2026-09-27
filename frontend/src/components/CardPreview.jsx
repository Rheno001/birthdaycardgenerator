import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

const CardPreview = forwardRef(({ member, quote, logoUrl, width = 1000, height = 800 }, ref) => {
  const canvasRef = useRef(null);

  useImperativeHandle(ref, () => ({
    downloadCard(customFilename) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const nameStr = (member?.name || 'Birthday_Card').replace(/\s+/g, '_');
      link.download = customFilename || `Birthday_Card_${nameStr}.png`;
      link.href = dataUrl;
      link.click();
    },
    getCanvas() {
      return canvasRef.current;
    }
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // CPP Brand Colors
    const cppBrandGreen = '#9abf49';
    const cppDarkText = '#1f2415';
    const quoteColor = '#555555';

    // 1. Background Fill - Soft light grey gradient
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#f8f9fa');
    bgGradient.addColorStop(1, '#e9ecef');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Decorative dot grids
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

    // Decorative circle rings
    ctx.strokeStyle = 'rgba(154, 191, 73, 0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(65, 120, 12, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(460, 515, 10, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Logo Section (Top Left - Compliance Professionals PLC)
    const activeLogo = logoUrl || '/cpp-log.png';
    const logoImg = new Image();
    logoImg.crossOrigin = 'Anonymous';
    logoImg.onload = () => {
      ctx.drawImage(logoImg, 50, 100, 400, 65);
    };
    logoImg.onerror = () => drawFallbackLogo(ctx, cppBrandGreen);
    logoImg.src = activeLogo;

    // 3. Center Left Typography ("happy BIRTHDAY")
    // "happy" cursive script text
    ctx.font = 'italic 72px "Great Vibes", "Georgia", "Brush Script MT", cursive, serif';
    ctx.fillStyle = '#1c1c1c';
    ctx.textAlign = 'left';
    ctx.fillText('happy', 145, 395);

    // "BIRTHDAY" bold uppercase CPP green text
    ctx.font = '900 68px "Montserrat", "Arial Black", sans-serif';
    ctx.fillStyle = cppBrandGreen;
    ctx.fillText('BIRTHDAY', 65, 450);

    // 4. Quote Section
    const currentQuote = quote || "Wishing you a beautiful day with good health and happiness forever.";
    ctx.fillStyle = cppBrandGreen;
    ctx.font = 'bold 50px "Georgia", serif';
    ctx.fillText('“', 225, 545);

    ctx.font = 'bold 22px "Inter", "Arial", sans-serif';
    ctx.fillStyle = quoteColor;
    ctx.textAlign = 'center';

    const maxQuoteWidth = 360;
    const words = currentQuote.split(' ');
    const lines = [];
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
      const w = words[i];
      if (ctx.measureText(currentLine + " " + w).width < maxQuoteWidth) {
        currentLine += " " + w;
      } else {
        lines.push(currentLine);
        currentLine = w;
      }
    }
    lines.push(currentLine);

    let lineY = 575;
    lines.forEach(line => {
      ctx.fillText(line, 235, lineY);
      lineY += 30;
    });

    // 5. Right Section - Member Photo Frame
    const photoX = 515;
    const photoY = 40;
    const photoW = 400;
    const photoH = 610;

    // White border frame
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(photoX - 8, photoY - 8, photoW + 16, photoH + 16);

    // Member Photo
    if (member?.picture) {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
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

        drawBadge(ctx, member, cppBrandGreen, cppDarkText);
      };
      img.onerror = () => {
        drawPhotoPlaceholder(ctx, photoX, photoY, photoW, photoH);
        drawBadge(ctx, member, cppBrandGreen, cppDarkText);
      };
      img.src = member.picture;
    } else {
      drawPhotoPlaceholder(ctx, photoX, photoY, photoW, photoH);
      drawBadge(ctx, member, cppBrandGreen, cppDarkText);
    }

    // Triangle graphic accent
    ctx.strokeStyle = '#b0b5be';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(930, 180);
    ctx.lineTo(942, 202);
    ctx.lineTo(918, 202);
    ctx.closePath();
    ctx.stroke();

    // 6. Bottom CPP Accent Line Bar
    ctx.fillStyle = cppBrandGreen;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(360, 770, 280, 8, 4);
    } else {
      ctx.rect(360, 770, 280, 8);
    }
    ctx.fill();

  }, [member, quote, logoUrl, width, height]);

  return (
    <div style={{ position: 'relative', display: 'inline-block', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.12)' }}>
      <canvas ref={canvasRef} width={width} height={height} style={{ width: '100%', height: 'auto', display: 'block' }} />
    </div>
  );
});

function drawFallbackLogo(ctx, cppBrandGreen) {
  ctx.fillStyle = cppBrandGreen;
  ctx.font = 'bold 24px "Montserrat", sans-serif';
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
  ctx.fillText('MEMBER PHOTO', x + w / 2, y + h / 2);
}

function drawBadge(ctx, member, cppBrandGreen, cppDarkText) {
  const badgeX = 605;
  const badgeY = 590;
  const badgeW = 365;
  const badgeH = 110;

  ctx.fillStyle = cppBrandGreen;
  ctx.fillRect(badgeX, badgeY, badgeW, badgeH);

  // Name (Bold Uppercase)
  ctx.fillStyle = cppDarkText;
  ctx.font = '900 24px "Montserrat", sans-serif';
  ctx.textAlign = 'center';
  const nameText = (member?.name || 'MR./MISS NAME HERE').toUpperCase();
  ctx.fillText(nameText, badgeX + badgeW / 2, badgeY + 48);

  // Designation (White Uppercase)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 17px "Inter", sans-serif';
  const desigText = (member?.designation || 'DESIGNATION HERE').toUpperCase();
  ctx.fillText(desigText, badgeX + badgeW / 2, badgeY + 80);
}

export default CardPreview;
