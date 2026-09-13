import {
  upsertCategory,
  upsertProduct,
} from '@/app/actions/products';
import { parseCurrency } from '@/lib/utils';

export async function saveProduct(
  formData: FormData,
  editingProduct: any,
  isCreatingCategory: boolean,
  selectedInsumos?: { insumo_id: string | number; quantidade_necessaria: number }[],
) {
  let finalCategoryId: string | number = formData.get('categoria_id') as string;

  if (isCreatingCategory || finalCategoryId === 'new_category') {
    const newCategoryName = formData.get('new_category_name') as string;
    if (!newCategoryName || newCategoryName.trim() === '') {
      throw new Error('Nome da nova categoria e obrigatorio');
    }
    const newCategory = await upsertCategory({ nome: newCategoryName });
    finalCategoryId = newCategory.id;
  } else {
    const numericCategoryId = Number(finalCategoryId);
    if (!Number.isNaN(numericCategoryId) && finalCategoryId.toString().trim() !== '') {
      finalCategoryId = numericCategoryId;
    }
  }

  let price = parseCurrency(formData.get('preco') as string);
  if (!Number.isFinite(price) || price < 0) price = 0;

  const selectedImage = formData.get('imagem');
  const imageUrl = typeof selectedImage === 'string'
    ? selectedImage
    : String(editingProduct?.imagem || '');
  const tagValue = formData.get('tag') as string;

  return upsertProduct({
    id: editingProduct?.id,
    nome: formData.get('nome') as string,
    categorias: finalCategoryId,
    categoria_id: finalCategoryId,
    preco: price,
    descricao: formData.get('descricao') as string,
    disponivel: editingProduct ? editingProduct.disponivel : true,
    imagem: imageUrl,
    tamanhos: formData.get('tamanhos') ? String(formData.get('tamanhos')) : null,
    recomendacoes: formData.get('recomendacoes') ? String(formData.get('recomendacoes')) : null,
    tag: tagValue || null,
  }, selectedInsumos);
}
