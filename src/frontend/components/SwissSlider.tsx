import React, { useState, useEffect } from 'react';

interface SwissSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  onCommit?: () => void;
  showPlusSign?: boolean;
  labelStyle?: React.CSSProperties;
}

export const SwissSlider: React.FC<SwissSliderProps> = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
  showPlusSign = false,
  labelStyle,
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const formatValue = (val: number): string => {
    const formatted = val.toFixed(step === 1 ? 0 : 2);
    if (showPlusSign && val > 0) {
      return `+${formatted}`;
    }
    return formatted;
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = parseFloat(e.target.value);
    if (!isNaN(nextVal)) {
      setLocalValue(nextVal);
      onChange(nextVal);
    }
  };

  const startEditing = () => {
    setInputValue(value.toFixed(step === 1 ? 0 : 2));
    setIsEditing(true);
  };

  const commitText = () => {
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      setLocalValue(clamped);
      onChange(clamped);
      onCommit?.();
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitText();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  return (
    <div className="slider-group">
      <div className="slider-header">
        <span className="slider-name" style={labelStyle}>
          {label}
        </span>
        {isEditing ? (
          <input
            type="number"
            className="slider-value-input"
            value={inputValue}
            step={step}
            min={min}
            max={max}
            onChange={e => setInputValue(e.target.value)}
            onBlur={commitText}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        ) : (
          <span className="slider-value" onClick={startEditing}>
            {formatValue(localValue)}
          </span>
        )}
      </div>
      <div className="slider-track-wrapper">
        <input
          type="range"
          className="slider-input"
          min={min}
          max={max}
          step={step}
          value={localValue}
          onChange={handleSliderChange}
          onMouseUp={onCommit}
          onTouchEnd={onCommit}
        />
      </div>
    </div>
  );
};
export default SwissSlider;
