'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    onValueChange?: (value: number) => void;
    defaultValue?: number | string;
}

export function CurrencyInput({ className, onValueChange, defaultValue, name, ...props }: CurrencyInputProps) {
    const [displayValue, setDisplayValue] = useState('');
    const previousDefaultRef = React.useRef<number | string | null>(null);

    // Format initial value
    useEffect(() => {
        if (defaultValue !== undefined && defaultValue !== null) {
            const numericVal = Number(defaultValue);
            if (!isNaN(numericVal)) {
                // Check if defaultValue actually changed (including same numeric value from different source)
                if (previousDefaultRef.current !== defaultValue) {
                    previousDefaultRef.current = defaultValue;
                    const formatted = numericVal.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    });
                    setDisplayValue(formatted);
                }
            }
        }
    }, [defaultValue]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value;
        value = value.replace(/\D/g, ''); // keep only digits

        if (!value) {
            setDisplayValue('');
            if (onValueChange) onValueChange(0);
            return;
        }

        const numericValue = Number(value) / 100;

        if (onValueChange) {
            onValueChange(numericValue);
        }

        const formatted = numericValue.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

        setDisplayValue(formatted);
    };

    const getNumericValue = () => {
        if (!displayValue) return 0;
        return Number(displayValue.replace(/\./g, '').replace(',', '.'));
    };

    return (
        <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium text-sm">R$</span>
            <input
                type="text"
                inputMode="numeric"
                value={displayValue}
                onChange={handleChange}
                className={cn(className, "pl-9 sm:pl-10")}
                placeholder="0,00"
                {...props}
            />
            {name && (
                <input type="hidden" name={name} value={getNumericValue()} />
            )}
        </div>
    );
}
