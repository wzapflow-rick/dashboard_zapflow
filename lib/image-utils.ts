/**
 * Utilitários para processamento de imagens no cliente
 * Redimensiona, otimiza e converte imagens para garantir compatibilidade
 */

export interface ImageProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'webp' | 'png';
}

const DEFAULT_OPTIONS: ImageProcessingOptions = {
  maxWidth: 512,
  maxHeight: 512,
  quality: 0.85,
  format: 'jpeg',
};

/**
 * Redimensiona e otimiza uma imagem
 * @param file - Arquivo de imagem
 * @param options - Opções de processamento
 * @returns Promise com o arquivo processado
 */
export async function processImage(
  file: File,
  options: ImageProcessingOptions = {}
): Promise<File> {
  const finalOptions = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        try {
          // Calcular novas dimensões mantendo proporção
          let { width, height } = img;
          const maxW = finalOptions.maxWidth || 512;
          const maxH = finalOptions.maxHeight || 512;

          if (width > maxW || height > maxH) {
            const ratio = Math.min(maxW / width, maxH / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          // Criar canvas e desenhar imagem redimensionada
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Não foi possível obter contexto do canvas'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Converter para blob com qualidade otimizada
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Não foi possível converter imagem'));
                return;
              }

              // Criar novo arquivo com a imagem processada
              const mimeType =
                finalOptions.format === 'webp'
                  ? 'image/webp'
                  : finalOptions.format === 'png'
                    ? 'image/png'
                    : 'image/jpeg';

              const processedFile = new File([blob], file.name, {
                type: mimeType,
                lastModified: Date.now(),
              });

              resolve(processedFile);
            },
            finalOptions.format === 'webp' ? 'image/webp' : finalOptions.format === 'png' ? 'image/png' : 'image/jpeg',
            finalOptions.quality
          );
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Não foi possível carregar a imagem'));
      };

      // Definir src da imagem a partir do FileReader
      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Valida se um arquivo é uma imagem válida
 * @param file - Arquivo a validar
 * @returns boolean
 */
export function isValidImageFile(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!validTypes.includes(file.type)) {
    return false;
  }

  if (file.size > maxSize) {
    return false;
  }

  return true;
}

/**
 * Formata tamanho de arquivo para exibição
 * @param bytes - Tamanho em bytes
 * @returns String formatada
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Gera preview de imagem a partir de um arquivo
 * @param file - Arquivo de imagem
 * @returns Promise com URL de preview
 */
export function generateImagePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      resolve(e.target?.result as string);
    };

    reader.onerror = () => {
      reject(new Error('Erro ao gerar preview'));
    };

    reader.readAsDataURL(file);
  });
}
