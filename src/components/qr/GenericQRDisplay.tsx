"use client";

import React from 'react';
import Image from 'next/image';
import ELogoLoader from '@/components/ui/ELogoLoader';

import QRCode from 'qrcode';

interface GenericQRDisplayProps {
  qrData: string;
  title?: string;
  description?: string;
  className?: string;
  showDownload?: boolean;
  autoDownload?: boolean;
  userName?: string;
  eventName?: string;
  eventDate?: string;
}

/**
 * A generic QR code display component that can be used for any QR code use case
 */
export const GenericQRDisplay: React.FC<GenericQRDisplayProps> = ({
  qrData,
  title,
  description,
  className = '',
  showDownload = true,
  autoDownload = true,
  userName,
  eventName,
  eventDate
}) => {
  // Generate QR code image on client side
  const [qrImage, setQrImage] = React.useState<string>('');
  const [generatedAt] = React.useState<Date>(new Date());

  React.useEffect(() => {
    async function generateQR() {
      try {
        const url = await QRCode.toDataURL(qrData, {
          margin: 1,
          width: 360,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });
        setQrImage(url);
      } catch (err) {
        console.error('Failed to generate QR code:', err);
      }
    }

    if (qrData) {
      generateQR();
    }
  }, [qrData]);

  const downloadQRCode = () => {
    if (!qrImage) return;

    try {
      // Create canvas to combine QR code and timestamp
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // Load QR code image
      const qrImg = document.createElement('img');
      qrImg.crossOrigin = 'anonymous';

      qrImg.onload = () => {
        // Set canvas size (header text + QR code + timestamp)
        const qrSize = 360;
        const headerHeight = (userName || eventName) ? 68 : 0;
        const timestampHeight = 40;
        const padding = 20;
        canvas.width = qrSize + (padding * 2);
        canvas.height = headerHeight + qrSize + timestampHeight + (padding * 2);

        // Fill background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        let currentY = padding;

        // Draw header text (user name and event name)
        if (userName || eventName) {
          ctx.fillStyle = '#1f2937'; // gray-800
          ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'center';

          if (userName) {
            // Extract first name only
            const firstName = userName.trim().split(' ')[0];
            ctx.fillText(firstName, canvas.width / 2, currentY + 20);
            currentY += 25;
          }

          if (eventName) {
            ctx.fillStyle = '#374151'; // gray-700
            ctx.font = '12px system-ui, -apple-system, sans-serif';
            ctx.fillText(eventName, canvas.width / 2, currentY + 15);
            currentY += 20;
          }

          currentY += 10; // Add some spacing before QR code
        }

        // Draw QR code
        ctx.drawImage(qrImg, padding, currentY, qrSize, qrSize);
        currentY += qrSize + 25;

        // Draw timestamp text
        ctx.fillStyle = '#6b7280'; // gray-500
        ctx.font = '12px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        const timestampText = `Generated at: ${generatedAt.toLocaleString()}`;
        ctx.fillText(timestampText, canvas.width / 2, currentY);

        // Convert to blob and download
        canvas.toBlob((blob) => {
          if (!blob) {
            console.error('Failed to create blob from canvas');
            alert('Failed to download QR code. Please try again.');
            return;
          }

          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;

          // Create filename: QR_NAME_TIMESTAMP
          const sanitizeForFilename = (str: string) =>
            str.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_').substring(0, 30);

          const firstName = userName ? userName.trim().split(' ')[0] : 'User';
          const namePart = sanitizeForFilename(firstName);
          const timestamp = generatedAt.getTime();

          link.download = `QR_${namePart}_${timestamp}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Clean up
          URL.revokeObjectURL(url);
        }, 'image/png');
      };

      qrImg.onerror = () => {
        console.error('Failed to load QR code image');
        alert('Failed to download QR code. Please try again.');
      };

      qrImg.src = qrImage;
    } catch (err) {
      console.error('Failed to download QR code:', err);
      alert('Failed to download QR code. Please try again.');
    }
  };

  React.useEffect(() => {
    if (autoDownload && qrImage) {
      downloadQRCode();
    }
  }, [autoDownload, qrImage]);

  // Parallax tilt effect (desktop only) + dynamic shadow depth
  const ticketRef = React.useRef<HTMLDivElement | null>(null);
  const [transformStyle, setTransformStyle] = React.useState<string>('perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0px)');
  const [shadowStyle, setShadowStyle] = React.useState<string>('0 8px 18px rgba(2,6,23,0.06), 0 1px 2px rgba(2,6,23,0.04)');

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Enable only on desktop width to avoid interfering with touch devices
    if (typeof window === 'undefined' || window.innerWidth < 768) return;
    const el = ticketRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const centerX = x - 0.5;
    const centerY = y - 0.5;

    const rotateY = centerX * 14; // degrees (slightly stronger)
    const rotateX = -centerY * 10; // degrees
    const translateZ = 8; // px

    // compute shadow based on tilt magnitude
    const distance = Math.sqrt(centerX * centerX + centerY * centerY);
    const offsetX = Math.round(-centerX * 14);
    const offsetY = Math.round(centerY * 18);
    const blur = Math.round(20 + distance * 30);
    const opacity = (0.06 + Math.min(0.16, distance * 0.18)).toFixed(3);

    const newShadow = `${offsetX}px ${offsetY}px ${blur}px rgba(2,6,23,${opacity}), 0 2px 6px rgba(2,6,23,0.06)`;

    // use rAF for smooth updates
    window.requestAnimationFrame(() => {
      setTransformStyle(`perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(${translateZ}px)`);
      setShadowStyle(newShadow);
    });
  };

  const handleMouseLeave = () => {
    setTransformStyle('perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0px)');
    setShadowStyle('0 8px 18px rgba(2,6,23,0.06), 0 1px 2px rgba(2,6,23,0.04)');
  };

  if (!qrImage) {
    return <div className="w-64 h-64 md:w-[420px] md:h-[420px] bg-gray-100 animate-pulse rounded-lg"></div>;
  }

  const formattedDate = (eventDate && !isNaN(Date.parse(eventDate)))
    ? new Date(eventDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  return (
    <div className={`flex flex-col items-center ${className} font-sans`}>
      <div
        ref={ticketRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="bg-white rounded-2xl overflow-hidden w-[320px] md:w-[420px] pt-6 transition-transform transition-shadow duration-200 ease-out"
        style={{ transform: transformStyle, boxShadow: shadowStyle, willChange: 'transform, box-shadow' }}
      >

        {/* Top header inside ticket: event name and description */}
        <div className="px-4 pb-2 text-center">
          {eventName && <div className="text-lg font-semibold text-slate-900 leading-tight break-words">{eventName}</div>}
          <div className="text-sm text-slate-500 mt-1 truncate">{description || 'Show this to event staff at checkpoints'}</div>
        </div>

        <div className="px-4 py-3">
          <div className="flex justify-center">
            <div className="w-[300px] h-[300px] md:w-[360px] md:h-[360px] relative">
              <Image src={qrImage} alt="QR Code" fill style={{ objectFit: 'contain' }} className="rounded" />
            </div>
          </div>
          <div className="mt-3 text-center">
            <p className="text-sm text-slate-500">Generated: {generatedAt.toLocaleString()}</p>
          </div>
        </div>

        <div className="border-t border-dashed border-slate-200" />

        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-slate-900">{userName ? userName.trim().split(' ')[0] : 'Guest'}</div>
            <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">PAX 1</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xxs text-slate-400">Powered by</div>
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center">
              <ELogoLoader size={24} colorClass="text-indigo-600" className="m-0" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};