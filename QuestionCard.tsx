
import React from 'react';
import type { FormItem } from '../types';
import { ItemType } from '../types';
import { CheckIcon } from './icons';

interface QuestionCardProps {
  item: FormItem;
  index: number;
}

const renderInput = (item: FormItem) => {
  const hasAnswer = item.correctAnswer !== undefined && item.correctAnswer !== null;

  switch (item.type) {
    case ItemType.SHORT_ANSWER:
      return (
        <>
            <input
              type="text"
              placeholder="Short answer text"
              className="w-full bg-slate-900/0 border-b border-slate-500 py-2 focus:outline-none focus:border-cyan-400 transition-colors"
              disabled
            />
            {hasAnswer && typeof item.correctAnswer === 'string' && (
                <div className="mt-3 flex items-center gap-2 text-sm text-green-300 bg-green-900/30 px-3 py-1.5 rounded-md">
                    <span className="font-semibold">Correct Answer:</span>
                    <span>{item.correctAnswer}</span>
                </div>
            )}
        </>
      );
    case ItemType.PARAGRAPH:
      return (
        <textarea
          placeholder="Long answer text"
          className="w-full h-24 bg-slate-900/0 border-b border-slate-500 py-2 focus:outline-none focus:border-cyan-400 transition-colors"
          disabled
        />
      );
    case ItemType.MULTIPLE_CHOICE:
      return (
        <div className="space-y-3">
          {item.options?.map((option, i) => {
            const isCorrect = hasAnswer && item.correctAnswer === option;
            return (
              <div key={i} className={`flex items-center gap-3 p-2 rounded-md ${isCorrect ? 'bg-green-900/30' : ''}`}>
                <div className={`flex-shrink-0 w-5 h-5 border-2 rounded-full flex items-center justify-center ${isCorrect ? 'border-green-400 bg-green-500' : 'border-slate-400'}`}>
                    {isCorrect && <CheckIcon className="w-4 h-4 text-slate-900" />}
                </div>
                <span className={`${isCorrect ? 'text-green-200 font-medium' : 'text-slate-300'}`}>{option}</span>
              </div>
            );
          })}
        </div>
      );
    case ItemType.CHECKBOXES:
      return (
        <div className="space-y-3">
          {item.options?.map((option, i) => {
            const isCorrect = hasAnswer && Array.isArray(item.correctAnswer) && item.correctAnswer.includes(option);
            return (
              <div key={i} className={`flex items-center gap-3 p-2 rounded-md ${isCorrect ? 'bg-green-900/30' : ''}`}>
                 <div className={`flex-shrink-0 w-5 h-5 border-2 rounded-sm flex items-center justify-center ${isCorrect ? 'border-green-400 bg-green-500' : 'border-slate-400'}`}>
                    {isCorrect && <CheckIcon className="w-4 h-4 text-slate-900" />}
                </div>
                <span className={`${isCorrect ? 'text-green-200 font-medium' : 'text-slate-300'}`}>{option}</span>
              </div>
            );
          })}
        </div>
      );
    case ItemType.DROPDOWN:
      return (
         <>
            <select
                className="w-full max-w-xs bg-slate-700 border border-slate-600 rounded-md p-2 focus:outline-none appearance-none"
                disabled
            >
                <option>Select an option</option>
                {item.options?.map((option, i) => (
                    <option key={i}>{option}</option>
                ))}
            </select>
             {hasAnswer && typeof item.correctAnswer === 'string' && (
                <div className="mt-3 flex items-center gap-2 text-sm text-green-300">
                    <span className="font-semibold">Correct Answer:</span>
                    <span>{item.correctAnswer}</span>
                </div>
            )}
        </>
      );
    default:
      return null;
  }
};

export const QuestionCard: React.FC<QuestionCardProps> = ({ item, index }) => {
  return (
    <div className="relative bg-slate-800 border border-slate-700/80 rounded-lg p-5 shadow-md transition-all hover:border-slate-600">
       {item.points && (
        <div className="absolute top-3 right-3 bg-cyan-500 text-slate-900 text-xs font-bold px-2 py-1 rounded-full">
            {item.points} {item.points === 1 ? 'point' : 'points'}
        </div>
      )}
      <h4 className="text-md font-semibold text-slate-200 mb-4 pr-16">
        {item.title}
        {item.required && <span className="text-red-400 ml-1">*</span>}
      </h4>
      <div className="mt-2">{renderInput(item)}</div>
    </div>
  );
};