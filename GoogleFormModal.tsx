import React, { useState, useEffect, useCallback } from 'react';
import type { Form, FormItem } from '../types';
import { ItemType } from '../types';
import { GoogleFormsIcon, WarningIcon, CheckIcon, ExternalLinkIcon, CopyIcon } from './icons';

// Declare the google object from the GSI client library
declare const google: any;

interface GoogleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: Form;
}

type Status = 'idle' | 'authenticating' | 'creating' | 'success' | 'error';

const SCOPES = 'https://www.googleapis.com/auth/forms.body';
let tokenClient: any = null;

/**
 * Generates a Google Apps Script string to manually create the form as a quiz.
 */
const generateAppsScript = (form: Form): string => {
    const formItems = form.items.map(item => {
        const title = JSON.stringify(item.title);
        const points = item.points || 0;
        const required = !!item.required;

        let itemSetup = '';

        switch (item.type) {
            case ItemType.SHORT_ANSWER:
                itemSetup = `  var item = form.addTextItem().setTitle(${title}).setRequired(${required});`;
                if (points > 0) {
                    itemSetup += `\n  item.setPoints(${points});`;
                    
                    itemSetup += `\n\n  // --- IMPORTANT: MANUAL STEP REQUIRED FOR THE QUESTION ABOVE ---`;
                    itemSetup += `\n  // Google Apps Script does not allow setting the correct answer for 'Short Answer' questions automatically.`;
                    if (item.correctAnswer && typeof item.correctAnswer === 'string') {
                        const answer = JSON.stringify(item.correctAnswer);
                        itemSetup += `\n  // You must set this in the Google Forms editor. The suggested correct answer is: ${answer}`;
                    } else {
                        itemSetup += `\n  // You must set the correct answer manually in the Google Forms editor.`;
                    }
                    itemSetup += `\n  // -------------------------------------------------------------`;
                }
                return itemSetup;

            case ItemType.PARAGRAPH:
                return `  form.addParagraphTextItem().setTitle(${title}).setRequired(${required});`;

            case ItemType.MULTIPLE_CHOICE:
            case ItemType.DROPDOWN:
            case ItemType.CHECKBOXES:
                const itemTypeMap = {
                    [ItemType.MULTIPLE_CHOICE]: 'addMultipleChoiceItem',
                    [ItemType.CHECKBOXES]: 'addCheckboxItem',
                    [ItemType.DROPDOWN]: 'addListItem',
                };
                const method = itemTypeMap[item.type];
                itemSetup = `  var item = form.${method}().setTitle(${title}).setRequired(${required});`;

                const hasAnswerKey = item.correctAnswer !== undefined && item.correctAnswer !== null && (Array.isArray(item.correctAnswer) ? item.correctAnswer.length > 0 : !!item.correctAnswer);

                const choices = (item.options || []).map(option => {
                    const isCorrect = Array.isArray(item.correctAnswer)
                        ? item.correctAnswer.includes(option)
                        : item.correctAnswer === option;
                    return `item.createChoice(${JSON.stringify(option)}, ${isCorrect})`;
                }).join(', ');
                
                itemSetup += `\n  item.setChoices([${choices}]);`;
                
                if (points > 0) {
                    itemSetup += `\n  item.setPoints(${points});`;
                }
                
                if (points > 0 && !hasAnswerKey) {
                    itemSetup += `\n  // AI WARNING: This question was assigned points, but the AI did not identify a correct answer. Please set the answer manually in the Form editor.`;
                }
                return itemSetup;

            case ItemType.SECTION_HEADER:
                const description = JSON.stringify(item.description || '');
                return `  form.addSectionHeaderItem().setTitle(${title}).setHelpText(${description});`;
            default:
                return `  // Unsupported item type: ${item.type} for item "${item.title}"`;
        }
    }).join('\n\n');

    return `function createFormFromAI() {
  /* 
   * How to use this script:
   * 1. Go to script.google.com/create in your browser.
   * 2. Paste this entire code into the editor, replacing any existing content.
   * 3. Click the "Save project" icon (floppy disk).
   * 4. Click the "Run" button.
   * 5. Google will ask for permission. Click "Review permissions" and "Allow".
   * 6. After it runs, click "View" > "Executions" to see the links to your new form.
   *
   * NOTE: Some items, like answers for text questions, may require manual setup.
   * Please review the generated form and script comments carefully.
  */
  
  try {
    var form = FormApp.create(${JSON.stringify(form.title)});
    form.setDescription(${JSON.stringify(form.description)});
    form.setIsQuiz(true); // Make it a quiz!

${formItems}

    Logger.log('✅ Form created successfully!');
    Logger.log('View your form here: ' + form.getPublishedUrl());
    Logger.log('Edit your form here: ' + form.getEditUrl());
  } catch (e) {
    Logger.log('❌ Error creating form: ' + e.toString());
  }
}`;
};


