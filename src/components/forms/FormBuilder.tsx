'use client';

import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { FormField, FieldType } from '@/types';
import { FieldTypeItem } from './FieldTypeItem';
import { SortableField } from './SortableField';

interface FormBuilderProps {
  fields: FormField[];
  onFieldsChange: (fields: FormField[]) => void;
}

export const FormBuilder: React.FC<FormBuilderProps> = ({ fields, onFieldsChange }) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Field type options for adding new fields
  const fieldTypes = [
    { type: 'text', label: 'Text' },
    { type: 'email', label: 'Email' },
    { type: 'number', label: 'Number' },
    { type: 'select', label: 'Dropdown' },
    { type: 'multiselect', label: 'Multi-select' },
    { type: 'checkbox', label: 'Checkbox' },
    { type: 'date', label: 'Date' },
    { type: 'time', label: 'Time' },
  ];

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    if (active.id !== over.id) {
      const oldIndex = fields.findIndex((field) => field.id === active.id);
      const newIndex = fields.findIndex((field) => field.id === over.id);

      console.log('Drag detected:', {
        active: active.id,
        over: over.id,
        oldIndex,
        newIndex
      });

      if (oldIndex !== -1 && newIndex !== -1) {
        const newFields = arrayMove(fields, oldIndex, newIndex);

        // Update the order property
        const updatedFields = newFields.map((field, index) => ({
          ...field,
          order: index,
        }));

        onFieldsChange(updatedFields);
      }
    }
  };

  // Helper: find duplicate names in current fields
  const getDuplicateNames = (fList: FormField[]) => {
    const counts: Record<string, number> = {};
    fList.forEach(f => {
      const n = (f.name || '').trim();
      if (!n) return;
      counts[n] = (counts[n] || 0) + 1;
    });
    return Object.keys(counts).filter(n => counts[n] > 1);
  };

  const [addFieldError, setAddFieldError] = React.useState<string | null>(null);

  const generateUniqueName = (base: string) => {
    let candidate = base;
    let i = 1;
    const existing = new Set(fields.map(f => f.name));
    while (existing.has(candidate)) {
      i += 1;
      candidate = `${base}_${i}`;
    }
    return candidate;
  };

  const handleAddField = (type: FieldType, label?: string, name?: string, required: boolean = true, placeholder?: string, useUserProfile?: boolean) => {
    setAddFieldError(null);

    // Normalize requested name or generate default
    const requestedName = name ? name.trim() : `field_${fields.length + 1}`;

    // If the requested name already exists, show error for suggested/custom names.
    if (fields.some(f => (f.name || '').trim() === requestedName)) {
      setAddFieldError(`A field with the name "${requestedName}" already exists. Field names must be unique.`);
      return;
    }

    const uniqueName = generateUniqueName(requestedName);

    // Create a new field with a UUID
    const newField: FormField = {
      id: crypto.randomUUID(),
      name: uniqueName,
      label: label || `Field ${fields.length + 1}`,
      type,
      required,
      order: fields.length,
      options: type === 'select' || type === 'multiselect' ? ['Option 1', 'Option 2'] : undefined,
      placeholder: placeholder || '',
      useUserProfile,
      userProfileField: useUserProfile && type === 'email' ? 'email' : undefined
    };

    onFieldsChange([...fields, newField]);
  };

  const handleFieldUpdate = (id: string, updates: Partial<FormField>) => {
    const updatedFields = fields.map(field =>
      field.id === id ? { ...field, ...updates } : field
    );

    onFieldsChange(updatedFields);
  };

  const handleFieldDelete = (id: string) => {
    const updatedFields = fields.filter(field => field.id !== id)
      .map((field, index) => ({ ...field, order: index }));

    onFieldsChange(updatedFields);
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h3 className="text-base font-medium text-gray-800">Form Fields</h3>

        {fields.length === 0 ? (
          <div className="p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-center">
            <p className="text-gray-500">No fields added yet. Add your first field below.</p>
          </div>
        ) : (
          <>
            {getDuplicateNames(fields).length > 0 && (
              <div className="mb-4 p-3 border border-red-200 bg-red-50 text-red-700 rounded">
                <strong className="font-medium">Duplicate field names detected:</strong>
                <div className="mt-1 text-sm">
                  {getDuplicateNames(fields).map(name => (
                    <span key={name} className="inline-block mr-2 px-2 py-1 bg-red-100 rounded">{name}</span>
                  ))}
                  <div className="mt-2">Please give each field a unique <code>Field Name</code> before creating the event.</div>
                </div>
              </div>
            )}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={fields.map(field => field.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {fields.map((field) => (
                    <SortableField
                      key={field.id}
                      field={field}
                      nameError={getDuplicateNames(fields).includes((field.name || '').trim()) || !(field.name || '').trim() ? (!(field.name || '').trim() ? 'Field name is required' : 'Field name must be unique') : undefined}
                      onUpdate={(updates) => handleFieldUpdate(field.id, updates)}
                      onDelete={() => handleFieldDelete(field.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-base font-medium text-gray-800">Suggested Fields</h3>
        {addFieldError && (
          <div className="mt-2 mb-3 text-sm text-red-600 bg-red-50 border border-red-100 p-2 rounded">
            {addFieldError}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <FieldTypeItem
            type="text"
            label="Full Name"
            fieldLabel="Full Name"
            fieldName="fullName"
            placeholder="Enter your full name"
            onSelect={handleAddField}
          />
          <FieldTypeItem
            type="email"
            label="Email Address (Auto)"
            fieldLabel="Email Address"
            fieldName="email"
            placeholder="Enter your email address"
            useUserProfile={true}
            onSelect={handleAddField}
          />
          <FieldTypeItem
            type="number"
            label="Phone Number"
            fieldLabel="Phone Number"
            fieldName="phoneNumber"
            placeholder="Enter your 10-digit phone number"
            onSelect={(type) => {
              // Prevent duplicates
              if (fields.some(f => (f.name || '').trim() === 'phoneNumber')) {
                setAddFieldError('A field with the name "phoneNumber" already exists.');
                return;
              }

              const newField: FormField = {
                id: crypto.randomUUID(),
                name: 'phoneNumber',
                label: 'Phone Number',
                type: 'number',
                required: true,
                order: fields.length,
                placeholder: 'Enter your 10-digit phone number',
                validation: {
                  pattern: '^[0-9]{10}$',
                  message: 'Must be exactly 10 digits'
                }
              };
              onFieldsChange([...fields, newField]);
            }}
          />
          <FieldTypeItem
            type="text"
            label="College/University"
            fieldLabel="College/University"
            fieldName="institution"
            placeholder="Enter your institution name"
            onSelect={handleAddField}
          />
          <FieldTypeItem
            type="select"
            label="Year of Study"
            fieldLabel="Year of Study"
            fieldName="yearOfStudy"
            onSelect={(type) => handleAddField(type, "Year of Study", "yearOfStudy", true, "Select your year of study")}
          />
          <FieldTypeItem
            type="text"
            label="USN/Roll Number"
            fieldLabel="USN/Roll Number"
            fieldName="usn"
            placeholder="Enter your USN or Roll Number"
            onSelect={handleAddField}
          />
          <FieldTypeItem
            type="text"
            label="Google Drive Link"
            fieldLabel="Google Drive Link (Public)"
            fieldName="driveLink"
            placeholder="https://drive.google.com/file/d/..."
            onSelect={() => {
              if (fields.some(f => (f.name || '').trim() === 'driveLink')) {
                setAddFieldError('A field with the name "driveLink" already exists.');
                return;
              }

              const newField: FormField = {
                id: crypto.randomUUID(),
                name: 'driveLink',
                label: 'Google Drive Link (Make sure it\'s public)',
                type: 'text',
                required: false,
                order: fields.length,
                placeholder: 'https://drive.google.com/file/d/...',
                validation: {
                  pattern: 'https?:\\/\\/drive\\.google\\.com\\/file\\/d\\/[a-zA-Z0-9_-]+\\/view',
                  message: 'Must be a valid Google Drive link (e.g., https://drive.google.com/file/d/abc123/view). Make sure the file is set to public access.'
                }
              };
              onFieldsChange([...fields, newField]);
            }}
          />
        </div>

        <h3 className="text-base font-medium text-gray-800 pt-4 mt-2">Add Custom Field</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {fieldTypes.map((fieldType) => (
            <FieldTypeItem
              key={fieldType.type}
              type={fieldType.type as FieldType}
              label={fieldType.label}
              onSelect={handleAddField}
            />
          ))}
        </div>
      </div>
    </div>
  );
};