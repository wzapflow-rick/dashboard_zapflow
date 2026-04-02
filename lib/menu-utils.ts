import {
  upsertProduct,
  upsertCategory,
  uploadImageAction,
  type Category
} from '@/app/actions/products';
import { updateGruposDoProduto } from '@/app/actions/complements';
import { updateGruposDoProduto as updateGruposSlotsDoProduto } from '@/app/actions/grupos-slots';
import { toast } from 'sonner';

interface ProductData {
  id?: number | string;
  nome: string;
  categorias: number;
  preco: number;
  descricao: string;
  disponivel: boolean;
  imagem: string;
}

export async function saveProduct(
  formData: FormData,
  editingProduct: any,
  isCreatingCategory: boolean,
  selectedInsumos?: { insumo_id: string | number; quantidade_necessaria: number }[],
  selectedGrupos?: number[],
  selectedSlots?: string[]
) {
  let finalCategoryId = Number(formData.get('categoria_id'));

  if (isCreatingCategory) {
    const novaCategoriaNome = formData.get('novaCategoria') as string;
    const novaCat = await upsertCategory({ nome: novaCategoriaNome });
    finalCategoryId = novaCat.id;
  }

  // Upload image if provided
  let imagemUrl = editingProduct?.imagem || 'https://picsum.photos/seed/food/200/200';
  const file = formData.get('imagem_file') as File;
  if (file && file.size > 0) {
    const uploadFormData = new FormData();
    uploadFormData.append('image', file);
    try {
      const uploadedUrl = await uploadImageAction(uploadFormData);
      if (uploadedUrl) {
        imagemUrl = uploadedUrl;
      }
    } catch (uploadError) {
      console.error('Upload Error:', uploadError);
      toast.error('Ocorreu um erro ao fazer upload da imagem.');
    }
  }

  const productData: ProductData = {
    id: editingProduct?.id,
    nome: formData.get('nome') as string,
    categorias: finalCategoryId,
    preco: parseFloat(formData.get('preco') as string),
    descricao: formData.get('descricao') as string,
    disponivel: editingProduct ? editingProduct.disponivel : true,
    imagem: imagemUrl
  };

  const savedProduct = await upsertProduct(productData, selectedInsumos);

  if (selectedGrupos) {
    await updateGruposDoProduto(savedProduct.id, selectedGrupos);
  }

  if (selectedSlots) {
    await updateGruposSlotsDoProduto(Number(savedProduct.id), selectedSlots.map(s => Number(s)));
  }

  return savedProduct;
}