const mapItemToApiRequest = (item: FormItem) => {
    let itemRequest;
    
    // Base question object that will be populated
    const question: {
        required?: boolean;
        grading?: { pointValue?: number; correctAnswers?: { answers: { value: string }[] } };
        textQuestion?: { paragraph: boolean };
        choiceQuestion?: { type: string; options: { value: string }[] };
    } = {};

    if (item.required) {
        question.required = true;
    }

    if (item.points && item.points > 0 && item.correctAnswer) {
        const answers = Array.isArray(item.correctAnswer) ? item.correctAnswer : [item.correctAnswer];
        question.grading = {
            pointValue: item.points,
            correctAnswers: { answers: answers.map(value => ({ value })) }
        };
    }

    switch (item.type) {
        case ItemType.SHORT_ANSWER:
            question.textQuestion = { paragraph: false };
            itemRequest = { questionItem: { question } };
            break;
        case ItemType.PARAGRAPH:
            // Paragraphs don't have grading, so create a new question object for it
             const paragraphQuestion: { required?: boolean; textQuestion: any } = { textQuestion: { paragraph: true } };
            if (item.required) {
                paragraphQuestion.required = true;
            }
            itemRequest = { questionItem: { question: paragraphQuestion } };
            break;
        case ItemType.MULTIPLE_CHOICE:
        case ItemType.CHECKBOXES:
        case ItemType.DROPDOWN:
            question.choiceQuestion = {
                type: item.type === ItemType.MULTIPLE_CHOICE ? 'RADIO' : item.type === ItemType.CHECKBOXES ? 'CHECKBOX' : 'DROP_DOWN',
                options: item.options?.map(opt => ({ value: opt })) || [],
            };
            itemRequest = { questionItem: { question } };
            break;
        case ItemType.SECTION_HEADER:
            itemRequest = { textItem: {} };
            return { createItem: { item: { title: item.title, description: item.description, ...itemRequest }, location: { index: 0 } } };
        default:
            return null;
    }

    return { createItem: { item: { title: item.title, ...itemRequest }, location: { index: 0 } } };
};


