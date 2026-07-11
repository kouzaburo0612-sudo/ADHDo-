/**
 * バーコード → 栄養成分の検索 (Open Food Facts API)
 * 100gあたりの成分を返し、UI側で分量を掛けて記録する。
 * 日本の商品は登録が無いこともある(その場合はNOT_FOUND)。
 */

export interface BarcodeProduct {
  name: string;
  /** 100gあたり */
  kcal100: number;
  protein100: number;
  fat100: number;
  carbs100: number;
  /** 1食分のグラム数(データがあれば) */
  servingG: number | null;
}

export async function lookupBarcode(code: string): Promise<BarcodeProduct> {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_ja,nutriments,serving_quantity`,
    { headers: { 'user-agent': 'VYTA/1.0 (personal health app)' } },
  );
  if (!res.ok) throw new Error('NETWORK');
  const data = await res.json();
  if (data.status !== 1 || !data.product) throw new Error('NOT_FOUND');

  const p = data.product;
  const n = p.nutriments ?? {};
  const kcal100 = Number(n['energy-kcal_100g'] ?? (Number(n.energy_100g ?? 0) / 4.184));
  if (!Number.isFinite(kcal100) || kcal100 <= 0) throw new Error('NO_NUTRITION');

  const servingRaw = Number(p.serving_quantity);
  return {
    name: String(p.product_name_ja || p.product_name || '市販食品'),
    kcal100: Math.round(kcal100),
    protein100: round1(Number(n.proteins_100g) || 0),
    fat100: round1(Number(n.fat_100g) || 0),
    carbs100: round1(Number(n.carbohydrates_100g) || 0),
    servingG: Number.isFinite(servingRaw) && servingRaw > 0 ? servingRaw : null,
  };
}

function round1(x: number): number { return Math.round(x * 10) / 10 }
