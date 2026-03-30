import React from 'react';
import { cn } from '@/lib/utils';

interface TimeInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type' | 'maxLength' | 'placeholder'> {
    value: string;
    onChange: (value: string) => void;
}

export function TimeInput({ value, onChange, className, ...props }: TimeInputProps) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, ''); // Remove non-digits

        // Auto-format as HH:MM
        if (val.length >= 3) {
            val = val.slice(0, 2) + ':' + val.slice(2, 4);
        }

        onChange(val);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        let val = value;
        if (val && val.length > 0) {
            const parts = val.split(':');
            let hours = parts[0] ? parseInt(parts[0], 10) : 0;
            let mins = parts[1] ? parseInt(parts[1], 10) : 0;

            let changed = false;
            if (isNaN(hours)) { hours = 0; changed = true; }
            if (isNaN(mins)) { mins = 0; changed = true; }
            if (hours > 23) { hours = 23; changed = true; }
            if (hours < 0) { hours = 0; changed = true; }
            if (mins > 59) { mins = 59; changed = true; }
            if (mins < 0) { mins = 0; changed = true; }

            if (changed || val.length !== 5) {
                const newVal = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
                onChange(newVal);
            }
        }

        if (props.onBlur) {
            props.onBlur(e);
        }
    };

    return (
        <input
            type="text"
            inputMode="numeric"
            placeholder="00:00"
            maxLength={5}
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            className={cn(className)}
            {...props}
        />
    );
}
