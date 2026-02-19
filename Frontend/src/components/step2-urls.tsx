import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, ArrowRight, ArrowLeft, CheckCircle, X, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface Step2Props {
  urls: string[];
  fileName: string;
  onUrlsChange: (urls: string[], fileName: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step2Urls({ urls, fileName, onUrlsChange, onNext, onBack }: Step2Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseFile = useCallback(
    async (file: File) => {
      setIsProcessing(true);
      try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1 });

        if (jsonData.length === 0) {
          toast.error('Empty file', { description: 'The spreadsheet appears to be empty.' });
          setIsProcessing(false);
          return;
        }

        // Find the "Address" column (case-insensitive) or use first column
        const headers = (jsonData[0] as unknown[]).map((h) => String(h || '').toLowerCase());
        let colIndex = headers.indexOf('address');
        if (colIndex === -1) {
          colIndex = 0; // fallback to first column
        }

        const extractedUrls: string[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as unknown[];
          if (row && row[colIndex]) {
            const val = String(row[colIndex]).trim();
            if (val && (val.startsWith('http://') || val.startsWith('https://'))) {
              extractedUrls.push(val);
            }
          }
        }

        if (extractedUrls.length === 0) {
          toast.error('No URLs found', {
            description: 'Could not extract any valid URLs from the spreadsheet. Ensure URLs start with http:// or https://.',
          });
          setIsProcessing(false);
          return;
        }

        onUrlsChange(extractedUrls, file.name);
        toast.success(`${extractedUrls.length} URLs loaded`, {
          description: `Successfully parsed ${file.name}`,
        });
      } catch (err) {
        toast.error('Parse error', {
          description: 'Could not read the spreadsheet. Please check the file format.',
        });
      }
      setIsProcessing(false);
    },
    [onUrlsChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) parseFile(file);
    },
    [parseFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) parseFile(file);
    },
    [parseFile]
  );

  const clearFile = () => {
    onUrlsChange([], '');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleNext = () => {
    if (urls.length === 0) {
      toast.error('No URLs loaded', {
        description: 'Please upload a spreadsheet with URLs first.',
      });
      return;
    }
    onNext();
  };

  const displayUrls = showAll ? urls : urls.slice(0, 10);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div
        className="rounded-2xl p-6 sm:p-8 relative overflow-hidden"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Cyan left border glow */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
          style={{ background: 'linear-gradient(180deg, #00D4FF, #00D4FF80)' }}
        />
        <div
          className="absolute left-0 top-0 bottom-0 w-8"
          style={{ background: 'linear-gradient(90deg, rgba(0,212,255,0.06), transparent)' }}
        />

        {/* Section Title */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(0, 212, 255, 0.15)' }}
          >
            <Upload className="w-5 h-5" style={{ color: '#00D4FF' }} />
          </div>
          <div>
            <h2 className="text-[#F0F0FF]" style={{ fontSize: '1.25rem', fontWeight: 600 }}>Upload Your URL Spreadsheet</h2>
            <p className="text-xs" style={{ color: '#8B8BAD' }}>Upload .xlsx, .xls, or .csv with URL addresses</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {urls.length === 0 ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Dropzone */}
              <motion.div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="relative rounded-2xl border-2 border-dashed p-12 flex flex-col items-center justify-center cursor-pointer transition-all mb-6"
                style={{
                  borderColor: isDragging ? '#6C63FF' : '#2A2A3E',
                  background: isDragging ? 'rgba(108, 99, 255, 0.05)' : 'rgba(10, 10, 15, 0.5)',
                }}
                animate={isDragging ? { scale: 1.02 } : { scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-3">
                    <div
                      className="w-10 h-10 border-2 rounded-full animate-spin-slow"
                      style={{ borderColor: '#2A2A3E', borderTopColor: '#6C63FF' }}
                    />
                    <span className="text-sm" style={{ color: '#8B8BAD' }}>
                      Processing file...
                    </span>
                  </div>
                ) : (
                  <>
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                      style={{ background: 'rgba(108, 99, 255, 0.1)' }}
                    >
                      <FileSpreadsheet className="w-7 h-7" style={{ color: '#6C63FF' }} />
                    </div>
                    <p style={{ color: '#F0F0FF', fontSize: '0.9375rem', fontWeight: 500 }}>
                      Drop your spreadsheet here
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#4A4A6A' }}>
                      or click to browse (.xlsx, .xls, .csv)
                    </p>
                  </>
                )}
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="mb-6"
            >
              {/* Success state */}
              <div
                className="rounded-xl p-4 mb-4 flex items-center justify-between"
                style={{ background: 'rgba(0, 200, 150, 0.08)', border: '1px solid rgba(0, 200, 150, 0.2)' }}
              >
                <div className="flex items-center gap-3">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  >
                    <CheckCircle className="w-5 h-5" style={{ color: '#00C896' }} />
                  </motion.div>
                  <div>
                    <p className="text-sm" style={{ color: '#00C896', fontWeight: 500 }}>
                      {urls.length} URLs loaded from {fileName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={clearFile}
                  className="p-1.5 rounded-lg transition-colors hover:bg-white/5 cursor-pointer"
                  style={{ color: '#8B8BAD' }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* URL List */}
              <div
                className="rounded-xl overflow-hidden relative"
                style={{ background: 'rgba(10, 10, 15, 0.5)', border: '1px solid #2A2A3E' }}
              >
                <div className="max-h-[200px] overflow-y-auto p-3 custom-scrollbar space-y-2">
                  {displayUrls.map((url, i) => (
                    <motion.div
                      key={url + i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="px-3 py-1.5 rounded-lg text-xs truncate"
                      style={{ background: 'rgba(108, 99, 255, 0.06)', color: '#8B8BAD', border: '1px solid rgba(108, 99, 255, 0.1)' }}
                      title={url}
                    >
                      {url}
                    </motion.div>
                  ))}
                </div>
                {urls.length > 10 && (
                  <div className="px-3 pb-3 pt-1">
                    <button
                      onClick={() => setShowAll(!showAll)}
                      className="text-xs cursor-pointer"
                      style={{ color: '#6C63FF' }}
                    >
                      {showAll ? 'Show less' : `Show all ${urls.length} URLs`}
                    </button>
                  </div>
                )}
                {!showAll && urls.length > 10 && (
                  <div
                    className="absolute bottom-8 left-0 right-0 h-12 pointer-events-none"
                    style={{ background: 'linear-gradient(transparent, rgba(10,10,15,0.8))' }}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex gap-3">
          <motion.button
            onClick={onBack}
            className="px-6 py-3.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer"
            style={{
              background: 'transparent',
              border: '1px solid #2A2A3E',
              color: '#8B8BAD',
              fontSize: '0.9375rem',
              fontWeight: 500,
            }}
            whileHover={{ borderColor: '#4A4A6A' }}
            whileTap={{ scale: 0.98 }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </motion.button>
          <motion.button
            onClick={handleNext}
            className="flex-1 py-3.5 rounded-xl flex items-center justify-center gap-2 text-white transition-all cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #6C63FF, #00D4FF)',
              fontSize: '0.9375rem',
              fontWeight: 600,
            }}
            whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(108, 99, 255, 0.35)' }}
            whileTap={{ scale: 0.98 }}
          >
            Continue to AI Selection
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
