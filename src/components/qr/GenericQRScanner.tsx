import React, { useState, useEffect } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { Camera, CameraOff, AlertCircle, SwitchCamera } from 'lucide-react';

interface GenericQRScannerProps {
  onScan: (qrData: string) => void;
  isActive?: boolean;
  scannerTitle?: string;
  scannerDescription?: string;
  className?: string;
}

export const GenericQRScanner: React.FC<GenericQRScannerProps> = ({
  onScan,
  isActive: externalActive,
  scannerTitle = "Scan QR Code",
  scannerDescription = "Point your camera at the QR code",
  className = ""
}) => {
  const [internalActive, setInternalActive] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isMobile, setIsMobile] = useState(false);
  const isScanning = externalActive !== undefined ? externalActive : internalActive;

  // Detect if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as { opera?: string }).opera;
      const mobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent?.toLowerCase() || '');
      setIsMobile(mobile);
    };
    checkMobile();
  }, []);

  // Check camera permission and enumerate devices on mount
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        // Check if we're on a secure context (required for camera)
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setError('Camera not supported on this device');
          setHasPermission(false);
          return;
        }

        // Check if we're on HTTPS (required for camera on many mobile browsers)
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
          setError('Camera requires HTTPS connection');
          setHasPermission(false);
          return;
        }

        console.log('Requesting camera permission...');
        
        // Request permission with preference for back camera
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: { ideal: 'environment' } // Prefer back camera on mobile
          }
        });
        
        console.log('Camera permission granted, enumerating devices...');
        
        // NOW enumerate devices - Android will show proper labels after permission is granted
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = deviceList.filter(device => device.kind === 'videoinput');
        
        console.log('Found cameras:', videoDevices.length, videoDevices.map(d => d.label));
        
        // Stop the test stream AFTER enumeration
        stream.getTracks().forEach(track => track.stop());
        
        setDevices(videoDevices);
        
        // Try to find the back camera by default
        const backCamera = videoDevices.find(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('rear') ||
          device.label.toLowerCase().includes('environment') ||
          device.label.toLowerCase().includes('후면') || // Korean
          device.label.toLowerCase().includes('trasera') // Spanish
        );
        
        if (backCamera) {
          console.log('Selected back camera:', backCamera.label);
          setSelectedDeviceId(backCamera.deviceId);
        } else if (videoDevices.length > 1) {
          // If we can't find back camera by label, assume last camera is back on mobile
          console.log('Using last camera as back camera:', videoDevices[videoDevices.length - 1].label);
          setSelectedDeviceId(videoDevices[videoDevices.length - 1].deviceId);
        } else if (videoDevices.length > 0) {
          console.log('Using first available camera:', videoDevices[0].label);
          setSelectedDeviceId(videoDevices[0].deviceId);
        }
        
        setHasPermission(true);
      } catch (err) {
        console.error('Camera initialization error:', err);
        setHasPermission(false);
        setError('Camera permission denied or not available: ' + ((err as Error)?.message || 'Unknown error'));
      }
    };

    initializeCamera();
  }, []);


  const handleScan = (results: unknown[]) => {
    if (results && results.length > 0 && (results[0] as { rawValue?: string }).rawValue) {
      onScan((results[0] as { rawValue: string }).rawValue);
    }
  };

  const handleError = (error: unknown) => {
    console.error('QR Scanner error:', error);
    setError('Camera error: ' + ((error as Error)?.message || 'Unknown error'));
  };

  const toggleScanner = () => {
    setInternalActive(!internalActive);
    setError(null); // Clear error when toggling
  };

  const retryCamera = () => {
    setError(null);
    setHasPermission(null);
    setTimeout(() => {
      window.location.reload(); // Simple retry - reload the page
    }, 100);
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {scannerTitle && <h3 className="text-lg font-medium mb-2">{scannerTitle}</h3>}
      
      {/* Camera Selection - Unified for both mobile and desktop */}
      {devices.length > 0 && hasPermission && (
        <div className="w-full max-w-md mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <SwitchCamera className="inline h-4 w-4 mr-1" />
            Select Camera ({devices.length} available)
          </label>
          
          {/* Quick toggle buttons for front/back - shown for all devices with multiple cameras */}
          {devices.length > 1 && (
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => {
                  const backCamera = devices.find(d => 
                    d.label.toLowerCase().includes('back') || 
                    d.label.toLowerCase().includes('rear') ||
                    d.label.toLowerCase().includes('environment') ||
                    d.label.toLowerCase().includes('후면') || // Korean
                    d.label.toLowerCase().includes('trasera') // Spanish
                  );
                  if (backCamera) {
                    setSelectedDeviceId(backCamera.deviceId);
                  } else if (devices.length > 1) {
                    // Fallback: assume last camera is back camera on mobile
                    setSelectedDeviceId(devices[devices.length - 1].deviceId);
                  }
                }}
                className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
                  devices.find(d => d.deviceId === selectedDeviceId)?.label.toLowerCase().includes('back') ||
                  devices.find(d => d.deviceId === selectedDeviceId)?.label.toLowerCase().includes('rear') ||
                  devices.find(d => d.deviceId === selectedDeviceId)?.label.toLowerCase().includes('environment') ||
                  selectedDeviceId === devices[devices.length - 1]?.deviceId
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                📷 Back
              </button>
              <button
                onClick={() => {
                  const frontCamera = devices.find(d => 
                    d.label.toLowerCase().includes('front') || 
                    d.label.toLowerCase().includes('user') ||
                    d.label.toLowerCase().includes('face') ||
                    d.label.toLowerCase().includes('전면') || // Korean
                    d.label.toLowerCase().includes('frontal') // Spanish
                  );
                  if (frontCamera) {
                    setSelectedDeviceId(frontCamera.deviceId);
                  } else if (devices.length > 0) {
                    // Fallback: assume first camera is front camera
                    setSelectedDeviceId(devices[0].deviceId);
                  }
                }}
                className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
                  devices.find(d => d.deviceId === selectedDeviceId)?.label.toLowerCase().includes('front') ||
                  devices.find(d => d.deviceId === selectedDeviceId)?.label.toLowerCase().includes('user') ||
                  devices.find(d => d.deviceId === selectedDeviceId)?.label.toLowerCase().includes('face') ||
                  selectedDeviceId === devices[0]?.deviceId
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🤳 Front
              </button>
            </div>
          )}
          
          {/* Dropdown selector - shown for all cases */}
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {devices.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${index + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="w-full max-w-md mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <div className="text-sm text-red-700">
              <p className="font-medium">Camera Error</p>
              <p>{error}</p>
              <button 
                onClick={retryCamera}
                className="mt-1 text-red-600 hover:text-red-800 underline"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permission status */}
      {hasPermission === false && !error && (
        <div className="w-full max-w-md mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-400 mr-2" />
            <div className="text-sm text-yellow-700">
              <p className="font-medium">Camera Access Required</p>
              <p>Please allow camera access and ensure you&apos;re using HTTPS</p>
              <button 
                onClick={retryCamera}
                className="mt-1 text-yellow-600 hover:text-yellow-800 underline"
              >
                Retry Camera Access
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No cameras detected warning */}
      {hasPermission === true && devices.length === 0 && (
        <div className="w-full max-w-md mb-4 p-3 bg-orange-50 border border-orange-200 rounded-md">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-orange-400 mr-2" />
            <div className="text-sm text-orange-700">
              <p className="font-medium">No Cameras Found</p>
              <p>Permission granted but no cameras detected. Try:</p>
              <ul className="list-disc ml-4 mt-1">
                <li>Refreshing the page</li>
                <li>Checking if another app is using the camera</li>
                <li>Restarting your browser</li>
              </ul>
              <button 
                onClick={retryCamera}
                className="mt-2 px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700"
              >
                Refresh Camera
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative w-full max-w-md aspect-square bg-black rounded-lg overflow-hidden">
        {isScanning && hasPermission ? (
          <Scanner
            onScan={handleScan}
            onError={handleError}
            styles={{ 
              container: { 
                height: '100%', 
                width: '100%',
                position: 'relative'
              },
              video: {
                objectFit: 'cover',
                height: '100%',
                width: '100%'
              }
            }}
            scanDelay={300}
            constraints={
              // If we have a selected device, use it. Otherwise fallback to facingMode
              selectedDeviceId && devices.length > 0
                ? { 
                    deviceId: { exact: selectedDeviceId },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                  }
                : { 
                    // Fallback for Android when device enumeration fails but permission is granted
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                  }
            }
            components={{
              finder: true,
              torch: false
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 text-white">
            <div className="text-center">
              <Camera className="mx-auto h-12 w-12 mb-2" />
              <p>Camera is off</p>
              {hasPermission === false && (
                <p className="text-sm text-gray-300 mt-1">Check permissions</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile-specific instructions */}
      <div className="mt-4 text-center text-sm text-gray-600 max-w-md">
        <p className="mb-2">{scannerDescription}</p>
        {isMobile && (
          <>
            <p className="text-xs mb-1">
              📱 <strong>Mobile:</strong> Ensure camera permissions are granted
            </p>
            <p className="text-xs text-gray-500">
              Cameras detected: {devices.length} | Selected: {selectedDeviceId ? '✓' : '✗'}
            </p>
          </>
        )}
      </div>

      {/* Only show toggle if this is uncontrolled */}
      {externalActive === undefined && (
        <button 
          onClick={toggleScanner}
          className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          disabled={hasPermission === false}
        >
          {isScanning ? (
            <>
              <CameraOff className="mr-2 h-5 w-5" />
              Stop Scanner
            </>
          ) : (
            <>
              <Camera className="mr-2 h-5 w-5" />
              Start Scanner
            </>
          )}
        </button>
      )}
    </div>
  );
};