export const GoogleFormModal: React.FC<GoogleFormModalProps> = ({ isOpen, onClose, form }) => {
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const [isConfigured] = useState(!!CLIENT_ID);

  // State for OAuth flow
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [formUrl, setFormUrl] = useState<string | null>(null);
  const [isGsiLoaded, setIsGsiLoaded] = useState(false);
  
  // State for manual script fallback
  const [appsScript, setAppsScript] = useState('');
  const [copied, setCopied] = useState(false);


  useEffect(() => {
    if (!isOpen) return;

    if (isConfigured) {
      // Setup for OAuth flow
      setStatus('idle');
      setError(null);
      setFormUrl(null);
      
      const checkGsi = () => {
        if (typeof google !== 'undefined' && google.accounts) {
          setIsGsiLoaded(true);
        } else {
          setTimeout(checkGsi, 100);
        }
      };
      checkGsi();
    } else {
      // Setup for manual script fallback
      setAppsScript(generateAppsScript(form));
    }
  }, [isOpen, form, isConfigured]);
  
  const createForm = useCallback(async (accessToken: string) => {
    setStatus('creating');
    setError(null);

    const formRequestBody = { info: { title: form.title, documentTitle: form.title } };

    try {
      const createResponse = await fetch('https://forms.googleapis.com/v1/forms', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(formRequestBody),
      });
      const createData = await createResponse.json();
      if (!createResponse.ok) throw new Error(createData.error?.message || 'Failed to create the initial form.');
      
      const formId = createData.formId;

      const quizSettingsRequest = {
        updateSettings: {
          settings: { quizSettings: { isQuiz: true } },
          updateMask: 'quizSettings.isQuiz',
        },
      };

      const itemRequests = form.items.map(mapItemToApiRequest).filter(Boolean).reverse(); // Reverse to insert at top

      const descriptionUpdateRequest = {
        updateFormInfo: {
          info: { description: form.description },
          updateMask: 'description',
        },
      };

      const allRequests = [quizSettingsRequest, ...itemRequests, descriptionUpdateRequest];
      
      if (allRequests.length > 0) {
        const batchUpdateResponse = await fetch(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ requests: allRequests, includeFormInResponse: false }),
        });
         if (!batchUpdateResponse.ok) {
            const errorData = await batchUpdateResponse.json();
            throw new Error(errorData.error?.message || 'Failed to update the form with items and settings.');
         }
      }

      setFormUrl(createData.responderUri);
      setStatus('success');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred during form creation.');
      setStatus('error');
    }
  }, [form]);

  const handleAuthAndCreate = useCallback(() => {
    if (!isGsiLoaded || !CLIENT_ID) {
      setError('Authentication libraries are not ready. Please try again in a moment.');
      setStatus('error');
      return;
    }

    setStatus('authenticating');
    
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (tokenResponse: any) => {
        if (tokenResponse && tokenResponse.access_token) {
          createForm(tokenResponse.access_token);
        } else {
          setError('Authentication failed. No access token received.');
          setStatus('error');
        }
      },
      error_callback: (error: any) => {
        setError(`Authentication error: ${error.message || 'The sign-in process was closed or failed.'}`);
        setStatus('error');
      }
    });

    tokenClient.requestAccessToken();
  }, [createForm, isGsiLoaded, CLIENT_ID]);

  const handleTryAgain = () => {
    setStatus('idle');
    setError(null);
  };
  
  const handleCopyScript = () => {
    if (!appsScript) return;
    navigator.clipboard.writeText(appsScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderContent = () => {
    if (!isConfigured) {
      return (
        <div>
          <div className="flex flex-col items-center justify-center text-center bg-yellow-900/20 rounded-lg p-4 mb-6 border border-yellow-700/50">
            <WarningIcon className="w-10 h-10 text-yellow-400 mb-3" />
            <h3 className="text-lg font-bold text-yellow-300">Automatic Creation Unavailable</h3>
            <p className="text-yellow-400/90 mt-1 text-sm max-w-md">
              This feature requires admin configuration. You can create the form manually with Google Apps Script.
            </p>
          </div>
          <div className="space-y-4 text-slate-300">
            <h4 className="font-semibold text-slate-100">Instructions:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm bg-slate-900/50 p-4 rounded-md border border-slate-700">
              <li>Click the "Copy Script" button below.</li>
              <li>Open <a href="https://script.google.com/create" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">Google Apps Script</a> in a new tab.</li>
              <li>Paste the code into the editor.</li>
              <li>Click "Save project", then click "Run".</li>
              <li>Authorize the script when prompted by Google.</li>
              <li>Check the "Execution log" for the link to your new form.</li>
            </ol>
            <div className="relative">
              <pre className="bg-slate-900 text-sm text-slate-300 p-4 rounded-md border border-slate-700 max-h-52 overflow-auto">
                <code>{appsScript}</code>
              </pre>
              <button
                onClick={handleCopyScript}
                className="absolute top-2 right-2 flex items-center gap-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium py-1 px-2 rounded-md transition-colors"
              >
                <CopyIcon className="w-4 h-4" />
                {copied ? 'Copied!' : 'Copy Script'}
              </button>
            </div>
          </div>
        </div>
      );
    }
    
    // OAuth Flow UI
    switch (status) {
      case 'creating':
        return (
          <div className="flex flex-col items-center justify-center min-h-[250px] text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
            <p className="mt-4 text-lg text-slate-300">Creating your form...</p>
            <p className="text-sm text-slate-400">Please wait while we set things up in your Google Drive.</p>
          </div>
        );
      case 'success':
        return (
           <div className="flex flex-col items-center justify-center min-h-[250px] text-center">
            <CheckIcon className="w-16 h-16 text-green-400 mb-4" />
            <h3 className="text-xl font-bold text-slate-100">Form Created Successfully!</h3>
            <p className="text-slate-400 mt-2 mb-6">Your new form is now available in your Google Drive.</p>
            <a href={formUrl || ''} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 transition-all">
                <ExternalLinkIcon className="w-5 h-5" />
                Open Form
            </a>
          </div>
        );
      case 'error':
        return (
          <div className="flex flex-col items-center justify-center min-h-[250px] text-center bg-red-900/20 rounded-lg p-4">
            <WarningIcon className="w-12 h-12 text-red-400 mb-4"/>
            <h3 className="text-xl font-bold text-red-300">An Error Occurred</h3>
            <p className="text-red-400 mt-2 mb-6 text-sm max-w-md">{error}</p>
            <button onClick={handleTryAgain} className="bg-slate-600 hover:bg-slate-500 text-slate-100 font-bold py-2 px-6 rounded-lg transition-all">
                Try Again
            </button>
          </div>
        );
      case 'idle':
      case 'authenticating':
      default:
        return (
           <div className="flex flex-col items-center justify-center min-h-[250px] text-center">
            <h3 className="text-xl font-bold text-slate-100">Ready to Create Your Quiz?</h3>
            <p className="text-slate-400 mt-2 mb-6 max-w-md">To continue, sign in with Google. This will securely create the form as a quiz directly in your Google Drive.</p>
             <button
                onClick={handleAuthAndCreate}
                disabled={status === 'authenticating' || !isGsiLoaded}
                className="w-full flex items-center justify-center gap-3 bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 transition-all disabled:bg-slate-600 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                <GoogleFormsIcon className="w-5 h-5" />
                {status === 'authenticating' ? 'Signing in...' : 'Sign in & Create Quiz'}
              </button>
          </div>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <header className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GoogleFormsIcon className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-semibold text-slate-100">Create Your Google Form</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors text-2xl leading-none">&times;</button>
        </header>
        <div className="p-6 overflow-y-auto">
            {renderContent()}
        </div>
        <footer className="p-4 border-t border-slate-700 text-right">
            <button onClick={onClose} className="bg-slate-700 text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-slate-600 transition-all">
                Close
            </button>
        </footer>
      </div>
    </div>
  );
};
