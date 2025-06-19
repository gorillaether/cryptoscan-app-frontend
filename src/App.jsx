import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { toast } from 'react-toastify';
import {
  Camera,
  Search,
  DollarSign,
  Bitcoin,
  Loader2,
  RefreshCw,
  Settings,
  Info,
  X,
  CheckCircle,
  AlertCircle,
  Upload,
  Zap,
  TrendingUp,
  ShieldCheck // Added for the rate limit UI
} from 'lucide-react';

// REFACTORED: Imports are now simplified and point to the correct service files.
import { imageAnalysisService } from './services/api';
import { rateLimitService } from './services/firebase';

// Utility function to convert HEX to RGBA (unchanged)
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function App() {
  // State management (simplified)
  const [isLoading, setIsLoading] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [selectedCryptos, setSelectedCryptos] = useState(['bitcoin', 'ethereum', 'litecoin', 'dogecoin']);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState(null);
  const [analysisStep, setAnalysisStep] = useState('');

  // NEW: State for rate limit usage
  const [usageInfo, setUsageInfo] = useState({ used: 0, remaining: 10, total: 10 });

  // Refs (unchanged)
  const webcamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Available cryptocurrencies (unchanged)
  const availableCryptos = [
    { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', color: '#f7931a' },
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', color: '#627eea' },
    { id: 'litecoin', name: 'Litecoin', symbol: 'LTC', color: '#bfbbbb' },
    { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE', color: '#c2a633' },
    { id: 'cardano', name: 'Cardano', symbol: 'ADA', color: '#0033ad' },
    { id: 'polkadot', name: 'Polkadot', symbol: 'DOT', color: '#e6007a' },
    { id: 'chainlink', name: 'Chainlink', symbol: 'LINK', color: '#375bd2' },
    { id: 'stellar', name: 'Stellar', symbol: 'XLM', color: '#7d00ff' }
  ];

  // NEW: Fetch user's scan usage on component mount
  useEffect(() => {
    const fetchUsage = async () => {
      // Assuming a max of 10 uses, as defined in your service
      const currentUsage = await rateLimitService.getCurrentUsage(10);
      setUsageInfo(currentUsage);
    };
    fetchUsage();
  }, []);

  // REMOVED: The useEffect and loadCryptoPrices function for background price fetching are no longer needed.

  // Capture image from webcam (unchanged)
  const captureImage = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setCapturedImage(imageSrc);
      handleImageAnalysis(imageSrc);
    } else {
      toast.error('Failed to capture image. Please try again.');
    }
  }, []);

  // Handle file upload (unchanged)
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('File size too large. Please select an image under 5MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const imageSrc = e.target.result;
        setCapturedImage(imageSrc);
        handleImageAnalysis(imageSrc);
      };
      reader.onerror = () => {
        toast.error('Failed to read file. Please try again.');
      };
      reader.readAsDataURL(file);
    }
  };

  // REWRITTEN: The main image analysis function is now clean and uses the new single service.
  const handleImageAnalysis = async (imageSrc) => {
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);
    setAnalysisStep('Starting analysis...');

    try {
      const base64Image = imageSrc.split(',')[1];
      toast.info('🔍 Performing AI analysis...');

      const result = await imageAnalysisService.analyzeImageWithRateLimit(base64Image);

      if (result.success) {
        setAnalysisResult(result.data);
        setUsageInfo({
          used: result.usage.current,
          remaining: result.usage.remaining,
          total: 10,
        });
        toast.success('🚀 Analysis complete!');
        if (result.data.finalPrice) {
          toast.success(`💵 Found price: $${result.data.finalPrice.toFixed(2)}`);
        } else {
          toast.warning('⚠️ Could not determine product price. Try a clearer image.');
        }
      } else {
        // Handle both rate limit errors and other analysis errors from the service
        setError(result.error);
        toast.error(`❌ Analysis failed: ${result.error}`);
      }

    } catch (err) {
      console.error('Critical error during image analysis flow:', err);
      setError(err.message || 'A critical error occurred. Please try again.');
      toast.error('❌ A critical error occurred.');
    } finally {
      setIsLoading(false);
      setAnalysisStep('');
    }
  };

  // REMOVED: The convertToCrypto function is no longer needed in this component.

  // Reset all states (unchanged)
  const resetAnalysis = () => {
    setCapturedImage(null);
    setAnalysisResult(null);
    setError(null);
    setAnalysisStep('');
    toast.info('🔄 Ready for new scan!');
  };

  // Toggle crypto selection (unchanged)
  const toggleCrypto = (cryptoId) => {
    setSelectedCryptos(prev => {
      const newSelection = prev.includes(cryptoId)
        ? prev.filter(id => id !== cryptoId)
        : [...prev, cryptoId];

      if (newSelection.length === 0) {
        toast.warning('Please select at least one cryptocurrency');
        return prev;
      }
      return newSelection;
    });
  };

  // DERIVED STATE: Get selected crypto conversions from the main analysisResult object.
  const cryptoConversions = analysisResult?.conversions
    ? Object.values(analysisResult.conversions)
        .filter(conv => selectedCryptos.includes(conv.name.toLowerCase()))
        .map(conv => {
          const cryptoInfo = availableCryptos.find(c => c.id === conv.name.toLowerCase());
          return {
            ...conv,
            symbol: cryptoInfo?.symbol || conv.name.toUpperCase().slice(0, 3),
            color: cryptoInfo?.color || '#666666',
          };
        })
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full">
              <Zap className="text-white" size={32} />
            </div>
            <h1 className="text-5xl font-bold gradient-text">
              CryptoScan
            </h1>
          </div>
          <p className="text-gray-600 text-xl max-w-2xl mx-auto">
            Instantly identify objects and get their value in cryptocurrency using AI-powered recognition
          </p>
          <div className="flex items-center justify-center gap-6 mt-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <CheckCircle size={16} className="text-green-500" />
              <span>AI Recognition</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp size={16} className="text-blue-500" />
              <span>Real-time Prices</span>
            </div>
            <div className="flex items-center gap-1">
              <Bitcoin size={16} className="text-orange-500" />
              <span>Crypto Conversion</span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Camera Section */}
          <div className="space-y-6">
            <div className="card p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
                  <Camera size={24} className="text-blue-500" />
                  Capture Image
                </h2>
                <div className="flex items-center gap-2">
                   {/* NEW: Daily Usage Display */}
                   <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full" title="Scans remaining today">
                      <ShieldCheck size={16} className="text-green-500" />
                      <span>{usageInfo.remaining} / {usageInfo.total} Scans</span>
                  </div>
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`p-3 rounded-lg transition-all duration-200 ${
                      showSettings
                        ? 'bg-blue-100 text-blue-600'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                    title="Settings"
                  >
                    <Settings size={20} />
                  </button>
                  <button
                    onClick={resetAnalysis}
                    className="p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200"
                    title="Reset"
                  >
                    <RefreshCw size={20} />
                  </button>
                </div>
              </div>

              {!capturedImage ? (
                <div className="space-y-6">
                  <div className="relative aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl overflow-hidden shadow-inner">
                    <Webcam
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      className="w-full h-full object-cover"
                      videoConstraints={{
                        width: 1280,
                        height: 720,
                        facingMode: "environment"
                      }}
                      onUserMediaError={(error) => {
                        console.error('Camera error:', error);
                        toast.error('Camera access denied or not available');
                      }}
                    />
                    <div className="absolute inset-0 border-2 border-dashed border-white/50 rounded-xl m-4 flex items-center justify-center">
                      <div className="text-white/70 text-center">
                        <Camera size={48} className="mx-auto mb-2" />
                        <p className="text-lg font-medium">Point camera at object</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      onClick={captureImage}
                      disabled={isLoading}
                      className="btn-primary flex items-center justify-center gap-3 py-4 text-lg"
                    >
                      <Camera size={24} />
                      {isLoading ? 'Processing...' : 'Capture Photo'}
                    </button>

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading}
                      className="btn-secondary flex items-center justify-center gap-3 py-4 text-lg"
                    >
                      <Upload size={24} />
                      Upload Image
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <img
                      src={capturedImage}
                      alt="Captured object"
                      className="w-full rounded-xl shadow-lg"
                    />
                    <button
                      onClick={resetAnalysis}
                      className="absolute top-4 right-4 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-all duration-200 transform hover:scale-110"
                      title="Remove image"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {isLoading && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center justify-center gap-3">
                        <Loader2 className="animate-spin text-blue-500" size={24} />
                        <div className="text-center">
                          <p className="font-medium text-blue-800">Processing Image...</p>
                          {analysisStep && (
                            <p className="text-sm text-blue-600 mt-1">{analysisStep}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Settings Panel */}
            {showSettings && (
              <div className="card p-6 animate-slide-up border-2 border-blue-100">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Settings size={20} className="text-blue-500" />
                  Cryptocurrency Settings
                </h3>
                <p className="text-gray-600 mb-4">Select which cryptocurrencies to show conversions for:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availableCryptos.map(crypto => (
                    <label
                      key={crypto.id}
                      className="flex items-center space-x-3 p-3 rounded-lg border-2 border-gray-100 hover:border-gray-200 cursor-pointer transition-all duration-200"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCryptos.includes(crypto.id)}
                        onChange={() => toggleCrypto(crypto.id)}
                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: crypto.color }}
                      ></div>
                      <div>
                        <span className="font-medium">{crypto.name}</span>
                        <span className="text-gray-500 ml-2">({crypto.symbol})</span>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    💡 <strong>Tip:</strong> Select fewer cryptocurrencies for faster conversion
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {/* Error Display */}
            {error && (
              <div className="card p-6 border-2 border-red-200 bg-red-50 animate-fade-in">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-red-500 mt-1" size={24} />
                  <div>
                    <h3 className="font-semibold text-red-800 mb-2">Analysis Error</h3>
                    <p className="text-red-700">{error}</p>
                    <button
                      onClick={resetAnalysis}
                      className="mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg transition-colors duration-200"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Analysis Results (data binding is updated) */}
            {analysisResult && !isLoading && (
              <div className="card p-6 animate-fade-in border-2 border-green-100">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle className="text-green-500" size={24} />
                  Analysis Results
                </h3>

                {analysisResult.gemini && (
                  <div className="mb-6 p-5 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                    <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                      <Zap size={18} />
                      AI Product Identification
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Product Name</p>
                        <p className="font-medium text-gray-800">{analysisResult.gemini.product_name}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Category</p>
                        <p className="font-medium text-gray-800">{analysisResult.gemini.category}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Confidence</p>
                        <p className="font-medium text-gray-800">{analysisResult.gemini.confidence}%</p>
                      </div>
                      {analysisResult.gemini.estimated_price_min && (
                        <div>
                          <p className="text-gray-600">AI Price Range</p>
                          <p className="font-medium text-gray-800">
                            ${analysisResult.gemini.estimated_price_min} - ${analysisResult.gemini.estimated_price_max}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {analysisResult.vision?.labels && (
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Search size={18} />
                      Detected Objects
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.vision.labels.slice(0, 8).map((label, index) => (
                        <span
                          key={index}
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-sm font-medium transition-colors duration-200"
                        >
                          {label.description} ({Math.round(label.score * 100)}%)
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Price Results (data binding is updated) */}
            {analysisResult?.finalPrice > 0 && !isLoading &&(
              <div className="card p-6 animate-slide-up border-2 border-green-100">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold flex items-center gap-2">
                    <DollarSign className="text-green-500" size={24} />
                    Price Analysis
                  </h3>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-green-600">
                      ${analysisResult.finalPrice.toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-500 capitalize">
                      {analysisResult.extractedPrice ? 'Market Price' : 'AI Estimate'}
                    </p>
                  </div>
                </div>

                {cryptoConversions.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                      <Bitcoin size={20} />
                      Cryptocurrency Equivalents
                    </h4>

                    <div className="grid gap-4">
                      {cryptoConversions.map((conversion, index) => (
                        <div
                          key={index}
                          className="crypto-card rounded-xl p-4 transition-all hover:scale-105 duration-200 text-white"
                          style={{
                            background: `linear-gradient(135deg, ${hexToRgba(conversion.color, 0.7)}, ${hexToRgba(conversion.color, 0.5)})`
                          }}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                                style={{ backgroundColor: conversion.color }}
                              >
                                {conversion.symbol.slice(0, 2)}
                              </div>
                              <div>
                                <h5 className="font-semibold text-lg">{conversion.name}</h5>
                                <p className="text-sm opacity-75">
                                  1 {conversion.symbol} = ${conversion.usd_price.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                  })}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold">
                                {conversion.crypto_amount.toFixed(8)} {conversion.symbol}
                              </p>
                              <p className="text-sm opacity-75">
                                ${analysisResult.finalPrice.toFixed(2)} USD
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        💡 <strong>Live prices:</strong> Cryptocurrency rates update every minute.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Info Card */}
            {!capturedImage && !isLoading && (
              <div className="card p-6 bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-100">
                <div className="flex items-start gap-4">
                  <Info className="text-blue-500 mt-1 flex-shrink-0" size={24} />
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-3">How CryptoScan Works</h3>
                    <div className="space-y-3 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">1</div>
                        <span>Capture or upload an image of any product or object</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">2</div>
                        <span>AI analyzes and identifies the product using Google Vision + Gemini</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">3</div>
                        <span>Smart price discovery finds current market prices</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">4</div>
                        <span>Real-time conversion to your selected cryptocurrencies</span>
                      </div>
                    </div>
                    <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
                      <p className="text-xs text-gray-500">
                        <strong>Pro tip:</strong> For best results, use well-lit images with clear product visibility.
                        Branded items and electronics typically work best.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center mt-12 py-8 border-t border-gray-200">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Google Vision AI
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Gemini AI
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
              CoinGecko API
            </span>
          </div>
        </div>

        {/* Add your website link - more prominent */}
        <div className="mb-4">
          <a 
            href="https://gorillaether.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-full hover:from-blue-600 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            <span>🦍</span>
            Visit GorillaEther.com
          </a>
        </div>

        <p className="text-gray-400 text-sm">
          Built with React + Vite • Real-time cryptocurrency prices • AI-powered object recognition
        </p>
      </footer>
      </div>
    </div>
  );
}

export default App;