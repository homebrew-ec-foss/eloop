'use client';

import React from 'react';
import { FieldType } from '@/types';

interface FieldTypeItemProps {
  type: FieldType;
  label: string;
  onSelect: (type: FieldType, label?: string, name?: string, required?: boolean, placeholder?: string, useUserProfile?: boolean) => void;
  fieldLabel?: string;
  fieldName?: string;
  required?: boolean;
  placeholder?: string;
  useUserProfile?: boolean;
}

export const FieldTypeItem: React.FC<FieldTypeItemProps> = ({ 
  type, 
  label, 
  onSelect,
  fieldLabel,
  fieldName,
  required = true,
  placeholder,
  useUserProfile
}) => {
  return (
    <button
      type="button" // Explicitly set type to "button" to prevent form submission
      onClick={() => onSelect(type, fieldLabel, fieldName, required, placeholder, useUserProfile)}
      className="flex-1 px-3 py-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 hover:bg-blue-100 transition-colors shadow-sm font-medium"
    >
      {label}
    </button>
  );
};