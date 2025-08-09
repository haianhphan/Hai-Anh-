
import React, { useState, useCallback, ChangeEvent } from 'react';
import { UploadIcon, GenerateIcon } from './icons';
import { getDocument, GlobalWorkerOptions, PageViewport } from 'pdfjs-dist';
import mammoth from 'mammoth';
import { extractTextFromImage } from '../services/geminiService';


// Set worker URL for pdf.js. This is required for it to work in the browser.
// We use a consistent CDN for both the worker and the main library to ensure version compatibility.
GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;


interface InputPanelProps {
  onGenerate: (text: string) => void;
  isLoading: boolean;
}

export const InputPanel: React.FC<InputPanelProps> = ({ onGenerate, isLoading }) => {
  const [inputText, setInputText] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [processingMessage, setProcessingMessage] = useState<string>('Processing your file...');
  const [fileProcessingError, setFileProcessingError] = useState<string | null>(null);

  const processFile = async (file: File) => {
    setIsProcessingFile(true);
    setFileProcessingError(null);
    setInputText('');

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'pdf' || file.type === 'application/pdf') {
        setProcessingMessage('Loading PDF...');
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
          setProcessingMessage(`Processing page ${i} of ${pdf.numPages}...`);
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');

          // Heuristic: If a page has very little text, assume it's an image needing OCR.
          if (pageText.trim().length < 50 && page.getViewport({ scale: 1.0 }).height > 100) {
            setProcessingMessage(`Image detected on page ${i}. Running OCR...`);
            try {
              const viewport: PageViewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              if (!context) {
                throw new Error('Could not get canvas context');
              }
              canvas.height = viewport.height;
              canvas.width = viewport.width;

              await page.render({ canvas, canvasContext: context, viewport }).promise;

              const base64Image = canvas.toDataURL('image/png').split(',')[1];
              const ocrText = await extractTextFromImage(base64Image);
              fullText += ocrText + '\n\n';
            } catch (ocrError) {
              console.error(`OCR failed for page ${i}:`, ocrError);
              fullText += pageText + '\n\n'; // Fallback to the little text we found
              setFileProcessingError(`Could not read text from an image on page ${i}. The result might be incomplete.`);
            }
          } else {
            fullText += pageText + '\n\n';
          }
        }
        setInputText(fullText.trim());
      } else if (fileExtension === 'docx' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        setProcessingMessage('Extracting text from DOCX...');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setInputText(result.value);
      } else if (['txt', 'md'].includes(fileExtension || '') || file.type.startsWith('text/')) {
        setProcessingMessage('Reading text file...');
        const text = await file.text();
        setInputText(text);
      } else {
        throw new Error('Unsupported file type. Please upload a PDF, DOCX, TXT, or MD file.');
      }
    } catch (err) {
      console.error('Error processing file:', err);
      setFileProcessingError(err instanceof Error ? err.message : 'An unknown error occurred while reading the file.');
    } finally {
      setIsProcessingFile(false);
    }
  };
  
  const handleFile = (file: File | undefined) => {
    if (file) {
      processFile(file);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    handleFile(e.target.files?.[0]);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFile(e.dataTransfer.files?.[0]);
  };


  const handleSubmit = () => {
    onGenerate(inputText);
  };

  return (
    <div className="relative bg-slate-800/50 rounded-xl shadow-lg border border-slate-700 p-6 flex flex-col gap-6">
       {isProcessingFile && (
        <div className="absolute inset-0 bg-slate-800/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl z-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400"></div>
            <p className="mt-4 text-slate-300">{processingMessage}</p>
        </div>
      )}
      
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-slate-100">Provide Content</h2>
        <p className="text-slate-400 text-sm">Paste your text below or upload a file (.pdf, .docx, .txt, .md).</p>
      </div>

      {fileProcessingError && (
        <div className="bg-red-900/50 border border-red-700 text-red-300 text-sm p-3 rounded-md">
          {fileProcessingError}
        </div>
      )}

      <textarea
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder="For example:
        'Event Feedback Survey. We want to know what you thought of our event.
        - Your Name
        - Your Email
        - How would you rate the event overall? (Poor, Fair, Good, Excellent)
        - Any additional comments?'"
        className="w-full h-48 p-3 bg-slate-900 border border-slate-600 rounded-md focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition-colors placeholder-slate-500 resize-y"
        disabled={isLoading || isProcessingFile}
      />

      <div className="text-center text-slate-500 my-2">OR</div>
      
      <div onDragEnter={handleDrag}>
        <label
            htmlFor="file-upload"
            className={`relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            dragActive ? "border-cyan-400 bg-slate-700/50" : "border-slate-600 hover:border-slate-500 hover:bg-slate-800"
            }`}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <UploadIcon className="w-8 h-8 mb-3 text-slate-400" />
            <p className="mb-2 text-sm text-slate-400">
                <span className="font-semibold text-cyan-400">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-slate-500">PDF, DOCX, TXT, or MD files</p>
          </div>
          <input id="file-upload" type="file" className="hidden" onChange={handleFileChange} disabled={isLoading || isProcessingFile} accept=".pdf,.docx,.txt,.md,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
        </label>
        {dragActive && <div className="absolute inset-0 w-full h-full" onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}></div>}
      </div>

      <button
        onClick={handleSubmit}
        disabled={isLoading || isProcessingFile || !inputText}
        className="mt-4 w-full flex items-center justify-center gap-2 bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 transition-all disabled:bg-slate-600 disabled:cursor-not-allowed disabled:text-slate-400"
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-900"></div>
            Generating...
          </>
        ) : (
          <>
            <GenerateIcon className="w-5 h-5" />
            Generate Form
          </>
        )}
      </button>
    </div>
  );
};
