import React, { useState, useRef, useEffect } from 'react';
import { Camera, History, Settings, Upload, ChevronRight, CheckCircle2, AlertCircle, Search, ArrowLeft, Globe, User, MapPin, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from '@google/genai';

type Tab = 'dashboard' | 'history' | 'settings';
type ScanState = 'idle' | 'scanning' | 'results';
type Lang = 'en' | 'bn';

interface Alternative {
  id: string;
  name: string;
  manufacturer: string;
  price: number;
  savings: number;
  verified: boolean;
}

interface ScanHistory {
  id?: number;
  date: string;
  item: string;
  generic: string;
  saved: number;
}

interface ScannedMedicine {
  originalName: string;
  genericCompound: string;
  originalPrice: number;
  alternatives: Alternative[];
}

const PHARMACIES = [
  "Lazz Pharma","Tamanna Pharmacy","Arogga","ePharma",
  "Shajgoj Pharmacy","Khidmah Drug","Prescription Point"
];

const TRANSLATIONS = {
  en: {
    title: "Find Cheaper Meds",
    desc: "Snap a photo of your medicine to find verified, affordable generic alternatives.",
    snap: "Snap Photo", upload: "Upload from Gallery",
    analyzing: "Analyzing chemical compound...", identifying: "Identifying alternatives...",
    scannedItem: "Scanned Item", genericCompound: "Generic Compound",
    cheaperAlts: "5 Cheaper Alternatives", availableNow: "Available Now",
    save: "Save", scan: "Scan", history: "History", settings: "Settings",
    scanHistory: "Scan History", saved: "Saved", language: "Language",
    notifications: "Notifications", pharmacy: "Preferred Pharmacy",
    about: "About MedMatch", signOut: "Sign Out", signUp: "Sign Up (Optional)",
    emailPlaceholder: "Enter your email", submit: "Submit",
    price: "Price", pill: "pill", newScan: "New Scan",
    today: "Today", yesterday: "Yesterday", guest: "Guest User",
    guestDesc: "Sign up to sync across devices", selectPharmacy: "Select Pharmacy"
  },
  bn: {
    title: "সস্তা ওষুধ খুঁজুন",
    desc: "আপনার ওষুধের ছবি তুলে সাশ্রয়ী মূল্যের জেনেরিক বিকল্প খুঁজুন।",
    snap: "ছবি তুলুন", upload: "গ্যালারি থেকে আপলোড",
    analyzing: "উপাদান বিশ্লেষণ করা হচ্ছে...", identifying: "বিকল্প খোঁজা হচ্ছে...",
    scannedItem: "স্ক্যান করা ওষুধ", genericCompound: "জেনেরিক উপাদান",
    cheaperAlts: "৫টি সস্তা বিকল্প", availableNow: "এখন উপলব্ধ",
    save: "সাশ্রয়", scan: "স্ক্যান", history: "ইতিহাস", settings: "সেটিংস",
    scanHistory: "স্ক্যান ইতিহাস", saved: "সাশ্রয়", language: "ভাষা",
    notifications: "নোটিফিকেশন", pharmacy: "পছন্দের ফার্মেসি",
    about: "MedMatch সম্পর্কে", signOut: "লগ আউট", signUp: "সাইন আপ (ঐচ্ছিক)",
    emailPlaceholder: "আপনার ইমেইল দিন", submit: "জমা দিন",
    price: "মূল্য", pill: "পিস", newScan: "নতুন স্ক্যান",
    today: "আজ", yesterday: "গতকাল", guest: "গেস্ট ইউজার",
    guestDesc: "ডিভাইস সিঙ্ক করতে সাইন আপ করুন", selectPharmacy: "ফার্মেসি নির্বাচন করুন"
  }
};

const SplitCapsuleLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M7 9C7 6.23858 9.23858 4 12 4C14.7614 4 17 6.23858 17 9V10H7V9Z" fill="currentColor" />
    <path d="M7 15H17V16C17 18.7614 14.7614 21 12 21C9.23858 21 7 18.7614 7 16V15Z" fill="currentColor" opacity="0.6" />
    <circle cx="12" cy="12.5" r="1.5" fill="currentColor" />
    <circle cx="9" cy="11.5" r="1" fill="currentColor" />
    <circle cx="15" cy="13.5" r="1" fill="currentColor" />
    <circle cx="14.5" cy="11" r="0.8" fill="currentColor" />
    <circle cx="9.5" cy="13.5" r="0.8" fill="currentColor" />
    <circle cx="12" cy="10.5" r="0.6" fill="currentColor" />
    <circle cx="12" cy="14.5" r="0.6" fill="currentColor" />
  </svg>
);

