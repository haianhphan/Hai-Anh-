
export enum ItemType {
  SHORT_ANSWER = 'SHORT_ANSWER',
  PARAGRAPH = 'PARAGRAPH',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  CHECKBOXES = 'CHECKBOXES',
  DROPDOWN = 'DROPDOWN',
  SECTION_HEADER = 'SECTION_HEADER', // For text blocks/passages
}

export interface FormItem {
  title: string;
  description?: string; // For SECTION_HEADER, this holds the passage.
  type: ItemType;
  options?: string[];
  points?: number;
  correctAnswer?: string | string[]; // string for most types, string[] for CHECKBOXES
  required?: boolean;
}

export interface Form {
  title: string;
  description: string;
  items: FormItem[];
}