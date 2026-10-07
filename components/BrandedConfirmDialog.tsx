import React, { useCallback, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmOptions {
    title: string;
    message: string;
    confirmLabel?: string;
}

interface PendingConfirmation extends ConfirmOptions {
    resolve: (confirmed: boolean) => void;
}

export const useBrandedConfirm = () => {
    const [pending, setPending] = useState<PendingConfirmation | null>(null);
    const pendingRef = useRef<PendingConfirmation | null>(null);

    const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        if (pendingRef.current) return Promise.resolve(false);

        return new Promise(resolve => {
            const request = { ...options, resolve };
            pendingRef.current = request;
            setPending(request);
        });
    }, []);

    const finish = (confirmed: boolean) => {
        const request = pendingRef.current;
        pendingRef.current = null;
        setPending(null);
        request?.resolve(confirmed);
    };

    const dialog = pending ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="presentation" onMouseDown={event => {
            if (event.target === event.currentTarget) finish(false);
        }}>
            <section className="w-full max-w-md overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="branded-confirm-title" aria-describedby="branded-confirm-message">
                <header className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
                    <h2 className="text-sm font-bold text-white">
                        5-5 <span className="text-rodez-red">FINANZAS</span>
                    </h2>
                    <button type="button" onClick={() => finish(false)} className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white" aria-label="Cerrar confirmación">
                        <X className="h-4 w-4" />
                    </button>
                </header>
                <div className="flex gap-3 px-5 py-5">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-400">
                        <AlertTriangle className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                        <h3 id="branded-confirm-title" className="text-base font-semibold text-white">{pending.title}</h3>
                        <p id="branded-confirm-message" className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-300">{pending.message}</p>
                    </div>
                </div>
                <footer className="flex justify-end gap-3 border-t border-gray-800 px-5 py-4">
                    <button type="button" onClick={() => finish(false)} className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700">
                        Cancelar
                    </button>
                    <button type="button" onClick={() => finish(true)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                        {pending.confirmLabel || 'Eliminar'}
                    </button>
                </footer>
            </section>
        </div>
    ) : null;

    return { confirm, dialog };
};
