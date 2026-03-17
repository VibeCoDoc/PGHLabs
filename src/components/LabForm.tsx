import React, { useState, useEffect, useRef } from 'react';
import { LabRequest, MaterialDetail, Reminder } from '../types';
import { RENDER_FIELDS, NUCMED_SCHEDULE, MRL_TB_TESTS, DAY_ABBREVIATIONS, CUP_SPECIMENS } from '../constants';

interface LabFormProps {
  form: LabRequest;
  onUpdate: (updatedForm: LabRequest) => void;
}

const LabForm: React.FC<LabFormProps> = ({ form, onUpdate }) => {
  const [fontSizes, setFontSizes] = useState<Record<string, number>>({});
  const [setter, setSetter] = useState<{ visible: boolean; x: number; y: number; field: string; baseSize: number } | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const cleanAgeSex = (ageSexString: string) => {
    if (!ageSexString) return { age: '', sex: '' };
    let cleaned = ageSexString.toLowerCase().replace(/years old/g, '').trim();

    if (cleaned.includes('/')) {
      let parts = cleaned.split('/');
      return { age: parts[0].trim(), sex: parts[1].trim().toUpperCase() };
    } else if (cleaned.includes(',')) {
      let parts = cleaned.split(',');
      return { age: parts[0].trim(), sex: parts[1].trim().toUpperCase() };
    } else {
      let parts = cleaned.split(' ');
      let sex = parts.pop()?.toUpperCase() || '';
      let age = parts.join(' ');
      return { age: age.trim(), sex: sex };
    }
  };

  const ageSexData = cleanAgeSex(form.age_sex);

  const handleDoubleClick = (e: React.MouseEvent, fieldClass: string, defaultSize: number) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setSetter({
      visible: true,
      x: rect.right + 10,
      y: rect.top,
      field: fieldClass,
      baseSize: fontSizes[fieldClass] || defaultSize
    });
  };

  const applyFontSize = (size: number) => {
    if (setter) {
      setFontSizes(prev => ({ ...prev, [setter.field]: size }));
      setSetter(null);
    }
  };

  const shrinkToFit = (text: string, width: number, height: number, baseSize: number, isMultiLine: boolean) => {
    // This is a simplified version for React rendering. 
    // In a real app, we might use a hidden canvas or div to measure.
    // For now, we'll return the baseSize and rely on CSS for basic overflow.
    return baseSize;
  };

  return (
    <div className="form-container" ref={formRef}>
      <div className="form-preview lrf-coords">
        {RENDER_FIELDS.map((field, idx) => {
          if (!field.key) return null;
          
          const value = field.key === 'name' ? (form.name || '').toUpperCase() : (form as any)[field.key] || '';
          const baseSize = fontSizes[field.class] || field.defaultFontSize || 16;
          
          if (field.element === 'textarea') {
            return (
              <textarea
                key={idx}
                className={`overlay-field ${field.class}`}
                style={{ fontSize: `${baseSize}px` }}
                value={value}
                onChange={(e) => onUpdate({ ...form, [field.key!]: e.target.value })}
                onDoubleClick={(e) => handleDoubleClick(e, field.class, field.defaultFontSize || 16)}
                title={field.title}
              />
            );
          }
          return (
            <input
              key={idx}
              type="text"
              className={`overlay-field ${field.class}`}
              style={{ fontSize: `${baseSize}px` }}
              value={value}
              onChange={(e) => onUpdate({ ...form, [field.key!]: e.target.value })}
              onDoubleClick={(e) => handleDoubleClick(e, field.class, field.defaultFontSize || 16)}
              title={field.title}
            />
          );
        })}

        {/* Special Fields */}
        <input
          type="text"
          className="overlay-field age-sex-age"
          style={{ fontSize: `${fontSizes['age-sex-age'] || 16}px` }}
          value={ageSexData.age}
          onChange={(e) => onUpdate({ ...form, age_sex: `${e.target.value}/${ageSexData.sex}` })}
          onDoubleClick={(e) => handleDoubleClick(e, 'age-sex-age', 16)}
          title="AGE"
        />
        <input
          type="text"
          className="overlay-field age-sex-sex"
          style={{ fontSize: `${fontSizes['age-sex-sex'] || 16}px` }}
          value={ageSexData.sex}
          onChange={(e) => onUpdate({ ...form, age_sex: `${ageSexData.age}/${e.target.value}` })}
          onDoubleClick={(e) => handleDoubleClick(e, 'age-sex-sex', 16)}
          title="SEX"
        />
        <textarea
          className="overlay-field requests-field"
          style={{ fontSize: `${fontSizes['requests-field'] || 16}px` }}
          value={form.requests_list}
          onChange={(e) => onUpdate({ ...form, requests_list: e.target.value })}
          onDoubleClick={(e) => handleDoubleClick(e, 'requests-field', 16)}
          title="LAB EXAM"
        />
      </div>

      {setter && setter.visible && (
        <div 
          className="font-setter-container"
          style={{ left: setter.x, top: setter.y }}
        >
          <span>Size:</span>
          <input
            type="number"
            className="font-setter-input"
            defaultValue={setter.baseSize}
            min={10}
            max={30}
            autoFocus
            onBlur={(e) => applyFontSize(parseInt(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyFontSize(parseInt((e.target as HTMLInputElement).value));
            }}
          />
        </div>
      )}
    </div>
  );
};

export default LabForm;
