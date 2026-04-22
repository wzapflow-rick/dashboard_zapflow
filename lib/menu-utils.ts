import {
  upsertProduct,
  upsertCategory,
  uploadImageAction,
  type Category
} from '@/app/actions/products';
import { toast } from 'sonner';
import { parseCurrency } from '@/lib/utils';

interface ProductData {
  id?: number | string;
  nome: string;
  categorias: number | string;
  categoria_id: number | string;
  preco: number;
  descricao: string;
  disponivel: boolean;
  imagem: string;
}

export async function saveProduct(
  formData: FormData,
  editingProduct: any,
  isCreatingCategory: boolean,
  selectedInsumos?: { insumo_id: string | number; quantidade_necessaria: number }[]
) {
  let finalCategoryId: string | number = formData.get('categoria_id') as string;

  if (isCreatingCategory) {
    const novaCategoriaNome = formData.get('new_category_name') as string;
    const novaCat = await upsertCategory({ nome: novaCategoriaNome });
    finalCategoryId = novaCat.id;
  } else {
    // Convert to number if it's completely numeric
    const num = Number(finalCategoryId);
    if (!isNaN(num) && finalCategoryId.toString().trim() !== '') {
      finalCategoryId = num;
    }
  }

  // Parse preco - garantir que é um número válido
  const precoRaw = formData.get('preco');
  let precoNumerico = parseCurrency(precoRaw as string);

  // Se for NaN ou negativo, usar 0
  if (isNaN(precoNumerico) || precoNumerico < 0) {
    precoNumerico = 0;
  }

  // Garantir que é um número finito
  if (!isFinite(precoNumerico)) {
    precoNumerico = 0;
  }

  const productData: any = {
    id: editingProduct?.id,
    nome: formData.get('nome') as string,
    categorias: finalCategoryId,
    categoria_id: finalCategoryId,
    preco: precoNumerico,
    descricao: formData.get('descricao') as string,
    disponivel: editingProduct ? editingProduct.disponivel : true,
    imagem: editingProduct?.imagem || '',
    tamanhos: formData.get('tamanhos') ? String(formData.get('tamanhos')) : null
  };

  // 1. Salva o produto primeiro. Isso garante a validação do DB. 
  // Caso falhe, a imagem não será enviada ao servidor (rollback preventivo).
  let savedProduct = await upsertProduct(productData, selectedInsumos);

  // 2. Com o produto salvo, processa o upload da imagem.
  const file = formData.get('imagem_file') as File;
  if (file && file.size > 0) {
    const uploadFormData = new FormData();
    uploadFormData.append('image', file);
    try {
      const uploadedUrl = await uploadImageAction(uploadFormData);
      if (uploadedUrl) {
        // Se a imagem subiu com sucesso, atualiza o produto com a nova imagem
        savedProduct = await upsertProduct({
          ...productData,
          id: savedProduct.id,
          imagem: uploadedUrl
        });
      }
    } catch (uploadError) {
      console.error('Upload Error:', uploadError);
      toast.error('Produto salvo, mas sem imagem devido a falha no upload.');
    }
  }

  return savedProduct;
}