// ✅ Initialize Gemini directly in frontend using Vite env variable
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>('en');
  const [history, setHistory] = useState<ScanHistory[]>([]);
  const [scannedMedicines, setScannedMedicines] = useState<ScannedMedicine[]>([]);
  const [email, setEmail] = useState<string>('');
  const [showSignUp, setShowSignUp] = useState(false);
  const [showPharmacyList, setShowPharmacyList] = useState(false);
  const [preferredPharmacy, setPreferredPharmacy] = useState(PHARMACIES[0]);
  const [signUpEmail, setSignUpEmail] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = TRANSLATIONS[lang];

  // ✅ Load everything from localStorage (no backend needed)
  useEffect(() => {
    const storedEmail = localStorage.getItem('medmatch_email');
    if (storedEmail) setEmail(storedEmail);

    const storedPharmacy = localStorage.getItem('medmatch_pharmacy');
    if (storedPharmacy) setPreferredPharmacy(storedPharmacy);

    const storedHistory = localStorage.getItem('medmatch_history');
    if (storedHistory) setHistory(JSON.parse(storedHistory));
  }, []);

  const saveToHistory = (medicines: ScannedMedicine[]) => {
    const newEntries: ScanHistory[] = medicines.map(med => {
      const best = med.alternatives?.length > 0
        ? med.alternatives.reduce((a, b) => a.price < b.price ? a : b)
        : null;
      return {
        id: Date.now() + Math.random(),
        date: new Date().toISOString().split('T')[0],
        item: med.originalName,
        generic: med.genericCompound,
        saved: best ? best.savings : 0
      };
    });

    setHistory(prev => {
      const updated = [...newEntries, ...prev];
      localStorage.setItem('medmatch_history', JSON.stringify(updated));
      return updated;
    });
  };

  // ✅ Call Gemini API directly from frontend
  const scanImage = async (base64: string) => {
    const mimeType = base64.substring(base64.indexOf(':') + 1, base64.indexOf(';'));
    const base64Data = base64.split(',')[1];

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: "Analyze this prescription or medicine strip. Identify all medicines. For each medicine, provide its original name, generic compound, estimated original price per pill in BDT, and exactly 5 cheaper generic alternatives available in Bangladesh with their manufacturer, price per pill in BDT, and savings compared to the original. Ensure 'verified' is true for DGDA verified medicines." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            medicines: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  originalName: { type: Type.STRING },
                  genericCompound: { type: Type.STRING },
                  originalPrice: { type: Type.NUMBER },
                  alternatives: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        manufacturer: { type: Type.STRING },
                        price: { type: Type.NUMBER },
                        savings: { type: Type.NUMBER },
                        verified: { type: Type.BOOLEAN }
                      },
                      required: ["name", "manufacturer", "price", "savings", "verified"]
                    }
                  }
                },
                required: ["originalName", "genericCompound", "originalPrice", "alternatives"]
              }
            }
          },
          required: ["medicines"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setImagePreview(base64);
      setScanState('scanning');

      try {
        const data = await scanImage(base64);
        if (Array.isArray(data.medicines)) {
          setScannedMedicines(data.medicines);
          setScanState('results');
          if (data.medicines.length > 0) saveToHistory(data.medicines);
        } else {
          setScannedMedicines([]);
          setScanState('results');
        }
      } catch (err) {
        console.error(err);
        resetScan();
        alert("Failed to scan image. Check your API key.");
      }
    };
    reader.readAsDataURL(file);
  };

  const resetScan = () => {
    setScanState('idle');
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    const gi = document.getElementById('galleryInput') as HTMLInputElement;
    if (gi) gi.value = '';
  };

  const toggleLanguage = () => setLang(p => p === 'en' ? 'bn' : 'en');

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpEmail) return;
    setEmail(signUpEmail);
    localStorage.setItem('medmatch_email', signUpEmail);
    setShowSignUp(false);
  };

  const selectPharmacy = (pharmacy: string) => {
    setPreferredPharmacy(pharmacy);
    localStorage.setItem('medmatch_pharmacy', pharmacy);
    setShowPharmacyList(false);
  };

  const formatDate = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (dateStr === today) return t.today;
    if (dateStr === yesterday) return t.yesterday;
    return dateStr;
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-100 text-gray-900 font-sans max-w-md mx-auto shadow-2xl relative overflow-hidden">
      <header className="bg-white/40 backdrop-blur-xl border-b border-white/60 p-3 z-10 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <SplitCapsuleLogo className="w-6 h-6 text-emerald-600" />
          <h1 className="text-xl font-bold tracking-tight text-emerald-900">MedMatch</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleLanguage} className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-white/50 px-2 py-1 rounded-full border border-white/60 hover:bg-white/80 transition-colors">
            <Globe className="w-3.5 h-3.5" />
            {lang === 'en' ? 'BN' : 'EN'}
          </button>
          {scanState === 'results' && activeTab === 'dashboard' && (
            <button onClick={resetScan} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold flex items-center gap-1 bg-white/50 px-2 py-1 rounded-full border border-white/60 hover:bg-white/80 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> {t.newScan}
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-16 relative">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }} className="h-full flex flex-col">
              {scanState === 'idle' && (
                <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                  <div className="w-20 h-20 bg-white/60 backdrop-blur-md border border-white/60 rounded-full flex items-center justify-center mb-4 shadow-sm">
                    <Camera className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h2 className="text-xl font-bold text-emerald-950 mb-1">{t.title}</h2>
                  <p className="text-sm text-emerald-800/80 mb-6 max-w-[260px] leading-relaxed">{t.desc}</p>
                  <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
                  <input type="file" accept="image/*" className="hidden" id="galleryInput" onChange={(e) => { handleImageUpload(e); e.target.value = ''; }} />
                  <button onClick={() => fileInputRef.current?.click()} className="w-full max-w-[280px] bg-emerald-600/90 hover:bg-emerald-700 backdrop-blur-md text-white rounded-2xl py-3.5 px-6 font-semibold text-base shadow-lg shadow-emerald-600/20 transition-transform active:scale-95 flex items-center justify-center gap-2 border border-emerald-500/50">
                    <Camera className="w-5 h-5" />{t.snap}
                  </button>
                  <button onClick={() => document.getElementById('galleryInput')?.click()} className="mt-3 w-full max-w-[280px] bg-white/60 backdrop-blur-md border border-white/80 hover:bg-white/80 text-emerald-900 rounded-2xl py-3.5 px-6 font-semibold text-base shadow-sm transition-colors active:scale-95 flex items-center justify-center gap-2">
                    <Upload className="w-5 h-5" />{t.upload}
                  </button>
                </div>
              )}

              {scanState === 'scanning' && (
                <div className="flex-1 flex flex-col items-center justify-center p-4">
                  <div className="relative w-40 h-40 mb-6 rounded-2xl overflow-hidden shadow-xl border-4 border-white/80 backdrop-blur-sm">
                    {imagePreview && <img src={imagePreview} alt="Scanning" className="w-full h-full object-cover" />}
                    <motion.div className="absolute top-0 left-0 w-full h-1 bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)]" animate={{ top: ['0%', '100%', '0%'] }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} />
                    <div className="absolute inset-0 bg-emerald-900/10 backdrop-blur-[2px]"></div>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-base bg-white/50 px-4 py-2 rounded-full border border-white/60 shadow-sm">
                    <Search className="w-4 h-4 animate-pulse" />{t.analyzing}
                  </div>
                  <p className="text-xs text-emerald-700/80 mt-2 font-medium">{t.identifying}</p>
                </div>
              )}

              {scanState === 'results' && (
                <div className="flex-1 flex flex-col h-full overflow-y-auto">
                  <div className="bg-white/60 backdrop-blur-xl p-3 border-b border-white/60 shadow-sm flex gap-3 items-center shrink-0 sticky top-0 z-10">
                    <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/80 shrink-0 shadow-sm">
                      {imagePreview ? <img src={imagePreview} alt="Scanned" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-white/50 flex items-center justify-center"><SplitCapsuleLogo className="w-5 h-5 text-emerald-600/50" /></div>}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-emerald-950 text-sm leading-tight">Prescription Scanned</h3>
                      <p className="text-[11px] text-emerald-800/80 font-medium">Found {scannedMedicines.length} medicines</p>
                    </div>
                  </div>
                  <div className="p-3 space-y-4">
                    {scannedMedicines.length === 0 ? (
                      <div className="bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 p-6 text-center shadow-sm">
                        <AlertCircle className="w-10 h-10 text-emerald-600/50 mx-auto mb-3" />
                        <h3 className="font-bold text-emerald-950 text-lg mb-1">No meds found</h3>
                        <p className="text-sm text-emerald-800/80">We couldn't identify any medicines. Try a clearer photo.</p>
                      </div>
                    ) : (
                      scannedMedicines.map((med, medIdx) => (
                        <div key={medIdx} className="bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 overflow-hidden shadow-sm">
                          <div className="px-3 py-2 bg-emerald-600/10 border-b border-white/40">
                            <div className="flex justify-between items-start mb-1">
                              <h3 className="font-bold text-emerald-950 text-sm leading-tight">{med.originalName}</h3>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-200/50 border border-emerald-300/30 px-1.5 py-0.5 rounded shadow-sm">৳ {(med.originalPrice || 0).toFixed(2)}</span>
                            </div>
                            <p className="text-[10px] text-emerald-800 uppercase font-bold tracking-wider mb-0.5">{t.genericCompound}</p>
                            <p className="text-xs font-bold text-emerald-900 leading-tight">{med.genericCompound}</p>
                          </div>
                          <div className="p-2 space-y-1.5">
                            <div className="flex items-center justify-between mb-1 px-1">
                              <h4 className="font-bold text-emerald-950 text-xs">{t.cheaperAlts}</h4>
                            </div>
                            {med.alternatives?.map((alt, index) => (
                              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} key={index} className="bg-white/60 backdrop-blur-xl p-2 rounded-xl shadow-sm border border-white/80 flex items-center justify-between hover:bg-white/80 transition-colors">
                                <div className="flex-1">
                                  <div className="flex items-center gap-1 mb-0.5">
                                    <h5 className="font-bold text-emerald-950 text-xs">{alt.name}</h5>
                                    {alt.verified && <CheckCircle2 className="w-3 h-3 text-blue-500" />}
                                  </div>
                                  <p className="text-[9px] text-emerald-800/70 font-medium">{alt.manufacturer}</p>
                                  <div className="mt-1 flex items-center gap-2">
                                    <span className="font-bold text-emerald-900 text-xs">৳ {(alt.price || 0).toFixed(2)}</span>
                                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/80 border border-emerald-200/50 px-1.5 py-0.5 rounded shadow-sm">{t.save} ৳ {(alt.savings || 0).toFixed(2)}</span>
                                  </div>
                                </div>
                                <button className="ml-2 w-6 h-6 rounded-full bg-white/50 border border-white/80 flex items-center justify-center text-emerald-600 hover:bg-emerald-100 hover:text-emerald-800 transition-colors shadow-sm">
                                  <ChevronRight className="w-3 h-3" />
                                </button>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }} className="h-full p-4 overflow-y-auto">
              <h2 className="text-xl font-bold text-emerald-950 mb-4">{t.scanHistory}</h2>
              <div className="space-y-3">
                {history.length === 0 ? (
                  <div className="text-center text-emerald-800/60 py-10 text-sm font-medium">No scans yet.</div>
                ) : (
                  history.map((item, i) => (
                    <div key={item.id || i} className="bg-white/60 backdrop-blur-xl p-3 rounded-2xl shadow-sm border border-white/80 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-emerald-700/70 mb-0.5 uppercase tracking-wider">{formatDate(item.date)}</p>
                        <h4 className="font-bold text-emerald-950 text-sm">{item.item}</h4>
                        <p className="text-[11px] text-emerald-800/80 font-medium">{item.generic}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-emerald-700 font-bold mb-0.5 uppercase tracking-wider">{t.saved}</p>
                        <p className="font-bold text-emerald-900 text-sm">৳ {(item.saved || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }} className="h-full p-4 overflow-y-auto">
              <h2 className="text-xl font-bold text-emerald-950 mb-4">{t.settings}</h2>
              <div className="bg-white/60 backdrop-blur-xl rounded-2xl shadow-sm border border-white/80 overflow-hidden mb-4">
                <div className="p-3 border-b border-white/40 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-600/10 border border-emerald-600/20 rounded-full flex items-center justify-center text-emerald-700 font-bold text-lg shadow-inner">
                      {email ? email.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-emerald-950 text-sm">{email ? email.split('@')[0] : t.guest}</h3>
                      <p className="text-[11px] text-emerald-800/80 font-medium">{email || t.guestDesc}</p>
                    </div>
                  </div>
                  {!email && <button onClick={() => setShowSignUp(true)} className="text-xs font-bold text-emerald-700 bg-white/50 px-3 py-1.5 rounded-full border border-white/60 hover:bg-white/80 transition-colors">{t.signUp}</button>}
                </div>
              </div>
              <div className="bg-white/60 backdrop-blur-xl rounded-2xl shadow-sm border border-white/80 overflow-hidden">
                <div className="p-3 border-b border-white/40 flex items-center justify-between hover:bg-white/40 cursor-pointer transition-colors" onClick={toggleLanguage}>
                  <span className="font-bold text-emerald-900 text-sm">{t.language}</span>
                  <div className="flex items-center gap-1 text-emerald-700/80">
                    <span className="text-xs font-bold">{lang === 'en' ? 'English' : 'বাংলা'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
                <div className="p-3 border-b border-white/40 flex items-center justify-between hover:bg-white/40 cursor-pointer transition-colors" onClick={() => setShowPharmacyList(true)}>
                  <span className="font-bold text-emerald-900 text-sm">{t.pharmacy}</span>
                  <div className="flex items-center gap-1 text-emerald-700/80">
                    <span className="text-xs font-bold">{preferredPharmacy}</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
                {[{ label: t.notifications, value: 'On' }, { label: t.about, value: 'v1.0.0' }].map((s, i) => (
                  <div key={i} className="p-3 border-b border-white/40 last:border-0 flex items-center justify-between hover:bg-white/40 cursor-pointer transition-colors">
                    <span className="font-bold text-emerald-900 text-sm">{s.label}</span>
                    <div className="flex items-center gap-1 text-emerald-700/80">
                      <span className="text-xs font-bold">{s.value}</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                ))}
              </div>
              {email && (
                <button onClick={() => { setEmail(''); localStorage.removeItem('medmatch_email'); }} className="w-full mt-4 p-3 text-red-600 font-bold bg-white/60 backdrop-blur-xl border border-white/80 rounded-2xl hover:bg-red-50/80 transition-colors shadow-sm text-sm">
                  {t.signOut}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <nav className="absolute bottom-0 w-full bg-white/40 backdrop-blur-xl border-t border-white/60 pb-[env(safe-area-inset-bottom)] z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="flex justify-around items-center h-16 px-2">
          {(['dashboard','history','settings'] as Tab[]).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === tab ? 'text-emerald-700' : 'text-emerald-900/40 hover:text-emerald-900/60'}`}>
              {tab === 'dashboard' && <Camera className={`w-5 h-5 ${activeTab === tab ? 'fill-emerald-600/20' : ''}`} />}
              {tab === 'history' && <History className={`w-5 h-5 ${activeTab === tab ? 'fill-emerald-600/20' : ''}`} />}
              {tab === 'settings' && <Settings className={`w-5 h-5 ${activeTab === tab ? 'fill-emerald-600/20' : ''}`} />}
              <span className="text-[10px] font-bold">{t[tab === 'dashboard' ? 'scan' : tab]}</span>
            </button>
          ))}
        </div>
      </nav>

      <AnimatePresence>
        {showSignUp && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-emerald-950/20 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowSignUp(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-white/90 backdrop-blur-xl w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-white" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-emerald-950 mb-2">{t.signUp}</h3>
              <p className="text-sm text-emerald-800/80 mb-4">{t.guestDesc}</p>
              <div>
                <input type="email" placeholder={t.emailPlaceholder} value={signUpEmail} onChange={e => setSignUpEmail(e.target.value)} className="w-full bg-white/50 border border-emerald-200 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                <div className="flex gap-2">
                  <button onClick={() => setShowSignUp(false)} className="flex-1 py-3 rounded-xl font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors">Cancel</button>
                  <button onClick={handleSignUp as any} className="flex-1 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20">{t.submit}</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
        {showPharmacyList && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-emerald-950/20 backdrop-blur-sm flex items-end justify-center" onClick={() => setShowPharmacyList(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="bg-white/90 backdrop-blur-xl w-full rounded-t-3xl p-6 shadow-2xl border-t border-white pb-[env(safe-area-inset-bottom)]" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1.5 bg-emerald-200 rounded-full mx-auto mb-6"></div>
              <h3 className="text-xl font-bold text-emerald-950 mb-4">{t.selectPharmacy}</h3>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                {PHARMACIES.map(pharmacy => (
                  <button key={pharmacy} onClick={() => selectPharmacy(pharmacy)} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-emerald-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-emerald-600/60" />
                      <span className="font-bold text-emerald-900 text-sm">{pharmacy}</span>
                    </div>
                    {preferredPharmacy === pharmacy && <Check className="w-5 h-5 text-emerald-600" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
