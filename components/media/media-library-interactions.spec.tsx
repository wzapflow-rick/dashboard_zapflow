import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MediaAssetCard } from './media-asset-card';
import { MediaUploader } from './media-uploader';
import type { MediaAsset } from '@/lib/media-library';

const mockUploadMediaAsset = jest.fn();
const mockProcessImage = jest.fn();

jest.mock('@/app/actions/media-library', () => ({
  uploadMediaAsset: (...args: unknown[]) => mockUploadMediaAsset(...args),
}));
jest.mock('@/lib/image-utils', () => ({
  processImage: (...args: unknown[]) => mockProcessImage(...args),
  formatFileSize: () => '2 KB',
}));
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ fill: _fill, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => <img {...props} />,
}));
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const asset: MediaAsset = {
  id: 12,
  empresaId: 77,
  name: 'Burger principal.jpg',
  url: 'https://res.cloudinary.com/demo/image/upload/burger.jpg',
  category: 'products',
  mimeType: 'image/jpeg',
  sizeBytes: 2048,
  width: 1000,
  height: 1000,
  createdAt: '2026-09-12T10:00:00.000Z',
  updatedAt: '2026-09-12T10:00:00.000Z',
};

describe('media library interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window, 'createImageBitmap', {
      configurable: true,
      value: jest.fn().mockResolvedValue({ width: 1000, height: 1000, close: jest.fn() }),
    });
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: jest.fn().mockReturnValue('test-upload-id'),
    });
  });

  it('disables uploads while the database migration is pending', () => {
    render(<MediaUploader remainingSlots={10} onUploaded={jest.fn()} disabled />);

    expect(screen.getByLabelText(/acervo aguardando configuração/i)).toBeDisabled();
    expect(screen.getByText('Acervo aguardando configuração')).toBeInTheDocument();
  });

  it('shows upload progress and completes a valid image', async () => {
    let finishUpload: (value: MediaAsset) => void = () => undefined;
    mockProcessImage.mockImplementation(async (file: File) => file);
    mockUploadMediaAsset.mockReturnValue(new Promise<MediaAsset>((resolve) => {
      finishUpload = resolve;
    }));
    const onUploaded = jest.fn();
    const user = userEvent.setup();

    render(<MediaUploader remainingSlots={10} onUploaded={onUploaded} />);
    const input = screen.getByLabelText(/arraste as imagens/i) as HTMLInputElement;
    await user.upload(input, new File(['image'], 'burger.jpg', { type: 'image/jpeg' }));

    expect(await screen.findByText('Enviando')).toBeInTheDocument();
    finishUpload(asset);

    expect(await screen.findByText('Concluído')).toBeInTheDocument();
    expect(onUploaded).toHaveBeenCalledWith(asset);
  });

  it('offers retry after a failed upload', async () => {
    mockProcessImage.mockImplementation(async (file: File) => file);
    mockUploadMediaAsset.mockRejectedValueOnce(new Error('Rede indisponível')).mockResolvedValueOnce(asset);
    const user = userEvent.setup();

    render(<MediaUploader remainingSlots={10} onUploaded={jest.fn()} />);
    const input = screen.getByLabelText(/arraste as imagens/i) as HTMLInputElement;
    await user.upload(input, new File(['image'], 'burger.jpg', { type: 'image/jpeg' }));

    expect(await screen.findByText('Falhou')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(await screen.findByText('Concluído')).toBeInTheDocument();
  });

  it('requires confirmation before permanent deletion', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn().mockResolvedValue(undefined);
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);

    render(
      <MediaAssetCard
        asset={asset}
        onRename={jest.fn().mockResolvedValue(undefined)}
        onCategoryChange={jest.fn().mockResolvedValue(undefined)}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByLabelText(/ações de burger principal/i));
    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(12));

    confirmSpy.mockRestore();
  });
});
