import { PlantDiagnosisResult, FarmerProfile } from '../types/plant';
import { SAMPLE_CASES } from '../data/sampleCases';
import { DEFAULT_DISTRICT } from '../data/gujaratDistricts';

const SCANS_STORAGE_KEY = 'ai_plant_doctor_scans_v1';
const PROFILE_STORAGE_KEY = 'ai_plant_doctor_profile_v1';
const DISTRICT_STORAGE_KEY = 'ai_plant_doctor_district_v1';

export const storageService = {
  getScans(): PlantDiagnosisResult[] {
    try {
      const stored = localStorage.getItem(SCANS_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      // Initial state: seed with the first 2 sample cases for demonstration
      const initialScans = [SAMPLE_CASES[0], SAMPLE_CASES[1]];
      localStorage.setItem(SCANS_STORAGE_KEY, JSON.stringify(initialScans));
      return initialScans;
    } catch {
      return [SAMPLE_CASES[0]];
    }
  },

  saveScan(scan: PlantDiagnosisResult): void {
    try {
      const scans = this.getScans();
      const existingIndex = scans.findIndex(s => s.id === scan.id);
      
      // Store a quota-friendly version of the scan
      const safeScan: PlantDiagnosisResult = {
        ...scan,
        // Drop heavy secondary image in persistent storage if it exists
        secondary_image_url: undefined
      };

      if (existingIndex >= 0) {
        scans[existingIndex] = safeScan;
      } else {
        scans.unshift(safeScan);
      }

      // Progressively save with automatic quota recovery
      let limit = Math.min(scans.length, 12);
      let saved = false;

      while (limit > 0 && !saved) {
        try {
          const subset = scans.slice(0, limit);
          localStorage.setItem(SCANS_STORAGE_KEY, JSON.stringify(subset));
          saved = true;
        } catch (e: any) {
          // If quota exceeded, halve the items or strip base64
          if (limit > 3) {
            limit = Math.floor(limit / 2);
          } else if (limit > 1) {
            limit = 1;
          } else {
            // Strip large base64 data URLs to guarantee metadata preservation
            try {
              const stripped = scans.slice(0, 3).map(s => ({
                ...s,
                image_url: s.image_url?.startsWith('data:') ? '' : s.image_url
              }));
              localStorage.setItem(SCANS_STORAGE_KEY, JSON.stringify(stripped));
              saved = true;
            } catch {
              // Reset key if browser storage is critically full
              localStorage.removeItem(SCANS_STORAGE_KEY);
              saved = true;
            }
            break;
          }
        }
      }
    } catch (err) {
      console.warn('Could not save scan to localStorage safely:', err);
    }
  },

  deleteScan(scanId: string): PlantDiagnosisResult[] {
    try {
      const scans = this.getScans().filter(s => s.id !== scanId);
      localStorage.setItem(SCANS_STORAGE_KEY, JSON.stringify(scans));
      return scans;
    } catch {
      return [];
    }
  },

  getProfile(): FarmerProfile {
    try {
      const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Fallback
    }

    return {
      full_name: 'પટેલ રમેશભાઈ',
      phone: '98765 43210',
      village: 'ભીખાપુરા',
      taluka: 'હાલોલ',
      district: 'પંચમહાલ (Panchmahal)',
      crop_name: 'કપાસ (બીટી કપાસ)',
      sowing_date: '2026-06-15',
      soil_type: 'ગોરાડુ (Loamy Soil)',
      irrigation_type: 'ટપક પદ્ધતિ (Drip)',
      acreage: '૪ એકર'
    };
  },

  saveProfile(profile: FarmerProfile): void {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch (err) {
      console.error('Error saving profile', err);
    }
  },

  getSelectedDistrictId(): string {
    try {
      return localStorage.getItem(DISTRICT_STORAGE_KEY) || DEFAULT_DISTRICT.id;
    } catch {
      return DEFAULT_DISTRICT.id;
    }
  },

  saveSelectedDistrictId(id: string): void {
    try {
      localStorage.setItem(DISTRICT_STORAGE_KEY, id);
    } catch {
      // ignore
    }
  },

  getAppliedFertilizerDoses(): Record<string, string> {
    try {
      const stored = localStorage.getItem('ai_plant_doctor_fertilizers_applied_v1');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    return {};
  },

  toggleFertilizerDoseApplied(doseId: string, appliedDate?: string): Record<string, string> {
    try {
      const current = this.getAppliedFertilizerDoses();
      if (current[doseId]) {
        delete current[doseId];
      } else {
        current[doseId] = appliedDate || new Date().toISOString();
      }
      localStorage.setItem('ai_plant_doctor_fertilizers_applied_v1', JSON.stringify(current));
      return current;
    } catch (err) {
      console.error('Error toggling applied fertilizer dose', err);
      return {};
    }
  }
};
