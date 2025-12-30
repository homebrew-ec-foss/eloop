import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FormField, FieldType } from '@/types';
import { PlusIcon, XMarkIcon, Bars3Icon } from '@heroicons/react/24/outline';

interface SortableFieldProps {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
  onDelete: () => void;
}

export const SortableField: React.FC<SortableFieldProps> = ({
  field,
  onUpdate,
  onDelete
}) => {
  const [expanded, setExpanded] = useState(true);
  const [newOption, setNewOption] = useState('');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ label: e.target.value });
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ name: e.target.value });
  };

  const handleRequiredChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ required: e.target.checked });
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as FieldType;

    // Reset options if changing to/from a field type with options
    const hasOptions = newType === 'select' || newType === 'multiselect';
    const hadOptions = field.type === 'select' || field.type === 'multiselect';

    const updates: Partial<FormField> = { type: newType };

    if (hasOptions && !hadOptions) {
      updates.options = ['Option 1', 'Option 2'];
    } else if (!hasOptions && hadOptions) {
      updates.options = undefined;
    }

    onUpdate(updates);
  };

  const handleRemoveOption = (option: string) => {
    if (!field.options) return;
    onUpdate({
      options: field.options.filter(opt => opt !== option)
    });
  };

  const handleAddOption = () => {
    if (!newOption.trim() || !field.options) return;
    onUpdate({
      options: [...field.options, newOption.trim()]
    });
    setNewOption('');
  };

  const handlePlaceholderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ placeholder: e.target.value });
  };

  const handleValidationPatternChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({
      validation: {
        ...field.validation,
        pattern: e.target.value
      }
    });
  };

  const handleValidationMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({
      validation: {
        ...field.validation,
        message: e.target.value
      }
    });
  };

  const setCommonPattern = (pattern: string, message: string) => {
    onUpdate({
      validation: {
        pattern,
        message
      }
    });
  };

  const toggleExpand = () => {
    setExpanded(!expanded);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border rounded-lg shadow-sm hover:shadow transition-all"
    >
      <div className="flex items-center p-4 bg-gray-50 border-b">
        <button
          type="button"
          className="cursor-move mr-3 text-gray-400 hover:text-gray-600"
          {...attributes}
          {...listeners}
        >
          <Bars3Icon className="w-5 h-5" />
        </button>

        <div className="flex-grow">
          <span className="font-medium text-gray-800">{field.label || 'Untitled field'}</span>
          <span className="ml-2 text-sm text-gray-500">({field.type})</span>
          {field.required && <span className="ml-2 text-sm text-red-500">*required</span>}
        </div>

        <button
          type="button"
          onClick={toggleExpand}
          className="ml-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>

        <button
          type="button"
          onClick={onDelete}
          className="ml-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Field Label</label>
              <input
                type="text"
                value={field.label}
                onChange={handleLabelChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Field Name</label>
              <input
                type="text"
                value={field.name}
                onChange={handleNameChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Field Type</label>
              <select
                value={field.type}
                onChange={handleTypeChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              >
                <option value="text">Text</option>
                <option value="textarea">Text Area</option>
                <option value="email">Email</option>
                <option value="number">Number</option>
                <option value="slider">Slider</option>
                <option value="select">Dropdown</option>
                <option value="multiselect">Multi-select</option>
                <option value="checkbox">Checkbox</option>
                <option value="date">Date</option>
                <option value="time">Time</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Placeholder</label>
              <input
                type="text"
                value={field.placeholder || ''}
                onChange={handlePlaceholderChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
            </div>
          </div>



          {/* Validation section for text fields */}
          {(field.type === 'text' || field.type === 'number') && (
            <div className="border border-gray-200 rounded-md p-4 bg-gray-50 space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Validation Rules</h4>

              {/* Quick regex patterns for common use cases */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-600">Common Patterns</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setCommonPattern('^PES[12](UG|PG)\\d{2}[A-Z]{2}\\d{3}$', 'Must be valid SRN format (e.g., PES2UG23CS381)')}
                    className="px-3 py-1 text-xs bg-white border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    SRN (PESU)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommonPattern('^[A-Z0-9]{10}$', 'Must be exactly 10 alphanumeric characters (e.g., USN: 1MS21CS001)')}
                    className="px-3 py-1 text-xs bg-white border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    USN (10 chars)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommonPattern('^[0-9]{10}$', 'Must be exactly 10 digits')}
                    className="px-3 py-1 text-xs bg-white border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    Phone (10 digits)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommonPattern('^[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}$', 'Must be valid Aadhaar format (e.g., XXXX-XXXX-XXXX)')}
                    className="px-3 py-1 text-xs bg-white border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    Aadhaar
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommonPattern('^[A-Z]{5}[0-9]{4}[A-Z]{1}$', 'Must be valid PAN format (e.g., ABCDE1234F)')}
                    className="px-3 py-1 text-xs bg-white border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    PAN
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommonPattern('^[a-zA-Z0-9]+$', 'Only letters and numbers allowed')}
                    className="px-3 py-1 text-xs bg-white border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    Alphanumeric
                  </button>
                </div>
              </div>

              {/* Custom regex pattern input */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Custom Regex Pattern
                  <span className="ml-1 text-gray-400 font-normal">(Leave empty for no validation)</span>
                </label>
                <input
                  type="text"
                  value={field.validation?.pattern || ''}
                  onChange={handleValidationPatternChange}
                  placeholder="e.g., ^[A-Z0-9]{10}$"
                  className="block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm font-mono"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Enter a JavaScript regex pattern (without / delimiters)
                </p>
              </div>

              {/* Custom error message */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Validation Error Message
                </label>
                <input
                  type="text"
                  value={field.validation?.message || ''}
                  onChange={handleValidationMessageChange}
                  placeholder="e.g., Must be a valid USN format"
                  className="block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Message shown when validation fails
                </p>
              </div>
            </div>
          )}

          {/* Slider properties */}
          {field.type === 'slider' && (
            <div className="border border-gray-200 rounded-md p-4 bg-gray-50 space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Slider Settings</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Min Value</label>
                  <input
                    type="number"
                    value={field.validation?.pattern ? parseInt(field.validation.pattern.split('-')[0]) : 0}
                    onChange={(e) => {
                      const min = e.target.value;
                      const max = field.validation?.pattern ? parseInt(field.validation.pattern.split('-')[1] || '100') : 100;
                      onUpdate({
                        validation: {
                          pattern: `${min}-${max}`,
                          message: field.validation?.message || 'Value out of range'
                        }
                      });
                    }}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Max Value</label>
                  <input
                    type="number"
                    value={field.validation?.pattern ? parseInt(field.validation.pattern.split('-')[1]) : 100}
                    onChange={(e) => {
                      const min = field.validation?.pattern ? parseInt(field.validation.pattern.split('-')[0] || '0') : 0;
                      const max = e.target.value;
                      onUpdate({
                        validation: {
                          pattern: `${min}-${max}`,
                          message: field.validation?.message || 'Value out of range'
                        }
                      });
                    }}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Step</label>
                  <input
                    type="number"
                    value={field.placeholder || '1'}
                    onChange={(e) => onUpdate({ placeholder: e.target.value })}
                    min="0.1"
                    step="0.1"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  />
                </div>
              </div>
            </div>
          )}

          {field.type === 'email' && (
            <div className="border border-gray-200 rounded-md p-3 bg-gray-50">
              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  id={`user-profile-${field.id}`}
                  checked={field.useUserProfile || false}
                  onChange={(e) => onUpdate({ useUserProfile: e.target.checked, userProfileField: 'email' })}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <label htmlFor={`user-profile-${field.id}`} className="ml-2 block text-sm text-gray-700">
                  Pull from user profile
                </label>
              </div>

              {field.useUserProfile && (
                <div className="ml-6">
                  <p className="text-sm text-gray-600">
                    This field will be automatically filled with the user&apos;s email address from their profile.
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    The field will be read-only and users cannot edit it.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center">
            <input
              type="checkbox"
              id={`required-${field.id}`}
              checked={field.required}
              onChange={handleRequiredChange}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
            <label htmlFor={`required-${field.id}`} className="ml-2 block text-sm text-gray-700">
              Required field
            </label>
          </div>

          {(field.type === 'select' || field.type === 'multiselect') && field.options && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
              <div className="space-y-2">
                {field.options.map((option, index) => (
                  <div key={index} className="flex items-center">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...field.options!];
                        newOptions[index] = e.target.value;
                        onUpdate({ options: newOptions });
                      }}
                      className="flex-grow border border-gray-300 rounded-md shadow-sm p-2"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(option)}
                      className="ml-2 text-red-500 hover:text-red-700"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center mt-2">
                <input
                  type="text"
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  placeholder="Add new option"
                  className="flex-grow border border-gray-300 rounded-md shadow-sm p-2"
                />
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="ml-2 bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
                >
                  <PlusIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};