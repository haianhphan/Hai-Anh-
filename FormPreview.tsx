
import React from 'react';
import type { Form } from '../types';
import { ItemType } from '../types';
import { QuestionCard } from './QuestionCard';
import { CopyIcon, GoogleFormsIcon } from './icons';

interface FormPreviewProps {
  form: Form;
  onExportClick: () => void;
}

const PassageCard: React.FC<{ item: Form['items'][0] }> = ({ item }) => (
  <div className="bg-slate-900/50 border-l-4 border-cyan-400 p-5 shadow-md rounded-r-lg">
    <h4 className="text-lg font-semibold text-slate-200 mb-2">{item.title}</h4>
    <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">{item.description}</p>
  </div>
);


export const FormPreview: React.FC<FormPreviewProps> = ({ form, onExportClick }) => {
  const [copied, setCopied] = React.useState(false);

  const copyJsonToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(form, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="w-full h-full overflow-y-auto pr-2">
      <div className="flex justify-between items-start mb-4 gap-4">
        <div className="flex-grow">
          <h3 className="text-2xl font-bold text-slate-100">{form.title}</h3>
          <p className="text-slate-400 mt-1">{form.description}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
          <button
            onClick={copyJsonToClipboard}
            className="flex items-center justify-center gap-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium py-2 px-3 rounded-md transition-colors"
            title="Copy JSON to clipboard"
          >
            <CopyIcon className="w-4 h-4" />
            <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
          </button>
          <button
            onClick={onExportClick}
            className="flex items-center justify-center gap-2 text-sm bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-2 px-3 rounded-md transition-colors"
            title="Create a real Google Form from this structure"
          >
            <GoogleFormsIcon className="w-4 h-4" />
            <span>Create Google Form</span>
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {form.items.map((item, index) => {
          if (item.type === ItemType.SECTION_HEADER) {
            return <PassageCard key={`item-${index}`} item={item} />;
          }
          return <QuestionCard key={`item-${index}`} item={item} index={index} />;
        })}
      </div>
    </div>
  );
};
