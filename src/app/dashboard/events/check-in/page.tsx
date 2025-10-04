'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { GenericQRScanner } from '@/components/qr/GenericQRScanner';
import { Check, X, RefreshCw, User, Calendar, MapPin } from 'lucide-react';

interface CheckpointCheckIn {
  checkpoint: string;
  checkedInBy: string;
  checkedInAt: string;
}

interface CheckInResponse {
  success: boolean;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  registration?: {
    id: string;
    eventId: string;
    eventName?: string;
    userId: string;
    status: 'registered' | 'checked-in';
    responses: Record<string, unknown>;
    checkedInAt?: Date;
    checkpointCheckIns?: CheckpointCheckIn[];
  };
  error?: string;
}

export default function CheckInPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isScanning, setIsScanning] = useState(true);
  const [scanResult, setScanResult] = useState<CheckInResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentCheckIns, setRecentCheckIns] = useState<CheckInResponse[]>([]);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<string>('');
  const [availableCheckpoints, setAvailableCheckpoints] = useState<string[]>([]);
  const [loadingCheckpoints, setLoadingCheckpoints] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [availableEvents, setAvailableEvents] = useState<Array<{
    id: string, 
    name: string, 
    checkpoints: string[],
    unlockedCheckpoints: string[]
  }>>([]);
  const [autoScanEnabled, setAutoScanEnabled] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);
  const isOrganizer = session?.user?.role === 'organizer' || session?.user?.role === 'admin';
  
  // Audio refs for sound effects
  const successSoundRef = useRef<HTMLAudioElement | null>(null);
  const errorSoundRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio on mount
  useEffect(() => {
    // Create success sound (higher pitch beep)
    const successAudio = new Audio();
    successAudio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE=';
    successSoundRef.current = successAudio;

    // Create error sound (lower pitch buzz)
    const errorAudio = new Audio();
    errorAudio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAgoSCfXp6fYGEhIN/e3t/hIiIhH99fYCEiIiFgn5+gYWIiIWCfn6BhYiIhYJ+foGFiIiFgn5+gYWIiIWCfn6BhYiIhYJ+foGFiIiFgn5+gYWIiIWCfn6BhYiIhYJ+foGFiIiFgn5+gYWIiIWCfn6BhYiIhYJ+foGFiIiFgn5+gYWIiIWCfn6BhYiIhYJ+';
    errorSoundRef.current = errorAudio;
  }, []);

  // Fetch available events and their checkpoints
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch('/api/events');
        if (!response.ok) throw new Error('Failed to fetch events');
        
        const data = await response.json();
        const events = data.events || data;
        
        if (events && events.length > 0) {
          // Store all events with their checkpoints and unlocked checkpoints
          const eventList = events.map((event: {
            id: string, 
            name: string, 
            checkpoints?: string[],
            unlockedCheckpoints?: string[]
          }) => ({
            id: event.id,
            name: event.name,
            checkpoints: event.checkpoints || ['Registration', 'Lunch', 'Dinner'],
            unlockedCheckpoints: event.unlockedCheckpoints || ['Registration']
          }));
          
          setAvailableEvents(eventList);
          
          // Auto-select first event
          setSelectedEvent(eventList[0].id);
          
          // Volunteers: only show unlocked checkpoints
          // Organizers: show all checkpoints
          const checkpointsToShow = isOrganizer 
            ? eventList[0].checkpoints 
            : eventList[0].unlockedCheckpoints;
          
          setAvailableCheckpoints(checkpointsToShow);
          setSelectedCheckpoint(checkpointsToShow[0]);
        } else {
          // Fallback to default
          setAvailableCheckpoints(['Registration']);
          setSelectedCheckpoint('Registration');
        }
      } catch (err) {
        console.error('Error fetching events:', err);
        // Fallback to default checkpoints
        setAvailableCheckpoints(['Registration', 'Lunch', 'Dinner']);
        setSelectedCheckpoint('Registration');
      } finally {
        setLoadingCheckpoints(false);
      }
    };

    fetchEvents();
  }, [isOrganizer]);

  // Update checkpoints when event selection changes
  const handleEventChange = (eventId: string) => {
    setSelectedEvent(eventId);
    const event = availableEvents.find(e => e.id === eventId);
    if (event) {
      // Volunteers: only show unlocked checkpoints
      // Organizers: show all checkpoints
      const checkpointsToShow = isOrganizer 
        ? event.checkpoints 
        : event.unlockedCheckpoints;
      
      setAvailableCheckpoints(checkpointsToShow);
      setSelectedCheckpoint(checkpointsToShow[0]);
      // Reset scanner with new key when changing events (this will reset camera)
      setScannerKey(prev => prev + 1);
    }
  };
  
  // Verify user has proper permissions (volunteers, organizers, admins only)
  useEffect(() => {
    if (session && session.user) {
      const userRole = session.user.role;
      // Redirect participants back to their dashboard
      if (userRole === 'participant') {
        router.push('/dashboard');
        return;
      }
      // Block other unauthorized roles
      if (userRole !== 'admin' && userRole !== 'organizer' && userRole !== 'volunteer') {
        router.push('/dashboard');
      }
    }
  }, [session, router]);

  const playSuccessSound = () => {
    if (successSoundRef.current) {
      successSoundRef.current.currentTime = 0;
      successSoundRef.current.play().catch(e => console.log('Audio play failed:', e));
    }
  };

  const playErrorSound = () => {
    if (errorSoundRef.current) {
      // Play error sound 3 times with short delays
      const playBeep = (count: number) => {
        if (count > 0 && errorSoundRef.current) {
          errorSoundRef.current.currentTime = 0;
          errorSoundRef.current.play().catch(e => console.log('Audio play failed:', e));
          setTimeout(() => playBeep(count - 1), 200); // 200ms between beeps
        }
      };
      playBeep(3);
    }
  };

  const handleScan = async (qrData: string) => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);
      setError(null);
      setScanResult(null);
      setIsScanning(false);
      
      // Call the check-in API with checkpoint
      const response = await fetch('/api/events/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          qrToken: qrData,
          checkpoint: selectedCheckpoint 
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || 'Failed to process check-in');
        playErrorSound();
        return;
      }
      
      // Show success
      setScanResult(data);
      playSuccessSound();
      
      // Add to recent check-ins
      setRecentCheckIns(prev => [data, ...prev.slice(0, 4)]);
    } catch (err) {
      const errorMsg = 'Failed to process QR code: ' + (err instanceof Error ? err.message : String(err));
      setError(errorMsg);
      playErrorSound();
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset scanner
  const resetScanner = () => {
    setIsScanning(true);
    setScanResult(null);
    setError(null);
  };

  // Auto-scan: automatically restart scanning after successful check-in
  useEffect(() => {
    if (autoScanEnabled && scanResult?.success && !isScanning) {
      const timer = setTimeout(() => {
        resetScanner();
      }, 2000); // Wait 2 seconds after successful scan before restarting
      
      return () => clearTimeout(timer);
    }
  }, [autoScanEnabled, scanResult, isScanning]);

  if (!session?.user) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Scanner */}
        <div>
          <h1 className="text-2xl font-bold mb-4">Check-In Scanner</h1>
          
          <div className="mb-4">
            <p className="text-gray-600 text-sm mb-3">
              Scan participant QR codes to check them into the event.
            </p>
            
            {/* Event Selector */}
            {availableEvents.length > 1 && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Calendar className="inline w-4 h-4 mr-1" />
                  Select Event
                </label>
                <select
                  value={selectedEvent}
                  onChange={(e) => handleEventChange(e.target.value)}
                  className="w-full px-3 py-2 border border-purple-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {availableEvents.map(event => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Checkpoint Selector */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <MapPin className="inline w-4 h-4 mr-1" />
                    Select Checkpoint (Sequential Order)
                  </label>
                  {loadingCheckpoints ? (
                    <div className="text-center py-4">
                      <div className="animate-pulse text-gray-500">Loading checkpoints...</div>
                    </div>
                  ) : availableCheckpoints.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">
                      <p>No checkpoints available</p>
                      <p className="text-xs mt-1">Create an event with checkpoints first</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2 flex-wrap">
                        {availableCheckpoints.map((checkpoint, index) => (
                          <button
                            key={checkpoint}
                            onClick={() => setSelectedCheckpoint(checkpoint)}
                            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                              selectedCheckpoint === checkpoint
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                            }`}
                          >
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                              selectedCheckpoint === checkpoint
                                ? 'bg-blue-800 text-white'
                                : 'bg-gray-200 text-gray-700'
                            }`}>
                              {index + 1}
                            </span>
                            {checkpoint}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-600 mt-3">
                        Currently checking into: <strong>{selectedCheckpoint}</strong>
                      </p>
                      <p className="text-xs text-amber-600 mt-1">
                        ⚠️ Participants must complete checkpoints in order
                      </p>
                    </>
                  )}
                </div>
            
            {/* Auto-Scan Toggle */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={autoScanEnabled}
                    onChange={(e) => setAutoScanEnabled(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`block w-14 h-8 rounded-full transition ${
                    autoScanEnabled ? 'bg-green-600' : 'bg-gray-400'
                  }`}></div>
                  <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition ${
                    autoScanEnabled ? 'transform translate-x-6' : ''
                  }`}></div>
                </div>
                <div className="ml-3 flex-1">
                  <span className="text-sm font-semibold text-gray-700">Auto-Scan Next</span>
                  <p className="text-xs text-gray-600">Automatically scan next participant after 2 seconds</p>
                </div>
              </label>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-md relative">
            {/* Scanner - always mounted to preserve camera selection */}
            <div className={isScanning ? '' : 'hidden'}>
              <GenericQRScanner
                key={scannerKey}
                onScan={handleScan}
                scannerTitle="Check-In Scanner"
                scannerDescription="Scan participant QR code"
                isActive={isScanning}
              />
            </div>
            
            {/* Results overlay - shown on top of scanner */}
            {!isScanning && (
              <div className="py-2">
                {isProcessing ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-600">Processing check-in...</p>
                  </div>
                ) : error ? (
                  <div className="text-center py-4">
                    <div className="bg-red-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                      <X className="text-red-500 w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-semibold mb-2 text-red-600">Check-In Failed</h2>
                    <p className="text-red-600 mb-6">{error}</p>
                  <button
                    onClick={resetScanner}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 inline-flex items-center"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" /> Scan Again
                  </button>
                </div>
              ) : scanResult?.success ? (
                <div className="text-center py-4">
                  <div className="bg-green-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <Check className="text-green-500 w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2 text-green-600">✓ Check-In Successful</h2>
                  
                  {scanResult.user && (
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-center mb-2">
                        <User className="w-5 h-5 mr-2 text-gray-600" />
                        <p className="font-semibold text-lg">{scanResult.user.name}</p>
                      </div>
                      <p className="text-sm text-gray-600">{scanResult.user.email}</p>
                    </div>
                  )}
                  
                  <button
                    onClick={resetScanner}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 inline-flex items-center"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" /> Scan Next
                  </button>
                </div>
              ) : null}
            </div>
            )}
          </div>
        </div>

        {/* Right Column: Recent Check-ins & History */}
        <div>
          <h2 className="text-xl font-bold mb-4">Recent Check-Ins</h2>
          
          {recentCheckIns.length === 0 ? (
            <div className="bg-white p-6 rounded-lg shadow-md text-center text-gray-500">
              <p>No recent check-ins</p>
                <p className="text-sm mt-2">Scanned participants will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentCheckIns.map((checkIn, index) => (
                  <div key={index} className="bg-white p-4 rounded-lg shadow-md border-l-4 border-green-500">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <User className="w-4 h-4 mr-2 text-gray-600" />
                          <h3 className="font-semibold">{checkIn.user?.name}</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{checkIn.user?.email}</p>
                        
                        {checkIn.registration?.eventName && (
                          <div className="flex items-center text-sm text-gray-500 mb-2">
                            <Calendar className="w-4 h-4 mr-1" />
                            <span>{checkIn.registration.eventName}</span>
                          </div>
                        )}
                        
                        {/* Checkpoint History */}
                        {checkIn.registration?.checkpointCheckIns && checkIn.registration.checkpointCheckIns.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center">
                              <MapPin className="w-3 h-3 mr-1" />
                              Checkpoint History:
                            </p>
                            <div className="space-y-1">
                              {checkIn.registration.checkpointCheckIns.map((cp, cpIndex) => (
                                <div key={cpIndex} className="text-xs text-gray-600 flex items-center justify-between bg-gray-50 p-2 rounded">
                                  <span className="font-medium">{cp.checkpoint}</span>
                                  <span className="text-gray-500">
                                    {new Date(cp.checkedInAt).toLocaleTimeString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="ml-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ✓ Checked In
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
      </div>
    </div>
  );
}