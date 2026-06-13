import React, { useState, useEffect } from "react";
import { X, ExternalLink, Info, Volume2, VolumeX } from "lucide-react";

/**
 * Standard Google Ads Banner Ad Placeholder
 * Horizontal layout, standard size, fully styled with "AdChoices" guidelines
 */
export const GoogleBannerAd: React.FC = () => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="w-full mt-8 border-t border-slate-800/60 pt-6" id="google-banner-ad-container">
      <div className="max-w-4xl mx-auto">
        {/* Ad labeling according to AdSense Policies */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1 px-1">
          <span className="font-mono tracking-wider">SPONSORED / ADVERTISING</span>
          <div className="flex items-center gap-1.5 cursor-pointer hover:text-slate-300 transition-colors">
            <span className="font-sans">AdChoices</span>
            {/* Minimal SVG of the official AdChoices icon wrapper */}
            <svg className="w-3.5 h-3.5 fill-blue-500 hover:fill-blue-400" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
            </svg>
          </div>
        </div>

        {/* Realistic Banner Ad Card */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 border border-slate-800 rounded-xl hover:border-blue-500/30 transition-all p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-[#0a0f1d] shadow-lg">
          {/* Decorative glowing background mesh */}
          <div className="absolute -left-36 -top-36 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -right-36 -bottom-36 w-72 h-72 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex items-center gap-4 relative z-10 w-full md:w-auto">
            {/* AD BADGE */}
            <div className="hidden sm:flex shrink-0 w-12 h-12 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl items-center justify-center font-bold text-white shadow-md shadow-blue-500/20">
              GA
            </div>
            {/* AD CONTENT */}
            <div className="space-y-1 text-center md:text-left w-full md:w-auto">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <span className="bg-yellow-400/15 text-yellow-400 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase border border-yellow-400/25">Ad</span>
                <h4 className="text-sm font-bold text-slate-100 tracking-tight">Google Workspace & Gemini API</h4>
              </div>
              <p className="text-xs text-slate-400 max-w-xl">
                Accelerate academic research. Connect Google Docs, Sheets, and Slides with multi-modal Gemini models. Build smart agents in seconds with free tier tokens in Google AI Studio.
              </p>
            </div>
          </div>

          {/* Call to Action & Control utilities */}
          <div className="flex items-center gap-3 relative z-10 shrink-0 w-full md:w-auto justify-center md:justify-end">
            <button 
              onClick={() => setIsMuted(!isMuted)} 
              className="p-2 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-lg transition-colors"
              title={isMuted ? "Unmute" : "Mute ad sound clips"}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <a 
              href="https://ai.studio/build" 
              target="_blank" 
              referrerPolicy="no-referrer"
              className="h-9 px-4.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-blue-500/15"
            >
              <span>Get Started</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button 
              onClick={() => setIsVisible(false)}
              className="p-2 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-lg transition-colors border border-transparent hover:border-slate-800"
              title="Close Ad"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


interface GoogleInterstitialAdProps {
  onComplete: () => void;
}

/**
 * Gorgeous Full-Screen Google Interstitial Ad with a active 5-second countdown timer.
 * Automatically completes or dismisses, and is fully styled inside Google responsive Ad guidelines.
 */
export const GoogleInterstitialAd: React.FC<GoogleInterstitialAdProps> = ({ onComplete }) => {
  const [secondsRemaining, setSecondsRemaining] = useState(5);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    // Prevent background scrolling while ad is open
    document.body.style.overflow = "hidden";

    const countdownInterval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          // Auto-trigger completion as requested by user
          setTimeout(() => {
            document.body.style.overflow = "";
            onComplete();
          }, 300);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      document.body.style.overflow = "";
      clearInterval(countdownInterval);
    };
  }, [onComplete]);

  const handleSkipAdManual = () => {
    document.body.style.overflow = "";
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-md animate-fadeIn" id="google-interstitial-overlay">
      {/* Background glowing effects to make it premium */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-2xl w-full mx-4 relative bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl shadow-2xl space-y-6 md:space-y-8 animate-scaleIn" id="google-interstitial-adbox">
        
        {/* Header containing Sponsor and timer status */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-2">
            <span className="bg-yellow-400 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase tracking-wide">Sponsored</span>
            <span className="text-xs text-slate-400 font-medium">Google AdChoices Placeholder</span>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMuted(!isMuted)} 
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              title={isMuted ? "Unmute" : "Mute ad sound clips"}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Glowing active timer progress ring */}
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-full border border-slate-800">
              <div className="w-4 h-4 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin"></div>
              <span className="text-xs font-bold text-indigo-400 font-mono tracking-wider">
                {secondsRemaining > 0 ? `Ad ends in ${secondsRemaining}s` : "Loading Results..."}
              </span>
            </div>
            
            {/* Skip Ad Button triggers immediately or completes */}
            <button
              onClick={handleSkipAdManual}
              className={`h-7 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 border ${
                secondsRemaining === 0 
                  ? "bg-slate-200 text-slate-950 hover:bg-white border-transparent" 
                  : "bg-white/5 text-slate-400 hover:text-white border-slate-800 hover:border-slate-700"
              }`}
            >
              <span>Skip Ad</span>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Ad Primary Visual Space */}
        <div className="space-y-5 text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center font-black text-white text-2xl shadow-xl shadow-blue-500/25">
            G
          </div>
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
              Unleash Unlimited Enterprise Grade Cloud Hosting
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
              Experience the fast, high-security infrastructure of Google App Engine and Cloud Run. Ship applications closer to students world-wide with multi-region scalability.
            </p>
          </div>

          {/* Simulated premium mockup banner graphic */}
          <div className="border border-slate-800/60 rounded-2xl bg-slate-950 p-4 shrink-0 flex items-center justify-between text-left relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl transition-all duration-700 group-hover:scale-150"></div>
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-indigo-400 tracking-wider uppercase font-mono">Special Academic Offer</span>
              <h3 className="text-xs sm:text-sm font-semibold text-slate-200">Google Cloud for Higher Education</h3>
              <p className="text-[10px] sm:text-xs text-slate-500">Sign up with institutional student accounts to claim $300 hosting credits.</p>
            </div>
            <a 
              href="https://cloud.google.com" 
              target="_blank" 
              referrerPolicy="no-referrer"
              className="h-8.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition"
            >
              <span>Apply</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Informative footer */}
        <div className="flex items-center justify-center gap-2.5 text-[10.5px] text-slate-500 border-t border-white/5 pt-4 text-center">
          <Info className="w-3.5 h-3.5 text-slate-500" />
          <span>This premium placement supports the Master Solve AI free education initiative.</span>
        </div>
      </div>
    </div>
  );
};
