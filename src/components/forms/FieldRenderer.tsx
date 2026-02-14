import React from 'react';
import { FormField } from '@/types';

export function validateField(field: FormField, value: string): string | null {
  if (field.validation?.pattern && value) {
    try {
      const regex = new RegExp(field.validation.pattern);
      if (!regex.test(value)) {
        return field.validation.message || `Invalid format for ${field.label}`;
      }
    } catch (error) {
      console.error('Invalid regex pattern for field', field.name, field.validation?.pattern, error);
    }
  }
  return null;
}

interface RenderFormFieldProps {
  field: FormField;
  value?: string;
  onChange: (name: string, value: string) => void;
  validationErrors?: Record<string, string>;
}

export const RenderFormField: React.FC<RenderFormFieldProps> = ({ field, value = '', onChange, validationErrors = {} }) => {
  const hasError = !!validationErrors[field.name];
  const errorClass = hasError ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-indigo-500';

  switch (field.type) {
    case 'text':
      return (
        <input
          type="text"
          id={field.name}
          name={field.name}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(field.name, e.target.value)}
          required={field.required}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${errorClass}`}
        />
      );

    case 'email':
      return (
        <div>
          {field.useUserProfile && (
            <div className="text-xs text-indigo-600 mb-1">🔒 Auto-filled from your profile (read-only)</div>
          )}
          <input
            type="email"
            id={field.name}
            name={field.name}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => onChange(field.name, e.target.value)}
            required={field.required}
            disabled={field.useUserProfile}
            className={`w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ${field.useUserProfile ? 'border-indigo-300 bg-indigo-50 cursor-not-allowed text-gray-700' : ''}`}
          />
        </div>
      );

    case 'number':
      return (
        <input
          type="number"
          id={field.name}
          name={field.name}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(field.name, e.target.value)}
          required={field.required}
          className={`w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:border-indigo-400 focus:ring-2 ${errorClass}`}
        />
      );

    case 'select':
      return (
        <select
          id={field.name}
          name={field.name}
          value={value}
          onChange={(e) => onChange(field.name, e.target.value)}
          required={field.required}
          className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        >
          <option value="">Select an option</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );

    case 'multiselect':
      return (
        <div className="space-y-2">
          {field.options?.map((option) => {
            const values = value ? value.split(',') : [];
            const isChecked = values.includes(option);

            return (
              <label key={option} className="flex items-center">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    const newValues = e.target.checked ? [...values, option] : values.filter((v) => v !== option);
                    onChange(field.name, newValues.join(','));
                  }}
                  className="mr-2"
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
      );

    case 'checkbox':
      return (
        <label className="flex items-center">
          <input
            type="checkbox"
            id={field.name}
            name={field.name}
            checked={value === 'true'}
            onChange={(e) => onChange(field.name, e.target.checked ? 'true' : 'false')}
            required={field.required}
            className="mr-2"
          />
          <span>{field.placeholder || 'Yes'}</span>
        </label>
      );

    case 'date':
      return (
        <input
          type="date"
          id={field.name}
          name={field.name}
          value={value}
          onChange={(e) => onChange(field.name, e.target.value)}
          required={field.required}
          className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
      );

    case 'time':
      return (
        <input
          type="time"
          id={field.name}
          name={field.name}
          value={value}
          onChange={(e) => onChange(field.name, e.target.value)}
          required={field.required}
          className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
      );

    default:
      return (
        <input
          type="text"
          id={field.name}
          name={field.name}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(field.name, e.target.value)}
          required={field.required}
          className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
      );
  }
};
