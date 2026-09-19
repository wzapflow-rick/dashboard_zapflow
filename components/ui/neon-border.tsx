'use client';

import React from 'react';

type NeonBorderProps = {
    children: React.ReactNode;
    className?: string;
    /** Cor principal do neon (padrão âmbar/gold da identidade). */
    color?: string;
    /** Cor secundária do gradiente do arco luminoso. */
    accent?: string;
    /** Espessura visível da borda, em px. */
    thickness?: number;
    /** Raio interno do conteúdo, em px. */
    radius?: number;
    /** Tamanho do arco luminoso, em graus (comprimento do "cometa"). */
    arc?: number;
    /** Duração de uma volta completa, em segundos (menor = mais rápido). */
    speed?: number;
};

/**
 * Envolve um elemento com uma borda de neon animada.
 * O movimento fica apenas na borda externa (via conic-gradient girando com
 * @property --neon-angle) — o conteúdo interno permanece totalmente estável.
 * A animação é puramente CSS: roda no compositor e é descartada automaticamente
 * quando o componente é desmontado.
 */
export function NeonBorder({
    children,
    className = '',
    color = '#CC9149',
    accent = '#F5A524',
    thickness = 5,
    radius = 13,
    arc = 46,
    speed = 4.5,
}: NeonBorderProps) {
    const outerRadius = radius + thickness;

    const style = {
        '--neon-color': color,
        '--neon-accent': accent,
        '--neon-thickness': `${thickness}px`,
        '--neon-radius': `${radius}px`,
        '--neon-outer-radius': `${outerRadius}px`,
        '--neon-arc': `${arc}deg`,
        '--neon-speed': `${speed}s`,
    } as React.CSSProperties;

    return (
        <div className={`neon-border ${className}`} style={style}>
            <span aria-hidden="true" className="neon-border__glow" />
            <span aria-hidden="true" className="neon-border__ring" />
            <div className="neon-border__content">{children}</div>

            <style jsx global>{`
                @property --neon-angle {
                    syntax: '<angle>';
                    initial-value: 0deg;
                    inherits: false;
                }

                .neon-border {
                    position: relative;
                    display: block;
                    width: 100%;
                    border-radius: var(--neon-outer-radius);
                    isolation: isolate;
                }

                .neon-border__ring,
                .neon-border__glow {
                    position: absolute;
                    inset: calc(var(--neon-thickness) * -1);
                    border-radius: var(--neon-outer-radius);
                    z-index: -1;
                    background: conic-gradient(
                        from var(--neon-angle),
                        transparent 0deg,
                        var(--neon-color) var(--neon-arc),
                        var(--neon-accent) calc(var(--neon-arc) * 1.55),
                        transparent calc(var(--neon-arc) * 2.6),
                        transparent 360deg
                    );
                    animation: neon-border-spin var(--neon-speed) linear infinite;
                    pointer-events: none;
                }

                .neon-border__glow {
                    filter: blur(9px);
                    opacity: 0.7;
                    transition: opacity 0.25s ease;
                }

                .neon-border:hover .neon-border__glow {
                    opacity: 1;
                }

                .neon-border__content {
                    position: relative;
                    z-index: 0;
                    border-radius: var(--neon-radius);
                    overflow: hidden;
                }

                @keyframes neon-border-spin {
                    to {
                        --neon-angle: 360deg;
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    .neon-border__ring,
                    .neon-border__glow {
                        animation: none;
                    }
                }
            `}</style>
        </div>
    );
}
