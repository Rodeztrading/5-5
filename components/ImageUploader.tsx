import React, { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';

interface ImageUploaderProps {
  onImageUpload: (base64: string, mimeType: string) => void;
  label?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload, label = "Pegar o Cargar Gráfico" }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Ctrl+V Paste
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) processFile(file);
          break;
        }
      }
    };

    // Only listen if we are focused on the window or specific area, 
    // but for simplicity in this modal we listen globally when component mounts
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const resultString = reader.result as string;
      const base64String = resultString.split(',')[1];
      if (base64String) {
        setPreview(resultString);
        onImageUpload(base64String, file.type);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div
      className={`w-full h-48 rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center cursor-pointer overflow-hidden group
        ${preview ? 'border-rodez-red/50 bg-gray-900' : 'border-gray-700 bg-gray-800/50 hover:bg-gray-800 hover:border-rodez-red'}
      `}
      onClick={() => fileInputRef.current?.click()}
    >
      {preview ? (
        <div className="relative w-full h-full">
          <img src={preview} alt="Preview" className="w-full h-full object-contain" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-white font-medium">Cambiar Imagen</span>
          </div>
        </div>
      ) : (
        <div className="text-center p-6 text-gray-500 group-hover:text-rodez-red transition-colors">
          <Upload className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="font-bold text-sm uppercase tracking-wider">{label}</p>
          <p className="text-xs mt-2 opacity-60">Clic o Ctrl+V para pegar</p>
        </div>
      )}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
      />
    </div>
  );
};