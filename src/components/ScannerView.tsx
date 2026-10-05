import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, RefreshCw, Sparkles, AlertCircle, HelpCircle, Layers, CheckCircle2, X } from 'lucide-react';
import { PlantDiagnosisResult } from '../types/plant';
import { SAMPLE_CASES } from '../data/sampleCases';
import { apiService } from '../services/apiService';

import { compressImageFile } from '../utils/imageUtils';

interface ScannerViewProps {
  onScanComplete: (result: PlantDiagnosisResult) => void;
  onOpenScanGuide: () => void;
  onSelectSample: (sample: PlantDiagnosisResult) => void;
}

export const ScannerView: React.FC<ScannerViewProps> = ({
  onScanComplete,
  onOpenScanGuide,
  onSelectSample
}) => {
  const [primaryImage, setPrimaryImage] = useState<string | null>(null);
  const [secondaryImage, setSecondaryImage] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<'primary' | 'secondary'>('primary');
  const [cropHint, setCropHint] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanStepText, setScanStepText] = useState<string>('તૈયાર');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Hidden native file inputs (synchronously triggered for 100% reliable camera opening)
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Direct synchronous camera trigger (guaranteed to open camera in all iframes and mobile browsers)
  const openDeviceCamera = () => {
    setErrorMsg(null);
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  const openGallery = () => {
    setErrorMsg(null);
    if (galleryInputRef.current) {
      galleryInputRef.current.click();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    try {
      // Auto-compress large phone photos to crisp diagnostic resolution (~150KB)
      const compressedDataUrl = await compressImageFile(file, 1280, 0.85);
      assignImage(compressedDataUrl);
    } catch {
      // Fallback to FileReader if canvas compression has any issue
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          assignImage(dataUrl);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const assignImage = (dataUrl: string) => {
    if (activeSlot === 'primary') {
      setPrimaryImage(dataUrl);
      // Auto move slot to secondary if empty
      if (!secondaryImage) {
        setActiveSlot('secondary');
      }
    } else {
      setSecondaryImage(dataUrl);
    }
  };

  const removeImage = (slot: 'primary' | 'secondary') => {
    if (slot === 'primary') {
      setPrimaryImage(null);
      setActiveSlot('primary');
    } else {
      setSecondaryImage(null);
      setActiveSlot('secondary');
    }
  };

  const handleStartScan = async () => {
    if (!primaryImage) {
      setErrorMsg('કૃપા કરીને પહેલા પાન અથવા છોડનો ફોટો લો કે અપલોડ કરો.');
      return;
    }

    setIsScanning(true);
    setErrorMsg(null);

    const steps = [
      '૧/૪: ફોટો ગુણવત્તા અને પ્રકાશનું મૂલ્યાંકન...',
      '૨/૪: પાંદડાનો આકાર અને રંગ વિશ્લેષણ...',
      '૩/૪: રોગ, ફૂગ અને જીવાતના લક્ષણ સ્કેનિંગ...',
      '૪/૪: ગુજરાતી કૃષિ રિપોર્ટ અને સલામતી માર્ગદર્શિકા...'
    ];

    let stepIdx = 0;
    setScanStepText(steps[0]);
    const stepInterval = setInterval(() => {
      stepIdx++;
      if (stepIdx < steps.length) {
        setScanStepText(steps[stepIdx]);
      }
    }, 900);

    try {
      const imagesToAnalyze = [primaryImage];
      if (secondaryImage) {
        imagesToAnalyze.push(secondaryImage);
      }

      const result = await apiService.analyzePlant(imagesToAnalyze, cropHint);
      clearInterval(stepInterval);
      setIsScanning(false);
      onScanComplete(result);
    } catch (err: any) {
      clearInterval(stepInterval);
      setIsScanning(false);
      setErrorMsg(err?.message || 'સ્કેનિંગ દરમિયાન ક્ષતિ આવી. કૃપા કરીને ફરી પ્રયાસ કરો.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 sm:py-6">
      {/* Title & Tagline */}
      <div className="text-center mb-5">
        <h2 className="text-xl sm:text-2xl font-bold text-emerald-950 flex items-center justify-center gap-2">
          <span>🌱 સ્માર્ટ પાક અને છોડ સ્કેનર</span>
        </h2>
        <p className="text-xs sm:text-sm text-emerald-800/80 mt-1">
          “ફોટો લો – પાક ઓળખો – સમસ્યા જાણો – યોગ્ય સંભાળ મેળવો”
        </p>
      </div>

      {/* Hidden native input files for 100% reliable capture on all devices */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Main Photo Card & Preview Frame */}
      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden mb-5">
        {/* Slot selector tabs (Primary leaf vs Whole plant) */}
        <div className="flex border-b border-slate-100 bg-slate-50/80 p-1.5 gap-1.5 text-xs font-semibold">
          <button
            onClick={() => setActiveSlot('primary')}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
              activeSlot === 'primary'
                ? 'bg-white text-emerald-800 shadow-sm border border-emerald-100'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>૧. પાનનો Close-up ફોટો</span>
            {primaryImage && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
          </button>
          <button
            onClick={() => setActiveSlot('secondary')}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
              activeSlot === 'secondary'
                ? 'bg-white text-emerald-800 shadow-sm border border-emerald-100'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>૨. આખો છોડ / પાછળનો ભાગ (વૈકલ્પિક)</span>
            {secondaryImage && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
          </button>
        </div>

        {/* Viewport & Scanner Simulation */}
        <div 
          onClick={() => {
            if (!(activeSlot === 'primary' ? primaryImage : secondaryImage) && !isScanning) {
              openDeviceCamera();
            }
          }}
          className={`relative aspect-[4/3] bg-emerald-950/90 flex items-center justify-center overflow-hidden ${
            !(activeSlot === 'primary' ? primaryImage : secondaryImage) ? 'cursor-pointer group hover:bg-emerald-900/90 transition-colors' : ''
          }`}
        >
          {/* Active Image Display */}
          {(activeSlot === 'primary' ? primaryImage : secondaryImage) ? (
            <div className="relative w-full h-full">
              <img
                src={(activeSlot === 'primary' ? primaryImage : secondaryImage)!}
                alt="Selected crop"
                className="w-full h-full object-contain"
              />

              {/* Laser Scan Animation Overlay */}
              {isScanning && (
                <>
                  <div className="absolute inset-0 bg-emerald-900/30 backdrop-blur-[1px] pointer-events-none" />
                  <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#22c55e] animate-scan pointer-events-none" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-black/40 text-white">
                    <div className="w-12 h-12 rounded-full border-3 border-emerald-400 border-t-transparent animate-spin mb-3" />
                    <span className="text-sm font-bold text-emerald-300 tracking-wide">{scanStepText}</span>
                    <span className="text-xs text-slate-200 mt-1">કૃપા કરીને રાહ જુઓ...</span>
                  </div>
                </>
              )}

              {/* Remove button */}
              {!isScanning && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(activeSlot);
                  }}
                  className="absolute top-3 right-3 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition-colors"
                  title="ફોટો હટાવો"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            /* Empty State / Photo Capture Placeholder - Clickable! */
            <div className="text-center p-6 text-white max-w-sm select-none">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-800/60 border border-emerald-500/40 flex items-center justify-center text-emerald-300 mb-3 shadow-inner group-hover:scale-105 group-hover:bg-emerald-700/70 transition-all">
                <Camera className="w-8 h-8" />
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-emerald-100 group-hover:text-white transition-colors">
                {activeSlot === 'primary'
                  ? 'અહીં ટચ કરી પાનનો ફોટો લો'
                  : 'અહીં ટચ કરી આખા છોડનો ફોટો લો'}
              </h3>
              <p className="text-xs text-emerald-300/80 mt-1">
                કેમેરાથી તાજો ફોટો પાડો અથવા નીચેથી ગેલેરીમાંથી પસંદ કરો
              </p>
              <span className="inline-block mt-3 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-[11px] font-medium">
                📸 કેમેરા ચાલુ કરવા ટચ કરો
              </span>
            </div>
          )}
        </div>

        {/* Capture Action Buttons */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openDeviceCamera}
              disabled={isScanning}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 active:scale-95 text-white text-xs font-semibold transition-all disabled:opacity-50 shadow-sm cursor-pointer"
            >
              <Camera className="w-4 h-4 text-emerald-300" />
              <span>કેમેરાથી ફોટો લો</span>
            </button>

            <button
              type="button"
              onClick={openGallery}
              disabled={isScanning}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer border border-slate-200"
            >
              <Upload className="w-4 h-4 text-slate-600" />
              <span>ગેલેરીમાંથી પસંદ કરો</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenScanGuide}
            className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 font-semibold py-1 px-2"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>કેવો ફોટો લેવો?</span>
          </button>
        </div>
      </div>

      {/* Optional Crop/Plant Hint Field */}
      <div className="bg-white rounded-xl p-3.5 shadow-sm border border-emerald-100 mb-4">
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-semibold text-slate-700">
            🌿 પાક કે છોડનું નામ (વૈકલ્પિક - જો ખબર હોય તો જ લખો):
          </label>
          <span className="text-[10px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            જે ફોટો સ્કેન થશે તેની જ માહિતી મળશે
          </span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={cropHint}
            onChange={(e) => setCropHint(e.target.value)}
            placeholder="દા.ત. ગુલાબ, લીંબુ, આંબો, ટામેટા, મરચાં, કપાસ, ઘઉં (ખાલી પણ રાખી શકાય)"
            disabled={isScanning}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
          />
          {cropHint && (
            <button
              onClick={() => setCropHint('')}
              className="px-2 py-1 text-xs text-slate-400 hover:text-slate-600"
            >
              સાફ કરો
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>ખેતરનો પાક, બગીચાનો છોડ, ફળઝાડ કે શાકભાજી — સ્કેનરમાં મુકેલા ફોટાનું જ ચોક્કસ વિશ્લેષણ થશે.</span>
        </p>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{errorMsg}</p>
            <p className="text-[11px] text-red-600 mt-0.5">
              વૈકલ્પિક રીતે નીચે આપેલા નમૂના પાક (Sample cases) અજમાવી શકો છો.
            </p>
          </div>
        </div>
      )}

      {/* Large Scan Now Primary CTA */}
      <div className="mb-6">
        <button
          onClick={handleStartScan}
          disabled={!primaryImage || isScanning}
          className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all shadow-md ${
            !primaryImage || isScanning
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              : 'bg-emerald-700 hover:bg-emerald-800 text-white active:scale-[0.99] glow-active'
          }`}
        >
          {isScanning ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>AI વિશ્લેષણ ચાલુ છે...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-amber-300" />
              <span>AI સ્કેન શરૂ કરો (Scan Now)</span>
            </>
          )}
        </button>
      </div>

      {/* Quick Demo Samples Bar */}
      <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-emerald-800" />
            <h4 className="text-xs font-bold text-emerald-950">
              અથવા તાત્કાલિક ડેમો માટે નમૂના પાક પસંદ કરો:
            </h4>
          </div>
          <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-semibold">
            ૮ પાક ઉપલબ્ધ
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SAMPLE_CASES.slice(0, 4).map((sample) => (
            <button
              key={sample.id}
              onClick={() => onSelectSample(sample)}
              className="flex items-center gap-2 p-2 rounded-xl bg-white border border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50/50 text-left transition-all group"
            >
              <img
                src={sample.image_url}
                alt={sample.plant_name_gu}
                className="w-8 h-8 rounded-lg object-cover shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-emerald-800">
                  {sample.plant_name_gu.split(' ')[0]}
                </p>
                <p className="text-[10px] text-slate-500 truncate">
                  {sample.health_status === 'healthy' ? '🟢 સ્વસ્થ' : sample.health_status === 'attention' ? '🟡 કુકડાવો' : '🔴 ટિક્કા રોગ'}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
