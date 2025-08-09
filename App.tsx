
import React, { useState, useCallback } from 'react';
import { InputPanel } from './components/InputPanel';
import { FormPreview } from './components/FormPreview';
import { GoogleFormModal } from './components/GoogleFormModal';
import { LogoIcon, SparklesIcon, WarningIcon } from './components/icons';
import { generateFormFromText } from './services/geminiService';
import type { Form } from './types';

const App: React.FC = () => {
  const [generatedForm, setGeneratedForm] = useState<Form | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const handleGenerate = useCallback(async (text: string) => {
    if (!text.trim()) {
      setError("Please provide some text or upload a file to generate a form.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedForm(null);

    try {
      const form = await generateFormFromText(text);
      setGeneratedForm(form);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An unknown error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <>
      <div className="min-h-screen bg-slate-900 text-slate-200">
        <header className="p-4 border-b border-slate-700/50">
          <div className="container mx-auto flex items-center gap-3">
            <LogoIcon className="w-8 h-8 text-cyan-400" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">Form Architect AI</h1>
          </div>
        </header>
        <main className="container mx-auto p-4 md:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <InputPanel onGenerate={handleGenerate} isLoading={isLoading} />

            <div className="bg-slate-800/50 rounded-xl shadow-lg border border-slate-700 h-full min-h-[500px] flex flex-col">
              <div className="p-5 border-b border-slate-700 flex items-center gap-3">
                <SparklesIcon className="w-6 h-6 text-cyan-400" />
                <h2 className="text-xl font-semibold text-slate-100">Generated Form Preview</h2>
              </div>
              <div className="p-6 flex-grow">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
                    <p className="mt-4 text-lg">Generating your form...</p>
                    <p className="text-sm">The AI is thinking, this might take a moment.</p>
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center h-full text-red-400 bg-red-900/20 rounded-lg p-6">
                    <WarningIcon className="w-12 h-12 mb-4"/>
                    <h3 className="text-xl font-bold text-red-300">An Error Occurred</h3>
                    <p className="text-center mt-2">{error}</p>
                  </div>
                ) : generatedForm ? (
                  <FormPreview form={generatedForm} onExportClick={openModal} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <p className="text-lg">Your generated form will appear here.</p>
                    <p className="text-sm">Get started by providing content on the left.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <footer className="text-center mt-12 text-slate-500 text-sm">
            <p>Powered by Gemini API. Designed for modern form creation.</p>
          </footer>
        </main>
      </div>
      {isModalOpen && generatedForm && (
        <GoogleFormModal
          form={generatedForm}
          isOpen={isModalOpen}
          onClose={closeModal}
        />
      )}
    </>
  );
};

export default App;
