import React from 'react';

interface FooterProps {
    light?: boolean;
}

export const Footer: React.FC<FooterProps> = ({ light = false }) => {
    return (
        <footer className={`py-6 text-center ${light ? 'text-white/40' : 'text-gray-400'}`}>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-1.5 overflow-hidden">
                <span className="opacity-70">Created by</span>
                <a
                    href="https://loyalink.id"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`transition-all duration-300 hover:scale-110 active:scale-95 px-1 py-0.5 rounded ${light
                            ? 'text-white hover:text-white underline decoration-white/30 underline-offset-4'
                            : 'text-brand-600 hover:text-brand-700 underline decoration-brand-500/30 underline-offset-4'
                        }`}
                >
                    loyalink.id
                </a>
            </p>
        </footer>
    );
};
