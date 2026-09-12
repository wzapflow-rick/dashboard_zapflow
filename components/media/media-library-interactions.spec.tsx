import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MediaAssetCard } from './media-asset-card';
import { MediaUploader } from './media-uploader';
import type { MediaAsset } from '@/lib/media-library';

const mockProcessImage = jest.fn();
const mockFetch = jest.fn();

type Listener = (event?: Partial<ProgressEvent>) => void;

class MockXMLHttpRequest {
  static instances: MockXMLHttpRequest[] = [];
  status = 0;
  response: unknown = null;
  responseText = '';
  responseType = '';
  private listeners: Record<string, Listener[]> = {};
  private uploadListeners: Record<string, Listener[]> = {};
  upload = {
    addEventListener: (event: string, listener: Listener) => {
      this.uploadListeners[event] = [...(this.uploadListeners[event] ?? []), listener];
    },
  };

  constructor() {
    MockXMLHttpRequest.instances.push(this);
  }

  open = jest.fn();
  send = jest.fn();

  addEventListener(event: string, listener: Listener) {
    this.listeners[event] = [...(this.listeners[event] ?? []), listener];
  }

  abort() {
    this.listeners.abort?.forEach((listener) => listener());
  }

  succeed(resourceType: 'image' | 'video' = 'image') {
    this.uploadListeners.progress?.forEach((listener) => listener({
      lengthComputable: true,
      loaded: 100,
      total: 100,
    }));
    this.status = 200;
    this.response = {
      public_id: `zapflow_media/company/test-upload-id`,
      resource_type: resourceType,
      signature: 'cloudinary-signature',
      version: 123,
    };
    this.listeners.load?.forEach((listener) => listener());
  }

  fail() {
    this.status = 503;
    this.response = { error: { message: 'Rede indisponível' } };
    this.listeners.load?.forEach((listener) => listener());
  }
}

jest.mock('@/lib/image-utils', () => ({
  processImage: (...args: unknown[]) => mockProcessImage(...args),
  formatFileSize: () => '2 KB',
}));
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ fill: _fill, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt ?? ''} />;
  },
}));
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const imageAsset: MediaAsset = {
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

const videoAsset: MediaAsset = {
  ...imageAsset,
  id: 13,
  name: 'Burger em movimento.mp4',
  url: 'https://res.cloudinary.com/demo/video/upload/burger.mp4',
  mimeType: 'video/mp4',
};

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: jest.fn().mockResolvedValue(body) } as unknown as Response;
}

function installFetch(finalAsset: MediaAsset = imageAsset) {
  mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/sign')) {
      return jsonResponse({
        uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
        resourceType: finalAsset.mimeType === 'video/mp4' ? 'video' : 'image',
        fields: { api_key: 'public-key', signature: 'signed', timestamp: '123' },
      });
    }
    if (url.endsWith('/finalize')) return jsonResponse({ asset: finalAsset, created: true });
    throw new Error(`Unexpected request: ${url}`);
  });
}

describe('media library interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockXMLHttpRequest.instances = [];
    mockProcessImage.mockImplementation(async (file: File) => file);
    installFetch();
    Object.defineProperty(window, 'XMLHttpRequest', {
      configurable: true,
      value: MockXMLHttpRequest,
    });
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: mockFetch,
    });
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: jest.fn().mockReturnValue('test-upload-id'),
    });
  });

  it('disables uploads while setup is pending', () => {
    render(<MediaUploader remainingSlots={10} onUploaded={jest.fn()} disabled />);

    expect(screen.getByLabelText(/acervo aguardando configuração/i)).toBeDisabled();
    expect(screen.getByText('Envio indisponível')).toBeInTheDocument();
  });

  it('uses signed direct upload progress and finalizes a valid image', async () => {
    const onUploaded = jest.fn();
    const user = userEvent.setup();

    render(<MediaUploader remainingSlots={10} onUploaded={onUploaded} />);
    const input = screen.getByLabelText(/arraste as imagens/i) as HTMLInputElement;
    await user.upload(input, new File(['image'], 'burger.jpg', { type: 'image/jpeg' }));

    expect(await screen.findByText('Enviando')).toBeInTheDocument();
    await waitFor(() => expect(MockXMLHttpRequest.instances).toHaveLength(1));
    act(() => MockXMLHttpRequest.instances[0].succeed());

    expect(await screen.findByText('Concluído')).toBeInTheDocument();
    expect(onUploaded).toHaveBeenCalledWith(imageAsset);
    expect(mockFetch).toHaveBeenCalledWith('/api/media-library/upload/sign', expect.any(Object));
    expect(mockFetch).toHaveBeenCalledWith('/api/media-library/upload/finalize', expect.any(Object));
  });

  it('accepts MP4 without running image optimization', async () => {
    installFetch(videoAsset);
    const onUploaded = jest.fn();
    const user = userEvent.setup();

    render(<MediaUploader remainingSlots={10} onUploaded={onUploaded} />);
    const input = screen.getByLabelText(/arraste as imagens/i) as HTMLInputElement;
    await user.upload(input, new File(['video'], 'burger.mp4', { type: 'video/mp4' }));

    await waitFor(() => expect(MockXMLHttpRequest.instances).toHaveLength(1));
    act(() => MockXMLHttpRequest.instances[0].succeed('video'));

    expect(await screen.findByText('Concluído')).toBeInTheDocument();
    expect(mockProcessImage).not.toHaveBeenCalled();
    expect(onUploaded).toHaveBeenCalledWith(videoAsset);
  });

  it('offers retry after a failed direct upload', async () => {
    const user = userEvent.setup();

    render(<MediaUploader remainingSlots={10} onUploaded={jest.fn()} />);
    const input = screen.getByLabelText(/arraste as imagens/i) as HTMLInputElement;
    await user.upload(input, new File(['image'], 'burger.jpg', { type: 'image/jpeg' }));

    await waitFor(() => expect(MockXMLHttpRequest.instances).toHaveLength(1));
    act(() => MockXMLHttpRequest.instances[0].fail());
    expect(await screen.findByText('Falhou')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    await waitFor(() => expect(MockXMLHttpRequest.instances).toHaveLength(2));
    act(() => MockXMLHttpRequest.instances[1].succeed());
    expect(await screen.findByText('Concluído')).toBeInTheDocument();
  });

  it('requires confirmation before permanent deletion', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn().mockResolvedValue(undefined);
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);

    render(
      <MediaAssetCard
        asset={imageAsset}
        onRename={jest.fn().mockResolvedValue(undefined)}
        onCategoryChange={jest.fn().mockResolvedValue(undefined)}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByLabelText(/ações de burger principal/i));
    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByLabelText(/ações de burger principal/i));
    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(12));

    confirmSpy.mockRestore();
  });
});
