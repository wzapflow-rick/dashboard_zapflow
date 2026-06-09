import DemoCardapioClient from './demo-client';

export const metadata = {
    title: 'Demo de Cardápio | ZapFlow Admin',
    description: 'Monte um cardápio-demo para um prospect e gere o link pronto para enviar no WhatsApp.',
};

export default function DemoCardapioPage() {
    return <DemoCardapioClient />;
}
