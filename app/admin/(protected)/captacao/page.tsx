import CaptacaoClient from './captacao-client';

export const metadata = {
    title: 'Captação de Leads | ZapFlash Admin',
    description: 'Encontre lojas de delivery ativas por cidade e tipo de comida e jogue direto no funil de remarketing.',
};

export default function CaptacaoPage() {
    return <CaptacaoClient />;
}
