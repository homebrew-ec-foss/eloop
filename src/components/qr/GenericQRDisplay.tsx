import React from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';

interface GenericQRDisplayProps {
  qrData: string;
  title?: string;
  description?: string;
  className?: string;
}

/**
 * A generic QR code display component that can be used for any QR code use case
 */
export const GenericQRDisplay: React.FC<GenericQRDisplayProps> = ({ 
  qrData,
  title,
  description,
  className = ''
}) => {
  // Generate QR code image on client side
  const [qrImage, setQrImage] = React.useState<string>('');

  React.useEffect(() => {
    async function generateQR() {
      try {
        const url = await QRCode.toDataURL(qrData, {
          margin: 1,
          width: 300,
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

  if (!qrImage) {
    return <div className="w-64 h-64 bg-gray-100 animate-pulse rounded-lg"></div>;
  }
  
  return (
    <div className={`flex flex-col items-center ${className}`}>
      {title && <h2 className="text-xl font-semibold mb-2">{title}</h2>}
      {description && <p className="text-gray-600 mb-4">{description}</p>}
      
      <div className="bg-white p-3 border rounded-lg shadow-sm">
        <div className="relative w-64 h-64">
          <Image 
            src={qrImage} 
            alt="QR Code" 
            fill
            style={{ objectFit: 'contain' }}
            className="rounded"
          />
        </div>
      </div>
    </div>
  );
};